import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOrUpdateProject,
  createGeneration,
  createGenerationJob,
  getActiveGenerationJobForProject,
  getLatestSucceededGenerationId,
  findProjectIdByFigmaSourceForOwner,
  claimGenerationJob,
  getGenerationJobByGenerationId,
  saveGenerationArtifacts,
  setGenerationStatus,
  updateGenerationJob
} from "@/lib/db";
import { runMockPipeline } from "@/lib/mockPipeline";
import { runFigmaPipeline } from "@/lib/figmaPipeline";
import { buildDemoBundle } from "@/lib/demoBundle";
import { envServer } from "@/lib/envServer";
import { FigmaRateLimitError } from "@/lib/figma";
import { processGenerationJob } from "@/lib/generationWorker";
import { requireUserIdFromRequest } from "@/lib/authApi";
import { hasUserFigmaPat } from "@/lib/userSecrets";

const BodySchema = z.object({
  sourceUrl: z.string().min(10),
  profileId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional()
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  const reqClone = req.clone();
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    const raw = await reqClone.text().catch(() => "");
    const details = parsed.error.flatten();
    console.error("Invalid /api/generate body", { raw, details });
    return NextResponse.json(
      {
        error: "Invalid body",
        message: "Invalid body",
        details,
        raw
      },
      { status: 400 }
    );
  }

  const { sourceUrl, profileId, projectId } = parsed.data;
  const isFigmaUrl = /figma\.com\//.test(sourceUrl);
  const userHasToken = await hasUserFigmaPat(userId).catch(() => false);
  const wantFigma = isFigmaUrl && userHasToken;

  const fileKeyMatch =
    sourceUrl.match(/figma\.com\/file\/([^/]+)/) ??
    sourceUrl.match(/figma\.com\/design\/([^/]+)/) ??
    sourceUrl.match(/figma\.com\/proto\/([^/]+)/);
  const nodeIdMatch = sourceUrl.match(/node-id=([^&]+)/);

  const figmaFileKey = fileKeyMatch?.[1] ?? "UNKNOWN_FILEKEY";
  const rawNodeId = nodeIdMatch ? decodeURIComponent(nodeIdMatch[1]).replace("%3A", ":") : "0:0";
  const figmaNodeId = rawNodeId.includes(":") ? rawNodeId : rawNodeId.replace(/-/g, ":");
  console.log("Generate request", {
    hasFigmaToken: Boolean(envServer.FIGMA_ACCESS_TOKEN),
    figmaFileKey,
    figmaNodeId,
    sourceUrl
  });

  const projectName = `Project ${figmaFileKey.slice(0, 6)} / ${figmaNodeId}`;

  let project: { id: string; owner_id: string; name: string; figma_file_key: string; figma_node_id: string; source_url: string } | null = null;
  let baseGenerationId: string | null = null;

  try {
    const resolvedProjectId =
      projectId ??
      (await findProjectIdByFigmaSourceForOwner(userId, { figma_file_key: figmaFileKey, figma_node_id: figmaNodeId }).catch(() => null)) ??
      undefined;

    project = await createOrUpdateProject({
      id: resolvedProjectId,
      owner_id: userId,
      name: projectName,
      figma_file_key: figmaFileKey,
      figma_node_id: figmaNodeId,
      source_url: sourceUrl,
      default_profile_id: profileId ?? null
    });
  } catch {
    // Supabase 無料プラン制限などで DB 保存に失敗 → デモモードでパイプラインのみ実行
    const tempProjectId = crypto.randomUUID();
    const tempGenerationId = crypto.randomUUID();

    try {
      const finalArtifacts = wantFigma
        ? await runFigmaPipeline({
            ownerId: userId,
            figmaFileKey,
            figmaNodeId,
            sourceUrl,
            profileOverrideId: profileId ?? undefined,
            projectId: tempProjectId,
            generationId: tempGenerationId,
            figmaToken: envServer.FIGMA_ACCESS_TOKEN!
          })
        : await runMockPipeline({
            figmaFileKey,
            figmaNodeId,
            sourceUrl,
            profileOverrideId: profileId ?? undefined,
            projectId: tempProjectId,
            generationId: tempGenerationId
          });
      console.log("Generate pipeline used", { usingFigma: wantFigma });

      const bundle = buildDemoBundle(
        tempProjectId,
        tempGenerationId,
        {
          name: projectName,
          figma_file_key: figmaFileKey,
          figma_node_id: figmaNodeId,
          source_url: sourceUrl,
          owner_id: userId
        },
        finalArtifacts
      );

      return NextResponse.json({ saved: false, bundle });
    } catch (e: any) {
      if (e instanceof FigmaRateLimitError) {
        return NextResponse.json(
          {
            saved: false,
            error: "figma_rate_limited",
            message:
              e.retryAfterSec >= 600
                ? "Figma が混雑しています（レート制限）。しばらく待ってから再実行してください。"
                : `Figma が混雑しています（レート制限）。約${e.retryAfterSec}秒後に再実行してください。`,
            retryAfterSec: e.retryAfterSec
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { saved: false, error: "pipeline_failed", message: e?.message ?? "Unknown error" },
        { status: wantFigma ? 502 : 500 }
      );
    }
  }

  // Immediate result strategy:
  // 1) If we already have a succeeded generation for this project, show it immediately (cache) and start updating in background.
  // 2) Otherwise, create a provisional generation with mock artifacts immediately (code/ZIP available right away),
  //    and in parallel create a real generation that will be updated via job retries.

  const cachedId = await getLatestSucceededGenerationId(project!.id).catch(() => null);
  if (cachedId) baseGenerationId = cachedId;

  // If already updating, reuse existing job (avoid job/generation explosion on repeated clicks)
  const activeJob = userHasToken ? await getActiveGenerationJobForProject({ ownerId: userId, projectId: project!.id }).catch(() => null) : null;

  // Create "real" generation that will be updated by the job worker (only if user token exists)
  const realGen = userHasToken
    ? activeJob
      ? ({ id: activeJob.generation_id } as any)
      : await createGeneration({
          project_id: project!.id,
          profile_id: profileId ?? null,
          ownerId: userId
        })
    : null;

  // If there is no cached result yet, create provisional generation immediately
  if (!baseGenerationId) {
    const provisional = await createGeneration({
      project_id: project!.id,
      profile_id: profileId ?? null,
      ownerId: userId
    });

    const mockArtifacts = await runMockPipeline({
      figmaFileKey,
      figmaNodeId,
      sourceUrl,
      profileOverrideId: profileId ?? undefined,
      projectId: project!.id,
      generationId: provisional.id
    });

    await saveGenerationArtifacts({
      projectId: project!.id,
      generationId: provisional.id,
      profileSnapshot: mockArtifacts.profileSnapshot,
      irJson: mockArtifacts.ir,
      reportJson: mockArtifacts.report,
      files: mockArtifacts.files,
      mappings: mockArtifacts.mappings,
      snapshotHash: mockArtifacts.snapshotHash
    });

    await setGenerationStatus(provisional.id, "succeeded", {
      finished_at: new Date().toISOString(),
      error_json: {
        provisional: true,
        note: "初回は暫定コード（テンプレ）を即表示し、裏で本生成を実行します。"
      }
    });

    baseGenerationId = provisional.id;
  }

  // Start job for "real" generation (if we created a new one)
  if (realGen && !activeJob) {
    const workerId = `inline:${crypto.randomUUID()}`;
    await createGenerationJob({ ownerId: userId, projectId: project!.id, generationId: realGen.id });
    const claimed = await claimGenerationJob({ generationId: realGen.id, workerId, lockTtlSec: 300 }).catch(() => null);
    if (claimed) {
      // best-effort start (may become waiting)
      await processGenerationJob(claimed as any, workerId);
    }
  }

  console.log("Generate immediate", {
    projectId: project!.id,
    baseGenerationId,
    realGenerationId: realGen?.id ?? null,
    cached: Boolean(cachedId),
    provisionalCreated: !Boolean(cachedId),
    userHasToken
  });

  return NextResponse.json({
    saved: true,
    projectId: project!.id,
    generationId: baseGenerationId,
    updatingGenerationId: realGen?.id ?? null,
    cached: Boolean(cachedId),
    provisional: !Boolean(cachedId),
    needsFigmaToken: !userHasToken && isFigmaUrl
  });
}
