"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { getAccessToken } from "@/lib/authClient";

export default function RegenerateButton(props: { generationId: string }) {
  const { generationId } = props;
  const [busy, setBusy] = useState(false);

  async function onRegenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("ログインが必要です。");
      const res = await fetch(`/api/generate/generations/${generationId}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      // NextResponse.redirect は fetch だと redirected=true になる
      if (res.redirected) {
        window.location.assign(res.url);
        return;
      }

      const text = await res.text().catch(() => "");
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.message ?? data?.error ?? `再生成に失敗しました（HTTP ${res.status}）`;
        throw new Error(msg);
      }

      // 念のため（redirectじゃない成功応答の場合）
      if (data?.projectId && data?.generationId) {
        window.location.assign(`/projects/${data.projectId}/generations/${data.generationId}`);
        return;
      }

      window.alert("再生成が完了しました。ページを更新します。");
      window.location.reload();
    } catch (e: any) {
      window.alert(e?.message ?? "再生成に失敗しました。しばらく待ってから再実行してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onRegenerate} disabled={busy} variant="primary">
      {busy ? "再生成中..." : "再生成"}
    </Button>
  );
}

