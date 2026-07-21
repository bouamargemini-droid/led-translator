export type SegmentKind = "docx_paragraph" | "xlsx_cell" | "pdf_line";

export type ParsedSegment = {
  index: number;
  text: string;
  kind: SegmentKind;
  /** Identifiant technique pour la reconstruction Phase 3.
   *  docx : path XML (ex: "document.xml:p[12]:r[0]:t[0]")
   *  xlsx : "sheet:cell" (ex: "Sheet1:B12")
   *  pdf  : "page:line" (ex: "3:12")
   */
  ref: string;
};

export type ParsedDocument = {
  segments: ParsedSegment[];
};
