// app/api/generate/generations/[generationId]/export/route.ts

import { NextRequest } from "next/server";
import { buildZipFromFiles } from "@/lib/zip";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ZipFile = { path: string; content: string };

/**
 * GET /api/generate/generations/:generationId/export
 * Supabase上の生成ファイル（path/content）をZIP化して返す
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { generationId: string } }
) {
  try {
    const generationId = params.generationId;

    // 1) Supabaseから files を取得（テーブル名の揺れに備えてフォールバック）
    const files = await fetchGenerationFiles(generationId);

    if (!files.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "対象の生成ファイルが見つかりませんでした（filesが0件）",
        }),
        { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    // 2) ZIP生成（Buffer）
    const zipBuffer = await buildZipFromFiles(files);

    // 3) Responseへ（BodyInit互換にするため Uint8Array 化）
    const filename = `design2code_${generationId}.zip`;
    const body = new Uint8Array(zipBuffer);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

/**
 * generationId に紐づく {path, content} を Supabase から取ってくる
 * ※テーブル名が環境によって違う場合があるので複数候補を試す
 */
async function fetchGenerationFiles(generationId: string): Promise<ZipFile[]> {
  // ここはあなたのDBスキーマに合わせて増減してください（よくある候補を入れています）
  const tableCandidates = [
    "files",            // 例: files テーブル
    "generation_files", // 例: generation_files テーブル
    "generated_files",  // 例: generated_files テーブル
  ];

  let lastError: string | null = null;

  for (const table of tableCandidates) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("path, content")
      .eq("generation_id", generationId)
      .order("path", { ascending: true });

    if (error) {
      lastError = `[${table}] ${error.message}`;
      continue;
    }

    if (data && Array.isArray(data)) {
      // contentがnullの行があるとZIPが壊れるので除外
      const files = data
        .filter((row: any) => typeof row?.path === "string" && typeof row?.content === "string")
        .map((row: any) => ({ path: row.path as string, content: row.content as string }));

      return files;
    }
  }

  throw new Error(
    lastError
      ? `Supabase から files を取得できませんでした。最後のエラー: ${lastError}`
      : "Supabase から files を取得できませんでした（原因不明）"
  );
}
