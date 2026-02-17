import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * ミドルウェア: Supabase セッション更新
 * - 認証機能を使わない場合でも、環境変数が設定されていない場合はスキップ
 */
export async function updateSession(request: NextRequest) {
  // Supabase が設定されていない場合はスキップ（認証機能を使わない場合）
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    });

    await supabase.auth.getUser();
  } catch (error) {
    // ミドルウェアでエラーが発生してもアプリをクラッシュさせない
    console.warn("[middleware] Supabase セッション更新でエラー:", error);
  }

  return response;
}
