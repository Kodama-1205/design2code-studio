import { NextResponse } from "next/server";
import { FigmaRateLimitError } from "@/lib/figma";
import {
  getGenerationBundle,
  createGeneration,
  setGenerationStatus,
  saveGenerationArtifacts,
  saveGenerationImages,
} from "@/lib/db";
import { runPixelFigmaPipeline } from "@/lib/pixelPipeline";
import { runMockPipeline } from "@/lib/mockPipeline";

export async function POST(req: Request, { params }: { params: { generationId: string } }) {
  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { figmaToken?: string };
  const figmaToken = typeof body.figmaToken === "string" ? body.figmaToken.trim() || undefined : undefined;

  const { project, generation } = bundle;

  const newGen = await createGeneration({ project_id: project.id, profile_id: generation.profileId });
  await setGenerationStatus(newGen.id, "running", { started_at: new Date().toISOString() });

  try {
    let artifacts: Awaited<ReturnType<typeof runMockPipeline>>;

    if (figmaToken) {
      const pixelResult = await runPixelFigmaPipeline({
        figmaFileKey: project.figma_file_key,
        figmaNodeId: project.figma_node_id,
        sourceUrl: project.source_url,
        figmaToken,
      });

      await saveGenerationImages({
        projectId: project.id,
        snapshotHash: pixelResult.snapshotHash,
        figmaPng: pixelResult.figmaPng,
        renderPng: pixelResult.renderPng,
        diffPng: pixelResult.diffPng,
      }).catch((e) => {
        console.error("[regenerate] 画像保存に失敗（生成は続行）:", e instanceof Error ? e.message : String(e));
      });

      artifacts = pixelResult;
    } else {
      artifacts = await runMockPipeline({
        figmaFileKey: project.figma_file_key,
        figmaNodeId: project.figma_node_id,
        sourceUrl: project.source_url,
        projectId: project.id,
        generationId: newGen.id,
      });
    }

    await saveGenerationArtifacts({
      projectId: project.id,
      generationId: newGen.id,
      profileSnapshot: artifacts.profileSnapshot,
      irJson: artifacts.ir,
      reportJson: artifacts.report,
      files: artifacts.files,
      mappings: artifacts.mappings,
      snapshotHash: artifacts.snapshotHash,
    });

    await setGenerationStatus(newGen.id, "succeeded", { finished_at: new Date().toISOString() });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(
      new URL(`/projects/${project.id}/generations/${newGen.id}`, appUrl)
    );
  } catch (e: any) {
    if (e instanceof FigmaRateLimitError) {
      await setGenerationStatus(newGen.id, "failed", {
        finished_at: new Date().toISOString(),
        error_json: { message: e.message, kind: "figma_rate_limited" },
      });
      return NextResponse.json({ error: "rate_limited", message: e.message }, { status: 429 });
    }
    await setGenerationStatus(newGen.id, "failed", {
      finished_at: new Date().toISOString(),
      error_json: { message: e?.message ?? "Unknown error" },
    });
    return NextResponse.json(
      { error: "regenerate_failed", message: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
