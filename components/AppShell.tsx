import Link from "next/link";
import { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[rgb(var(--border))] bg-[rgba(10,10,12,0.85)] backdrop-blur">
        <div className="container-max py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="logo-mark" />
            <div className="leading-tight">
              <div className="text-sm font-bold">Design2Code Studio</div>
              <div className="text-xs text-[rgb(var(--muted))]">Figma → Code（MVP）</div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/new"
              className={[
                "btn btn-primary",
                "px-3 py-2 rounded-xl",
                "text-sm font-semibold"
              ].join(" ")}
            >
              新規作成
            </Link>

            <Link
              href="/dashboard"
              className={[
                "btn btn-secondary",
                "px-3 py-2 rounded-xl",
                "text-sm font-semibold"
              ].join(" ")}
            >
              ダッシュボード
            </Link>
          </nav>
        </div>
      </header>

      <main className="container-max py-10">{children}</main>

      <footer className="border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="container-max py-8 text-xs text-[rgb(var(--muted))]">
          © {new Date().getFullYear()} Design2Code Studio（MVP）
        </div>
      </footer>
    </div>
  );
}
