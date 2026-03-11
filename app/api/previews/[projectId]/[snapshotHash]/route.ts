import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { envServer } from "@/lib/envServer";

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

  // 実際に参照している Storage パスをログに出す
  console.log("[previews] download path =", path);

  const { data, error } = await supabaseAdmin.storage.from("d2c-previews").download(path);

  if (error) {
    console.error("[previews] storage error:", error.name, error.message);
  }

  // StorageUnknownError の場合は、Storage REST API に直接フォールバックして取得を試みる
  let arrayBuffer: ArrayBuffer | null = null;
  if (!error && data) {
    arrayBuffer = await data.arrayBuffer();
  } else if (error && (error as any).name === "StorageUnknownError") {
    try {
      const baseUrl = envServer.NEXT_PUBLIC_SUPABASE_URL;
      console.log("[previews] envServer.NEXT_PUBLIC_SUPABASE_URL =", baseUrl);
      // Supabase の Storage REST API 公開バケット用 URL を構築
      const url = new URL(`${baseUrl}/storage/v1/object/public/d2c-previews/${encodeURI(path)}`);
      console.log("[previews] REST fallback url =", url.toString());

      const res = await fetch(url.toString(), {
        headers: {
          apikey: envServer.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${envServer.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[previews] REST fallback error:", res.status, await res.text().catch(() => ""));
      } else {
        arrayBuffer = await res.arrayBuffer();
      }
    } catch (e) {
      console.error("[previews] REST fallback threw:", e);
    }
  }

  if (!arrayBuffer) {
    return NextResponse.json(
      { error: "not_found", message: "プレビュー画像が見つかりませんでした。" },
      { status: 404 }
    );
  }

  const body = new Uint8Array(arrayBuffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
