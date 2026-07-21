import fs from "node:fs/promises";
import { Document, Packer, Paragraph, TextRun } from "docx";

/**
 * PDF entrant → sortie .docx traduit (Option B PRD).
 * On génère un DOCX linéaire : chaque ligne PDF devient un paragraphe traduit.
 * Adil convertit ensuite en PDF sous Word Mac (Fichier → Exporter au format PDF).
 */
export async function reconstructPdfToDocx(params: {
  pathOut: string;
  translationsInOrder: string[];
}): Promise<void> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { size: 22, font: "Songti SC" }, // 11pt, police compatible chinois macOS/Windows
        },
      },
    },
    sections: [
      {
        properties: {},
        children: params.translationsInOrder.map(
          (text) =>
            new Paragraph({
              children: [new TextRun({ text: text || "" })],
            }),
        ),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(params.pathOut, buffer);
}
