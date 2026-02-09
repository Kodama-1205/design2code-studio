"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function Page() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign("/");
    });
  }, []);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      } catch (fetchErr: any) {
        const msg = fetchErr?.message ?? "";
        if (msg === "Failed to fetch" || msg.includes("fetch") || msg.includes("NetworkError")) {
          throw new Error(
            "サーバーに接続できませんでした。Vercel に最新のデプロイが反映されているか、ネットワークを確認してください。"
          );
        }
        throw fetchErr;
      }

      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        throw new Error(`API エラー (${res.status})`);
      }

      if (!res.ok) {
        throw new Error((json?.error as string) ?? "失敗しました");
      }

      if (json.access_token && json.refresh_token) {
        try {
          await supabaseBrowser.auth.setSession({
            access_token: json.access_token as string,
            refresh_token: json.refresh_token as string,
          });
        } catch {
          // setSession が Supabase に接続しようとして失敗する場合のフォールバック
          try {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
            const projectRef = url ? new URL(url).hostname.split(".")[0] : "project";
            const storageKey = `sb-${projectRef}-auth-token`;
            const expiresIn = (json.expires_in as number) ?? 3600;
            const session = {
              access_token: json.access_token,
              refresh_token: json.refresh_token,
              expires_in: expiresIn,
              expires_at: Math.floor(Date.now() / 1000) + expiresIn,
              token_type: "bearer",
            };
            localStorage.setItem(storageKey, JSON.stringify(session));
            if (json.user) {
              localStorage.setItem(`${storageKey}-user`, JSON.stringify({ user: json.user }));
            }
          } catch {}
        }
        window.location.assign("/");
        return;
      }
      setMessage("サインアップしました。メール認証が必要な設定の場合は、届いたメールを確認してください。");
    } catch (e: any) {
      setMessage(e?.message ?? "ログインに失敗しました。");
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

        <div className="mt-6 grid gap-3">
          <div>
            <label className="block text-sm font-semibold">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none focus:border-[rgba(170,90,255,0.75)]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              className="mt-2 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none focus:border-[rgba(170,90,255,0.75)]"
            />
            <div className="p-muted mt-2 text-xs">※ Supabase Auth の設定に従って、最小文字数などの制約があります。</div>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-[rgb(var(--border))] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm whitespace-pre-wrap">
            {message}
          </div>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Button onClick={submit} disabled={busy || email.trim().length < 5 || password.length < 6} variant="primary">
            {busy ? "..." : mode === "login" ? "ログイン" : "新規登録"}
          </Button>
          <Button href="/" variant="secondary">
            戻る
          </Button>
        </div>
      </Card>
    </div>
  );
}
