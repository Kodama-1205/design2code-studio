import { NextResponse } from "next/server";
import { z } from "zod";
import { buildZipFromFiles } from "@/lib/zip";

/**
 * # 重要
 * archiver（Node依存）を使うため、必ず Node.js runtime に固定する。
 * Edge runtime になると stream / zlib 周りで即死する。
 */
export const runtime = "nodejs";

const BodySchema = z.object({
  files: z.array(z.object({ path: z.string(), content: z.string() })),
  filename: z.string().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { files, filename } = parsed.data;

  // ZIP生成（Bufferを返す想定）
  const zipBuffer = await buildZipFromFiles(files);
  const name = filename ?? "design2code_export.zip";

  // NextResponse の BodyInit 互換のため Uint8Array に変換
  const body = Uint8Array.from(zipBuffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      // ブラウザやCDNの取り扱い安定化（任意だが推奨）
      "Cache-Control": "no-store",
    },
  });
}
