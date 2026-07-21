import { parseDocx } from "./docx";
import { parseXlsx } from "./xlsx";
import { parsePdf } from "./pdf";
import type { ParsedDocument } from "./types";

export type SupportedMime =
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/pdf";

export const SUPPORTED_EXTS = [".docx", ".xlsx", ".pdf"] as const;
export type SupportedExt = (typeof SUPPORTED_EXTS)[number];

export function detectExt(filename: string): SupportedExt | null {
  const lower = filename.toLowerCase();
  for (const ext of SUPPORTED_EXTS) {
    if (lower.endsWith(ext)) return ext;
  }
  return null;
}

export async function parseDocument(
  buffer: Buffer,
  ext: SupportedExt,
): Promise<ParsedDocument> {
  switch (ext) {
    case ".docx":
      return parseDocx(buffer);
    case ".xlsx":
      return parseXlsx(buffer);
    case ".pdf":
      return parsePdf(buffer);
  }
}

export type { ParsedDocument, ParsedSegment } from "./types";
