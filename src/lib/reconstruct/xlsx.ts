import fs from "node:fs/promises";
import ExcelJS from "exceljs";

/**
 * Reconstruction XLSX in-place :
 * - Recharge le fichier source
 * - Remplace cell.value pour chaque ref "SheetName:A1" présente dans la map
 * - Préserve styles, formats numériques, formules, images, mise en forme conditionnelle
 */
export async function reconstructXlsx(params: {
  pathIn: string;
  pathOut: string;
  translationsByRef: Map<string, string>;
}): Promise<void> {
  const buffer = await fs.readFile(params.pathIn);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  wb.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const ref = `${sheet.name}:${cell.address}`;
        const translation = params.translationsByRef.get(ref);
        if (translation == null) return;

        // Préserver richText si présent : on collapse en texte simple traduit
        // (les styles inline dans la cellule sont perdus, mais le format de cellule reste)
        const value = cell.value;
        if (
          value &&
          typeof value === "object" &&
          "richText" in value &&
          Array.isArray(value.richText)
        ) {
          cell.value = translation;
          return;
        }
        cell.value = translation;
      });
    });
  });

  const out = await wb.xlsx.writeBuffer();
  await fs.writeFile(params.pathOut, Buffer.from(out));
}
