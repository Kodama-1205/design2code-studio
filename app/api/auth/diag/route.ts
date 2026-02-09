import { NextResponse } from "next/server";

/**
 * 認証 API の診断用。本番で環境変数が正しく読まれているか確認。
 * 機密情報は返さない。
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasAnonKey = Boolean(anonKey && anonKey.length >= 20);
  const isFallback = !url || url === "http://localhost:54321" || !anonKey || anonKey === "missing_anon_key";

  return NextResponse.json({
    ok: !isFallback,
    hasUrl: Boolean(url),
    hasAnonKey,
    isFallback,
    hint: isFallback
      ? "Vercel の環境変数（NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）が Production に設定されていません"
      : "環境変数は読み込まれています",
  });
}
