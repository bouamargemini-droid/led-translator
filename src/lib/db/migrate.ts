import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import path from "node:path";

const migrationsFolder = path.resolve(process.cwd(), "src/lib/db/migrations");

migrate(db, { migrationsFolder });
console.log("Migrations applied.");
