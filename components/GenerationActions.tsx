"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

/**
 * 生成結果ページ用の操作ボタン
 * - ZIP出力: /api/export-zip に files を渡してダウンロード
 * - 再生成: /new へ遷移（projectId + sourceUrl を維持）
 */

export default function GenerationActions(props: {
  projectId: string;
  sourceUrl: string;
  files?: Array<{ path: string; content: string }>;
  filename?: string;
}) {
  const { projectId, sourceUrl, files: filesProp } = props;
  const files = Array.isArray(filesProp) ? filesProp : [];
  const filename = props.filename ?? "design2code_export.zip";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExportZip() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/export-zip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files, filename }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? j?.error ?? "ZIPの生成に失敗しました。"
        );
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? "ZIPの生成に失敗しました（不明なエラー）");
    } finally {
      setBusy(false);
    }
  }

  const regenHref = `/new?projectId=${encodeURIComponent(projectId)}&sourceUrl=${encodeURIComponent(sourceUrl)}`;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button onClick={onExportZip} variant="secondary" disabled={busy || files.length === 0}>
          {busy ? "ZIP作成中..." : "ZIP出力"}
        </Button>
        <Button href={regenHref} variant="primary">
          再生成
        </Button>
      </div>

      {error && <div className="text-xs text-red-300">{error}</div>}
    </div>
  );
}
