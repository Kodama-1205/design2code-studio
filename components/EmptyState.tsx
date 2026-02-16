import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

/**
 * EmptyState（空状態）
 * - 既存のレイアウトに影響を与えず、下部の「新規作成」ボタンをデフォルトで非表示にする安全版
 * - showAction === true のときだけ action ボタンを表示
 *
 * 目的:
 * - ヘッダー（AppShell）の「新規作成」に導線を一本化する
 * - app/page.tsx 等を触らずに、重複ボタンだけ確実に消す
 */
export default function EmptyState(props: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  showAction?: boolean; // ★追加：明示 true のときだけボタン表示
}) {
  const { title, description, actionHref, actionLabel, showAction = false } = props;

  const canShow = Boolean(showAction && actionHref && actionLabel);

  return (
    <Card className="p-10">
      <div className="text-center">
        <div className="text-base font-semibold">{title}</div>
        {description && <div className="p-muted mt-2 text-sm">{description}</div>}

        {canShow && (
          <div className="mt-6">
            <Button href={actionHref!} variant="primary">
              {actionLabel!}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
