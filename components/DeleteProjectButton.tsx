"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { getAccessToken } from "@/lib/authClient";

export default function DeleteProjectButton(props: { projectId: string; projectName: string }) {
  const { projectId, projectName } = props;
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (busy) return;
    const ok = window.confirm(`プロジェクト「${projectName}」を削除します。\n関連する生成結果も削除されます。\nよろしいですか？`);
    if (!ok) return;

    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("ログインが必要です。");
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "削除に失敗しました。");
      // キャッシュ/SSR更新の揺れを避けるため、確実に再取得する
      window.location.assign(`/?r=${Date.now()}`);
    } catch (e: any) {
      window.alert(e?.message ?? "削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onDelete} disabled={busy} variant="ghost">
      {busy ? "削除中..." : "削除"}
    </Button>
  );
}

