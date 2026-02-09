import { NextRequest, NextResponse } from "next/server";

/**
 * サーバー側で Supabase Auth のログインを実行するプロキシ。
 * クライアント直叩きで「Failed to fetch」が出る場合の回避策。
 */
export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey || anonKey.length < 20) {
      return NextResponse.json(
        { error: "環境変数が未設定です。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を Vercel Production に設定してください。" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: "email と password が必要です" }, { status: 400 });
    }

    const authUrl = `${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;
    const res = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error_description ?? data?.msg ?? data?.message ?? "ログインに失敗しました" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      user: data.user,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "接続エラーが発生しました" },
      { status: 500 }
    );
  }
}
