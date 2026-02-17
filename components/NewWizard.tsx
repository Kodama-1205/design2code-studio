"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Mode = "production" | "lecture" | "pixel";
type OutputTarget = "nextjs_tailwind" | "static_html_css";

const PRESETS: Array<{
  id: Mode;
  label: string;
  mode: Mode;
  outputTarget: OutputTarget;
  description: string;
}> = [
  {
    id: "production",
    label: "Production Mode",
    mode: "production",
    outputTarget: "nextjs_tailwind",
    description: "実務寄り。トークン/分割を前提。"
  },
  {
    id: "lecture",
    label: "Lecture Mode",
    mode: "lecture",
    outputTarget: "static_html_css",
    description: "授業向け。読みやすさ優先の静的出力。"
  },
  {
    id: "pixel",
    label: "Pixel Mode",
    mode: "pixel",
    outputTarget: "static_html_css",
    description: "見た目優先。absolute許容（将来拡張）。"
  }
];

export default function NewWizard({
  projectId,
  sourceUrl: initialSourceUrl
}: {
  projectId?: string;
  sourceUrl?: string;
}) {
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl ?? "");
  const [presetId, setPresetId] = useState<Mode>(PRESETS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [figmaToken, setFigmaToken] = useState<string>("");

  // ダッシュボードから再生成リンクで来たときにクエリの sourceUrl を反映
  useEffect(() => {
    if (typeof initialSourceUrl === "string" && initialSourceUrl.trim()) {
      setSourceUrl(initialSourceUrl.trim());
    }
  }, [initialSourceUrl]);

  const selectedPreset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setWarnings([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          projectId,
          // ✅ ここが実体：プリセット選択をサーバへ渡す
          presetId,
          // ✅ 任意：Figma Token（入力されているときだけ送る）
          ...(figmaToken.trim() ? { figmaToken: figmaToken.trim() } : {})
        })
      });

      const data = await res.json().catch(() => ({} as any));

      // warnings をUIに反映（成功/失敗どちらでもあり得る）
      if (Array.isArray(data?.warnings) && data.warnings.every((x: any) => typeof x === "string")) {
        setWarnings(data.warnings);
      }

      if (!res.ok) {
        const detail =
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
            ? data.error
            : "不明なエラー";
        setError(detail);
        return;
      }

      // デモモード: 保存なしで bundle のみ返却 → sessionStorage に保存して /result へ
      if (data?.saved === false && data?.bundle) {
        try {
          sessionStorage.setItem("d2c_demo_bundle", JSON.stringify(data.bundle));
        } catch {
          // sessionStorage 失敗は無視
        }
        window.location.href = "/result";
        return;
      }

      // 保存済み: projectId / generationId で結果ページへ
      if (typeof data?.projectId === "string" && typeof data?.generationId === "string") {
        window.location.href = `/projects/${data.projectId}/generations/${data.generationId}`;
        return;
      }
      if (data?.bundle?.project?.id && data?.bundle?.generation?.id) {
        window.location.href = `/projects/${data.bundle.project.id}/generations/${data.bundle.generation.id}`;
        return;
      }

      setError("生成結果の取得に失敗しました（projectId/generationId が不正です）。");
    } catch (e: any) {
      setError(e?.message ?? "通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4" style={{ width: "100%", maxWidth: "100%" }}>
      <div style={{ minWidth: 0, width: "100%" }}>
        <Card className="p-6" style={{ width: "100%" }}>
          <div className="h2">新規作成</div>
          <p className="p-muted mt-2">
            Figma のURLを入力して生成します。プリセットは生成プロファイルとしてDBに保存され、次回以降も同じ設定で生成できます。
          </p>

          <div className="mt-5 grid gap-3" style={{ width: "100%" }}>
            <div style={{ width: "100%", minWidth: 0 }}>
              <div className="text-sm font-medium">Figma URL</div>
              <input
                className="d2c-form-input-full mt-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.figma.com/file/... または /design/..."
              />
            </div>

            <div style={{ width: "100%", minWidth: 0 }}>
              <div className="text-sm font-medium">Figma Token（任意）</div>
              <input
                className="d2c-form-input-full mt-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none"
                style={{ width: "100%", boxSizing: "border-box" }}
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                placeholder="Personal Access Token（Images APIのプレビュー取得に使用）"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <div className="font-semibold">注意</div>
                <ul className="mt-2 list-disc pl-5">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-2 flex gap-2">
              <Button onClick={onGenerate} variant="primary" disabled={busy}>
                {busy ? "生成中..." : "生成する"}
              </Button>
              <Button href="/" variant="secondary">
                キャンセル
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="min-w-0">
        <Card className="p-6">
          <div className="h2">品質プリセット</div>
          <p className="p-muted mt-2">
            ここで選んだプリセットは、サーバ側で <code>d2c_profiles</code> に自動作成（または再利用）され、生成に紐付きます。
          </p>

          <div className="mt-4 grid grid-cols-1 min-[500px]:grid-cols-3 gap-3">
            {PRESETS.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer rounded-xl border px-4 py-3 transition min-w-0 ${
                  presetId === p.id
                    ? "border-[rgba(var(--accent),0.75)] bg-[rgba(var(--accent),0.10)]"
                    : "border-[rgb(var(--border))] bg-[rgb(var(--surface2))] hover:border-[rgba(var(--accent),0.45)]"
                }`}
              >
                <input type="radio" className="hidden" checked={presetId === p.id} onChange={() => setPresetId(p.id)} />
                <div className="text-sm font-semibold">{p.label}</div>
                <div className="p-muted mt-1 text-xs">{p.description}</div>
                <div className="mt-2 flex gap-2">
                  <span className="badge">{p.mode}</span>
                  <span className="badge">{p.outputTarget}</span>
                </div>
              </label>
            ))}
          </div>

          <p className="p-muted mt-4 text-xs">
            選択中：<span className="font-semibold">{selectedPreset.label}</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
