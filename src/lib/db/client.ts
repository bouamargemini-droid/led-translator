import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import { initSchema } from "./init";

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "led-translator.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
initSchema(sqlite);

export const db = drizzle(sqlite, { schema });
export { DATA_DIR };
export { schema };
