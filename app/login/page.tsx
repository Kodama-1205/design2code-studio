"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { login, signup } from "./actions";

export default function Page() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const m = formData.get("mode") as string;
      const result = m === "signup" ? await signup(formData) : await login(formData);
      if (result && "error" in result) {
        setMessage(result.error);
      } else if (result && "message" in result) {
        setMessage(result.message);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "エラーが発生しました";
      const isFetchFailed = msg === "fetch failed" || msg === "Failed to fetch" || msg.includes("fetch") || msg.includes("NetworkError");
      setMessage(
        isFetchFailed
          ? "Supabase への接続に失敗しました。\n・Vercel の環境変数（NEXT_PUBLIC_SUPABASE_URL）を確認\n・Supabase プロジェクトが一時停止していないか確認\n・数秒後に再試行してください"
          : msg
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-max py-10">
      <Card className="max-w-xl mx-auto p-6">
        <h1 className="h1">ログイン</h1>
        <p className="p-muted mt-2">実務向けのユーザー分離（RLS）に対応するため、ログインが必要です。</p>

        <div className="mt-6 flex gap-2">
          <Button variant={mode === "login" ? "primary" : "secondary"} onClick={() => setMode("login")}>
            ログイン
          </Button>
          <Button variant={mode === "signup" ? "primary" : "secondary"} onClick={() => setMode("signup")}>
            新規登録
          </Button>
        </div>

        <form action={handleSubmit} className="mt-6 grid gap-3">
          <input type="hidden" name="mode" value={mode} />
          <div>
            <label className="block text-sm font-semibold">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="mt-2 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none focus:border-[rgba(170,90,255,0.75)]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="password"
              className="mt-2 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none focus:border-[rgba(170,90,255,0.75)]"
            />
            <div className="p-muted mt-2 text-xs">※ Supabase Auth の設定に従って、最小文字数などの制約があります。</div>
          </div>

          {message ? (
            <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm whitespace-pre-wrap">
              {message}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy} variant="primary">
              {busy ? "..." : mode === "login" ? "ログイン" : "新規登録"}
            </Button>
            <Button href="/" variant="secondary" type="button">
              戻る
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
