"use client";

import { useMemo } from "react";

export default function CodeBlock({ code }: { code: string }) {
  const lines = useMemo(() => code.split("\n"), [code]);

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] overflow-hidden">
      <div className="px-4 py-2 border-b border-[rgb(var(--border))] text-xs text-[rgb(var(--muted))]">
        {lines.length} lines
      </div>
      <pre className="p-4 text-xs overflow-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
