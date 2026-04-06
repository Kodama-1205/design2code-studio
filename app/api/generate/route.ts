// app/api/generate/route.ts
// Figma URL からプロジェクト/generation を作成し、pixelPipeline で生成・視覚検証する。

import { NextResponse } from "next/server";
import { parseFigmaUrl } from "@/lib/figma";
import { FigmaRateLimitError } from "@/lib/figma";
import { getServerEnvOrNull, DEMO_OWNER_ID } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getProject,
  createOrUpdateProject,
  createGeneration,
  setGenerationStatus,
  saveGenerationArtifacts,
  saveGenerationImages,
} from "@/lib/db";
import { runPixelFigmaPipeline } from "@/lib/pixelPipeline";
import { runMockPipeline } from "@/lib/mockPipeline";
import { buildDemoBundle, type DemoBundle } from "@/lib/demoBundle";
import crypto from "crypto";

export const runtime = "nodejs";

type GenerateBody = {
  sourceUrl: string;
  projectId?: string;
  figmaToken?: string;
  presetId?: string;
};

type SavedResponse = {
  saved: true;
  projectId: string;
  generationId: string;
};

type DemoResponse = {
  saved: false;
  bundle: DemoBundle;
};

type ErrorResponse = { message?: string; error?: string };

function projectNameFromFileKey(fileKey: string): string {
  return fileKey.length > 12 ? `Figma ${fileKey.slice(0, 8)}…` : `Figma ${fileKey}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as GenerateBody;
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() || undefined : undefined;
    const figmaToken = typeof body.figmaToken === "string" ? body.figmaToken.trim() || undefined : undefined;

    if (sourceUrl.length < 10) {
      return NextResponse.json<ErrorResponse>(
        { message: "sourceUrl が必要です。Figma の Frame URL（node-id 付き）を入力してください。" },
        { status: 400 }
      );
    }

    const parsed = parseFigmaUrl(sourceUrl);
    if (!parsed) {
      return NextResponse.json<ErrorResponse>(
        { message: "Figma URL の形式が不正です。例: https://www.figma.com/design/XXX/YYY?node-id=12%3A345" },
        { status: 400 }
      );
    }

    const { fileKey, nodeId } = parsed;
    const serverEnv = getServerEnvOrNull();
    const supabase = getSupabaseAdmin();

    // ── 保存モード（Supabase 設定済み） ──────────────────────────────
    if (serverEnv && supabase) {
      let generationIdForCleanup: string | null = null;
      try {
        let projectName = projectNameFromFileKey(fileKey);
        let effectiveProjectId: string | undefined = projectId;
        if (projectId) {
          const existing = await getProject(projectId);
          if (!existing) {
            effectiveProjectId = undefined;
          } else {
            projectName = existing.name;
          }
        }

        const project = await createOrUpdateProject({
          id: effectiveProjectId,
          name: projectName,
          figma_file_key: fileKey,
          figma_node_id: nodeId,
          source_url: sourceUrl,
          default_profile_id: null,
        });

        const generation = await createGeneration({ project_id: project.id, profile_id: null });
        generationIdForCleanup = generation.id;

        await setGenerationStatus(generation.id, "running", { started_at: new Date().toISOString() });

        // ── パイプライン選択 ──────────────────────────────────────────
        // figmaToken あり → pixelPipeline（Nodes API → IR → absolute HTML → 視覚検証）
        // figmaToken なし → mockPipeline（ダミー雛形）
        let artifacts: Awaited<ReturnType<typeof runMockPipeline>>;

        if (figmaToken) {
          try {
            const pixelResult = await runPixelFigmaPipeline({
              figmaFileKey: fileKey,
              figmaNodeId: nodeId,
              sourceUrl,
              figmaToken,
            });

            // 画像3点（figma原画 / レンダリング / diff）を Storage に保存
            await saveGenerationImages({
              projectId: project.id,
              snapshotHash: pixelResult.snapshotHash,
              figmaPng: pixelResult.figmaPng,
              renderPng: pixelResult.renderPng,
              diffPng: pixelResult.diffPng,
            }).catch((e) => {
              console.error("[generate] 画像保存に失敗（生成は続行）:", e instanceof Error ? e.message : String(e));
            });

            artifacts = pixelResult;
          } catch (e) {
            if (e instanceof FigmaRateLimitError) throw e;
            // Figma Nodes API 失敗（権限エラー等）→ モックへフォールバック
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error("[generate] pixelPipeline 失敗、モックへフォールバック:", errMsg);
            artifacts = await runMockPipeline({
              figmaFileKey: fileKey,
              figmaNodeId: nodeId,
              sourceUrl,
              projectId: project.id,
              generationId: generation.id,
            });
            (artifacts.report as Record<string, unknown>).figmaFallbackToMock = true;
            (artifacts.report as Record<string, unknown>).figmaFallbackMessage =
              `Figma Nodes API の取得に失敗したためモック表示しています: ${errMsg}`;
          }
        } else {
          artifacts = await runMockPipeline({
            figmaFileKey: fileKey,
            figmaNodeId: nodeId,
            sourceUrl,
            projectId: project.id,
            generationId: generation.id,
          });
        }

        await saveGenerationArtifacts({
          projectId: project.id,
          generationId: generation.id,
          profileSnapshot: artifacts.profileSnapshot,
          irJson: artifacts.ir,
          reportJson: artifacts.report,
          files: artifacts.files,
          mappings: artifacts.mappings,
          snapshotHash: artifacts.snapshotHash,
        });

        await setGenerationStatus(generation.id, "succeeded", { finished_at: new Date().toISOString() });

        const out: SavedResponse = { saved: true, projectId: project.id, generationId: generation.id };
        return NextResponse.json(out, { status: 200 });
      } catch (saveError: unknown) {
        const msg = saveError instanceof Error ? saveError.message : "保存中にエラーが発生しました。";
        if (generationIdForCleanup) {
          await setGenerationStatus(generationIdForCleanup, "failed", {
            finished_at: new Date().toISOString(),
            error_json: { message: msg },
          }).catch(() => {});
        }
        const isNetworkError = /fetch failed|Failed to fetch|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(msg);
        const displayMessage = isNetworkError
          ? `保存に失敗しました: ${msg}（Supabase の URL・キーおよびサーバーからの接続を確認してください）`
          : `保存に失敗しました: ${msg}`;
        return NextResponse.json<ErrorResponse>({ message: displayMessage, error: msg }, { status: 500 });
      }
    }

    // ── デモモード（Supabase 未設定） ─────────────────────────────────
    const demoProjectId = projectId ?? crypto.randomUUID();
    const demoGenerationId = crypto.randomUUID();

    const artifacts = await runMockPipeline({
      figmaFileKey: fileKey,
      figmaNodeId: nodeId,
      sourceUrl,
      projectId: demoProjectId,
      generationId: demoGenerationId,
    });

    const bundle = buildDemoBundle(
      demoProjectId,
      demoGenerationId,
      {
        name: projectNameFromFileKey(fileKey),
        figma_file_key: fileKey,
        figma_node_id: nodeId,
        source_url: sourceUrl,
        owner_id: serverEnv?.D2C_OWNER_ID ?? DEMO_OWNER_ID,
      },
      {
        snapshotHash: artifacts.snapshotHash,
        ir: artifacts.ir,
        report: artifacts.report,
        files: artifacts.files,
        mappings: artifacts.mappings,
      }
    );

    const out: DemoResponse = { saved: false, bundle };
    return NextResponse.json(out, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "生成に失敗しました。";
    return NextResponse.json<ErrorResponse>({ message, error: message }, { status: 500 });
  }
}
