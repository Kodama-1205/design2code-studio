import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Supabase Storage(d2c-previews) から PNG をダウンロードして返す
 * - ResultTabs はここを参照してプレビュー表示する
 */

export const runtime = "nodejs";

function normalizeSnapshotToPng(snapshotHash: string) {
  return snapshotHash.endsWith(".png") ? snapshotHash : `${snapshotHash}.png`;
}

export async function GET(_req: Request, { params }: { params: { projectId: string; snapshotHash: string } }) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "not_configured", message: "Supabase が未設定のため、プレビュー画像は取得できません。" },
      { status: 404 }
    );
  }

  const projectId = decodeURIComponent(params.projectId);
  const snapshotHashRaw = decodeURIComponent(params.snapshotHash);
  const fileName = normalizeSnapshotToPng(snapshotHashRaw);
  const path = `${projectId}/${fileName}`;

  const { data, error } = await supabaseAdmin.storage.from("d2c-previews").download(path);

  if (error || !data) {
    return NextResponse.json(
      { error: "not_found", message: "プレビュー画像が見つかりませんでした。" },
      { status: 404 }
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
