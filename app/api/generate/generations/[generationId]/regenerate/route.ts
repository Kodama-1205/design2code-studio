import { NextResponse } from "next/server";
import { getGenerationBundle, createGeneration, setGenerationStatus, saveGenerationArtifacts } from "@/lib/db";
import { runMockPipeline } from "@/lib/mockPipeline";

export async function POST(_: Request, { params }: { params: { generationId: string } }) {
  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { project, generation } = bundle;

  const newGen = await createGeneration({
    project_id: project.id,
    profile_id: generation.profileId
  });

  await setGenerationStatus(newGen.id, "running", { started_at: new Date().toISOString() });

  try {
    const artifacts = await runMockPipeline({
      figmaFileKey: project.figma_file_key,
      figmaNodeId: project.figma_node_id,
      sourceUrl: project.source_url,
      profileOverrideId: generation.profileId ?? undefined,
      projectId: project.id,
      generationId: newGen.id
    });

    await saveGenerationArtifacts({
      projectId: project.id,
      generationId: newGen.id,
      profileSnapshot: artifacts.profileSnapshot,
      irJson: artifacts.ir,
      reportJson: artifacts.report,
      files: artifacts.files,
      mappings: artifacts.mappings,
      snapshotHash: artifacts.snapshotHash
    });

    await setGenerationStatus(newGen.id, "succeeded", { finished_at: new Date().toISOString() });

    // redirect to new result page
    return NextResponse.redirect(new URL(`/projects/${project.id}/generations/${newGen.id}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  } catch (e: any) {
    await setGenerationStatus(newGen.id, "failed", {
      finished_at: new Date().toISOString(),
      error_json: { message: e?.message ?? "Unknown error" }
    });
    return NextResponse.json({ error: "regenerate_failed", message: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
