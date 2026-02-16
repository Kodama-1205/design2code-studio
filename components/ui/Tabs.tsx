"use client";

import { clsx } from "clsx";

/**
 * オレンジ系テーマ対応
 * - 直書きの紫（rgba(170,90,255,...)）を CSS 変数（--accent）に置換
 * - レイアウト/構造は変更しない
 */
export default function Tabs({
  tabs,
  active,
  onChange
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="px-2 pb-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const isActive = t === active;
          return (
            <button
              key={t}
              onClick={() => onChange(t)}
              className={clsx(
                "rounded-xl px-3 py-2 text-sm border transition",
                isActive
                  ? "border-[rgba(var(--accent),0.75)] bg-[rgba(var(--accent),0.10)]"
                  : "border-[rgb(var(--border))] bg-[rgb(var(--surface2))] hover:border-[rgba(var(--accent),0.45)]"
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
