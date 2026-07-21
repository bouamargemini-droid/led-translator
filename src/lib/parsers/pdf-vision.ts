import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { callClaudeVision } from "@/lib/anthropic";
import type { ParsedDocument, ParsedSegment } from "./types";

const execFileP = promisify(execFile);

/** DPI de rendu PNG. 200 = bon compromis lisibilité / taille (~1.5 MB / A4). */
const RENDER_DPI = 200;

/** Concurrence des appels Claude vision (aligne avec pipeline traduction). */
const VISION_CONCURRENCY = 3;

const SYSTEM_PROMPT = `Tu es un extracteur OCR spécialisé en documents techniques français (appels d'offres LED, CPS, BPU, DPGF, notes techniques).

Ta mission : extraire le texte français exact visible sur l'image de page PDF fournie.

Règles strictes :
- Restitue le texte fidèlement, ligne par ligne, dans l'ordre de lecture visuel (haut vers bas, gauche vers droite).
- Ne traduis pas. Ne reformule pas. Ne résume pas.
- Conserve intégralement : nombres, unités (mm, W, nits, kg, cd/m², IP65…), références produit, sigles (LED, SMD, IP, CPS, BPU, DPGF), ponctuation.
- Ignore les entêtes/pieds de page répétitifs SEULEMENT s'ils sont clairement un cadre décoratif (numéro de page seul, filigrane). Garde les titres de section.
- Pour les tableaux : une ligne de texte par cellule/ligne logique, dans l'ordre de lecture.
- Retourne UNIQUEMENT le texte extrait, une entrée par ligne, sans balises, sans commentaires, sans préambule.`;

const USER_PROMPT = `Extrait le texte français de cette page. Une ligne par segment logique. Aucun commentaire.`;

/** Rend le PDF en une série de PNG (une image par page) dans un dossier temporaire. */
async function renderPdfToPngs(pdfBuffer: Buffer): Promise<{ dir: string; pngs: string[] }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `led-pdfvision-${randomUUID().slice(0, 8)}-`));
  const inputPath = path.join(dir, "input.pdf");
  await fs.writeFile(inputPath, pdfBuffer);

  // pdftoppm génère prefix-<n>.png avec n zéro-padé selon le nb de pages.
  const prefix = path.join(dir, "page");
  await execFileP("pdftoppm", ["-png", "-r", String(RENDER_DPI), inputPath, prefix], {
    maxBuffer: 1024 * 1024 * 64,
  });

  const entries = await fs.readdir(dir);
  const pngs = entries
    .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
    .sort() // ordre lexicographique = ordre des pages grâce au zéro-padding
    .map((f) => path.join(dir, f));

  return { dir, pngs };
}

async function extractPageText(pngPath: string, pageNumber: number): Promise<ParsedSegment[]> {
  const buf = await fs.readFile(pngPath);
  const base64 = buf.toString("base64");

  const { text } = await callClaudeVision({
    system: SYSTEM_PROMPT,
    user: USER_PROMPT,
    images: [{ mediaType: "image/png", base64 }],
    maxTokens: 4096,
    temperature: 0,
  });

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line, lineIdx) => ({
    index: 0, // ré-indexé plus bas
    text: line,
    kind: "pdf_line" as const,
    ref: `${pageNumber}:${lineIdx + 1}`,
  }));
}

/**
 * Extraction PDF par vision Claude (fallback quand extraction texte natif produit
 * de la bouillie — polices subset sans ToUnicode CMap). Concurrence bornée.
 */
export async function parsePdfViaVision(buffer: Buffer): Promise<ParsedDocument> {
  const { dir, pngs } = await renderPdfToPngs(buffer);

  try {
    // Pool de workers concurrents pour respecter la limite de débit Anthropic.
    const results: ParsedSegment[][] = new Array(pngs.length);
    let cursor = 0;

    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= pngs.length) return;
        results[i] = await extractPageText(pngs[i], i + 1);
      }
    }

    await Promise.all(Array.from({ length: Math.min(VISION_CONCURRENCY, pngs.length) }, worker));

    // Ré-index global.
    const segments: ParsedSegment[] = [];
    let index = 0;
    for (const pageSegs of results) {
      for (const seg of pageSegs) {
        segments.push({ ...seg, index: index++ });
      }
    }

    return { segments };
  } finally {
    // Nettoyage : on ignore l'erreur si le dossier n'existe plus.
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
