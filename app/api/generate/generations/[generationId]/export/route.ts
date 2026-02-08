// app/api/generate/generations/[generationId]/export/route.ts

import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { generationId: string } }
) {
  // ===== あなたの既存処理（例）=====
  // ここは既存のままでOKです：
  // - project を取得
  // - generation を取得
  // - zipBuffer を生成（Buffer）
  const { project, generation, zipBuffer } = await buildExportZip(params.generationId);
  // ================================

  const filename = `design2code_${project.id}_${generation.id}.zip`;

  // ✅ ここが修正点：BufferをUint8Array化して Response に渡す
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
 * ★ここはあなたの既存の export ロジックに置き換えてください。
 * すでに route.ts 内で project/generation/zipBuffer を作っているなら
 * この関数は不要なので、上のGET内をあなたの既存コードに戻し、
 * 「return new Response(...)」だけ差し替えればOKです。
 */
async function buildExportZip(
  generationId: string
): Promise<{ project: any; generation: any; zipBuffer: Buffer }> {
  // この中身は既存実装を使ってください
  throw new Error("buildExportZip is a placeholder. Use your existing logic.");
}
