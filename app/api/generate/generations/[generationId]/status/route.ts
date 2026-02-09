import { NextResponse } from "next/server";
import crypto from "crypto";
import { envServer } from "@/lib/envServer";
import { getGenerationJobByGenerationId, updateGenerationJobByGenerationId, claimGenerationJob } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processGenerationJob } from "@/lib/generationWorker";
import { requireUserIdFromRequest } from "@/lib/authApi";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { generationId: string } }) {
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  const generationId = params.generationId;
  const job = await getGenerationJobByGenerationId(generationId);

  const { data: gen } = await supabaseAdmin
    .from("d2c_generations")
    .select("id,project_id,status,started_at,finished_at,error_json,created_at")
    .eq("id", generationId)
    .single();

  if (!gen) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: proj } = await supabaseAdmin.from("d2c_projects").select("id,owner_id").eq("id", (gen as any).project_id).single();
  if (!proj || (proj as any).owner_id !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Local/dev safety net: if due and not locked, try to run inline even without cron.
  if (job && (job.status === "queued" || job.status === "waiting")) {
    const due = Date.parse(job.next_attempt_at) <= Date.now();
    if (due) {
      const workerId = `poll:${crypto.randomUUID()}`;
      const claimed = await claimGenerationJob({ generationId, workerId, lockTtlSec: 300 }).catch(() => null);
      if (claimed) {
        // Never fail the status endpoint due to worker execution errors.
        try {
          await processGenerationJob(claimed as any, workerId);
        } catch (e: any) {
          console.error("processGenerationJob failed (status poll)", String(e?.message ?? e));
        }
      }
    }
  }

  const job2 = await getGenerationJobByGenerationId(generationId);
  return NextResponse.json({
    generation: gen,
    job: job2
      ? {
          status: job2.status,
          attemptCount: job2.attempt_count,
          nextAttemptAt: job2.next_attempt_at,
          lastError: job2.last_error
        }
      : null,
    cronConfigured: Boolean(envServer.D2C_CRON_SECRET)
  });
}

export async function POST(req: Request, { params }: { params: { generationId: string } }) {
  // Manual kick: set next_attempt_at to now
  const generationId = params.generationId;

  // Prefer authenticated user kick
  try {
    const userId = await requireUserIdFromRequest(req);
    const { data: gen } = await supabaseAdmin.from("d2c_generations").select("id,project_id").eq("id", generationId).single();
    if (!gen) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: proj } = await supabaseAdmin.from("d2c_projects").select("id,owner_id").eq("id", (gen as any).project_id).single();
    if (!proj || (proj as any).owner_id !== userId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (e: any) {
    // If user auth is not present, allow cron secret as fallback (for external schedulers)
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : null;
    if (envServer.D2C_CRON_SECRET && token !== envServer.D2C_CRON_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  await updateGenerationJobByGenerationId(generationId, { next_attempt_at: new Date().toISOString(), status: "queued" } as any).catch(() => {});
  return NextResponse.json({ ok: true });
}

