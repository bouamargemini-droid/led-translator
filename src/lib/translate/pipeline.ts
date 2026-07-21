import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { translateBatch, type SegmentIn } from "./translate";
import type { GlossaryEntry } from "./prompt";

const BATCH_SIZE = 10;
const CONCURRENCY = 3;

/**
 * Traduit tous les segments FR d'un lot :
 * 1. Snapshot du glossaire validé dans lot_glossary
 * 2. Batch de 10 segments par appel Claude
 * 3. 3 appels en parallèle
 * 4. Persist text_zh + tokens dans translations
 */
export async function translateLot(lotId: string): Promise<{
  totalSegments: number;
  translated: number;
  failed: number;
  tokensIn: number;
  tokensOut: number;
}> {
  const glossary = snapshotGlossary(lotId);

  // Charger tous les segments non encore traduits (idempotence : reprise en cas d'erreur)
  const docs = db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(eq(schema.documents.lotId, lotId))
    .all();

  const allSegments: {
    id: string;
    documentId: string;
    segmentIndex: number;
    textFr: string;
  }[] = [];

  for (const doc of docs) {
    const rows = db
      .select({
        id: schema.translations.id,
        documentId: schema.translations.documentId,
        segmentIndex: schema.translations.segmentIndex,
        textFr: schema.translations.textFr,
      })
      .from(schema.translations)
      .where(
        and(
          eq(schema.translations.documentId, doc.id),
          or(isNull(schema.translations.textZh), eq(schema.translations.textZh, "")),
        ),
      )
      .all();
    allSegments.push(...rows);
  }

  const totalSegments = allSegments.length;
  let translated = 0;
  let failed = 0;
  let tokensIn = 0;
  let tokensOut = 0;

  // Batching par document pour préserver le contexte proche dans un même appel
  const batches: { docSegments: SegmentIn[]; ids: string[] }[] = [];
  for (let i = 0; i < allSegments.length; i += BATCH_SIZE) {
    const slice = allSegments.slice(i, i + BATCH_SIZE);
    batches.push({
      docSegments: slice.map((s, k) => ({ i: k, fr: s.textFr })),
      ids: slice.map((s) => s.id),
    });
  }

  // Concurrence contrôlée
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((b) => translateBatch({ segments: b.docSegments, glossary })),
    );

    results.forEach((batchOut, idx) => {
      const ids = chunk[idx].ids;
      batchOut.forEach((seg) => {
        const rowId = ids[seg.i];
        if (!rowId) return;
        db.update(schema.translations)
          .set({
            textZh: seg.zh,
            tokensIn: seg.tokensIn,
            tokensOut: seg.tokensOut,
            error: seg.error,
          })
          .where(eq(schema.translations.id, rowId))
          .run();
        tokensIn += seg.tokensIn;
        tokensOut += seg.tokensOut;
        if (seg.zh) translated++;
        else failed++;
      });
    });
  }

  return { totalSegments, translated, failed, tokensIn, tokensOut };
}

function snapshotGlossary(lotId: string): GlossaryEntry[] {
  // Sélectionne tous les termes validés du lot (base + user + extracted validés)
  const baseTerms = db
    .select({
      id: schema.glossaryTerms.id,
      termFr: schema.glossaryTerms.termFr,
      termZh: schema.glossaryTerms.termZh,
    })
    .from(schema.glossaryTerms)
    .where(eq(schema.glossaryTerms.source, "base"))
    .all();

  const lotTerms = db
    .select({
      id: schema.glossaryTerms.id,
      termFr: schema.glossaryTerms.termFr,
      termZh: schema.glossaryTerms.termZh,
    })
    .from(schema.glossaryTerms)
    .where(
      and(eq(schema.glossaryTerms.lotId, lotId), eq(schema.glossaryTerms.validated, true)),
    )
    .all();

  const dedup = new Map<string, { id: string; termFr: string; termZh: string }>();
  for (const t of [...baseTerms, ...lotTerms]) {
    dedup.set(t.termFr.toLowerCase(), t);
  }
  const merged = Array.from(dedup.values());

  // Purge & insert snapshot
  db.delete(schema.lotGlossary).where(eq(schema.lotGlossary.lotId, lotId)).run();
  if (merged.length > 0) {
    db.insert(schema.lotGlossary)
      .values(
        merged.map((t) => ({
          lotId,
          termId: t.id,
          termFrSnapshot: t.termFr,
          termZhSnapshot: t.termZh,
        })),
      )
      .run();
  }

  return merged.map((t) => ({ fr: t.termFr, zh: t.termZh }));
}
