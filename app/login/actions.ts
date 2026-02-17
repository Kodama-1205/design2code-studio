"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  try {
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { error: "email と password を入力してください" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/", "layout");
    redirect("/");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isFetchFailed = msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("ETIMEDOUT");
    
    if (isFetchFailed) {
      return {
        error: "Supabase への接続に失敗しました。\n・Vercel の環境変数（NEXT_PUBLIC_SUPABASE_URL）を確認\n・Supabase プロジェクトが一時停止していないか確認\n・数秒後に再試行してください"
      };
    }
    
    return { error: `ログインエラー: ${msg}` };
  }
}

export async function signup(formData: FormData) {
  try {
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { error: "email と password を入力してください" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return { error: error.message };
    }

    if (data.session) {
      revalidatePath("/", "layout");
      redirect("/");
    }

    return { message: "サインアップしました。メール認証が必要な場合は届いたメールを確認してください。" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isFetchFailed = msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("ETIMEDOUT");
    
    if (isFetchFailed) {
      return {
        error: "Supabase への接続に失敗しました。\n・Vercel の環境変数（NEXT_PUBLIC_SUPABASE_URL）を確認\n・Supabase プロジェクトが一時停止していないか確認\n・数秒後に再試行してください"
      };
    }
    
    return { error: `サインアップエラー: ${msg}` };
  }
}
