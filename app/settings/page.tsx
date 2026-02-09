"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getAccessToken } from "@/lib/authClient";

export default function Page() {
  const [busy, setBusy] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const token = await getAccessToken();
    if (!token) {
      window.location.assign("/login");
      return;
    }
    const res = await fetch("/api/figma-token", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (res.ok) setHasToken(Boolean(data?.hasToken));
    else setHasToken(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const access = await getAccessToken();
      if (!access) throw new Error("ログインが必要です。");
      const res = await fetch("/api/figma-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ token: tokenInput })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? "保存に失敗しました。");
      setTokenInput("");
      setMsg("保存しました。次回の生成からこのトークンを使用します。");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = window.confirm("Figmaトークンを削除します。よろしいですか？");
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const access = await getAccessToken();
      if (!access) throw new Error("ログインが必要です。");
      const res = await fetch("/api/figma-token", { method: "DELETE", headers: { Authorization: `Bearer ${access}` } });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "削除に失敗しました。");
      setMsg("削除しました。");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-max py-10">
      <Card className="p-6">
        <h1 className="h1">設定</h1>
        <p className="p-muted mt-2">講師向け: 各ユーザーのFigmaトークン（PAT）で生成を分散します。</p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm">
            <div className="font-semibold">Figmaトークン</div>
            <div className="mt-1 text-[rgb(var(--muted))]">
              状態: {hasToken === null ? "確認中…" : hasToken ? "設定済み" : "未設定"}
            </div>
            <div className="mt-2 text-xs text-[rgb(var(--muted))]">
              推奨スコープ: <code>file_content:read</code>（少なくともこれが必要）
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold">新しいトークンを保存</label>
            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="figd_..."
              className="mt-2 w-full min-h-[96px] rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none focus:border-[rgba(170,90,255,0.75)]"
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={save} disabled={busy || tokenInput.trim().length < 10} variant="primary">
                {busy ? "保存中…" : "保存"}
              </Button>
              <Button onClick={remove} disabled={busy || !hasToken} variant="secondary">
                削除
              </Button>
              <Button href="/" variant="ghost">
                戻る
              </Button>
            </div>
          </div>
        </div>

        {msg ? (
          <div className="mt-4 rounded-xl border border-[rgb(var(--border))] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm whitespace-pre-wrap">
            {msg}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

