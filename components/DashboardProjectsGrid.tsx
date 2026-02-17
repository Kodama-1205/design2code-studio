"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/EmptyState";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import { getAccessToken } from "@/lib/authClient";

type Project = {
  id: string;
  owner_id: string;
  name: string;
  figma_file_key: string;
  figma_node_id: string;
  source_url: string;
  last_generation_id: string | null;
  preview_image: string | null;
};

type WhoAmI = { user: { id: string; email: string | null } };

export default function DashboardProjectsGrid(props: { emptyAction?: "new" | "top" | "none" }) {
  const { emptyAction = "new" } = props;
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<WhoAmI["user"] | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError(null);
        const token = await getAccessToken();
        if (!token) {
          window.location.assign("/login");
          return;
        }
        // Best-effort: show current user in empty-state for quick diagnosis.
        fetch("/api/whoami", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (!active) return;
            const u = (j as WhoAmI | null)?.user ?? null;
            if (u?.id) setWho(u);
          })
          .catch(() => {});

        const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) throw new Error(data?.message ?? data?.error ?? "failed_to_list_projects");
        if (!Array.isArray(data?.projects)) {
          throw new Error("API応答が不正です（projectsが配列ではありません）。");
        }
        setProjects(data.projects as Project[]);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Unknown error");
        setProjects([]);
      }
    }

    // Ensure dashboard reflects latest data even when returning via back/forward cache.
    const onVis = () => {
      if (!active) return;
      if (!document.hidden) load();
    };
    const onFocus = () => {
      if (!active) return;
      load();
    };
    const onPageShow = () => {
      if (!active) return;
      load();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    load();
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const whoLine = who?.email ? `${who.email}（${who.id}）` : who?.id ? who.id : null;

  return (
    <>
      {error ? (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong>取得に失敗しました。</strong> {error}
        </div>
      ) : null}

      {!projects ? (
        <Card className="mt-8 p-6">
          <div className="h2">読み込み中…</div>
          <p className="p-muted mt-2">プロジェクト一覧を取得しています。</p>
        </Card>
      ) : projects.length === 0 ? (
        emptyAction === "new" ? (
          <EmptyState
            title="まだプロジェクトがありません"
            description={
              whoLine
                ? `ログイン中: ${whoLine} / 「新規生成」からFigma URLを貼り付けて生成してください。`
                : "「新規生成」からFigma URLを貼り付けて生成してください。"
            }
            actionHref="/new"
            actionLabel="新規生成"
          />
        ) : emptyAction === "top" ? (
          <Card className="mt-8 p-6">
            <div className="h2">プロジェクトがありません</div>
            <p className="p-muted mt-2">
              {whoLine ? (
                <>
                  <span className="font-semibold">ログイン中:</span> {whoLine}
                  <br />
                </>
              ) : null}
              TOPページから新規生成してください。
              {whoLine ? (
                <>
                  <br />
                  ※ 別アカウントでログインしていると、過去に作ったプロジェクトは表示されません。
                </>
              ) : null}
            </p>
            <div className="mt-4">
              <Button href="/" variant="secondary">
                TOPへ戻る
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="mt-8 p-6">
            <div className="h2">プロジェクトがありません</div>
            <p className="p-muted mt-2">プロジェクトが作成されるとここに一覧表示されます。</p>
          </Card>
        )
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{p.name}</div>
                  <div className="p-muted mt-1 truncate">{p.source_url}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge">Figma</span>
                  <DeleteProjectButton projectId={p.id} projectName={p.name} />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-[rgb(var(--muted))] mb-2">プレビュー</div>
                <div className="w-full aspect-[16/9] rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] overflow-hidden flex items-center justify-center relative">
                  {(() => {
                    const label = (p.name ?? "No preview").slice(0, 32);
                    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1F2937"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" rx="48" fill="url(#g)"/>
  <rect x="48" y="48" width="1184" height="624" rx="36" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)"/>
  <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans JP', sans-serif" font-size="44" fill="#E5E7EB" font-weight="700">${label.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</text>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans JP', sans-serif" font-size="24" fill="#9CA3AF">プレビューなし</text>
</svg>`;
                    const placeholder = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

                    // モック判定: base64 SVG 内の "Sample Image" / "Mock pipeline"
                    const isMock =
                      typeof p.preview_image === "string" &&
                      (p.preview_image.includes("Sample Image") ||
                        p.preview_image.includes("Mock pipeline") ||
                        (p.preview_image.startsWith("data:image/svg+xml;base64,") &&
                          (() => {
                            try {
                              const decoded = atob(p.preview_image.slice(24));
                              return decoded.includes("Sample Image") || decoded.includes("Mock pipeline");
                            } catch {
                              return false;
                            }
                          })()));

                    // 実画像があれば表示（モックは除外）
                    if (p.preview_image && !isMock) {
                      return (
                        <img
                          src={p.preview_image}
                          alt={`${p.name} preview`}
                          className="h-full w-full object-cover object-center"
                        />
                      );
                    }

                    // モック or なし: fileKey+nodeId があれば Figma API で取得
                    if (p.figma_file_key && p.figma_node_id) {
                      const apiUrl = `/api/figma-preview?fileKey=${encodeURIComponent(p.figma_file_key)}&nodeId=${encodeURIComponent(p.figma_node_id)}`;
                      return (
                        <img
                          src={apiUrl}
                          alt={`${p.name} preview`}
                          className="h-full w-full object-cover object-center"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = placeholder;
                          }}
                        />
                      );
                    }

                    return (
                      <img
                        src={placeholder}
                        alt={`${p.name} preview`}
                        className="h-full w-full object-cover object-center"
                      />
                    );
                  })()}
                </div>
              </div>

              <div className="mt-4 text-xs text-[rgb(var(--muted))]">
                <div>FileKey: {p.figma_file_key}</div>
                <div>NodeId: {p.figma_node_id}</div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button href={`/new?projectId=${p.id}`} variant="ghost">
                  再生成
                </Button>
                <Button
                  href={p.last_generation_id ? `/projects/${p.id}/generations/${p.last_generation_id}` : `/new?projectId=${p.id}`}
                  variant="secondary"
                >
                  開く
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

