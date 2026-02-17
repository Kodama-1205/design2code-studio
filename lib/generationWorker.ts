import { envServer } from "@/lib/envServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FigmaRateLimitError } from "@/lib/figma";
import { runFigmaPipeline } from "@/lib/figmaPipeline";
import { runMockPipeline } from "@/lib/mockPipeline";
import { saveGenerationArtifacts, setGenerationStatus, updateGenerationJob } from "@/lib/db";
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
  // Fetch generation + project
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
      updated_at: new Date().toISOString()
    } as any);
    return { status: "failed" as const };
  }

  if ((gen as any).status === "succeeded") {
    await updateGenerationJob(job.id, {
      status: "succeeded",
      locked_by: null,
      locked_at: null,
      updated_at: new Date().toISOString()
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
      updated_at: new Date().toISOString()
    } as any);
    return { status: "failed" as const };
  }

  const ownerId = ((job as any).owner_id ?? (project as any).owner_id) as string;
  const userToken = await getUserFigmaPat(ownerId).catch(() => null);
  const wantFigma = /figma\.com\//.test((project as any).source_url) && Boolean(userToken);

  if (/figma\.com\//.test((project as any).source_url) && !userToken) {
    await updateGenerationJob(job.id, {
      status: "failed",
      locked_by: null,
      locked_at: null,
      last_error: { kind: "missing_figma_token", message: "Figmaトークンが未設定です。/settings で設定してください。", workerId },
      updated_at: new Date().toISOString()
    } as any);
    await setGenerationStatus(job.generation_id, "failed", {
      finished_at: new Date().toISOString(),
      error_json: { message: "Figmaトークンが未設定です。設定画面でPATを登録してください。", kind: "missing_figma_token" }
    });
    return { status: "failed" as const, message: "missing_figma_token" };
  }

  try {
    await setGenerationStatus(job.generation_id, "running", { started_at: (gen as any).started_at ?? new Date().toISOString() });

    const finalArtifacts = wantFigma
      ? await runFigmaPipeline({
          ownerId,
          figmaFileKey: (project as any).figma_file_key,
          figmaNodeId: (project as any).figma_node_id,
          sourceUrl: (project as any).source_url,
          profileOverrideId: (gen as any).profile_id ?? undefined,
          projectId: (project as any).id,
          generationId: job.generation_id,
          figmaToken: userToken!
        })
      : await runMockPipeline({
          figmaFileKey: (project as any).figma_file_key,
          figmaNodeId: (project as any).figma_node_id,
          sourceUrl: (project as any).source_url,
          profileOverrideId: (gen as any).profile_id ?? undefined,
          projectId: (project as any).id,
          generationId: job.generation_id
        });

    await saveGenerationArtifacts({
      projectId: (project as any).id,
      generationId: job.generation_id,
      profileSnapshot: finalArtifacts.profileSnapshot,
      irJson: finalArtifacts.ir,
      reportJson: finalArtifacts.report,
      files: finalArtifacts.files,
      mappings: finalArtifacts.mappings,
      snapshotHash: finalArtifacts.snapshotHash
    });

    await setGenerationStatus(job.generation_id, "succeeded", { finished_at: new Date().toISOString(), error_json: null });
    await updateGenerationJob(job.id, {
      status: "succeeded",
      locked_by: null,
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString()
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
        updated_at: new Date().toISOString()
      } as any);
      await setGenerationStatus(job.generation_id, "running", {
        error_json: { state: "waiting_rate_limit", retryAfterSec, nextAttemptAt }
      });
      return { status: "waiting" as const, retryAfterSec, nextAttemptAt };
    }

    const message = e?.message ?? "Unknown error";
    await updateGenerationJob(job.id, {
      status: "failed",
      locked_by: null,
      locked_at: null,
      last_error: { message, kind: "generation_failed", workerId },
      updated_at: new Date().toISOString()
    } as any);
    await setGenerationStatus(job.generation_id, "failed", {
      finished_at: new Date().toISOString(),
      error_json: { message, workerId }
    });
    return { status: "failed" as const, message };
  } finally {
    // best-effort unlock for safety
    try {
      await updateGenerationJob(job.id, { locked_by: null, locked_at: null } as any);
    } catch {}
  }
}

