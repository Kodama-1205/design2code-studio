import { NextResponse } from "next/server";
import { z } from "zod";
import { buildZipFromFiles } from "@/lib/zip";

const BodySchema = z.object({
  files: z.array(z.object({ path: z.string(), content: z.string() })),
  filename: z.string().optional()
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { files, filename } = parsed.data;
  const zipBuffer = await buildZipFromFiles(files);
  const name = filename ?? "design2code_export.zip";

  // Buffer is not assignable to BodyInit - convert to Uint8Array for NextResponse
  const body = new Uint8Array(zipBuffer);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`
    }
  });
}
