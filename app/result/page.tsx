"use client";

// app/result/page.tsx
import { useEffect, useState } from "react";
import ResultTabs from "@/components/ResultTabs";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { GenerationBundle } from "@/lib/db";

const DEMO_STORAGE_KEY = "d2c_demo_bundle";

type Bundle = NonNullable<GenerationBundle>;

function toJaStatus(status: string) {
  switch (status) {
    case "succeeded":
      return "成功";
    case "running":
      return "実行中";
    case "failed":
      return "失敗";
    case "queued":
      return "待機中";
    default:
      return status;
  }
}

function toJaMode(mode: string) {
  switch (mode) {
    case "production":
      return "本番";
    case "development":
      return "開発";
    default:
      return mode;
  }
}

function toJaOutputTarget(target: string) {
  if (target === "nextjs_tailwind") return "Next.js / Tailwind";
  return target;
}

export default function Page() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // デモモード: sessionStorage から取得
    try {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Bundle;
        setBundle(parsed);
      }
    } catch {
      // sessionStorage の読み取りに失敗
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="container-max py-10">
        <Card className="p-6">
          <div className="h2">読み込み中...</div>
        </Card>
      </div>
    );
  }

  // バンドルが無い場合（デモモードの結果が無い）
  if (!bundle) {
    return (
      <div className="container-max py-10">
        <Card className="p-6">
          <div className="h2">デモ結果がありません</div>
          <p className="p-muted mt-2">
            先に「新規作成」から Figma URL を生成してください。
          </p>
          <div className="mt-4 flex gap-2">
            <Button href="/new" variant="primary">
              新規作成
            </Button>
            <Button href="/" variant="secondary">
              ダッシュボード
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { project, generation } = bundle;

  return (
    <div className="container-max py-10">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 mb-6">
        <strong>デモモード</strong> — プロジェクトは保存されていません。コードの確認とZIP出力のみ利用できます。
        <p className="mt-2 text-xs opacity-90">
          保存・ダッシュボード・削除を使うには、環境変数（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / D2C_OWNER_ID）を設定して再デプロイしてください。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="h1">{project.name}</h1>
            <span className="badge">{toJaStatus(generation.status)}</span>
            <span className="badge">{toJaMode(generation.profile.mode)}</span>
            <span className="badge">{toJaOutputTarget(generation.profile.outputTarget)}</span>
          </div>
          <p className="p-muted mt-2 truncate">{project.source_url}</p>
        </div>

        {/* /result は "表示専用" なので、操作ボタンは置かない（スクショ安定化） */}
      </div>

      <div className="mt-6">
        <ResultTabs bundle={bundle} />
      </div>
    </div>
  );
}
