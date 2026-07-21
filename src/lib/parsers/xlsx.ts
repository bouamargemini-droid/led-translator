import ExcelJS from "exceljs";
import type { ParsedDocument, ParsedSegment } from "./types";

/**
 * Extraction des cellules texte de toutes les feuilles.
 * On ignore les cellules purement numériques, les formules, les dates.
 * ref = "SheetName:A1"
 */
export async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const segments: ParsedSegment[] = [];
  let index = 0;

  wb.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.type === ExcelJS.ValueType.Formula) return;
        if (cell.type === ExcelJS.ValueType.Number) return;
        if (cell.type === ExcelJS.ValueType.Date) return;
        if (cell.type === ExcelJS.ValueType.Boolean) return;

        const text = extractCellText(cell);
        if (!text || text.trim().length === 0) return;

        segments.push({
          index: index++,
          text: text.trim(),
          kind: "xlsx_cell",
          ref: `${sheet.name}:${cell.address}`,
        });
      });
    });
  });

  return { segments };
}

function extractCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return "";
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((r) => r.text).join("");
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return "";
}
