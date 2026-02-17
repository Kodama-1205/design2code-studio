import { redirect } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import Card from "@/components/ui/Card";

/**
 * プロジェクト単体ページ
 * - 最新の generation があればその結果ページへリダイレクト
 * - なければ「まだ生成がありません」と新規生成へのリンクを表示
 */
export default async function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return (
      <div className="container-max py-10">
        <Card className="p-6">
          <div className="h2">Supabase が未設定です</div>
          <p className="p-muted mt-2">保存・ダッシュボード利用には環境変数を設定してください。</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm underline text-[rgb(var(--muted))]">
            ダッシュボードへ
          </Link>
        </Card>
      </div>
    );
  }

  const project = await getProject(params.projectId);
  if (!project) {
    return (
      <div className="container-max py-10">
        <Card className="p-6">
          <div className="h2">プロジェクトが見つかりません</div>
          <p className="p-muted mt-2">指定のプロジェクトは存在しないか、削除されています。</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm underline text-[rgb(var(--muted))]">
            ダッシュボードへ
          </Link>
        </Card>
      </div>
    );
  }

  const { data: gens } = await supabase
    .from("d2c_generations")
    .select("id")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestGenId = gens?.[0]?.id;
  if (latestGenId) {
    redirect(`/projects/${project.id}/generations/${latestGenId}`);
  }

  return (
    <div className="container-max py-10">
      <Card className="p-6">
        <div className="h2">{project.name}</div>
        <p className="p-muted mt-2 truncate">{project.source_url}</p>
        <p className="p-muted mt-4">まだこのプロジェクトの生成履歴がありません。</p>
        <Link
          href={`/new?projectId=${encodeURIComponent(project.id)}&sourceUrl=${encodeURIComponent(project.source_url)}`}
          className="mt-4 inline-block rounded-xl bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white"
        >
          生成する
        </Link>
        <Link href="/dashboard" className="ml-3 mt-4 inline-block text-sm underline text-[rgb(var(--muted))]">
          ダッシュボードへ
        </Link>
      </Card>
    </div>
  );
}
