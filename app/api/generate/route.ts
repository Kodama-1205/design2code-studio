import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrUpdateProject, createGeneration, saveGenerationArtifacts, setGenerationStatus } from "@/lib/db";
import { runMockPipeline } from "@/lib/mockPipeline";
import { buildDemoBundle } from "@/lib/demoBundle";
import { env } from "@/lib/env";

const BodySchema = z.object({
  sourceUrl: z.string().min(10),
  profileId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional()
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { sourceUrl, profileId, projectId } = parsed.data;

  const fileKeyMatch = sourceUrl.match(/figma\.com\/file\/([^/]+)/);
  const nodeIdMatch = sourceUrl.match(/node-id=([^&]+)/);

  const figmaFileKey = fileKeyMatch?.[1] ?? "UNKNOWN_FILEKEY";
  const figmaNodeId = nodeIdMatch ? decodeURIComponent(nodeIdMatch[1]).replace("%3A", ":") : "0:0";

  const projectName = `Project ${figmaFileKey.slice(0, 6)} / ${figmaNodeId}`;

  let project: { id: string; owner_id: string; name: string; figma_file_key: string; figma_node_id: string; source_url: string } | null = null;
  let generation: { id: string; project_id: string } | null = null;

  try {
    project = await createOrUpdateProject({
      id: projectId,
      name: projectName,
      figma_file_key: figmaFileKey,
      figma_node_id: figmaNodeId,
      source_url: sourceUrl,
      default_profile_id: profileId ?? null
    });

    generation = await createGeneration({
      project_id: project.id,
      profile_id: profileId ?? null
    });

    await setGenerationStatus(generation.id, "running", { started_at: new Date().toISOString() });
  } catch {
    // Supabase 無料プラン制限などで DB 保存に失敗 → デモモードでパイプラインのみ実行
    const tempProjectId = crypto.randomUUID();
    const tempGenerationId = crypto.randomUUID();

    const artifacts = await runMockPipeline({
      figmaFileKey,
      figmaNodeId,
      sourceUrl,
      profileOverrideId: profileId ?? undefined,
      projectId: tempProjectId,
      generationId: tempGenerationId
    });

    const bundle = buildDemoBundle(
      tempProjectId,
      tempGenerationId,
      {
        name: projectName,
        figma_file_key: figmaFileKey,
        figma_node_id: figmaNodeId,
        source_url: sourceUrl,
        owner_id: env.D2C_OWNER_ID
      },
      artifacts
    );

    return NextResponse.json({ saved: false, bundle });
  }

  try {
    const artifacts = await runMockPipeline({
      figmaFileKey,
      figmaNodeId,
      sourceUrl,
      profileOverrideId: profileId ?? undefined,
      projectId: project!.id,
      generationId: generation!.id
    });

    await saveGenerationArtifacts({
      projectId: project!.id,
      generationId: generation!.id,
      profileSnapshot: artifacts.profileSnapshot,
      irJson: artifacts.ir,
      reportJson: artifacts.report,
      files: artifacts.files,
      mappings: artifacts.mappings,
      snapshotHash: artifacts.snapshotHash
    });

    await setGenerationStatus(generation!.id, "succeeded", { finished_at: new Date().toISOString() });

    return NextResponse.json({
      saved: true,
      projectId: project!.id,
      generationId: generation!.id
    });
  } catch (e: any) {
    const artifacts = await runMockPipeline({
      figmaFileKey,
      figmaNodeId,
      sourceUrl,
      profileOverrideId: profileId ?? undefined,
      projectId: project!.id,
      generationId: generation!.id
    }).catch(() => null);

    if (artifacts) {
      const bundle = buildDemoBundle(
        project!.id,
        generation!.id,
        {
          name: projectName,
          figma_file_key: figmaFileKey,
          figma_node_id: figmaNodeId,
          source_url: sourceUrl,
          owner_id: (project as any).owner_id ?? env.D2C_OWNER_ID
        },
        artifacts
      );
      return NextResponse.json({ saved: false, bundle });
    }

    try {
      await setGenerationStatus(generation!.id, "failed", {
        finished_at: new Date().toISOString(),
        error_json: { message: e?.message ?? "Unknown error" }
      });
    } catch {}

    return NextResponse.json({ error: "Generation failed", message: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
