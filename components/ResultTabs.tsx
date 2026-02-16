"use client";

import { useMemo, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import Card from "@/components/ui/Card";
import FileTree from "@/components/ui/FileTree";
import CodeBlock from "@/components/ui/CodeBlock";
import Button from "@/components/ui/Button";
import type { GenerationBundle } from "@/lib/db";

type Bundle = NonNullable<GenerationBundle>;

export default function ResultTabs({ bundle }: { bundle: Bundle }) {
  const tabs = useMemo(() => ["プレビュー", "コード", "レポート", "マッピング"] as const, []);
  const [active, setActive] = useState<(typeof tabs)[number]>("プレビュー");

  const { project, generation, files, mappings } = bundle;

  const defaultFilePath = files.find((f) => f.path.endsWith("README.md"))?.path ?? files[0]?.path ?? "";
  const [selectedPath, setSelectedPath] = useState(defaultFilePath);

  const selectedFile = files.find((f) => f.path === selectedPath);

  // ✅ プレビューURLは必ず /api/previews に統一（Storage → download）
  const snapshotHash = generation.figma_snapshot_hash ?? "";
  const previewApiUrl =
    project?.id && snapshotHash ? `/api/previews/${encodeURIComponent(project.id)}/${encodeURIComponent(snapshotHash)}` : "";

  const [imgOk, setImgOk] = useState<boolean | null>(null);

  // レポート側に debug がある場合は補助表示（無くてもOK）
  const previewDebug = (generation.report_json as any)?.preview_debug;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">生成結果</div>
          <div className="flex gap-2">
            <span className="badge">ファイル: {files.length}</span>
            <span className="badge">マッピング: {mappings.length}</span>
          </div>
        </div>
        <Tabs tabs={tabs as unknown as string[]} active={active} onChange={(t) => setActive(t as any)} />
      </div>

      {active === "プレビュー" && (
        <div className="p-6">
          <div className="h2">プレビュー</div>
          <p className="p-muted mt-2">
            生成時に取得したスクリーンショット（PNG）を表示します。URLは最大30日で失効するため、表示されない場合は「再生成（トークン入力）」で再取得してください。
          </p>

          <div className="mt-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
            {!previewApiUrl ? (
              <div className="text-sm text-[rgb(var(--muted))]">
                スナップショットがありません（node-id無し、または生成保存に失敗している可能性があります）。
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-[rgb(var(--muted))] break-all">{previewApiUrl}</div>
                  <a className="text-xs underline text-[rgb(var(--muted))]" href={previewApiUrl} target="_blank" rel="noreferrer">
                    別タブで開く
                  </a>
                </div>

                <div className="mt-3">
                  {imgOk === false && (
                    <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                      <div className="font-semibold">プレビュー画像が表示できません</div>
                      <div className="mt-1 text-xs text-amber-200/90">
                        Storageに画像が無い / 取得に失敗している可能性があります。必要なら「再生成」でトークンを入れて再取得してください。
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          href={`/new?projectId=${encodeURIComponent(project.id)}&sourceUrl=${encodeURIComponent(project.source_url ?? "")}`}
                          variant="secondary"
                        >
                          再生成（トークン入力）
                        </Button>
                      </div>

                      {previewDebug?.figma_images_api?.status && (
                        <div className="mt-3 text-xs text-amber-200/80">
                          debug: figma_images_api.status={String(previewDebug.figma_images_api.status)} / node_api={String(previewDebug.figma_node_id_api)}
                        </div>
                      )}
                    </div>
                  )}

                  <img
                    src={previewApiUrl}
                    alt="preview"
                    className="w-full rounded-xl border border-white/10"
                    onLoad={() => setImgOk(true)}
                    onError={() => setImgOk(false)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
              <div className="text-xs text-[rgb(var(--muted))]">スナップショットハッシュ</div>
              <div className="mt-2 text-sm font-semibold break-all">{generation.figma_snapshot_hash ?? "-"}</div>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
              <div className="text-xs text-[rgb(var(--muted))]">出力ターゲット</div>
              <div className="mt-2 text-sm font-semibold">{generation.profile.outputTarget}</div>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
              <div className="text-xs text-[rgb(var(--muted))]">モード</div>
              <div className="mt-2 text-sm font-semibold">{generation.profile.mode}</div>
            </div>
          </div>
        </div>
      )}

      {active === "コード" && (
        <div className="grid lg:grid-cols-3">
          <div className="border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
            <div className="px-4 py-3 text-sm font-semibold border-b border-[rgb(var(--border))]">ファイル一覧</div>
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

      {active === "レポート" && (
        <div className="p-6">
          <div className="h2">品質レポート</div>
          <p className="p-muted mt-2">
            report_json を表示します。Token付き生成では「Figma画像 vs 生成レンダリング」の差分（diff）も保存され、ここで確認できます。
          </p>

          {project?.id && snapshotHash ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
                <div className="text-xs text-[rgb(var(--muted))]">Figma（Storage）</div>
                <div className="mt-3">
                  <img
                    src={`/api/previews/${encodeURIComponent(project.id)}/${encodeURIComponent(snapshotHash)}`}
                    alt="figma"
                    className="w-full rounded-xl border border-white/10"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
                <div className="text-xs text-[rgb(var(--muted))]">生成レンダリング（IR）</div>
                <div className="mt-3">
                  <img
                    src={`/api/previews/${encodeURIComponent(project.id)}/${encodeURIComponent(snapshotHash + "_render")}`}
                    alt="render"
                    className="w-full rounded-xl border border-white/10"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4">
                <div className="text-xs text-[rgb(var(--muted))]">diff（差分）</div>
                <div className="mt-3">
                  <img
                    src={`/api/previews/${encodeURIComponent(project.id)}/${encodeURIComponent(snapshotHash + "_diff")}`}
                    alt="diff"
                    className="w-full rounded-xl border border-white/10"
                  />
                </div>
                {typeof (generation.report_json as any)?.visualDiff?.diffRatio === "number" && (
                  <div className="mt-3 text-xs text-[rgb(var(--muted))]">
                    diffRatio: {String(((generation.report_json as any).visualDiff.diffRatio * 100).toFixed(2))}%
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <CodeBlock code={JSON.stringify(generation.report_json ?? {}, null, 2)} />
          </div>
        </div>
      )}

      {active === "マッピング" && (
        <div className="p-6">
          <div className="h2">マッピング</div>
          <p className="p-muted mt-2">Figma node id ↔ 生成ファイル の対応をリスト表示します。</p>

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
