import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

type Params = { params: Promise<{ docId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { docId } = await params;

  const doc = db.select().from(schema.documents).where(eq(schema.documents.id, docId)).all()[0];
  if (!doc) return new NextResponse("Not found", { status: 404 });
  if (!doc.pathOut) return new NextResponse("Not yet reconstructed", { status: 409 });

  const buffer = await fs.readFile(doc.pathOut);
  const outName = path.basename(doc.pathOut);
  const mime = detectMime(outName);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(outName)}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}

function detectMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}
