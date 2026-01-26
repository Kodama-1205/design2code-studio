"use client";

import { useMemo, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import Card from "@/components/ui/Card";
import FileTree from "@/components/ui/FileTree";
import CodeBlock from "@/components/ui/CodeBlock";

type Bundle = Awaited<ReturnType<import("@/lib/db").getGenerationBundle>>;

export default function ResultTabs({ bundle }: { bundle: NonNullable<Bundle> }) {
  const tabs = useMemo(() => ["Preview", "Code", "Report", "Mapping"] as const, []);
  const [active, setActive] = useState<(typeof tabs)[number]>("Preview");

  const { generation, files, mappings } = bundle;

  const defaultFilePath = files.find((f) => f.path.endsWith("README.md"))?.path ?? files[0]?.path ?? "";
  const [selectedPath, setSelectedPath] = useState(defaultFilePath);

  const selectedFile = files.find((f) => f.path === selectedPath);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Generation Result</div>
          <div className="flex gap-2">
            <span className="badge">Files: {files.length}</span>
            <span className="badge">Mappings: {mappings.length}</span>
          </div>
        </div>
        <Tabs tabs={tabs as unknown as string[]} active={active} onChange={(t) => setActive(t as any)} />
      </div>

      {active === "Preview" && (
        <div className="p-6">
          <div className="h2">Preview (scaffold)</div>
          <p className="p-muted mt-2">
            現時点では“生成物の中身”を直接レンダリングする前段として、生成IR/レポートを元にした簡易プレビューを表示します。
          </p>

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
            <div className="text-sm font-semibold">Next Step (recommended)</div>
            <div className="p-muted mt-1">
              次の実装で <code>generated/Page.tsx</code> 相当を DB から取り出して sandbox iframe で実描画し、Mobile/Tablet/Desktop 切替を追加します。
            </div>
          </div>
        </div>
      )}

      {active === "Code" && (
        <div className="grid lg:grid-cols-3">
          <div className="border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
            <div className="px-4 py-3 text-sm font-semibold border-b border-[rgb(var(--border))]">Files</div>
            <FileTree
              paths={files.map((f) => f.path)}
              selected={selectedPath}
              onSelect={(p) => setSelectedPath(p)}
            />
          </div>
          <div className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{selectedFile?.path ?? "No file selected"}</div>
                <div className="p-muted mt-1">DBに保存された生成ファイルの内容を表示しています。</div>
              </div>
            </div>
            <div className="mt-4">
              <CodeBlock code={selectedFile?.content ?? ""} />
            </div>
          </div>
        </div>
      )}

      {active === "Report" && (
        <div className="p-6">
          <div className="h2">Quality Report (scaffold)</div>
          <p className="p-muted mt-2">report_json をそのまま表示します（将来はカード/グラフ化）。</p>
          <div className="mt-4">
            <CodeBlock code={JSON.stringify(generation.report_json ?? {}, null, 2)} />
          </div>
        </div>
      )}

      {active === "Mapping" && (
        <div className="p-6">
          <div className="h2">Mapping (scaffold)</div>
          <p className="p-muted mt-2">Figma node id ↔ 生成ファイル の対応をリスト表示します（将来はツリー連動）。</p>

          <div className="mt-4 grid gap-3">
            {mappings.slice(0, 30).map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] p-4"
              >
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
            {mappings.length > 30 && (
              <div className="p-muted text-xs">表示は先頭30件のみ（MVP）。</div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
