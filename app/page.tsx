import { listProjects } from "@/lib/db";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/EmptyState";

export default async function Page() {
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let saveDisabled = false;

  try {
    projects = await listProjects();
  } catch {
    saveDisabled = true;
  }

  return (
    <div className="container-max py-10">
      {saveDisabled && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong>保存機能は現在ご利用いただけません。</strong> Supabase が無料プランまたは接続制限のため、プロジェクト一覧の取得に失敗しています。New Generation ではコード生成・プレビュー・ZIP出力までお試し頂けます。2月2日以降のプロプランアップグレードで保存が有効になります。
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="h1">Design2Code Studio</h1>
          <p className="p-muted mt-2">
            Figma URL からコードを生成し、プレビュー・差分・ZIP出力まで行うデモ実装（MVP骨組み）です。
          </p>
        </div>
        <Button href="/new" variant="primary">
          New Generation
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              title="まだプロジェクトがありません"
              description={saveDisabled
                ? "上記の通り保存は無効です。New Generation から Figma URL を貼り付けて生成すると、結果の確認とZIP出力ができます。"
                : "New Generation からFigma URLを貼り付けて生成してください。"}
              actionHref="/new"
              actionLabel="New Generation"
            />
          </div>
        ) : (
          projects.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{p.name}</div>
                  <div className="p-muted mt-1 truncate">{p.source_url}</div>
                </div>
                <span className="badge">Figma</span>
              </div>

              <div className="mt-4 text-xs text-[rgb(var(--muted))]">
                <div>FileKey: {p.figma_file_key}</div>
                <div>NodeId: {p.figma_node_id}</div>
              </div>

              <div className="mt-5 flex gap-2">
                <Button href={`/new?projectId=${p.id}`} variant="ghost">
                  Regenerate
                </Button>
                <Button
                  href={p.last_generation_id ? `/projects/${p.id}/generations/${p.last_generation_id}` : `/new?projectId=${p.id}`}
                  variant="secondary"
                >
                  Open
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
