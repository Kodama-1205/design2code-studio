"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function NewClient(props: {
  projectId?: string;
  initialSourceUrl: string;
  projectName?: string;
}) {
  const router = useRouter();
  const { projectId, initialSourceUrl, projectName } = props;

  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [figmaToken, setFigmaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hint = useMemo(
    () => "例：https://www.figma.com/design/XXX/YYY?node-id=12%3A345（node-id付き推奨）",
    []
  );

  const isRegenerate = Boolean(projectId);

  async function onGenerate() {
    setBusy(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          projectId: projectId || undefined,
          // 再生成でもトークンを入れられる（入力されているときだけ送る）
          figmaToken: figmaToken.trim() ? figmaToken.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMsg(data?.message ?? data?.error ?? "生成に失敗しました。");
        return;
      }

      // デモモード: 保存なしで bundle のみ返却 → sessionStorage に保存して /result へ
      if (data?.saved === false && data?.bundle) {
        try {
          sessionStorage.setItem("d2c_demo_bundle", JSON.stringify(data.bundle));
        } catch {
          // sessionStorage 失敗は無視
        }
        router.push("/result");
        return;
      }

      // 保存済み: projectId / generationId で結果ページへ
      if (data?.projectId && data?.generationId) {
        router.push(`/projects/${data.projectId}/generations/${data.generationId}`);
        return;
      }
      if (data?.bundle?.project?.id && data?.bundle?.generation?.id) {
        router.push(`/projects/${data.bundle.project.id}/generations/${data.bundle.generation.id}`);
        return;
      }

      setErrorMsg("生成結果の遷移情報が取得できませんでした。");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "不明なエラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-4" style={{ width: "100%" }}>
      <div style={{ flex: "1 1 0", minWidth: 0, width: "100%" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="h1">{isRegenerate ? "再生成" : "新規作成"}</h1>
            <p className="p-muted mt-2">
              {isRegenerate
                ? `保存済みプロジェクトに対して再生成します。${projectName ? `（${projectName}）` : ""}`
                : "Figma URL を入力してコード生成を実行します。"}
            </p>
          </div>
        </div>

        <Card className="mt-6 p-6" style={{ width: "100%" }}>
          <div className="grid gap-4" style={{ width: "100%" }}>
            <div style={{ width: "100%", minWidth: 0 }}>
              <div className="text-sm font-semibold">Figma URL</div>
              <div className="p-muted mt-1 text-xs">{hint}</div>
              <input
                className="d2c-form-input-full mt-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none"
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder={hint}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </div>

            <div style={{ width: "100%", minWidth: 0 }}>
              <div className="text-sm font-semibold">Figma トークン（任意）</div>
              <div className="p-muted mt-1 text-xs">
                プレビュー画像取得に使用します（最大30日で失効）。{" "}
                <span className="font-semibold text-[rgb(var(--text))]">アプリ側には保存しません</span>。
              </div>
              <input
                className="d2c-form-input-full mt-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface2))] px-4 py-3 text-sm outline-none"
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="Personal Access Token（任意）"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={onGenerate} variant="primary" disabled={busy || sourceUrl.trim().length < 10}>
                {busy ? "生成中..." : isRegenerate ? "再生成する" : "生成する"}
              </Button>

              {isRegenerate && projectId && (
                <div className="p-muted text-xs">
                  projectId: <span className="font-mono">{projectId}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
