"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { translateLot } from "@/lib/translate/pipeline";
import { reconstructLot } from "@/lib/reconstruct";

export async function updateTermAction(formData: FormData): Promise<void> {
  const id = String(formData.get("termId") ?? "");
  const lotId = String(formData.get("lotId") ?? "");
  const termZh = String(formData.get("termZh") ?? "").trim();
  const validated = formData.get("validated") === "1";

  if (!id) return;
  db.update(schema.glossaryTerms)
    .set({ termZh, validated })
    .where(eq(schema.glossaryTerms.id, id))
    .run();
  revalidatePath(`/lots/${lotId}`);
}

export async function addManualTermAction(formData: FormData): Promise<void> {
  const lotId = String(formData.get("lotId") ?? "");
  const termFr = String(formData.get("termFr") ?? "").trim();
  const termZh = String(formData.get("termZh") ?? "").trim();
  if (!lotId || !termFr || !termZh) return;

  db.insert(schema.glossaryTerms)
    .values({
      id: crypto.randomUUID(),
      termFr,
      termZh,
      source: "user",
      validated: true,
      lotId,
    })
    .run();
  revalidatePath(`/lots/${lotId}`);
}

export async function removeTermAction(formData: FormData): Promise<void> {
  const id = String(formData.get("termId") ?? "");
  const lotId = String(formData.get("lotId") ?? "");
  if (!id) return;
  db.delete(schema.glossaryTerms).where(eq(schema.glossaryTerms.id, id)).run();
  revalidatePath(`/lots/${lotId}`);
}

export async function startTranslationAction(formData: FormData): Promise<void> {
  const lotId = String(formData.get("lotId") ?? "");
  if (!lotId) return;

  const lot = db.select().from(schema.lots).where(eq(schema.lots.id, lotId)).all()[0];
  if (!lot) return;

  db.update(schema.lots).set({ status: "translating" }).where(eq(schema.lots.id, lotId)).run();

  try {
    await translateLot(lotId);
    await reconstructLot(lotId);
    db.update(schema.lots).set({ status: "done" }).where(eq(schema.lots.id, lotId)).run();
  } catch (err) {
    db.update(schema.lots)
      .set({ status: "error", error: err instanceof Error ? err.message : String(err) })
      .where(eq(schema.lots.id, lotId))
      .run();
  }

  redirect(`/lots/${lotId}`);
}

export async function rejectExtractedAction(formData: FormData): Promise<void> {
  // Supprime tous les termes extracted non validés du lot (nettoyage rapide)
  const lotId = String(formData.get("lotId") ?? "");
  if (!lotId) return;
  db.delete(schema.glossaryTerms)
    .where(
      and(
        eq(schema.glossaryTerms.lotId, lotId),
        eq(schema.glossaryTerms.source, "extracted"),
        eq(schema.glossaryTerms.validated, false),
      ),
    )
    .run();
  revalidatePath(`/lots/${lotId}`);
}
