import { NextResponse } from "next/server";
import crypto from "crypto";
import { envServer } from "@/lib/envServer";
import { claimDueGenerationJobs, getGenerationJobByGenerationId } from "@/lib/db";
import { processGenerationJob } from "@/lib/generationWorker";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : url.searchParams.get("token");

  // Auth:
  // - On Vercel, scheduled invocations include `x-vercel-cron: 1`
  // - Otherwise require a shared secret
  if (!isVercelCron) {
    if (!envServer.D2C_CRON_SECRET) {
      return NextResponse.json(
        {
          error: "cron_secret_missing",
          message: "D2C_CRON_SECRET is not configured (required outside Vercel Cron)."
        },
        { status: 500 }
      );
    }
    if (!token || token !== envServer.D2C_CRON_SECRET) return unauthorized();
  }

  const workerId = `cron:${crypto.randomUUID()}`;
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? "5")));

  const claimed = await claimDueGenerationJobs({ limit, workerId, lockTtlSec: 300 }).catch(() => []);
  const results: Array<{ generationId: string; jobId: string; status: string }> = [];

  for (const j of claimed) {
    const job = await getGenerationJobByGenerationId(j.generation_id);
    if (!job) continue;
    const r = await processGenerationJob(job as any, workerId);
    results.push({ generationId: j.generation_id, jobId: j.id, status: r.status });
  }

  return NextResponse.json({
    ok: true,
    workerId,
    claimed: claimed.length,
    results
  });
}

