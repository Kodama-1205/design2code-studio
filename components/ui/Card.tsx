import { clsx } from "clsx";

export default function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-soft/10", className)}>
      {children}
    </div>
  );
}
