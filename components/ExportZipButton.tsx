"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { getAccessToken } from "@/lib/authClient";

export default function ExportZipButton(props: { generationId: string; filename?: string }) {
  const { generationId, filename } = props;
  const [busy, setBusy] = useState(false);

  async function onExport() {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("ログインが必要です。");
      const res = await fetch(`/api/generate/generations/${generationId}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `ZIP出力に失敗しました（HTTP ${res.status}）`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `design2code_${generationId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      window.alert(e?.message ?? "ZIP出力に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onExport} disabled={busy} variant="secondary">
      {busy ? "出力中..." : "ZIPを出力"}
    </Button>
  );
}

