import { z } from "zod";

/**
 * # 重要
 * - NEXT_PUBLIC_* はクライアントでも参照される（public）
 * - SERVICE_ROLE_KEY など秘匿値はサーバー専用（server）
 * - server env は import 時に即評価せず、必要な場所でだけ評価する（遅延）
 */

// =======================
// public（クライアントOK）
// =======================
// NOTE:
// - このアプリは「Supabase未設定でもデモモードで動く」ことが設計要件。
// - そのため public env は import 時に parse で落とさず、safeParse で "未設定" を許容する。
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
});

// =======================
// server（サーバー専用）
// =======================
const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  D2C_OWNER_ID: z.string().uuid(),
  // 使っているならここで必須化してOK（未使用なら任意でもよい）
  // NEXT_PUBLIC_APP_URL: z.string().url(),
});

/**
 * デモ用の固定 owner id（.env.example と一致）
 * - Supabase未設定時でも bundle 生成で必要になるため、ここで定数化。
 */
export const DEMO_OWNER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * public env を取得（未設定なら null）
 */
export function getPublicEnvOrNull(): { NEXT_PUBLIC_SUPABASE_URL: string } | null {
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * サーバー環境変数は「必要な場所」でのみ評価する
 * - Route Handler / server-only モジュールから呼ぶ
 * - Client Component からは絶対に呼ばない
 */
export function getServerEnvOrNull(): { SUPABASE_SERVICE_ROLE_KEY: string; D2C_OWNER_ID: string } | null {
  const parsed = ServerEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    D2C_OWNER_ID: process.env.D2C_OWNER_ID,
    // NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * 既存コード互換のため「必須」を維持したい箇所向け
 * - 未設定なら throw する
 */
export function getServerEnv() {
  const env = getServerEnvOrNull();
  if (!env) {
    throw new Error(
      "Supabase 環境変数が未設定です（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / D2C_OWNER_ID）。"
    );
  }
  return env;
}
