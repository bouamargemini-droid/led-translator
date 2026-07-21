import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

type Params = { params: Promise<{ lotId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { lotId } = await params;

  const lot = db.select().from(schema.lots).where(eq(schema.lots.id, lotId)).all()[0];
  if (!lot) return new NextResponse("Lot not found", { status: 404 });

  const docs = db.select().from(schema.documents).where(eq(schema.documents.lotId, lotId)).all();

  const readyDocs = docs.filter((d) => d.pathOut && d.status === "reconstructed");
  if (readyDocs.length === 0) {
    return new NextResponse("No reconstructed documents", { status: 409 });
  }

  const zip = new JSZip();
  for (const doc of readyDocs) {
    if (!doc.pathOut) continue;
    const buffer = await fs.readFile(doc.pathOut);
    zip.file(path.basename(doc.pathOut), buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipName = `${sanitize(lot.name || "lot")}-zh.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
      "Content-Length": String(zipBuffer.byteLength),
    },
  });
}

function sanitize(name: string): string {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80);
}
