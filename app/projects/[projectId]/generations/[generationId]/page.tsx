"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ResultTabs from "@/components/ResultTabs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import RegenerateButton from "@/components/RegenerateButton";
import GenerationWatcher from "@/components/GenerationWatcher";
import ExportZipButton from "@/components/ExportZipButton";
import { getAccessToken } from "@/lib/authClient";

import type { GenerationBundle } from "@/lib/types";

export default function Page() {
  const params = useParams() as { projectId: string; generationId: string };
  const sp = useSearchParams();
  const generationId = params.generationId;
  const projectId = params.projectId;
  const cached = sp.get("cached") === "1";
  const fallback = sp.get("fallback") === "mock";
  const queued = sp.get("queued") === "1";
  const updatingId = sp.get("updating");

  const [bundle, setBundle] = useState<GenerationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [immediateSourceUrl, setImmediateSourceUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          window.location.assign("/login");
          return;
        }
        const res = await fetch(`/api/generations/${generationId}/bundle`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) throw new Error(data?.error ?? data?.message ?? `HTTP ${res.status}`);
        setBundle((data?.bundle ?? null) as GenerationBundle | null);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Unknown error");
        setBundle(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [generationId]);

  // Hydration safety: read sessionStorage only after mount (never during render).
  useEffect(() => {
    try {
      const url =
        sessionStorage.getItem(`d2c_source_url:${generationId}`) ??
        sessionStorage.getItem(`d2c_source_url:${projectId}`) ??
        sessionStorage.getItem("d2c_last_source_url") ??
        "";
      setImmediateSourceUrl(url || "");
    } catch {
      setImmediateSourceUrl("");
    }
  }, [generationId, projectId]);

  const content = useMemo(() => {
    if (!bundle) {
      // Show immediate embed (if possible) while bundle loads.
      const url = immediateSourceUrl;
      const embedUrl = (() => {
        const u = url ?? "";
        if (!u) return "";
        if (u.includes("hide-ui=1")) return u;
        return `${u}${u.includes("?") ? "&" : "?"}hide-ui=1`;
      })();
      const isFigmaUrl = /figma\.com\//.test(url);
      return (
        <Card className="p-6">
          <div className="h2">読み込み中…</div>
          <p className="p-muted mt-2">結果データを取得しています（プレビューは先に表示します）。</p>

          {isFigmaUrl && embedUrl ? (
            <div className="mt-5">
              <div className="text-sm font-semibold">即時プレビュー（Figma埋め込み）</div>
              <div className="p-muted mt-1 text-sm">429（レート制限）の影響を受けにくく、すぐ確認できます。</div>
              <div className="mt-3 overflow-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
                <iframe
                  title="figma-embed-loading"
                  style={{ width: "100%", height: 640, border: "0", borderRadius: 12, background: "#121218" }}
                  src={`https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(embedUrl)}`}
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </Card>
      );
    }

    const { project, generation } = bundle;
    const embedUrl = (() => {
      const u = project.source_url ?? "";
      if (!u) return "";
      if (u.includes("hide-ui=1")) return u;
      return `${u}${u.includes("?") ? "&" : "?"}hide-ui=1`;
    })();
    const isQueued = queued || generation.status === "queued" || generation.status === "running";
    const isMockFallback = fallback || (generation as any)?.error_json?.fallback?.type === "mock";
    const isProvisional = Boolean((generation as any)?.error_json?.provisional);

    return (
      <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h1">{project.name}</h1>
              <span className="badge">{generation.status}</span>
              <span className="badge">{generation.profile.mode}</span>
              <span className="badge">{generation.profile.outputTarget}</span>
            </div>
            <p className="p-muted mt-2 truncate">{project.source_url}</p>
          </div>

          <div className="flex gap-2">
            <ExportZipButton generationId={generation.id} filename={`design2code_${project.id}_${generation.id}.zip`} />
            <RegenerateButton generationId={generation.id} />
          </div>
        </div>

        {cached ? (
          <div className="mt-4 rounded-xl border border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm">
            <div className="font-semibold">キャッシュ結果を表示中</div>
            <div className="mt-1 text-[rgb(var(--muted))]">Figma 側のレート制限（429）のため、直近の成功結果を表示しています。</div>
          </div>
        ) : null}

        {isMockFallback ? (
          <div className="mt-4 rounded-xl border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.08)] px-4 py-3 text-sm">
            <div className="font-semibold">暫定コードを表示中（即時表示優先）</div>
            <div className="mt-1 text-[rgb(var(--muted))]">
              Figma 側のレート制限（429）により画像アセット取得は待ちになりますが、プレビューは埋め込みで即確認できます。裏で本生成を自動再試行します。
            </div>
          </div>
        ) : null}

        {isProvisional ? (
          <div className="mt-4 rounded-xl border border-[rgba(99,102,241,0.45)] bg-[rgba(99,102,241,0.08)] px-4 py-3 text-sm">
            <div className="font-semibold">暫定コードを表示中（すぐ表示優先）</div>
            <div className="mt-1 text-[rgb(var(--muted))]">
              初回はテンプレコードを即表示し、裏で本生成を進めています。完了すると自動で最新結果に切り替わります。
            </div>
          </div>
        ) : null}

        {updatingId ? (
          <div className="mt-4 rounded-xl border border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.08)] px-4 py-3 text-sm">
            <div className="font-semibold">最新結果をバックグラウンドで生成中</div>
            <div className="mt-1 text-[rgb(var(--muted))]">完了すると自動で最新結果へ移動します。</div>
          </div>
        ) : null}

        {isQueued ? (
          <div className="mt-4 rounded-xl border border-[rgba(170,90,255,0.45)] bg-[rgba(170,90,255,0.08)] px-4 py-3 text-sm">
            <div className="font-semibold">生成を実行中</div>
            <div className="mt-1 text-[rgb(var(--muted))]">完了まで自動で再試行します。</div>
          </div>
        ) : null}

        {updatingId ? (
          <GenerationWatcher generationIdToWatch={updatingId} targetUrlOnSuccess={`/projects/${project.id}/generations/${updatingId}`} label="最新生成の進捗" />
        ) : null}

        {isQueued && generation.status !== "succeeded" ? (
          <GenerationWatcher generationIdToWatch={generation.id} targetUrlOnSuccess={`/projects/${project.id}/generations/${generation.id}`} label="現在の生成の進捗" />
        ) : null}

        <div className="mt-6">
          {generation.status === "succeeded" ? (
            <ResultTabs bundle={bundle} />
          ) : (
            <Card className="p-6">
              <div className="h2">結果を準備中…</div>
              <p className="p-muted mt-2">
                生成処理はバックグラウンドで実行しています。下のプレビューは即時表示（Figma埋め込み）で、生成が完了するとコード/ZIPも表示されます。
              </p>

              <div className="mt-5">
                <div className="text-sm font-semibold">即時プレビュー（Figma埋め込み）</div>
                <div className="p-muted mt-1 text-sm">Figma API 429（レート制限）の影響を受けずに表示できます。</div>
                <div className="mt-3 overflow-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
                  <iframe
                    title="figma-embed"
                    style={{ width: "100%", height: 640, border: "0", borderRadius: 12, background: "#121218" }}
                    src={`https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(embedUrl || project.source_url)}`}
                    allowFullScreen
                  />
                </div>
                <div className="mt-2 text-xs text-[rgb(var(--muted))]">
                  ※ ファイルの共有設定によっては表示できない場合があります（その場合はFigma側で閲覧権限を付与してください）。
                </div>
              </div>

              <div className="mt-4">
                <Button href="/dashboard" variant="secondary">
                  ダッシュボードへ戻る
                </Button>
              </div>
            </Card>
          )}
        </div>
      </>
    );
  }, [bundle, cached, fallback, queued, updatingId, immediateSourceUrl]);

  return (
    <div className="container-max py-10">
      {error ? (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong>取得に失敗しました。</strong> {error}
        </div>
      ) : null}
      {content}
    </div>
  );
}
