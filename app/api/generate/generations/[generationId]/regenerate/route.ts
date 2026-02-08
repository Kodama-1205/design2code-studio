import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  getGenerationBundle,
  createGeneration,
  createGenerationJob,
  claimGenerationJob,
  getActiveGenerationJobForProject,
  getLatestSucceededGenerationId,
  saveGenerationArtifacts,
  setGenerationStatus
} from "@/lib/db";
import { processGenerationJob } from "@/lib/generationWorker";
import { requireUserIdFromRequest } from "@/lib/authApi";
import { runMockPipeline } from "@/lib/mockPipeline";

export async function POST(req: Request, { params }: { params: { generationId: string } }) {
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { project, generation } = bundle;
  if (project.owner_id !== userId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Avoid job explosion on repeated clicks: reuse an active job if it exists.
  const activeJob = await getActiveGenerationJobForProject({ ownerId: userId, projectId: project.id }).catch(() => null);

  // Create/start the "real" generation only when there isn't one already in-flight.
  let realGenId: string;
  if (activeJob) {
    realGenId = activeJob.generation_id;
  } else {
    const realGen = await createGeneration({
      project_id: project.id,
      profile_id: generation.profileId,
      ownerId: userId
    });
    realGenId = realGen.id;

    const workerId = `inline:${crypto.randomUUID()}`;
    await createGenerationJob({ ownerId: userId, projectId: project.id, generationId: realGen.id });
    const claimed = await claimGenerationJob({ generationId: realGen.id, workerId, lockTtlSec: 300 }).catch(() => null);
    const result = claimed ? await processGenerationJob(claimed as any, workerId) : ({ status: "waiting" as const } as any);
    if (result.status === "succeeded") {
      return NextResponse.redirect(
        new URL(`/projects/${project.id}/generations/${realGen.id}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
      );
    }
  }

  // Immediate result strategy:
  // - Prefer current succeeded generation
  // - Else latest succeeded generation
  // - Else create a provisional (mock) generation immediately so code/ZIP is always available right away
  let immediateId: string | null =
    generation.status === "succeeded" ? generation.id : await getLatestSucceededGenerationId(project.id).catch(() => null);

  if (!immediateId) {
    const provisional = await createGeneration({
      project_id: project.id,
      profile_id: generation.profileId,
      ownerId: userId
    });

    const mockArtifacts = await runMockPipeline({
      figmaFileKey: project.figma_file_key,
      figmaNodeId: project.figma_node_id,
      sourceUrl: project.source_url,
      profileOverrideId: generation.profileId ?? undefined,
      projectId: project.id,
      generationId: provisional.id
    });

    await saveGenerationArtifacts({
      projectId: project.id,
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
        fallback: { type: "mock", reason: "provisional_template" },
        note: "再生成は暫定コード（テンプレ）を即表示し、裏で本生成を実行します。"
      }
    });

    immediateId = provisional.id;
  }

  return NextResponse.redirect(
    new URL(
      `/projects/${project.id}/generations/${immediateId}?updating=${realGenId}`,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    )
  );
}
