import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * サーバー側で Supabase Auth のログインを実行するプロキシ。
 * クライアント直叩きで「Failed to fetch」が出る場合の回避策。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json({ error: "email と password が必要です" }, { status: 400 });
    }

    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
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
