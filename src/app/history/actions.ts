"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, DATA_DIR, schema } from "@/lib/db/client";

export async function deleteLotAction(formData: FormData): Promise<void> {
  const lotId = String(formData.get("lotId") ?? "");
  if (!lotId) return;

  // Cascade DB (FK ON DELETE CASCADE couvre documents/translations/glossary_terms/lot_glossary)
  db.delete(schema.lots).where(eq(schema.lots.id, lotId)).run();

  // Cleanup filesystem
  await safeRm(path.join(DATA_DIR, "uploads", lotId));
  await safeRm(path.join(DATA_DIR, "outputs", lotId));

  revalidatePath("/history");
}

async function safeRm(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
