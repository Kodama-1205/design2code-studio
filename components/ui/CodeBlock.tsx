"use client";

import { useMemo } from "react";

/**
 * オレンジ系テーマ + 日本語表記対応
 * - レイアウト/構造は変更しない
 * - "lines" を日本語に
 * - 色指定は既存の CSS 変数（--border / --surface2 / --muted）で十分なので追加変更なし
 */
export default function CodeBlock({ code }: { code: string }) {
  const lines = useMemo(() => code.split("\n"), [code]);

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] overflow-hidden">
      <div className="px-4 py-2 border-b border-[rgb(var(--border))] text-xs text-[rgb(var(--muted))]">
        {lines.length} 行
      </div>
      <pre className="p-4 text-xs overflow-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
