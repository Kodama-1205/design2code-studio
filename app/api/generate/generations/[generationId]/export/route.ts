// app/api/generate/generations/[generationId]/export/route.ts

import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { generationId: string } }
) {
  // ==========================
  // === ここはあなたの既存処理 ===
  // - project を取得
  // - generation を取得
  // - zipBuffer を生成（Buffer）
  //
  // 例：
  // const { project, generation, zipBuffer } = await buildExportZip(params.generationId);
  //
  // ※あなたの現状コードをそのまま置いてOK
  // ==========================

  // ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
  // ★あなたの現状コードにある変数をそのまま使ってください
  // project / generation / zipBuffer が既にある前提
  // ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
  // @ts-ignore - ここはあなたの既存コードに合わせて変数が存在する前提
  const { project, generation, zipBuffer } = (globalThis as any).__EXPORT_CONTEXT__ ?? {};
  // ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
  // 注意：上の2行は「全文として成立させるための仮置き」です。
  // 実際には、あなたの route.ts 内の既存処理で作っている
  // project / generation / zipBuffer をそのまま使い、
  // この仮置きブロックは削除してください。
  // ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

  const filename = `design2code_${project.id}_${generation.id}.zip`;

  // ✅ ここが修正点：Buffer を Uint8Array にして Response に渡す
  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
