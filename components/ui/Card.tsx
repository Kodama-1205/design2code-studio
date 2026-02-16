import { clsx } from "clsx";

/**
 * オレンジ系テーマ対応
 * - Card 自体は既存の CSS 変数（--border / --surface）を使っているため、
 *   基本は globals.css の変数差し替えだけでテーマが反映される。
 * - ここでは「ハイライト（オレンジのうっすらグロー）」を追加しても良いという要望に合わせ、
 *   レイアウトを崩さない範囲で subtle な背景グラデを追加。
 * - 既存の丸み/枠/背景/影は維持。
 */
export default function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        // 既存：丸み/枠/背景/影
        "rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-soft/10",
        // 追加：オレンジの淡いハイライト（破壊的変更を避けるため very subtle）
        "bg-gradient-to-b from-[rgba(var(--accent2),0.06)] to-[rgba(var(--accent3),0.02)]",
        className
      )}
    >
      {children}
    </div>
  );
}
