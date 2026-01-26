import ResultTabs from "@/components/ResultTabs";
import { getGenerationBundle } from "@/lib/db";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

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
            <Button href="/" variant="secondary">
              Back to Dashboard
            </Button>
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

        <div className="flex gap-2">
          <Button href={`/api/generate/generations/${generation.id}/export`} variant="secondary">
            Export ZIP
          </Button>
          <form action={`/api/generate/generations/${generation.id}/regenerate`} method="post">
            <Button type="submit" variant="primary">
              Regenerate
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <ResultTabs bundle={bundle} />
      </div>
    </div>
  );
}
