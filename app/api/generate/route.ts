// app/api/generate/route.ts
// Figma URL を元に project/generation 作成 → モックパイプライン → 保存（またはデモバンドル返却）。
// Dify は使用しない。

import { NextResponse } from "next/server";
import { parseFigmaUrl, fetchFigmaImageUrl } from "@/lib/figma";
import { getServerEnvOrNull, DEMO_OWNER_ID } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getProject,
  createOrUpdateProject,
  createGeneration,
  setGenerationStatus,
  saveGenerationArtifacts,
} from "@/lib/db";
import { runMockPipeline } from "@/lib/mockPipeline";
import { buildDemoBundle, type DemoBundle } from "@/lib/demoBundle";
import crypto from "crypto";

export const runtime = "nodejs";

/** POST body（新規作成・再生成） */
type GenerateBody = {
  sourceUrl: string;
  projectId?: string;
  figmaToken?: string;
};

/** 成功時（保存済み） */
type SavedResponse = {
  saved: true;
  projectId: string;
  generationId: string;
};

/** デモモード（DB 未設定 or 保存失敗時） */
type DemoResponse = {
  saved: false;
  bundle: DemoBundle;
};

type ErrorResponse = { message?: string; error?: string };

function projectNameFromFileKey(fileKey: string): string {
  return fileKey.length > 12 ? `Figma ${fileKey.slice(0, 8)}…` : `Figma ${fileKey}`;
}

async function savePreviewIfPossible(params: {
  projectId: string;
  snapshotHash: string;
  fileKey: string;
  nodeId: string;
  token: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const imageUrl = await fetchFigmaImageUrl({
      fileKey: params.fileKey,
      nodeId: params.nodeId,
      token: params.token,
      scale: 2,
    });
    const imgRes = await fetch(imageUrl, { cache: "no-store" });
    if (!imgRes.ok) return;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const path = `${params.projectId}/${params.snapshotHash}.png`;
    await supabase.storage.from("d2c-previews").upload(path, buf, {
      contentType: "image/png",
      upsert: true,
    });
  } catch {
    // プレビュー取得失敗は無視
  }
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
        {
          message:
            "Figma URL の形式が不正です。例: https://www.figma.com/design/XXX/YYY?node-id=12%3A345（node-id 付き推奨）",
        },
        { status: 400 }
      );
    }

    const { fileKey, nodeId } = parsed;
    const serverEnv = getServerEnvOrNull();
    const supabase = getSupabaseAdmin();

    if (serverEnv && supabase) {
      try {
        let projectName = projectNameFromFileKey(fileKey);
        let effectiveProjectId: string | undefined = projectId;
        if (projectId) {
          const existing = await getProject(projectId);
          if (!existing) {
            // 無効な projectId（削除済み等）の場合は新規作成として続行
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

        const generation = await createGeneration({
          project_id: project.id,
          profile_id: null,
        });

        await setGenerationStatus(generation.id, "running", {
          started_at: new Date().toISOString(),
        });

        const artifacts = await runMockPipeline({
          figmaFileKey: fileKey,
          figmaNodeId: nodeId,
          sourceUrl,
          projectId: project.id,
          generationId: generation.id,
        });

        if (figmaToken) {
          await savePreviewIfPossible({
            projectId: project.id,
            snapshotHash: artifacts.snapshotHash,
            fileKey,
            nodeId,
            token: figmaToken,
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

        await setGenerationStatus(generation.id, "succeeded", {
          finished_at: new Date().toISOString(),
        });

        const out: SavedResponse = {
          saved: true,
          projectId: project.id,
          generationId: generation.id,
        };
        return NextResponse.json(out, { status: 200 });
      } catch (saveError: unknown) {
        const msg = saveError instanceof Error ? saveError.message : "保存中にエラーが発生しました。";
        return NextResponse.json<ErrorResponse>(
          { message: `保存に失敗しました: ${msg}`, error: msg },
          { status: 500 }
        );
      }
    }

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
    return NextResponse.json<ErrorResponse>(
      { message, error: message },
      { status: 500 }
    );
  }
}
