import { NextRequest, NextResponse } from "next/server";
import { getGenerationBundle } from "@/lib/db";
import { buildZipFromFiles } from "@/lib/zip";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { generationId: string } }
) {
  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { project, generation, files } = bundle;

  if (files.length === 0) {
    return NextResponse.json({ error: "no_files", message: "生成ファイルが存在しません" }, { status: 404 });
  }

  const zipBuffer = await buildZipFromFiles(
    files.map((f) => ({ path: f.path, content: f.content }))
  );

  const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `design2code_${safeName}_${generation.id.slice(0, 8)}.zip`;

  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
