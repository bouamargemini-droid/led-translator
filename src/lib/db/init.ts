import type Database from "better-sqlite3";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  path_in TEXT NOT NULL,
  path_out TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_lot ON documents(lot_id);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id TEXT PRIMARY KEY,
  term_fr TEXT NOT NULL,
  term_zh TEXT NOT NULL,
  source TEXT NOT NULL,
  validated INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  lot_id TEXT REFERENCES lots(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_glossary_lot ON glossary_terms(lot_id);
CREATE INDEX IF NOT EXISTS idx_glossary_source ON glossary_terms(source);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_glossary_base_fr
  ON glossary_terms(term_fr) WHERE source = 'base';

CREATE TABLE IF NOT EXISTS lot_glossary (
  lot_id TEXT NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE,
  term_fr_snapshot TEXT NOT NULL,
  term_zh_snapshot TEXT NOT NULL,
  PRIMARY KEY (lot_id, term_id)
);

CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  text_fr TEXT NOT NULL,
  text_zh TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  ref TEXT,
  kind TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_translations_doc ON translations(document_id);
`;

function safeAddColumn(sqlite: Database.Database, table: string, column: string, ddl: string): void {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export function initSchema(sqlite: Database.Database): void {
  sqlite.exec(SCHEMA_SQL);
  // Migrations legeres pour bases existantes (Phase 2 -> Phase 3)
  safeAddColumn(sqlite, "translations", "ref", "ref TEXT");
  safeAddColumn(sqlite, "translations", "kind", "kind TEXT");
}
