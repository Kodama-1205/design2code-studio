import { envServer } from "@/lib/envServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { FigmaRateLimitError } from "@/lib/figma";
import { runPixelFigmaPipeline } from "@/lib/pixelPipeline";
import { runMockPipeline } from "@/lib/mockPipeline";
import { saveGenerationArtifacts, saveGenerationImages, setGenerationStatus, updateGenerationJob } from "@/lib/db";
import { getUserFigmaPat } from "@/lib/userSecrets";

type JobRow = {
  id: string;
  owner_id: string;
  project_id: string;
  generation_id: string;
  status: "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";
  attempt_count: number;
  next_attempt_at: string;
  locked_by: string | null;
  locked_at: string | null;
  last_error: any | null;
  created_at: string;
  updated_at: string;
} | null;

function clampRetryAfterSec(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return 60;
  return Math.max(30, Math.min(600, Math.floor(sec)));
}

export async function processGenerationJob(job: NonNullable<JobRow>, workerId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { status: "failed" as const, message: "supabase_not_configured" };

  const { data: gen, error: genErr } = await supabaseAdmin
    .from("d2c_generations")
    .select("*")
    .eq("id", job.generation_id)
    .single();

  if (genErr) {
    await updateGenerationJob(job.id, {
      status: "failed",
      locked_by: null,
      locked_at: null,
      last_error: { message: genErr.message, kind: "generation_not_found" },
      updated_at: new Date().toISOString(),
    } as any);
    return { status: "failed" as const };
  }

  if ((gen as any).status === "succeeded") {
    await updateGenerationJob(job.id, {
      status: "succeeded",
      locked_by: null,
      locked_at: null,
      updated_at: new Date().toISOString(),
    } as any);
    return { status: "succeeded" as const };
  }

  const { data: project, error: projErr } = await supabaseAdmin
    .from("d2c_projects")
    .select("*")
    .eq("id", job.project_id)
    .single();

  if (projErr) {
    await updateGenerationJob(job.id, {
      status: "failed",
      locked_by: null,
      locked_at: null,
      last_error: { message: projErr.message, kind: "project_not_found" },
      updated_at: new Date().toISOString(),
    } as any);
    return { status: "failed" as const };
  }

  const ownerId = ((job as any).owner_id ?? (project as any).owner_id) as string;
  const userToken = await getUserFigmaPat(ownerId).catch(() => null);
  const isFigmaUrl = /figma\.com\//.test((project as any).source_url);

  // Figma URL かつトークン未設定の場合は即失敗
  if (isFigmaUrl && !userToken) {
    await updateGenerationJob(job.id, {
      status: "failed",
      locked_by: null,
      locked_at: null,
      last_error: { kind: "missing_figma_token", message: "Figmaトークンが未設定です。設定画面でPATを登録してください。", workerId },
      updated_at: new Date().toISOString(),
    } as any);
    await setGenerationStatus(job.generation_id, "failed", {
      finished_at: new Date().toISOString(),
      error_json: { message: "Figmaトークンが未設定です。設定画面でPATを登録してください。", kind: "missing_figma_token" },
    });
    return { status: "failed" as const, message: "missing_figma_token" };
  }

  try {
    await setGenerationStatus(job.generation_id, "running", {
      started_at: (gen as any).started_at ?? new Date().toISOString(),
    });

    let artifacts: Awaited<ReturnType<typeof runMockPipeline>>;

    if (isFigmaUrl && userToken) {
      // pixelPipeline: Nodes API → IR → absolute HTML → 視覚検証
      const pixelResult = await runPixelFigmaPipeline({
        figmaFileKey: (project as any).figma_file_key,
        figmaNodeId: (project as any).figma_node_id,
        sourceUrl: (project as any).source_url,
        figmaToken: userToken,
      });

      // 画像3点を Storage に保存（失敗しても生成は続行）
      await saveGenerationImages({
        projectId: (project as any).id,
        snapshotHash: pixelResult.snapshotHash,
        figmaPng: pixelResult.figmaPng,
        renderPng: pixelResult.renderPng,
        diffPng: pixelResult.diffPng,
      }).catch((e) => {
        console.error("[worker] 画像保存に失敗（生成は続行）:", e instanceof Error ? e.message : String(e));
      });

      artifacts = pixelResult;
    } else {
      artifacts = await runMockPipeline({
        figmaFileKey: (project as any).figma_file_key,
        figmaNodeId: (project as any).figma_node_id,
        sourceUrl: (project as any).source_url,
        projectId: (project as any).id,
        generationId: job.generation_id,
      });
    }

    await saveGenerationArtifacts({
      projectId: (project as any).id,
      generationId: job.generation_id,
      profileSnapshot: artifacts.profileSnapshot,
      irJson: artifacts.ir,
      reportJson: artifacts.report,
      files: artifacts.files,
      mappings: artifacts.mappings,
      snapshotHash: artifacts.snapshotHash,
    });

    await setGenerationStatus(job.generation_id, "succeeded", {
      finished_at: new Date().toISOString(),
      error_json: null,
    });
    await updateGenerationJob(job.id, {
      status: "succeeded",
      locked_by: null,
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    } as any);
    return { status: "succeeded" as const };
  } catch (e: any) {
    if (e instanceof FigmaRateLimitError) {
      const retryAfterSec = clampRetryAfterSec(e.retryAfterSec);
      const nextAttemptAt = new Date(Date.now() + retryAfterSec * 1000).toISOString();
      await updateGenerationJob(job.id, {
        status: "waiting",
        next_attempt_at: nextAttemptAt,
        locked_by: null,
        locked_at: null,
        last_error: { message: e.message, kind: "figma_rate_limited", retryAfterSec, workerId },
        updated_at: new Date().toISOString(),
      } as any);
      await setGenerationStatus(job.generation_id, "running", {
        error_json: { state: "waiting_rate_limit", retryAfterSec, nextAttemptAt },
      });
      return { status: "waiting" as const, retryAfterSec, nextAttemptAt };
    }

    const message = e?.message ?? "Unknown error";
    await updateGenerationJob(job.id, {
      status: "failed",
      locked_by: null,
      locked_at: null,
      last_error: { message, kind: "generation_failed", workerId },
      updated_at: new Date().toISOString(),
    } as any);
    await setGenerationStatus(job.generation_id, "failed", {
      finished_at: new Date().toISOString(),
      error_json: { message, workerId },
    });
    return { status: "failed" as const, message };
  } finally {
    // best-effort unlock
    try {
      await updateGenerationJob(job.id, { locked_by: null, locked_at: null } as any);
    } catch {}
  }
}
