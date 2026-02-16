"use client";

import Button from "@/components/ui/Button";
import { usePathname } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname();
  const isTop = pathname === "/";

  return (
    <div className="w-full border-b border-white/10 bg-black/20">
      <div className="container-max py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[rgb(var(--accent))] to-[rgb(var(--accent2))]" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Design2Code Studio</div>
            <div className="text-xs text-[rgb(var(--muted))] truncate">MVP 雛形</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ✅ TOPページではTOPボタン不要 → 非表示 */}
          {!isTop && (
            <Button href="/" variant="secondary">
              TOP
            </Button>
          )}

          <Button href="/new" variant="primary">
            新規作成
          </Button>

          <Button href="/dashboard" variant="secondary">
            ダッシュボード
          </Button>
        </div>
      </div>
    </div>
  );
}
