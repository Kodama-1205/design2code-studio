"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { getAccessToken } from "@/lib/authClient";

type StatusResponse = {
  generation?: { status?: string };
  job?: {
    status: string;
    attemptCount: number;
    nextAttemptAt: string;
    lastError: any;
  } | null;
  cronConfigured?: boolean;
};

function fmtSec(s: number) {
  if (s <= 0) return "0秒";
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}分${r}秒`;
}

export default function GenerationWatcher(input: {
  generationIdToWatch: string;
  targetUrlOnSuccess: string;
  label?: string;
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [kicking, setKicking] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const apiUrl = useMemo(() => `/api/generate/generations/${input.generationIdToWatch}/status`, [input.generationIdToWatch]);

  useEffect(() => {
    let active = true;
    const tick = () => setNow(Date.now());
    const t1 = window.setInterval(tick, 1000); // countdown UI only

    getAccessToken().then((t) => {
      tokenRef.current = t;
    });

    function schedule(nextMs: number) {
      if (!active) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(pollOnce, nextMs);
    }

    async function pollOnce() {
      if (!active) return;
      // If tab is hidden, back off aggressively.
      if (document.hidden) {
        schedule(30_000);
        return;
      }

      const token = tokenRef.current;
      if (!token) {
        schedule(5_000);
        return;
      }

      try {
        const res = await fetch(apiUrl, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = (await res.json().catch(() => null)) as StatusResponse | null;
        if (!active) return;
        if (json) setStatus(json);

        const genStatus = json?.generation?.status;
        if (genStatus === "succeeded") {
          window.location.assign(input.targetUrlOnSuccess);
          return;
        }

        const job = json?.job ?? null;
        const nextAttemptMs = job?.nextAttemptAt ? Date.parse(job.nextAttemptAt) : null;
        const waitSec = nextAttemptMs ? Math.max(0, Math.ceil((nextAttemptMs - Date.now()) / 1000)) : null;

        // Adaptive polling to reduce noisy logs:
        // - waiting w/ long countdown: poll rarely
        // - near next attempt: poll more often
        let nextPollMs = 5000;
        if (job?.status === "waiting" && waitSec !== null) {
          if (waitSec > 60) nextPollMs = 15_000;
          else if (waitSec > 15) nextPollMs = 7_500;
          else nextPollMs = 2_500;
        }
        schedule(nextPollMs);
      } catch {
        // transient errors: back off
        schedule(10_000);
      }
    }

    const onVis = () => {
      if (!active) return;
      if (!document.hidden) pollOnce();
    };
    document.addEventListener("visibilitychange", onVis);

    pollOnce();
    return () => {
      active = false;
      window.clearInterval(t1);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [apiUrl, input.targetUrlOnSuccess]);

  const genStatus = status?.generation?.status ?? "-";
  const job = status?.job ?? null;
  const nextAttemptMs = job?.nextAttemptAt ? Date.parse(job.nextAttemptAt) : null;
  const waitSec = nextAttemptMs ? Math.max(0, Math.ceil((nextAttemptMs - now) / 1000)) : null;

  return (
    <div className="mt-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold">{input.label ?? "処理状況"}</div>
        <div className="flex gap-2">
          <span className="badge">generation: {genStatus}</span>
          {job ? <span className="badge">job: {job.status}</span> : null}
        </div>
      </div>
      {job ? (
        <div className="mt-2 text-[rgb(var(--muted))]">
          <div>試行回数: {job.attemptCount}</div>
          {waitSec !== null ? <div>次の自動再試行まで: {fmtSec(waitSec)}</div> : null}
          {job.lastError?.message ? <div className="mt-1">直近エラー: {String(job.lastError.message).slice(0, 160)}</div> : null}
          {status?.cronConfigured === false ? (
            <div className="mt-2">
              注意: 本番の自動完了には Cron 設定（`D2C_CRON_SECRET` + 定期HTTP呼び出し）を推奨します。
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-[rgb(var(--muted))]">ジョブ情報を取得できませんでした。</div>
      )}
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          <Button href={input.targetUrlOnSuccess} variant="secondary">
            最新結果を開く
          </Button>
          <Button
            variant="secondary"
            disabled={kicking}
            onClick={async () => {
              setKicking(true);
              try {
                const token = await getAccessToken();
                if (!token) throw new Error("ログインが必要です。");
                await fetch(apiUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({})
                });
              } catch {
                // ignore
              } finally {
                setKicking(false);
              }
            }}
          >
            {kicking ? "再試行中…" : "今すぐ再試行"}
          </Button>
        </div>
      </div>
    </div>
  );
}

