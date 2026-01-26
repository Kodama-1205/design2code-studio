import { NextResponse } from "next/server";
import { getGenerationBundle } from "@/lib/db";
import { buildZipFromFiles } from "@/lib/zip";

export async function GET(_: Request, { params }: { params: { generationId: string } }) {
  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { project, generation, files } = bundle;

  const zipBuffer = await buildZipFromFiles(files.map((f) => ({ path: f.path, content: f.content })));

  const filename = `design2code_${project.id}_${generation.id}.zip`;

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
