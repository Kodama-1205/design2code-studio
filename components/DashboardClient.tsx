"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import DashboardProjectsGrid from "@/components/DashboardProjectsGrid";

export default function DashboardClient() {
  return (
    <div className="container-max py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="h1">Design2Code Studio</h1>
          <p className="p-muted mt-2">Figma URL からコードを生成し、プレビュー・差分・ZIP出力まで行う実務向けツールです。</p>
        </div>
        <div className="flex gap-2">
          <Button href="/settings" variant="secondary">
            設定（Figmaトークン）
          </Button>
          <Button href="/new" variant="primary">
            新規生成
          </Button>
        </div>
      </div>

      <Card className="mt-6 p-6">
        <div className="h2">使い方（3ステップ）</div>
        <p className="p-muted mt-2 text-sm">Figma の Frame URL（node-id 付き）を使って生成します。</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
            <div className="text-sm font-semibold">1. 新規生成</div>
            <div className="p-muted mt-1 text-sm">Figma URL を貼り付けて生成。</div>
          </li>
          <li className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
            <div className="text-sm font-semibold">2. 結果確認</div>
            <div className="p-muted mt-1 text-sm">プレビュー / コード / レポート / マッピング を確認。</div>
          </li>
          <li className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
            <div className="text-sm font-semibold">3. ZIP出力</div>
            <div className="p-muted mt-1 text-sm">生成ファイル一式をZIPで取得。</div>
          </li>
        </ol>
      </Card>

      <DashboardProjectsGrid emptyAction="new" />
    </div>
  );
}

