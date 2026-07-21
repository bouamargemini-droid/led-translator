import path from "node:path";
import { eq } from "drizzle-orm";
import { db, DATA_DIR, schema } from "@/lib/db/client";
import { reconstructDocx } from "./docx";
import { reconstructXlsx } from "./xlsx";
import { reconstructPdfToDocx } from "./pdf-to-docx";

/**
 * Reconstruit tous les documents traduits d'un lot dans data/outputs/<lot_id>/.
 * Nomme le fichier de sortie <filename_original>-zh.<ext>
 * (docx pour docx/pdf entrants, xlsx pour xlsx entrant).
 */
export async function reconstructLot(lotId: string): Promise<void> {
  const outDir = path.join(DATA_DIR, "outputs", lotId);
  await ensureDir(outDir);

  const docs = db.select().from(schema.documents).where(eq(schema.documents.lotId, lotId)).all();

  for (const doc of docs) {
    if (doc.status === "error") continue;

    const rows = db
      .select({
        segmentIndex: schema.translations.segmentIndex,
        textZh: schema.translations.textZh,
        textFr: schema.translations.textFr,
        ref: schema.translations.ref,
      })
      .from(schema.translations)
      .where(eq(schema.translations.documentId, doc.id))
      .all();

    const ext = path.extname(doc.filename).toLowerCase();
    const baseName = path.basename(doc.filename, ext);

    try {
      let outPath: string;
      if (ext === ".docx") {
        outPath = path.join(outDir, `${baseName}-zh.docx`);
        const map = new Map<string, string>();
        for (const r of rows) {
          if (!r.ref || !r.textZh) continue;
          map.set(r.ref, r.textZh);
        }
        await reconstructDocx({ pathIn: doc.pathIn, pathOut: outPath, translationsByRef: map });
      } else if (ext === ".xlsx") {
        outPath = path.join(outDir, `${baseName}-zh.xlsx`);
        const map = new Map<string, string>();
        for (const r of rows) {
          if (!r.ref || !r.textZh) continue;
          map.set(r.ref, r.textZh);
        }
        await reconstructXlsx({ pathIn: doc.pathIn, pathOut: outPath, translationsByRef: map });
      } else if (ext === ".pdf") {
        outPath = path.join(outDir, `${baseName}-zh.docx`);
        const ordered = [...rows]
          .sort((a, b) => a.segmentIndex - b.segmentIndex)
          .map((r) => r.textZh ?? r.textFr);
        await reconstructPdfToDocx({ pathOut: outPath, translationsInOrder: ordered });
      } else {
        continue;
      }

      db.update(schema.documents)
        .set({ status: "reconstructed", pathOut: outPath })
        .where(eq(schema.documents.id, doc.id))
        .run();
    } catch (err) {
      db.update(schema.documents)
        .set({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        })
        .where(eq(schema.documents.id, doc.id))
        .run();
    }
  }
}

async function ensureDir(dir: string): Promise<void> {
  const fs = await import("node:fs/promises");
  await fs.mkdir(dir, { recursive: true });
}
