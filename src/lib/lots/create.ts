import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db, DATA_DIR, schema } from "@/lib/db/client";
import { ensureBaseGlossary } from "@/lib/glossary/base";
import { extractGlossaryCandidates } from "@/lib/glossary/extract";
import { detectExt, parseDocument, type SupportedExt } from "@/lib/parsers";
import { and, eq, inArray } from "drizzle-orm";

export type IncomingFile = {
  filename: string;
  mime: string;
  buffer: Buffer;
};

export async function createLotFromUpload(params: {
  name: string;
  files: IncomingFile[];
  sourceLotId?: string;
}): Promise<{ lotId: string; docsIngested: number; candidates: number; clonedTerms: number }> {
  ensureBaseGlossary();

  const lotId = crypto.randomUUID();
  const lotDir = path.join(DATA_DIR, "uploads", lotId);
  await fs.mkdir(lotDir, { recursive: true });

  db.insert(schema.lots)
    .values({
      id: lotId,
      name: params.name,
      status: "draft",
    })
    .run();

  const clonedTerms = params.sourceLotId ? cloneValidatedTerms(params.sourceLotId, lotId) : 0;

  const allSegments: string[] = [];
  let docsIngested = 0;

  for (const file of params.files) {
    const ext = detectExt(file.filename);
    if (!ext) continue;

    const docId = crypto.randomUUID();
    const safeName = `${docId}${ext}`;
    const pathIn = path.join(lotDir, safeName);
    await fs.writeFile(pathIn, file.buffer);

    db.insert(schema.documents)
      .values({
        id: docId,
        lotId,
        filename: file.filename,
        mime: file.mime,
        size: file.buffer.length,
        pathIn,
        status: "uploaded",
      })
      .run();

    try {
      const parsed = await parseDocument(file.buffer, ext as SupportedExt);
      persistSegments(docId, parsed.segments);
      allSegments.push(...parsed.segments.map((s) => s.text));

      db.update(schema.documents)
        .set({ status: "parsed" })
        .where(eq(schema.documents.id, docId))
        .run();
      docsIngested++;
    } catch (err) {
      db.update(schema.documents)
        .set({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        })
        .where(eq(schema.documents.id, docId))
        .run();
    }
  }

  // Extraction candidats glossaire via Claude — on ignore aussi les termes clonés depuis le lot source
  const alreadyCoveredFr = db
    .select({ termFr: schema.glossaryTerms.termFr })
    .from(schema.glossaryTerms)
    .where(
      eq(schema.glossaryTerms.source, "base"),
    )
    .all()
    .map((r) => r.termFr);
  const clonedFr = db
    .select({ termFr: schema.glossaryTerms.termFr })
    .from(schema.glossaryTerms)
    .where(eq(schema.glossaryTerms.lotId, lotId))
    .all()
    .map((r) => r.termFr);
  const baseGlossaryFr = [...alreadyCoveredFr, ...clonedFr];

  let candidatesCount = 0;
  if (allSegments.length > 0) {
    try {
      const { candidates } = await extractGlossaryCandidates({
        segments: allSegments,
        baseGlossaryFr,
      });

      for (const c of candidates) {
        db.insert(schema.glossaryTerms)
          .values({
            id: crypto.randomUUID(),
            termFr: c.term_fr,
            termZh: c.term_zh,
            source: "extracted",
            validated: false,
            notes: c.reason,
            lotId,
          })
          .run();
        candidatesCount++;
      }
    } catch (err) {
      console.error("[createLotFromUpload] extract candidates failed", err);
    }
  }

  db.update(schema.lots)
    .set({ status: "glossary_pending" })
    .where(eq(schema.lots.id, lotId))
    .run();

  return { lotId, docsIngested, candidates: candidatesCount, clonedTerms };
}

/**
 * Clone les termes validés (extracted+user validated=true) du lot source
 * comme termes source='user' du nouveau lot. Ignore le glossaire de base (déjà global).
 */
function cloneValidatedTerms(sourceLotId: string, newLotId: string): number {
  const rows = db
    .select({
      termFr: schema.glossaryTerms.termFr,
      termZh: schema.glossaryTerms.termZh,
      notes: schema.glossaryTerms.notes,
    })
    .from(schema.glossaryTerms)
    .where(
      and(
        eq(schema.glossaryTerms.lotId, sourceLotId),
        eq(schema.glossaryTerms.validated, true),
        inArray(schema.glossaryTerms.source, ["extracted", "user"]),
      ),
    )
    .all();

  if (rows.length === 0) return 0;

  db.insert(schema.glossaryTerms)
    .values(
      rows.map((r) => ({
        id: crypto.randomUUID(),
        termFr: r.termFr,
        termZh: r.termZh,
        source: "user" as const,
        validated: true,
        notes: r.notes ? `cloné : ${r.notes}` : "cloné d'un lot passé",
        lotId: newLotId,
      })),
    )
    .run();

  return rows.length;
}

function persistSegments(
  documentId: string,
  segments: { index: number; text: string; kind: string; ref: string }[],
): void {
  if (segments.length === 0) return;
  const insert = db.insert(schema.translations).values(
    segments.map((s) => ({
      id: crypto.randomUUID(),
      documentId,
      segmentIndex: s.index,
      textFr: s.text,
      ref: s.ref,
      kind: s.kind,
    })),
  );
  insert.run();
}
