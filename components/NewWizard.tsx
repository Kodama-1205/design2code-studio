"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getAccessToken } from "@/lib/authClient";

type Mode = "production" | "lecture" | "pixel";
type OutputTarget = "nextjs_tailwind" | "static_html_css";

type PresetOption = {
  id: string;
  label: string;
  mode: Mode;
  outputTarget: OutputTarget;
  description: string;
};

type ProfileRow = {
  id: string;
  name: string;
  mode: Mode;
  output_target: OutputTarget;
};

const PRESET_DESCRIPTIONS: Record<string, string> = {
  Production: "実務寄り。トークン化/分割を前提。",
  Lecture: "授業向け。読みやすさ優先の静的出力。",
  Pixel: "見た目優先。absolute許容（将来拡張）。"
};

const PRESETS: PresetOption[] = [
  { id: "prod_next", label: "Production（実務）", mode: "production", outputTarget: "nextjs_tailwind", description: "実務寄り。トークン化/分割を前提。" },
  { id: "lecture_static", label: "Lecture（講義）", mode: "lecture", outputTarget: "static_html_css", description: "授業向け。読みやすさ優先の静的出力。" },
  { id: "pixel_static", label: "Pixel（見た目優先）", mode: "pixel", outputTarget: "static_html_css", description: "見た目優先。absolute許容（将来拡張）。" }
];

export default function NewWizard({ projectId }: { projectId?: string }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAccessToken()
      .then((token) =>
        fetch("/api/profiles", { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      )
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!active) return;
        const rows = (data?.profiles ?? []) as ProfileRow[];
        setProfiles(rows.length > 0 ? rows : []);
      })
      .catch(() => {
        if (!active) return;
        setProfiles([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const presetOptions: PresetOption[] = useMemo(() => {
    if (profiles && profiles.length > 0) {
      return profiles.map((p) => ({
        id: p.id,
        label: p.name,
        mode: p.mode,
        outputTarget: p.output_target,
        description: PRESET_DESCRIPTIONS[p.name] ?? "プリセット"
      }));
    }
    return PRESETS;
  }, [profiles]);

  useEffect(() => {
    if (!presetId && presetOptions[0]) {
      setPresetId(presetOptions[0].id);
    }
  }, [presetId, presetOptions]);

  const preset = useMemo(() => presetOptions.find((p) => p.id === presetId) ?? presetOptions[0], [presetId, presetOptions]);

  async function onGenerate() {
    setBusy(true);
    setError(null);

    try {
      // UX: keep sourceUrl for immediate preview during next page load
      try {
        sessionStorage.setItem("d2c_last_source_url", sourceUrl);
        sessionStorage.setItem("d2c_last_source_url_ts", String(Date.now()));
        if (projectId) sessionStorage.setItem(`d2c_source_url:${projectId}`, sourceUrl);
      } catch {}

      const token = await getAccessToken();
      if (!token) throw new Error("ログインが必要です。");
      const isUuid = typeof presetId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(presetId);
      const selectedProfileId = profiles && profiles.length > 0 && isUuid ? presetId : undefined;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sourceUrl,
          projectId,
          profileId: selectedProfileId
        })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        const detail = data?.details ? JSON.stringify(data.details, null, 2) : null;
        const raw = typeof data?.raw === "string" && data.raw.trim().length > 0 ? data.raw : null;
        const bodyPreview = data ? null : (text?.slice(0, 500) ?? "");
        const message = [
          data?.message ?? `生成に失敗しました（HTTP ${res.status}）`,
          detail,
          raw,
          bodyPreview ? `---\n${bodyPreview}` : null
        ]
          .filter(Boolean)
          .join("\n");
        throw new Error(message);
      }

      if (data.saved === false && data.bundle) {
        sessionStorage.setItem("d2c_demo_bundle", JSON.stringify(data.bundle));
        window.location.href = "/result";
        return;
      }

      // Persist sourceUrl for the target pages to render an immediate embed while bundle loads.
      try {
        if (data?.projectId) sessionStorage.setItem(`d2c_source_url:${data.projectId}`, sourceUrl);
        if (data?.generationId) sessionStorage.setItem(`d2c_source_url:${data.generationId}`, sourceUrl);
        if (data?.updatingGenerationId) sessionStorage.setItem(`d2c_source_url:${data.updatingGenerationId}`, sourceUrl);
        if (data?.projectId) sessionStorage.setItem("d2c_last_project_id", String(data.projectId));
        if (data?.generationId) sessionStorage.setItem("d2c_last_generation_id", String(data.generationId));
        if (data?.updatingGenerationId) sessionStorage.setItem("d2c_last_updating_generation_id", String(data.updatingGenerationId));
      } catch {}

      if (data.cached) {
        const updating = typeof data.updatingGenerationId === "string" ? `&updating=${encodeURIComponent(data.updatingGenerationId)}` : "";
        window.location.assign(`/projects/${data.projectId}/generations/${data.generationId}?cached=1${updating}`);
        return;
      }

      if (data.fallback === "mock") {
        window.location.assign(`/projects/${data.projectId}/generations/${data.generationId}?fallback=mock`);
        return;
      }

      const updating =
        typeof data.updatingGenerationId === "string" && data.updatingGenerationId.length > 0
          ? `?updating=${encodeURIComponent(data.updatingGenerationId)}`
          : "";
      window.location.assign(`/projects/${data.projectId}/generations/${data.generationId}${updating}`);
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
          <h1 className="h1">新規生成</h1>
          <p className="p-muted mt-2">
            Figma URL を貼り付けて生成します。現時点はMVPで、DB保存・結果画面・ZIP出力までの骨組みを提供します。
          </p>

          <div className="mt-6">
            <label className="block text-sm font-semibold">ソース（Figma URL）</label>
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
              <pre className="whitespace-pre-wrap break-words text-sm">{error}</pre>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button
              onClick={onGenerate}
              disabled={busy || sourceUrl.trim().length < 10}
              variant="primary"
            >
              {busy ? "生成中..." : "生成する"}
            </Button>
            <Button href="/" variant="secondary">
              キャンセル
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <Card className="p-6">
          <div className="h2">品質プリセット（デモ）</div>
          <p className="p-muted mt-2">
            現在は <code>d2c_profiles</code> と連動し、選択したプリセットが生成に反映されます。
          </p>

          <div className="mt-4 grid gap-2">
            {presetOptions.map((p) => (
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
            プリセットは Supabase に保存され、チームで共通利用できます。
          </div>
        </Card>
      </div>
    </div>
  );
}
