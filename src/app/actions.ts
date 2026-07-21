"use server";

import { redirect } from "next/navigation";
import { createLotFromUpload, type IncomingFile } from "@/lib/lots/create";

export async function uploadLotAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim() || "Lot sans nom";
  const sourceLotId = String(formData.get("sourceLotId") ?? "").trim() || undefined;
  const rawFiles = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (rawFiles.length === 0) {
    throw new Error("Aucun fichier fourni.");
  }

  const files: IncomingFile[] = [];
  for (const f of rawFiles) {
    const buffer = Buffer.from(await f.arrayBuffer());
    files.push({ filename: f.name, mime: f.type, buffer });
  }

  const { lotId } = await createLotFromUpload({ name, files, sourceLotId });
  redirect(`/lots/${lotId}`);
}
