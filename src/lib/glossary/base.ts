import crypto from "node:crypto";
import { db, schema } from "@/lib/db/client";
import { LED_BASE_GLOSSARY } from "./seed";
import { eq, and } from "drizzle-orm";

/**
 * Insère le glossaire LED de base en mode idempotent :
 * - si un terme (fr) existe déjà en source='base', on ne l'écrase pas
 * - permet à Adil d'éditer/corriger sans être écrasé au reboot
 */
export function ensureBaseGlossary(): { inserted: number; skipped: number } {
  let inserted = 0;
  let skipped = 0;

  for (const term of LED_BASE_GLOSSARY) {
    const existing = db
      .select({ id: schema.glossaryTerms.id })
      .from(schema.glossaryTerms)
      .where(
        and(
          eq(schema.glossaryTerms.termFr, term.fr),
          eq(schema.glossaryTerms.source, "base"),
        ),
      )
      .all();

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    db.insert(schema.glossaryTerms)
      .values({
        id: crypto.randomUUID(),
        termFr: term.fr,
        termZh: term.zh,
        source: "base",
        validated: true,
        notes: term.category,
      })
      .run();
    inserted++;
  }

  return { inserted, skipped };
}
