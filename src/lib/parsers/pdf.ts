import pdfParse from "pdf-parse";
import type { ParsedDocument, ParsedSegment } from "./types";

/**
 * Extraction texte des PDF (texte natif uniquement, pas d'OCR en V1).
 * On segmente par ligne non vide. La ref garde le numéro de page approximatif.
 * Rappel : pour un PDF entrant, la sortie sera un .docx traduit (Option B),
 * donc les refs PDF ne servent qu'à afficher le lot, pas à la reconstruction.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdfParse(buffer);
  const pages = data.text.split(/\f/); // séparateur form-feed par page (heuristique pdf-parse)
  const segments: ParsedSegment[] = [];
  let index = 0;

  pages.forEach((pageText, pageIdx) => {
    const lines = pageText.split(/\r?\n/);
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return;
      segments.push({
        index: index++,
        text: trimmed,
        kind: "pdf_line",
        ref: `${pageIdx + 1}:${lineIdx + 1}`,
      });
    });
  });

  return { segments };
}
