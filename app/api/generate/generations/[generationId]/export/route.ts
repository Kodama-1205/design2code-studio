// app/api/generate/generations/[generationId]/export/route.ts

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildZipFromFiles } from "@/lib/zip";

export const runtime = "nodejs";

type ZipFile = { path: string; content: string };

  const body = await buildZipFromFiles(files.map((f) => ({ path: f.path, content: f.content })));

  const filename = `design2code_${project.id}_${generation.id}.zip`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * generationId から export 用コンテキストを組み立てる
 * - generation（id, project_id）
 * - project（id）
 * - files（path, content）→ ZIP化
 */
async function getExportContext(
  generationId: string
): Promise<{ project: { id: string }; generation: { id: string }; zipBuffer: Buffer }> {
  // 1) generation を取得（テーブル名の揺れに備えて候補を試す）
  const generation = await fetchGenerationRow(generationId);

  // 2) project を取得
  const project = await fetchProjectRow(generation.project_id);

  // 3) files を取得（path/content）
  const files = await fetchGenerationFiles(generationId);
  if (files.length === 0) {
    throw new Error("対象の生成ファイルが見つかりませんでした（filesが0件）");
  }

  // 4) ZIP生成（Buffer）
  const zipBuffer = await buildZipFromFiles(files);

  return {
    project: { id: project.id },
    generation: { id: generation.id },
    zipBuffer,
  };
}

/** generation取得（最低限 id と project_id が取れればOK） */
async function fetchGenerationRow(
  generationId: string
): Promise<{ id: string; project_id: string }> {
  const tableCandidates = [
    "generations",
    "generation",
    "generation_rows",
    "demo_generations", // 念のため（demo系を使ってる場合）
  ];

  let lastError: string | null = null;

  for (const table of tableCandidates) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("id, project_id")
      .eq("id", generationId)
      .maybeSingle();

    if (error) {
      lastError = `[${table}] ${error.message}`;
      continue;
    }

    if (data?.id && data?.project_id) {
      return { id: data.id, project_id: data.project_id };
    }
  }

  throw new Error(
    lastError
      ? `generation を取得できませんでした。最後のエラー: ${lastError}`
      : "generation を取得できませんでした（原因不明）"
  );
}

/** project取得（最低限 id が取れればOK） */
async function fetchProjectRow(projectId: string): Promise<{ id: string }> {
  const tableCandidates = [
    "projects",
    "project",
    "project_rows",
    "demo_projects", // 念のため
  ];

  let lastError: string | null = null;

  for (const table of tableCandidates) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      lastError = `[${table}] ${error.message}`;
      continue;
    }

    if (data?.id) return { id: data.id };
  }

  throw new Error(
    lastError
      ? `project を取得できませんでした。最後のエラー: ${lastError}`
      : "project を取得できませんでした（原因不明）"
  );
}

/** files取得（path/content） */
async function fetchGenerationFiles(generationId: string): Promise<ZipFile[]> {
  const tableCandidates = [
    "files",
    "generation_files",
    "generated_files",
    "demo_files", // 念のため
  ];

  let lastError: string | null = null;

  for (const table of tableCandidates) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("path, content")
      .eq("generation_id", generationId)
      .order("path", { ascending: true });

    if (error) {
      lastError = `[${table}] ${error.message}`;
      continue;
    }

    const files =
      (data ?? [])
        .filter((r: any) => typeof r?.path === "string" && typeof r?.content === "string")
        .map((r: any) => ({ path: r.path as string, content: r.content as string })) ?? [];

    return files;
  }

  throw new Error(
    lastError
      ? `files を取得できませんでした。最後のエラー: ${lastError}`
      : "files を取得できませんでした（原因不明）"
  );
}
