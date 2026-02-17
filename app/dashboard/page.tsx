import Link from "next/link";
import { listProjects } from "@/lib/db";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/EmptyState";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import GenerationActions from "@/components/GenerationActions";
import ProjectThumbnail from "@/components/ProjectThumbnail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0; // 常に最新データを取得（キャッシュ無効化）

export default async function DashboardPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="h1">ダッシュボード</h1>
          <p className="p-muted mt-2">保存済みプロジェクト（生成履歴）を一覧表示します。</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="まだ保存されたプロジェクトがありません"
          description="新規作成からFigma URLを入力して生成し、保存するとここに並びます。"
          actionLabel="新規作成"
          actionHref="/new"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                {/* 確認用サムネイル（Storage にプレビューがある場合表示；取得失敗時は「画像なし」） */}
                {p.last_snapshot_hash ? (
                  <ProjectThumbnail
                    src={`/api/previews/${encodeURIComponent(p.id)}/${encodeURIComponent(p.last_snapshot_hash)}`}
                    href={p.last_generation_id ? `/projects/${p.id}/generations/${p.last_generation_id}` : `/projects/${p.id}`}
                  />
                ) : (
                  <div
                    className="shrink-0 rounded border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/10 flex items-center justify-center text-[10px] text-[rgb(var(--muted))]"
                    style={{ width: 72, height: 54 }}
                  >
                    画像なし
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <div className="mt-1 text-xs text-[rgb(var(--muted))] truncate">{p.source_url}</div>
                  <div className="mt-3 text-xs text-[rgb(var(--muted))] space-y-1">
                    <div>FileKey: {p.figma_file_key}</div>
                    <div>NodeId: {p.figma_node_id}</div>
                  </div>
                </div>

                <span className="badge shrink-0">Figma</span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <GenerationActions projectId={p.id} sourceUrl={p.source_url} />

                <div className="flex items-center gap-2">
                  <Link
                    className="btn btn-secondary px-3 py-2 rounded-xl text-sm font-semibold"
                    href={p.last_generation_id ? `/projects/${p.id}/generations/${p.last_generation_id}` : `/projects/${p.id}`}
                  >
                    開く
                  </Link>
                  <DeleteProjectButton projectId={p.id} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
