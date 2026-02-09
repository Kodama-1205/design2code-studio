// lib/db.ts
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";

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

// /result が型参照する「bundle」の型（anyに逃がさず明示）
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

export async function listProjects(): Promise<Array<ProjectRow & { last_generation_id: string | null }>> {
  const { data: projects, error } = await supabaseAdmin
    .from("d2c_projects")
    .select("*")
    .eq("owner_id", env.D2C_OWNER_ID)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  // last generation per project (simple approach)
  const results: Array<ProjectRow & { last_generation_id: string | null }> = [];
  for (const p of projects ?? []) {
    const { data: gens } = await supabaseAdmin
      .from("d2c_generations")
      .select("id,created_at")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false })
      .limit(1);
    results.push({ ...p, last_generation_id: gens?.[0]?.id ?? null });
  }
  return results;
}

export async function createOrUpdateProject(input: {
  id?: string;
  name: string;
  figma_file_key: string;
  figma_node_id: string;
  source_url: string;
  default_profile_id: string | null;
}): Promise<ProjectRow> {
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
        updated_at: now
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
      owner_id: env.D2C_OWNER_ID,
      name: input.name,
      figma_file_key: input.figma_file_key,
      figma_node_id: input.figma_node_id,
      source_url: input.source_url,
      default_profile_id: input.default_profile_id,
      updated_at: now
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

export async function createGeneration(input: { project_id: string; profile_id: string | null }): Promise<GenerationRow> {
  // profile_id が未指定ならデフォルトを用意して使う
  const profileId = input.profile_id ?? (await ensureDefaultProfile());

  const { data, error } = await supabaseAdmin
    .from("d2c_generations")
    .insert({
      project_id: input.project_id,
      profile_id: profileId,
      status: "queued"
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as GenerationRow;
}

async function ensureDefaultProfile(): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("d2c_profiles")
    .select("id")
    .eq("owner_id", env.D2C_OWNER_ID)
    .eq("name", "Default Production")
    .limit(1);

  if (existing?.[0]?.id) return existing[0].id as string;

  const { data, error } = await supabaseAdmin
    .from("d2c_profiles")
    .insert({
      owner_id: env.D2C_OWNER_ID,
      name: "Default Production",
      mode: "production",
      output_target: "nextjs_tailwind",
      use_shadcn: true,
      styling_strategy: "tailwind_only",
      naming_convention: "camel",
      qc_prettier: true,
      qc_eslint: true,
      qc_a11y: true,
      token_cluster_threshold: 0.12
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setGenerationStatus(
  generationId: string,
  status: GenerationRow["status"],
  extra: Partial<Pick<GenerationRow, "started_at" | "finished_at" | "error_json">> & { started_at?: string; finished_at?: string; error_json?: any }
) {
  const { error } = await supabaseAdmin
    .from("d2c_generations")
    .update({
      status,
      started_at: extra.started_at ?? undefined,
      finished_at: extra.finished_at ?? undefined,
      error_json: extra.error_json ?? undefined
    })
    .eq("id", generationId);

  if (error) throw new Error(error.message);
}

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
  const { error: genErr } = await supabaseAdmin
    .from("d2c_generations")
    .update({
      figma_snapshot_hash: input.snapshotHash,
      ir_json: input.irJson,
      report_json: input.reportJson
    })
    .eq("id", input.generationId);

  if (genErr) throw new Error(genErr.message);

  // Upsert files
  const fileRows = input.files.map((f) => ({
    generation_id: input.generationId,
    path: f.path,
    content: f.content,
    content_sha256: sha256(f.content),
    kind: f.kind
  }));

  const { error: fileErr } = await supabaseAdmin.from("d2c_files").upsert(fileRows, { onConflict: "generation_id,path" });
  if (fileErr) throw new Error(fileErr.message);

  // Insert mappings（MVP: いったん全消しして入れ直し）
  await supabaseAdmin.from("d2c_mappings").delete().eq("generation_id", input.generationId);

  const mappingRows = input.mappings.map((m) => ({
    generation_id: input.generationId,
    figma_node_id: m.figma_node_id,
    figma_node_name: m.figma_node_name,
    target_path: m.target_path,
    target_symbol: m.target_symbol,
    loc_start: m.loc_start,
    loc_end: m.loc_end,
    mapping_type: m.mapping_type
  }));

  const { error: mapErr } = await supabaseAdmin.from("d2c_mappings").insert(mappingRows);
  if (mapErr) throw new Error(mapErr.message);
}

/**
 * /result が参照する bundle を取得
 * - 見つからなければ null
 */
export async function getGenerationBundle(generationId: string): Promise<GenerationBundle | null> {
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
    .single();

  const { data: files, error: fileErr } = await supabaseAdmin
    .from("d2c_files")
    .select("*")
    .eq("generation_id", generationId)
    .order("path", { ascending: true });

  if (fileErr) throw new Error(fileErr.message);

  const { data: mappings, error: mapErr } = await supabaseAdmin
    .from("d2c_mappings")
    .select("*")
    .eq("generation_id", generationId)
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
        outputTarget: (profile as any)?.output_target ?? "nextjs_tailwind"
      }
    },
    files: (files ?? []) as FileRow[],
    mappings: (mappings ?? []) as MappingRow[]
  };
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
