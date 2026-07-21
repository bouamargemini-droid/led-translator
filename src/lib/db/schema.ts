import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const lots = sqliteTable("lots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", {
    enum: ["draft", "glossary_pending", "translating", "done", "error"],
  })
    .notNull()
    .default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  error: text("error"),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  lotId: text("lot_id")
    .notNull()
    .references(() => lots.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  pathIn: text("path_in").notNull(),
  pathOut: text("path_out"),
  status: text("status", {
    enum: ["uploaded", "parsed", "translated", "reconstructed", "error"],
  })
    .notNull()
    .default("uploaded"),
  error: text("error"),
});

export const glossaryTerms = sqliteTable("glossary_terms", {
  id: text("id").primaryKey(),
  termFr: text("term_fr").notNull(),
  termZh: text("term_zh").notNull(),
  source: text("source", { enum: ["base", "extracted", "user"] }).notNull(),
  validated: integer("validated", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  lotId: text("lot_id").references(() => lots.id, { onDelete: "cascade" }),
});

export const lotGlossary = sqliteTable(
  "lot_glossary",
  {
    lotId: text("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    termId: text("term_id")
      .notNull()
      .references(() => glossaryTerms.id, { onDelete: "cascade" }),
    termFrSnapshot: text("term_fr_snapshot").notNull(),
    termZhSnapshot: text("term_zh_snapshot").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.lotId, t.termId] }) }),
);

export const translations = sqliteTable("translations", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  segmentIndex: integer("segment_index").notNull(),
  textFr: text("text_fr").notNull(),
  textZh: text("text_zh"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  error: text("error"),
});
