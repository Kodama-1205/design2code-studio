import { NextResponse } from "next/server";
import { getGenerationBundle } from "@/lib/db";
import { buildZipFromFiles } from "@/lib/zip";
import { requireUserIdFromRequest } from "@/lib/authApi";

export async function GET(req: Request, { params }: { params: { generationId: string } }) {
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { project, generation, files } = bundle;
  if (project.owner_id !== userId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const zipBuffer = await buildZipFromFiles(files.map((f) => ({ path: f.path, content: f.content })));

  const filename = `design2code_${project.id}_${generation.id}.zip`;

  // Normalize to a plain ArrayBuffer for stable typing (avoid SharedArrayBuffer incompatibility).
  const u8 = zipBuffer instanceof Uint8Array ? zipBuffer : (new Uint8Array(zipBuffer as any) as Uint8Array);
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  const blob = new Blob([ab], { type: "application/zip" });

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
