import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnvOrNull, getServerEnvOrNull } from "@/lib/env";

/**
 * # サーバー専用 Supabase クライアント（lazy）
 *
 * 重要:
 * - このアプリは「Supabase未設定でもデモモードで動く」仕様。
 * - そのため import 時点で env を parse して落とさない。
 * - 実際に DB/Storage を触るタイミングでだけクライアントを生成し、未設定なら null を返す。
 */

let _client: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client !== undefined) return _client;

  const pub = getPublicEnvOrNull();
  const server = getServerEnvOrNull();

  if (!pub || !server) {
    _client = null;
    return _client;
  }

  _client = createClient(pub.NEXT_PUBLIC_SUPABASE_URL, server.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  return _client;
}

/**
 * routes やユーティリティ側が `import { supabaseAdmin } from "@/lib/supabaseAdmin"`
 * という named export を期待しているための互換 export。
 *
 * - このプロジェクトは「Supabase未設定でもデモモードで動く」ため、
 *   import 時点では client を生成しない（getSupabaseAdmin() は遅延）。
 * - ただし実際に supabaseAdmin を触った瞬間に Supabase が未設定なら例外にする。
 */
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseAdmin();
      if (!client) {
        throw new Error("Supabase が未設定のため、supabaseAdmin を利用できません。");
      }

      const value = (client as any)[prop];
      if (typeof value === "function") {
        return value.bind(client);
      }
      return value;
    }
  }
) as any as SupabaseClient;
