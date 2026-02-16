import ResultTabs from "@/components/ResultTabs";
import { getGenerationBundle } from "@/lib/db";
import Card from "@/components/ui/Card";
import GenerationActions from "@/components/GenerationActions";

export default async function Page({
  params
}: {
  params: { projectId: string; generationId: string };
}) {
  const bundle = await getGenerationBundle(params.generationId);

  if (!bundle) {
    return (
      <div className="container-max py-10">
        <Card className="p-6">
          <div className="h2">Generation not found</div>
          <p className="p-muted mt-2">指定の generationId が見つかりませんでした。</p>
          <div className="mt-4">
            <a className="text-sm underline text-[rgb(var(--muted))]" href="/dashboard">
              ダッシュボードへ戻る
            </a>
          </div>
        </Card>
      </div>
    );
  }

  const { project, generation } = bundle;

  return (
    <div className="container-max py-10">
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

        <GenerationActions
          projectId={project.id}
          sourceUrl={project.source_url}
          files={bundle.files.map((f) => ({ path: f.path, content: f.content }))}
          filename={`${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip`}
        />
      </div>

      <div className="mt-6">
        <ResultTabs bundle={bundle} />
      </div>
    </div>
  );
}
