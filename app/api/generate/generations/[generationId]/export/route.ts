// app/api/generate/generations/[generationId]/export/route.ts

import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { generationId: string } }
) {
  // =========================================================
  // TODO: ここに「今あなたが使っている既存処理」を移植してください
  //
  // 必要な最終成果物はこの3つ：
  //   - project: { id: string }
  //   - generation: { id: string }
  //   - zipBuffer: Buffer（lib/zip.ts の buildZipFromFiles が返すやつ）
  //
  // 例）あなたの既存コードが既にこれらを作っているなら、そのまま貼るだけでOK
  // =========================================================
  const { project, generation, zipBuffer } = await getExportContext(params.generationId);
  // =========================================================

  const filename = `design2code_${project.id}_${generation.id}.zip`;

  // ✅ Buffer → Uint8Array にして Web標準 Response に渡す（型エラー回避）
  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * ★ここはダミーです。あなたの既存処理に置き換えてください。
 * ※ただし、返却（Response部分）はこのままが正解です。
 */
async function getExportContext(
  generationId: string
): Promise<{ project: { id: string }; generation: { id: string }; zipBuffer: Buffer }> {
  throw new Error("getExportContext is not implemented. Paste your existing logic here.");
}
