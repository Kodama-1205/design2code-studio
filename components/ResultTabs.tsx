"use client";

import { useMemo, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import Card from "@/components/ui/Card";
import FileTree from "@/components/ui/FileTree";
import CodeBlock from "@/components/ui/CodeBlock";
import type { GenerationBundle } from "@/lib/db";

type Bundle = NonNullable<GenerationBundle>;

export default function ResultTabs({ bundle }: { bundle: Bundle }) {
  const tabs = useMemo(() => ["Preview", "Code", "Report", "Mapping"] as const, []);
  const [active, setActive] = useState<(typeof tabs)[number]>("Preview");

  const { generation, files, mappings } = bundle;
  const isProvisional = Boolean((generation as any)?.error_json?.provisional);
  const isMockFallback = isProvisional || (generation as any)?.error_json?.fallback?.type === "mock";

  const isFigmaUrl = /figma\.com\//.test(bundle.project.source_url ?? "");
  const embedUrl = useMemo(() => {
    const u = bundle.project.source_url ?? "";
    if (!u) return "";
    if (u.includes("hide-ui=1")) return u;
    return `${u}${u.includes("?") ? "&" : "?"}hide-ui=1`;
  }, [bundle.project.source_url]);

  // UX: When we're showing provisional/mock due to rate limit, NEVER prioritize a dummy image.
  // Always show Figma embed first so the user can confirm "the real design" immediately.
  const preferEmbed = isFigmaUrl && isMockFallback;

  const assetFiles = useMemo(() => {
    if (preferEmbed) return [];
    return files.filter((f) => f.kind === "asset" || f.content.startsWith("data:image/"));
  }, [files, preferEmbed]);
  const previewImage = useMemo(() => assetFiles.find((f) => f.content.startsWith("data:image/")) ?? null, [assetFiles]);
  const [previewWidth, setPreviewWidth] = useState(1024);
  const defaultFilePath =
    files.find((f) => f.path.endsWith("README.md"))?.path ??
    files.find((f) => f.kind !== "asset" && !f.content.startsWith("data:image/"))?.path ??
    files[0]?.path ??
    "";
  const [selectedPath, setSelectedPath] = useState(defaultFilePath);

  const selectedFile = files.find((f) => f.path === selectedPath);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">生成結果</div>
          <div className="flex gap-2">
            <span className="badge">ファイル: {files.length}</span>
            <span className="badge">マッピング: {mappings.length}</span>
            {isMockFallback ? <span className="badge">フォールバック: モック</span> : null}
            {isProvisional ? <span className="badge">暫定</span> : null}
          </div>
        </div>
        <Tabs tabs={tabs as unknown as string[]} active={active} onChange={(t) => setActive(t as any)} />
      </div>

      {active === "プレビュー" && (
        <div className="p-6">
          <div className="h2">即時プレビュー</div>
          <p className="p-muted mt-2">
            まずは“今すぐ確認できること”を最優先に表示します。Figma URL の場合は埋め込み表示が最速（Figma API 429の影響を受けにくい）です。
          </p>

          {isMockFallback ? (
            <div className="mt-4 rounded-2xl border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.08)] p-4 text-sm">
              <div className="font-semibold">暫定表示（即時表示優先）</div>
              <div className="mt-1 text-[rgb(var(--muted))]">
                Figma 側のレート制限（429）でも、プレビューは埋め込みで即確認できます。コードは暫定を即表示し、裏で本生成を再試行します。
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Snapshot Hash</div>
              <div className="mt-2 text-sm font-semibold break-all">{generation.figma_snapshot_hash ?? "-"}</div>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Output Target</div>
              <div className="mt-2 text-sm font-semibold">{generation.profile.outputTarget}</div>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
              <div className="text-xs text-[rgb(var(--muted))]">Mode</div>
              <div className="mt-2 text-sm font-semibold">{generation.profile.mode}</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgba(170,90,255,0.08)] p-5">
            <div className="text-sm font-semibold">Previewについて</div>
            <div className="p-muted mt-1">
              現在は Figma の埋め込みを優先し、次に“生成された画像アセット”を表示します。将来的には生成コードを実行して、より正確なUIプレビューに置き換えます。
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">ライブプレビュー</div>
              <Button onClick={() => setPreviewWidth(375)} variant={previewWidth === 375 ? "primary" : "secondary"}>
                モバイル
              </Button>
              <Button onClick={() => setPreviewWidth(768)} variant={previewWidth === 768 ? "primary" : "secondary"}>
                タブレット
              </Button>
              <Button onClick={() => setPreviewWidth(1200)} variant={previewWidth === 1200 ? "primary" : "secondary"}>
                デスクトップ
              </Button>
            </div>
            <div className="mt-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
              {isFigmaUrl ? (
                <div className="grid gap-3">
                  <div className="overflow-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
                    <iframe
                      title="figma-embed-primary"
                      style={{ width: "100%", height: 640, border: "0", borderRadius: 12, background: "#121218" }}
                      src={`https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(embedUrl || bundle.project.source_url)}`}
                      allowFullScreen
                    />
                  </div>

                  {previewImage && !preferEmbed ? (
                    <div className="overflow-auto">
                      <iframe
                        title="generated-preview"
                        sandbox="allow-same-origin"
                        style={{ width: previewWidth, height: 640, border: "0", borderRadius: 12, background: "#121218" }}
                        srcDoc={`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { height: 100%; margin: 0; background: #121218; color: #f5f5fa; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", sans-serif; }
      .wrap { padding: 24px; }
      .card { margin-top: 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 12px; background: rgba(255,255,255,0.02); }
      img { max-width: 100%; border-radius: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div style="font-weight: 600; margin-bottom: 10px;">${isMockFallback ? "モックプレビュー" : "Figmaプレビュー"}</div>
      <img src="${previewImage.content}" alt="プレビュー" />
      <div class="card">
        <div style="opacity: 0.7; font-size: 12px;">ソース</div>
        <div style="word-break: break-all; margin-top: 6px;">${bundle.project.source_url}</div>
      </div>
    </div>
  </body>
</html>`}
                      />
                    </div>
                  ) : null}
                </div>
              ) : previewImage ? (
                <div className="overflow-auto">
                  <iframe
                    title="generated-preview"
                    sandbox="allow-same-origin"
                    style={{ width: previewWidth, height: 640, border: "0", borderRadius: 12, background: "#121218" }}
                    srcDoc={`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { height: 100%; margin: 0; background: #121218; color: #f5f5fa; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", sans-serif; }
      .wrap { padding: 24px; }
      .card { margin-top: 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 12px; background: rgba(255,255,255,0.02); }
      img { max-width: 100%; border-radius: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div style="font-weight: 600; margin-bottom: 10px;">${isMockFallback ? "モックプレビュー" : "プレビュー"}</div>
      <img src="${previewImage.content}" alt="プレビュー" />
      <div class="card">
        <div style="opacity: 0.7; font-size: 12px;">ソース</div>
        <div style="word-break: break-all; margin-top: 6px;">${bundle.project.source_url}</div>
      </div>
    </div>
  </body>
</html>`}
                  />
                </div>
              ) : (
                <div className="p-muted text-sm">プレビューを表示できません。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {active === "コード" && (
        <div className="grid lg:grid-cols-3">
          <div className="border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
            <div className="px-4 py-3 text-sm font-semibold border-b border-[rgb(var(--border))]">Files</div>
            <FileTree paths={files.map((f) => f.path)} selected={selectedPath} onSelect={(p) => setSelectedPath(p)} />
          </div>
          <div className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{selectedFile?.path ?? "ファイルが選択されていません"}</div>
                <div className="p-muted mt-1">DBに保存された生成ファイルの内容を表示しています。</div>
              </div>
            </div>
            <div className="mt-4">
              <CodeBlock code={selectedFile?.content ?? ""} />
            </div>
          </div>
        </div>
      )}

      {active === "アセット" && (
        <div className="p-6">
          <div className="h2">アセット</div>
          <p className="p-muted mt-2">Figma から取得した画像アセットを表示します（MVP）。</p>
          {assetFiles.length === 0 ? (
            <div className="p-muted mt-4 text-sm">
              画像アセットはありません。
              {preferEmbed ? "（429などで取得待ちの場合でも、プレビュータブでFigma埋め込みを即確認できます）" : ""}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assetFiles.map((f) => (
                <div key={f.path} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
                  <div className="text-xs text-[rgb(var(--muted))] truncate">{f.path}</div>
                  {f.content.startsWith("data:image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.content} alt={f.path} className="mt-3 w-full rounded-lg border border-[rgb(var(--border))]" />
                  ) : (
                    <div className="p-muted mt-3 text-xs">プレビュー不可（data URLではありません）。</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {active === "レポート" && (
        <div className="p-6">
          <div className="h2">品質レポート（仮）</div>
          <p className="p-muted mt-2">report_json をそのまま表示します（将来はカード/グラフ化）。</p>
          <div className="mt-4">
            <CodeBlock code={JSON.stringify(generation.report_json ?? {}, null, 2)} />
          </div>
        </div>
      )}

      {active === "マッピング" && (
        <div className="p-6">
          <div className="h2">マッピング（仮）</div>
          <p className="p-muted mt-2">Figma node id ↔ 生成ファイル の対応をリスト表示します（将来はツリー連動）。</p>

          <div className="mt-4 grid gap-3">
            {mappings.slice(0, 30).map((m) => (
              <div key={m.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">{m.mapping_type}</span>
                  <span className="badge">{m.figma_node_id}</span>
                  <span className="badge">{m.target_path}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{m.figma_node_name ?? "-"}</div>
                <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                  {m.target_symbol ? `symbol: ${m.target_symbol}` : "symbol: -"}{" "}
                  {m.loc_start && m.loc_end ? ` / loc: ${m.loc_start}-${m.loc_end}` : ""}
                </div>
              </div>
            ))}
            {mappings.length > 30 && <div className="p-muted text-xs">表示は先頭30件のみ（MVP）。</div>}
          </div>
        </div>
      )}
    </Card>
  );
}
