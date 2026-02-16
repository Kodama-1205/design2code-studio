"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

/**
 * ダッシュボード用：プロジェクト削除ボタン
 * - Server Component（dashboard）からは projectId（文字列）だけ渡す
 * - 削除後は router.refresh() で一覧更新
 */
export default function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onDelete = () => {
    const ok = window.confirm(
      "このプロジェクトを削除します。よろしいですか？\n（生成履歴も一緒に削除されます）"
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({} as any));
          throw new Error(data?.error ?? `Delete failed: ${res.status}`);
        }

        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "削除に失敗しました。");
      }
    });
  };

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={onDelete}
      disabled={pending}
    >
      削除
    </Button>
  );
}
