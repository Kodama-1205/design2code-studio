// lib/db.ts
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerEnv, getServerEnvOrNull } from "@/lib/env";

/**
 * DBアクセス層
 * - Supabase Admin（Service Role）でDB操作
 * - Supabase未設定時はこの層で明示的に例外を投げる（UI側で握ってデモ継続）
 */

export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  figma_file_key: string;
  figma_node_id: string;
  source_url: string;
  default_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GenerationRow = {
  id: string;
  project_id: string;
  profile_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  figma_snapshot_hash: string | null;
  ir_json: any | null;
  report_json: any | null;
  error_json: any | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type FileRow = {
  id: string;
  generation_id: string;
  path: string;
  content: string;
  content_sha256: string;
  kind: "code" | "config" | "style" | "asset_index";
  created_at: string;
};

export type MappingRow = {
  id: string;
  generation_id: string;
  figma_node_id: string;
  figma_node_name: string | null;
  target_path: string;
  target_symbol: string | null;
  loc_start: number | null;
  loc_end: number | null;
  mapping_type: "component" | "element" | "style_token" | "asset";
  created_at: string;
};

/**
 * /result が参照する「bundle」型
 */
export type GenerationBundle = {
  project: ProjectRow;
  generation: {
    id: string;
    status: GenerationRow["status"];
    figma_snapshot_hash: string | null;
    ir_json: any | null;
    report_json: any | null;
    profileId: string | null;
    profile: {
      mode: string;
      outputTarget: string;
    };
  };
  files: FileRow[];
  mappings: MappingRow[];
};

/**
 * ✅ プロジェクト単体取得（再生成でURL自動セットに必須）
 */
export async function getProject(projectId: string): Promise<ProjectRow | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、プロジェクト取得はできません。");
  }

  const { data, error } = await supabaseAdmin
    .from("d2c_projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error || !data) return null;
  return data as ProjectRow;
}

/**
 * ✅ ダッシュボード用：プロジェクト一覧（owner_idで絞る）
 * - 各プロジェクトの最新 generation_id と figma_snapshot_hash を付与（サムネイル表示用）
 * - Supabase 未設定時は空配列を返し、ダッシュボードは「保存されたプロジェクトがありません」を表示
 */
export async function listProjects(): Promise<
  Array<ProjectRow & { last_generation_id: string | null; last_snapshot_hash: string | null }>
> {
  const serverEnv = getServerEnvOrNull();
  const supabaseAdmin = getSupabaseAdmin();
  if (!serverEnv || !supabaseAdmin) return [];

  const { data: projects, error } = await supabaseAdmin
    .from("d2c_projects")
    .select("*")
    .eq("owner_id", serverEnv.D2C_OWNER_ID)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const results: Array<ProjectRow & { last_generation_id: string | null; last_snapshot_hash: string | null }> = [];

  for (const p of projects ?? []) {
    const { data: gens } = await supabaseAdmin
      .from("d2c_generations")
      .select("id, figma_snapshot_hash")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const last = gens?.[0];
    results.push({
      ...(p as ProjectRow),
      last_generation_id: last?.id ?? null,
      last_snapshot_hash: last?.figma_snapshot_hash ?? null,
    });
  }

  return results;
}

/**
 * ✅ プロジェクト作成/更新
 */
export async function createOrUpdateProject(input: {
  id?: string;
  name: string;
  figma_file_key: string;
  figma_node_id: string;
  source_url: string;
  default_profile_id: string | null;
}): Promise<ProjectRow> {
  const serverEnv = getServerEnv();
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、プロジェクト保存はできません。");
  }

  const now = new Date().toISOString();

  if (input.id) {
    const { data, error } = await supabaseAdmin
      .from("d2c_projects")
      .update({
        name: input.name,
        figma_file_key: input.figma_file_key,
        figma_node_id: input.figma_node_id,
        source_url: input.source_url,
        default_profile_id: input.default_profile_id,
        updated_at: now,
      })
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data as ProjectRow;
  }

  const { data, error } = await supabaseAdmin
    .from("d2c_projects")
    .insert({
      owner_id: serverEnv.D2C_OWNER_ID,
      name: input.name,
      figma_file_key: input.figma_file_key,
      figma_node_id: input.figma_node_id,
      source_url: input.source_url,
      default_profile_id: input.default_profile_id,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("プロジェクト作成後にデータが取得できませんでした");

  return data as ProjectRow;
}

/**
 * ✅ 生成履歴作成
 * - profile_id 未指定ならデフォルト profile を自動作成して使う
 */
export async function createGeneration(input: {
  project_id: string;
  profile_id: string | null;
}): Promise<GenerationRow> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、生成履歴の作成はできません。");
  }

  const profileId = input.profile_id ?? (await ensureDefaultProfile());

  const { data, error } = await supabaseAdmin
    .from("d2c_generations")
    .insert({
      project_id: input.project_id,
      profile_id: profileId,
      status: "queued",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as GenerationRow;
}

/**
 * ✅ default profile を保証
 */
async function ensureDefaultProfile(): Promise<string> {
  const serverEnv = getServerEnv();
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、Profile を作成できません。");
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("d2c_profiles")
    .select("id")
    .eq("owner_id", serverEnv.D2C_OWNER_ID)
    .eq("name", "Default Production")
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabaseAdmin
    .from("d2c_profiles")
    .insert({
      owner_id: serverEnv.D2C_OWNER_ID,
      name: "Default Production",
      mode: "production",
      output_target: "nextjs_tailwind",
      use_shadcn: true,
      styling_strategy: "tailwind_only",
      naming_convention: "camel",
      qc_prettier: true,
      qc_eslint: true,
      qc_a11y: true,
      token_cluster_threshold: 0.12,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * ✅ 生成ステータス更新
 */
export async function setGenerationStatus(
  generationId: string,
  status: GenerationRow["status"],
  extra: Partial<
    Pick<GenerationRow, "started_at" | "finished_at" | "error_json">
  > & {
    started_at?: string;
    finished_at?: string;
    error_json?: any;
  }
) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、ステータス更新はできません。");
  }

  const { error } = await supabaseAdmin
    .from("d2c_generations")
    .update({
      status,
      started_at: extra.started_at ?? undefined,
      finished_at: extra.finished_at ?? undefined,
      error_json: extra.error_json ?? undefined,
    })
    .eq("id", generationId);

  if (error) throw new Error(error.message);
}

/**
 * ✅ 生成物の保存（files/mappings + generationの JSON）
 */
export async function saveGenerationArtifacts(input: {
  projectId: string;
  generationId: string;
  profileSnapshot: any;
  irJson: any;
  reportJson: any;
  files: Array<{ path: string; content: string; kind: FileRow["kind"] }>;
  mappings: Array<{
    figma_node_id: string;
    figma_node_name: string | null;
    target_path: string;
    target_symbol: string | null;
    loc_start: number | null;
    loc_end: number | null;
    mapping_type: MappingRow["mapping_type"];
  }>;
  snapshotHash: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、生成物の保存はできません。");
  }

  const { error: genErr } = await supabaseAdmin
    .from("d2c_generations")
    .update({
      figma_snapshot_hash: input.snapshotHash,
      ir_json: input.irJson,
      report_json: input.reportJson,
    })
    .eq("id", input.generationId);

  if (genErr) throw new Error(genErr.message);

  // files: upsert
  const fileRows = input.files.map((f) => ({
    generation_id: input.generationId,
    path: f.path,
    content: f.content,
    content_sha256: sha256(f.content),
    kind: f.kind,
  }));

  const { error: fileErr } = await supabaseAdmin
    .from("d2c_files")
    .upsert(fileRows, { onConflict: "generation_id,path" });

  if (fileErr) throw new Error(fileErr.message);

  // mappings: MVPとして一旦全消し→入れ直し
  await supabaseAdmin.from("d2c_mappings").delete().eq("generation_id", input.generationId);

  const mappingRows = input.mappings.map((m) => ({
    generation_id: input.generationId,
    figma_node_id: m.figma_node_id,
    figma_node_name: m.figma_node_name,
    target_path: m.target_path,
    target_symbol: m.target_symbol,
    loc_start: m.loc_start,
    loc_end: m.loc_end,
    mapping_type: m.mapping_type,
  }));

  const { error: mapErr } = await supabaseAdmin.from("d2c_mappings").insert(mappingRows);
  if (mapErr) throw new Error(mapErr.message);
}

/**
 * ✅ /result が参照する bundle を取得
 * - 見つからなければ null
 */
export async function getGenerationBundle(
  generationId: string
): Promise<GenerationBundle | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、生成結果は取得できません。");
  }

  const { data: gen, error: genErr } = await supabaseAdmin
    .from("d2c_generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (genErr || !gen) return null;
  const generation = gen as GenerationRow;

  const { data: project, error: projErr } = await supabaseAdmin
    .from("d2c_projects")
    .select("*")
    .eq("id", generation.project_id)
    .single();

  if (projErr || !project) return null;

  const { data: profile } = await supabaseAdmin
    .from("d2c_profiles")
    .select("id, mode, output_target")
    .eq("id", generation.profile_id)
    .maybeSingle();

  const { data: files, error: fileErr } = await supabaseAdmin
    .from("d2c_files")
    .select("*")
    .eq("generation_id", generation.id)
    .order("path", { ascending: true });

  if (fileErr) throw new Error(fileErr.message);

  const { data: mappings, error: mapErr } = await supabaseAdmin
    .from("d2c_mappings")
    .select("*")
    .eq("generation_id", generation.id)
    .order("created_at", { ascending: true });

  if (mapErr) throw new Error(mapErr.message);

  return {
    project: project as ProjectRow,
    generation: {
      id: generation.id,
      status: generation.status,
      figma_snapshot_hash: generation.figma_snapshot_hash,
      ir_json: generation.ir_json,
      report_json: generation.report_json,
      profileId: generation.profile_id,
      profile: {
        mode: (profile as any)?.mode ?? "production",
        outputTarget: (profile as any)?.output_target ?? "nextjs_tailwind",
      },
    },
    files: (files ?? []) as FileRow[],
    mappings: (mappings ?? []) as MappingRow[],
  };
}

/**
 * ✅ プロジェクト削除（関連データは FK の ON DELETE CASCADE で消える想定）
 * - owner_id が一致するもののみ削除（誤削除防止）
 */
export async function deleteProject(projectId: string): Promise<void> {
  const serverEnv = getServerEnv();
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error("Supabase が未設定のため、プロジェクト削除はできません。");
  }

  const { error } = await supabaseAdmin
    .from("d2c_projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", serverEnv.D2C_OWNER_ID);

  if (error) throw new Error(error.message);
}

/**
 * ==========================
 * generation job 周りの互換 export
 * ==========================
 *
 * routes / worker 側が named export を期待しているが、現状の db.ts には関数が存在しないため、
 * ここで最小限の実装を追加する。
 *
 * NOTE:
 * - 実DBのテーブル構成（job テーブルが別途あるか）まではこのリポジトリだけでは不明。
 * - そのため、フォールバックとして `d2c_generations` を job 管理にも使う前提で実装する。
 * - Supabase が未設定なら安全に空/ null を返す。
 */

type GenerationJobClaimInput = {
  limit: number;
  workerId: string;
  lockTtlSec: number;
};

type GenerationJobClaimSingleInput = {
  generationId: string;
  workerId: string;
  lockTtlSec: number;
};

export async function claimDueGenerationJobs(input: GenerationJobClaimInput): Promise<
  Array<any>
> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const now = new Date();
  const nowIso = now.toISOString();
  const lockExpiredIso = new Date(now.getTime() - input.lockTtlSec * 1000).toISOString();

  // 候補を先に絞り、その後に 1件ずつロックをかける（完全な SKIP LOCKED はできない）。
  // ただしデモ用途/低並列なら十分に動くことが多い。
  const { data: candidates, error } = await supabaseAdmin
    .from("d2c_generations")
    .select("*")
    .in("status", ["queued", "waiting"] as any)
    .or(`next_attempt_at.lte.${nowIso},next_attempt_at.is.null`)
    .or(`locked_by.is.null,locked_at.lte.${lockExpiredIso}`)
    .order("next_attempt_at", { ascending: true })
    .limit(input.limit);

  if (error || !candidates) return [];

  const claimed: Array<any> = [];

  for (const c of candidates as any[]) {
    const attempt = typeof c.attempt_count === "number" ? c.attempt_count : 0;
    const attemptCount = attempt + 1;

    const { data: updated } = await supabaseAdmin
      .from("d2c_generations")
      .update({
        status: "running",
        locked_by: input.workerId,
        locked_at: nowIso,
        next_attempt_at: nowIso,
        attempt_count: attemptCount,
        last_error: null
      })
      .eq("id", c.id)
      .select("*")
      .single()
      .catch(() => null);

    if (updated) {
      claimed.push({
        ...updated,
        id: updated.id,
        generation_id: updated.id
      });
    }
  }

  return claimed;
}

export async function getGenerationJobByGenerationId(
  generationId: string
): Promise<any | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("d2c_generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (error || !data) return null;
  return { ...(data as any), generation_id: (data as any).id };
}

export async function claimGenerationJob(
  input: GenerationJobClaimSingleInput
): Promise<any | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const now = new Date();
  const nowIso = now.toISOString();
  const lockExpiredIso = new Date(now.getTime() - input.lockTtlSec * 1000).toISOString();

  const job = await getGenerationJobByGenerationId(input.generationId);
  if (!job) return null;

  const status = job.status;
  const nextAttemptAt = job.next_attempt_at ? Date.parse(job.next_attempt_at) : 0;
  const due = status === "queued" || status === "waiting" ? nextAttemptAt <= Date.now() : false;

  const lockOk =
    !job.locked_by ||
    !job.locked_at ||
    (typeof job.locked_at === "string" && Date.parse(job.locked_at) <= Date.parse(lockExpiredIso));

  if (!due || !lockOk) return null;

  const attempt = typeof job.attempt_count === "number" ? job.attempt_count : 0;
  const attemptCount = attempt + 1;

  const { data: updated, error } = await supabaseAdmin
    .from("d2c_generations")
    .update({
      status: "running",
      locked_by: input.workerId,
      locked_at: nowIso,
      next_attempt_at: nowIso,
      attempt_count: attemptCount,
      last_error: null
    })
    .eq("id", input.generationId)
    .select("*")
    .single();

  if (error || !updated) return null;
  return { ...(updated as any), generation_id: (updated as any).id };
}

export async function updateGenerationJobByGenerationId(
  generationId: string,
  updates: Record<string, any>
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const { error } = await supabaseAdmin.from("d2c_generations").update(updates).eq("id", generationId);
  if (error) throw new Error(error.message);
}

export async function updateGenerationJob(
  jobId: string,
  updates: Record<string, any>
): Promise<void> {
  // フォールバックとして jobId = generationId とみなす
  await updateGenerationJobByGenerationId(jobId, updates);
}

export async function listProfiles(ownerId: string): Promise<Array<any>> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from("d2c_profiles")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data as any[];
}

/**
 * ✅ pixelPipeline の画像3点（figma / render / diff）を Storage に保存
 * - Supabase 未設定時はスキップ（エラーにしない）
 */
export async function saveGenerationImages(input: {
  projectId: string;
  snapshotHash: string;
  figmaPng: Uint8Array;
  renderPng: Uint8Array | null;
  diffPng: Uint8Array | null;
}): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const base = `${input.projectId}/${input.snapshotHash}`;
  const bucket = "d2c-previews";

  const uploads: Array<{ path: string; buf: Buffer }> = [
    { path: `${base}.png`, buf: Buffer.from(input.figmaPng) },
  ];
  if (input.renderPng) uploads.push({ path: `${base}_render.png`, buf: Buffer.from(input.renderPng) });
  if (input.diffPng) uploads.push({ path: `${base}_diff.png`, buf: Buffer.from(input.diffPng) });

  await Promise.all(
    uploads.map(({ path, buf }) =>
      supabaseAdmin.storage.from(bucket).upload(path, buf, { contentType: "image/png", upsert: true })
    )
  );
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
