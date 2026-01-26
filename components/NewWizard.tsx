"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Mode = "production" | "lecture" | "pixel";
type OutputTarget = "nextjs_tailwind" | "static_html_css";

const PRESETS: Array<{
  id: string;
  label: string;
  mode: Mode;
  outputTarget: OutputTarget;
  description: string;
}> = [
  { id: "prod_next", label: "Production Mode", mode: "production", outputTarget: "nextjs_tailwind", description: "実務寄り。トークン化/分割を前提。" },
  { id: "lecture_static", label: "Lecture Mode", mode: "lecture", outputTarget: "static_html_css", description: "授業向け。読みやすさ優先の静的出力。" },
  { id: "pixel_static", label: "Pixel Mode", mode: "pixel", outputTarget: "static_html_css", description: "見た目優先。absolute許容（将来拡張）。" }
];

export default function NewWizard({ projectId }: { projectId?: string }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);

  async function onGenerate() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          projectId,
          // For MVP: profileId is optional. We pass nothing and store snapshot in generation.
          // Later you will map these presets to d2c_profiles rows.
          profileId: undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Generate failed");

      if (data.saved === false && data.bundle) {
        sessionStorage.setItem("d2c_demo_bundle", JSON.stringify(data.bundle));
        window.location.href = "/result";
        return;
      }

      window.location.href = `/projects/${data.projectId}/generations/${data.generationId}`;
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="p-6">
          <h1 className="h1">New Generation</h1>
          <p className="p-muted mt-2">
            Figma URL を貼り付けて Generate。現時点はモックパイプラインで、DB保存・結果画面・ZIP出力の骨組みを提供します。
          </p>

          <div className="mt-6">
            <label className="block text-sm font-semibold">Source (Figma URL)</label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.figma.com/file/XXX/YYY?node-id=12%3A345"
              className="mt-2 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none focus:border-[rgba(170,90,255,0.75)]"
            />
            <div className="p-muted mt-2">node-id が付いたFrame URL推奨（無い場合も動きますが精度の前提を置けません）。</div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-[rgba(255,80,80,0.4)] bg-[rgba(255,80,80,0.08)] px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button
              onClick={onGenerate}
              disabled={busy || sourceUrl.trim().length < 10}
              variant="primary"
            >
              {busy ? "Generating..." : "Generate"}
            </Button>
            <Button href="/" variant="secondary">
              Cancel
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <Card className="p-6">
          <div className="h2">Quality Preset (demo)</div>
          <p className="p-muted mt-2">
            本MVPではDBのProfileテーブル連携は後回しにし、まず“体験”が回ることを優先しています。
          </p>

          <div className="mt-4 grid gap-2">
            {PRESETS.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                  presetId === p.id
                    ? "border-[rgba(170,90,255,0.75)] bg-[rgba(170,90,255,0.10)]"
                    : "border-[rgb(var(--border))] bg-[rgb(var(--surface2))] hover:border-[rgba(170,90,255,0.45)]"
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={presetId === p.id}
                  onChange={() => setPresetId(p.id)}
                />
                <div className="text-sm font-semibold">{p.label}</div>
                <div className="text-xs text-[rgb(var(--muted))] mt-1">{p.description}</div>
                <div className="mt-2 flex gap-2">
                  <span className="badge">{p.mode}</span>
                  <span className="badge">{p.outputTarget}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-5 text-xs text-[rgb(var(--muted))]">
            次の実装で、このプリセットを <code>d2c_profiles</code> に紐付け、UIから選択→生成に反映します。
          </div>
        </Card>
      </div>
    </div>
  );
}
