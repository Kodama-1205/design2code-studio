"use client";

import { useEffect, useState } from "react";
import ResultTabs from "@/components/ResultTabs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { GenerationBundle } from "@/lib/db";

const DEMO_STORAGE_KEY = "d2c_demo_bundle";

type Bundle = NonNullable<GenerationBundle>;

export default function ResultPage() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) setBundle(JSON.parse(raw) as Bundle);
    } catch {
      setBundle(null);
    }
  }, []);

  async function handleExportZip() {
    if (!bundle) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: bundle.files.map((f) => ({ path: f.path, content: f.content })),
          filename: `design2code_demo_${bundle.project.id}_${bundle.generation.id}.zip`
        })
      });
      if (!res.ok) throw new Error("ZIP出力に失敗しました。");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `design2code_demo_${bundle.project.id}_${bundle.generation.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  if (bundle === null) {
    return (
      <div className="container-max py-10">
        <Card className="p-6">
          <div className="h2">デモ結果がありません</div>
          <p className="p-muted mt-2">
            保存機能がオフの状態で生成した結果は、このページで表示されます。先に「新規生成」から Figma URL で生成してください。
          </p>
          <div className="mt-4">
            <Button href="/new" variant="primary">
              New Generation
            </Button>

            <span className="ml-2 inline-block">
              <Button href="/" variant="secondary">
                Dashboard
              </Button>
            </span>
          </div>
        </Card>
      </div>
    );
  }

  const { project, generation } = bundle;

  return (
    <div className="container-max py-10">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 mb-6">
        <strong>デモモード</strong> — プロジェクトは保存されていません。コードの確認とZIP出力のみ利用できます。2月2日以降の Supabase プロプランで保存が有効になります。
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="h1">{project.name}</h1>
            <span className="badge">{generation.status}</span>
            <span className="badge">{generation.profile.mode}</span>
            <span className="badge">{generation.profile.outputTarget}</span>
          </div>
          <p className="p-muted mt-2 truncate">{project.source_url}</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleExportZip} disabled={exporting} variant="secondary">
            {exporting ? "出力中..." : "ZIPを出力"}
          </Button>
          <Button href="/new" variant="ghost">
            新規生成
          </Button>
          <Button href="/dashboard" variant="secondary">
            ダッシュボード
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <ResultTabs bundle={bundle} />
      </div>
    </div>
  );
}
