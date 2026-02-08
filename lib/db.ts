import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { envServer } from "@/lib/envServer";

type ProjectRow = {
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

type GenerationRow = {
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

type GenerationJobRow = {
  id: string;
  owner_id: string;
  project_id: string;
  generation_id: string;
  status: "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";
  attempt_count: number;
  next_attempt_at: string;
  locked_by: string | null;
  locked_at: string | null;
  last_error: any | null;
  created_at: string;
  updated_at: string;
};

type FigmaImageCacheRow = {
  owner_id: string;
  figma_file_key: string;
  figma_node_id: string;
  mime: string;
  base64: string;
  created_at: string;
  updated_at: string;
};

type FileRow = {
  id: string;
  generation_id: string;
  path: string;
  content: string;
  content_sha256: string;
  kind: "code" | "config" | "style" | "asset_index" | "asset";
  created_at: string;
};

type MappingRow = {
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

type ProfileRow = {
  id: string;
  owner_id: string;
  name: string;
  mode: "production" | "lecture" | "pixel";
  output_target: "nextjs_tailwind" | "static_html_css";
  use_shadcn: boolean;
  styling_strategy: string;
  naming_convention: string;
  qc_prettier: boolean;
  qc_eslint: boolean;
  qc_a11y: boolean;
  token_cluster_threshold: number;
  created_at: string;
  updated_at: string;
};

const PRESET_PROFILES: Array<Omit<ProfileRow, "id" | "created_at" | "updated_at">> = [
  {
    owner_id: envServer.D2C_OWNER_ID,
    name: "Production",
    mode: "production",
    output_target: "nextjs_tailwind",
    use_shadcn: true,
    styling_strategy: "tailwind_only",
    naming_convention: "camel",
    qc_prettier: true,
    qc_eslint: true,
    qc_a11y: true,
    token_cluster_threshold: 0.12
  },
  {
    owner_id: envServer.D2C_OWNER_ID,
    name: "Lecture",
    mode: "lecture",
    output_target: "static_html_css",
    use_shadcn: false,
    styling_strategy: "readable",
    naming_convention: "camel",
    qc_prettier: true,
    qc_eslint: true,
    qc_a11y: true,
    token_cluster_threshold: 0.18
  },
  {
    owner_id: envServer.D2C_OWNER_ID,
    name: "Pixel",
    mode: "pixel",
    output_target: "static_html_css",
    use_shadcn: false,
    styling_strategy: "pixel",
    naming_convention: "camel",
    qc_prettier: false,
    qc_eslint: false,
    qc_a11y: false,
    token_cluster_threshold: 0.05
  }
];

export async function listProjects(ownerId = envServer.D2C_OWNER_ID): Promise<Array<ProjectRow & { last_generation_id: string | null; preview_image: string | null }>> {
  const { data: projects, error } = await supabaseAdmin
    .from("d2c_projects")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  // last generation per project (simple approach)
  const results: Array<ProjectRow & { last_generation_id: string | null; preview_image: string | null }> = [];
  for (const p of projects ?? []) {
    const { data: gens } = await supabaseAdmin
      .from("d2c_generations")
      .select("id,created_at,status,error_json")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const rows = (gens ?? []) as Array<{ id: string; created_at: string; status: string; error_json: any | null }>;
    const preferred =
      rows.find((g) => g.status === "succeeded" && !g?.error_json?.provisional && g?.error_json?.fallback?.type !== "mock") ?? rows[0] ?? null;
    let lastGenId = preferred?.id ?? null;
    let preview_image = lastGenId ? await getGenerationPreviewImage(lastGenId) : null;
    // preferred に画像がなければ、他の succeeded から画像を探す
    if (!preview_image) {
      const succeeded = rows.filter((g) => g.status === "succeeded");
      for (const g of succeeded) {
        const img = await getGenerationPreviewImage(g.id);
        if (img) {
          lastGenId = g.id;
          preview_image = img;
          break;
        }
      }
      if (!lastGenId && succeeded[0]) lastGenId = succeeded[0].id;
    }

    results.push({ ...p, last_generation_id: lastGenId, preview_image });
  }
  return results;
}

async function getGenerationPreviewImage(generationId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("d2c_files")
    .select("path,content,kind,created_at")
    .eq("generation_id", generationId)
    .eq("kind", "asset")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return null;

  const rows = (data ?? []) as Array<Pick<FileRow, "path" | "content" | "kind" | "created_at">>;
  const imageLike = rows.find((r) => typeof r.content === "string" && r.content.startsWith("data:image/"));
  return (imageLike ?? rows[0])?.content ?? null;
}

export async function findProjectIdByFigmaSource(input: { figma_file_key: string; figma_node_id: string }): Promise<string | null> {
  return await findProjectIdByFigmaSourceForOwner(envServer.D2C_OWNER_ID, input);
}

export async function findProjectIdByFigmaSourceForOwner(ownerId: string, input: { figma_file_key: string; figma_node_id: string }): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("d2c_projects")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("figma_file_key", input.figma_file_key)
    .eq("figma_node_id", input.figma_node_id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) return null;
  return (data?.[0] as any)?.id ?? null;
}

export async function getLatestSucceededGenerationId(projectId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("d2c_generations")
    .select("id,created_at,status")
    .eq("project_id", projectId)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return null;
  return (data?.[0] as any)?.id ?? null;
}

export async function createOrUpdateProject(input: {
  id?: string;
  owner_id?: string;
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
      owner_id: input.owner_id ?? envServer.D2C_OWNER_ID,
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

export async function createGeneration(input: { project_id: string; profile_id: string | null; ownerId?: string }): Promise<GenerationRow> {
  // For MVP: if profile_id not provided, we still store profile snapshot inside report/IR and keep profile_id null in DB schema.
  // But the table enforces NOT NULL in earlier SQL; if you used that exact SQL, profile_id is NOT NULL.
  // Practical fix for MVP: you should create a default profile row and pass its id here.
  // To avoid blocking, we will auto-create a default profile on the fly if needed.
  const ownerId = input.ownerId ?? envServer.D2C_OWNER_ID;
  const profileId = input.profile_id ?? (await ensureDefaultProfile(ownerId));

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

async function ensureDefaultProfile(ownerId: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("d2c_profiles")
    .select("id")
    .eq("owner_id", ownerId)
    .in("name", ["Production", "Default Production"])
    .limit(1);

  if (existing?.[0]?.id) return existing[0].id as string;

  const { data, error } = await supabaseAdmin
    .from("d2c_profiles")
    .insert({ ...PRESET_PROFILES[0], owner_id: ownerId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listProfiles(ownerId = envServer.D2C_OWNER_ID): Promise<ProfileRow[]> {
  await ensurePresetProfiles(ownerId);
  const { data, error } = await supabaseAdmin
    .from("d2c_profiles")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

async function ensurePresetProfiles(ownerId: string) {
  const { data, error } = await supabaseAdmin
    .from("d2c_profiles")
    .select("id,name")
    .eq("owner_id", ownerId);

  if (error) throw new Error(error.message);

  const existingNames = new Set((data ?? []).map((p) => p.name));
  const missing = PRESET_PROFILES.filter((p) => !existingNames.has(p.name)).map((p) => ({ ...p, owner_id: ownerId }));
  if (missing.length === 0) return;

  const { error: insertErr } = await supabaseAdmin.from("d2c_profiles").insert(missing);
  if (insertErr) throw new Error(insertErr.message);
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

export async function createGenerationJob(input: {
  ownerId?: string;
  projectId: string;
  generationId: string;
  status?: GenerationJobRow["status"];
  nextAttemptAt?: string;
}): Promise<GenerationJobRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("d2c_generation_jobs")
    .insert({
      owner_id: input.ownerId ?? envServer.D2C_OWNER_ID,
      project_id: input.projectId,
      generation_id: input.generationId,
      status: input.status ?? "queued",
      next_attempt_at: input.nextAttemptAt ?? now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as GenerationJobRow;
}

export async function getGenerationJobByGenerationId(generationId: string): Promise<GenerationJobRow | null> {
  const { data, error } = await supabaseAdmin
    .from("d2c_generation_jobs")
    .select("*")
    .eq("generation_id", generationId)
    .single();
  if (error) return null;
  return data as GenerationJobRow;
}

export async function updateGenerationJob(generationJobId: string, patch: Partial<GenerationJobRow>) {
  const { error } = await supabaseAdmin.from("d2c_generation_jobs").update(patch).eq("id", generationJobId);
  if (error) throw new Error(error.message);
}

export async function updateGenerationJobByGenerationId(generationId: string, patch: Partial<GenerationJobRow>) {
  const { error } = await supabaseAdmin.from("d2c_generation_jobs").update(patch).eq("generation_id", generationId);
  if (error) throw new Error(error.message);
}

export async function claimDueGenerationJobs(input: { limit: number; workerId: string; lockTtlSec?: number }): Promise<GenerationJobRow[]> {
  const { data, error } = await supabaseAdmin.rpc("d2c_claim_due_generation_jobs", {
    p_limit: input.limit,
    p_worker: input.workerId,
    p_lock_ttl_sec: input.lockTtlSec ?? 300
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as GenerationJobRow[];
}

export async function claimGenerationJob(input: { generationId: string; workerId: string; lockTtlSec?: number }): Promise<GenerationJobRow | null> {
  const { data, error } = await supabaseAdmin.rpc("d2c_claim_generation_job", {
    p_generation_id: input.generationId,
    p_worker: input.workerId,
    p_lock_ttl_sec: input.lockTtlSec ?? 300
  });
  if (error) return null;
  const rows = (data ?? []) as GenerationJobRow[];
  return rows[0] ?? null;
}

export async function getActiveGenerationJobForProject(input: { ownerId: string; projectId: string }): Promise<GenerationJobRow | null> {
  const { data, error } = await supabaseAdmin
    .from("d2c_generation_jobs")
    .select("*")
    .eq("owner_id", input.ownerId)
    .eq("project_id", input.projectId)
    .in("status", ["queued", "running", "waiting"])
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) return null;
  const rows = (data ?? []) as GenerationJobRow[];
  return rows[0] ?? null;
}

export async function getFigmaImageCache(input: { ownerId: string; fileKey: string; nodeId: string }): Promise<null | { mime: string; base64: string }> {
  const { data, error } = await supabaseAdmin
    .from("d2c_figma_image_cache")
    .select("mime,base64")
    .eq("owner_id", input.ownerId)
    .eq("figma_file_key", input.fileKey)
    .eq("figma_node_id", input.nodeId)
    .single();
  if (error) return null;
  return { mime: (data as any).mime, base64: (data as any).base64 };
}

export async function upsertFigmaImageCache(input: { ownerId: string; fileKey: string; nodeId: string; mime: string; base64: string }) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("d2c_figma_image_cache")
    .upsert(
      {
        owner_id: input.ownerId,
        figma_file_key: input.fileKey,
        figma_node_id: input.nodeId,
        mime: input.mime,
        base64: input.base64,
        updated_at: now
      },
      { onConflict: "owner_id,figma_file_key,figma_node_id" }
    );
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

  // Insert mappings
  // For MVP: delete old mappings first
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

export async function getGenerationBundle(generationId: string): Promise<null | {
  project: ProjectRow;
  generation: {
    id: string;
    status: GenerationRow["status"];
    figma_snapshot_hash: string | null;
    ir_json: any | null;
    report_json: any | null;
    error_json: any | null;
    profileId: string | null;
    profile: {
      mode: string;
      outputTarget: string;
    };
  };
  files: FileRow[];
  mappings: MappingRow[];
}> {
  const { data: gen, error: genErr } = await supabaseAdmin
    .from("d2c_generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (genErr) return null;

  const generation = gen as GenerationRow;

  const { data: project, error: projErr } = await supabaseAdmin
    .from("d2c_projects")
    .select("*")
    .eq("id", generation.project_id)
    .single();
  if (projErr) return null;

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
      error_json: generation.error_json,
      profileId: generation.profile_id,
      profile: {
        mode: profile?.mode ?? "production",
        outputTarget: profile?.output_target ?? "nextjs_tailwind"
      }
    },
    files: (files ?? []) as FileRow[],
    mappings: (mappings ?? []) as MappingRow[]
  };
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
