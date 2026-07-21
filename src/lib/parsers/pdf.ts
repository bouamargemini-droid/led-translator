import pdfParse from "pdf-parse";
import type { ParsedDocument, ParsedSegment } from "./types";
import { parsePdfViaVision } from "./pdf-vision";

/**
 * Extraction texte des PDF.
 *
 * Étape 1 : extraction texte natif via pdf-parse. Rapide et gratuit.
 * Étape 2 : si le texte extrait est de la bouillie (polices subset sans ToUnicode
 * CMap, symptôme classique des CPS générés par certains logiciels d'édition),
 * on bascule automatiquement sur Claude vision (rendu PNG + OCR sémantique).
 *
 * Segmentation : une ligne non vide = un segment. La ref garde "page:ligne".
 * Rappel Option B : pour un PDF entrant, la sortie sera un .docx traduit,
 * donc les refs PDF ne servent qu'à afficher le lot, pas à la reconstruction.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdfParse(buffer);

  if (isTextGibberish(data.text)) {
    console.warn(
      "[pdf] Texte natif illisible (police subset sans ToUnicode CMap détectée). " +
        "Bascule sur extraction Claude vision.",
    );
    return await parsePdfViaVision(buffer);
  }

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

/**
 * Détecte un texte "bouillie" : PDF avec polices subset qui exposent des glyph
 * IDs bruts sans mapping Unicode. Symptômes typiques :
 *   - TRAVAUX → "75$9$8;"   (shift +3 caractères ASCII)
 *   - canalisation → "FDQDOLVDWLRQ"
 * Ces sorties ont une empreinte statistique très différente d'un français normal :
 *   - Densité anormale de ponctuation ASCII ($, ;, (, ), :, ., ,) au milieu de
 *     mots présumés.
 *   - Absence quasi totale d'accents (é, è, à, ç…) alors qu'un texte français
 *     réel de plus de quelques centaines de caractères en contient toujours.
 *   - Proportion élevée de mots contenant des chiffres/symboles au milieu.
 *
 * Seuil calibré empiriquement sur le CPS Marrakech 2026 (source de la bouillie).
 */
export function isTextGibberish(text: string): boolean {
  const sample = text.replace(/\s+/g, " ").trim();
  if (sample.length < 500) {
    // Trop court pour trancher statistiquement. On fait confiance à l'extraction native.
    return false;
  }

  const letters = sample.match(/\p{L}/gu) ?? [];
  if (letters.length < 200) return false;

  // Signal 1 : taux d'accents français. Un CPS/BPU/DPGF français contient
  // typiquement ≥ 1.5% de caractères accentués. Un PDF bouillie n'en a AUCUN
  // (les accents sont des glyph IDs séparés qui deviennent des symboles).
  const accented = sample.match(/[éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ]/g) ?? [];
  const accentRatio = accented.length / letters.length;

  // Signal 2 : mots avec ponctuation ASCII au milieu (hors trait d'union, apostrophe).
  // Ex : "75$9$8;" — un vrai mot français ne contient jamais $, ;, (, ), :, /.
  const words = sample.split(/\s+/).filter((w) => w.length >= 3);
  const suspiciousWords = words.filter((w) =>
    /^[\p{L}\d$;:()/\\<>=]+$/u.test(w) && /[$;:()/\\<>=]/.test(w),
  );
  const suspiciousRatio = words.length > 0 ? suspiciousWords.length / words.length : 0;

  // Signal 3 : proportion de mots exclusivement en majuscules parmi les mots
  // "lettres pures" (>= 4 lettres). En bouillie shift+3, quasi tout le texte
  // majuscule remonte en symboles, mais les minuscules deviennent des majuscules
  // (ex "canalisation" → "FDQDOLVDWLRQ"). Ratio très élevé = suspect.
  const alphaWords = words.filter((w) => /^\p{L}+$/u.test(w) && w.length >= 4);
  const upperWords = alphaWords.filter((w) => w === w.toUpperCase());
  const upperRatio = alphaWords.length > 0 ? upperWords.length / alphaWords.length : 0;

  // Décision : bouillie si accents quasi absents ET (mots-symboles fréquents OU
  // majuscules dominantes).
  const noAccents = accentRatio < 0.002;
  const suspiciousHeavy = suspiciousRatio > 0.15;
  const upperDominant = upperRatio > 0.6;

  return noAccents && (suspiciousHeavy || upperDominant);
}
