import Link from "next/link";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="container-max py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[rgb(var(--primary))] to-[rgb(var(--primary2))] shadow-soft" />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Design2Code Studio</div>
              <div className="text-xs text-[rgb(var(--muted))] leading-tight">MVP scaffold</div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/new"
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-3 py-2 text-sm hover:border-[rgba(170,90,255,0.55)] transition"
            >
              New
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm hover:bg-[rgba(255,255,255,0.03)] transition"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-[rgb(var(--border))] mt-14">
        <div className="container-max py-6 text-xs text-[rgb(var(--muted))]">
          This scaffold stores generated files in DB for code view and ZIP export.
        </div>
      </footer>
    </div>
  );
}
