import crypto from "crypto";

/**
 * Supabase が使えない場合（無料プラン制限など）に、API が返すバンドルを組み立てる。
 * getGenerationBundle と同じ形にする。
 */
export type DemoProjectRow = {
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

export type DemoGenerationRow = {
  id: string;
  project_id: string;
  profile_id: string | null;
  status: "succeeded";
  figma_snapshot_hash: string | null;
  ir_json: any;
  report_json: any;
  profile: { mode: string; outputTarget: string };
};

export type DemoFileRow = {
  id: string;
  generation_id: string;
  path: string;
  content: string;
  content_sha256: string;
  kind: "code" | "config" | "style" | "asset_index" | "asset";
  created_at: string;
};

export type DemoMappingRow = {
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

export type DemoBundle = {
  project: DemoProjectRow;
  generation: {
    id: string;
    status: "succeeded";
    figma_snapshot_hash: string | null;
    ir_json: any;
    report_json: any;
    profileId: string | null;
    profile: { mode: string; outputTarget: string };
  };
  files: DemoFileRow[];
  mappings: DemoMappingRow[];
};

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function buildDemoBundle(
  projectId: string,
  generationId: string,
  input: {
    name: string;
    figma_file_key: string;
    figma_node_id: string;
    source_url: string;
    owner_id: string;
  },
  artifacts: {
    snapshotHash: string;
    ir: any;
    report: any;
    files: Array<{ path: string; content: string; kind: DemoFileRow["kind"] }>;
    mappings: Array<{
      figma_node_id: string;
      figma_node_name: string | null;
      target_path: string;
      target_symbol: string | null;
      loc_start: number | null;
      loc_end: number | null;
      mapping_type: DemoMappingRow["mapping_type"];
    }>;
  }
): DemoBundle {
  const now = new Date().toISOString();
  const rawProfile = artifacts.ir?.meta?.profile ?? {};
  const profile = {
    mode: rawProfile.mode ?? "production",
    outputTarget: rawProfile.outputTarget ?? rawProfile.output_target ?? "nextjs_tailwind"
  };

  const project: DemoProjectRow = {
    id: projectId,
    owner_id: input.owner_id,
    name: input.name,
    figma_file_key: input.figma_file_key,
    figma_node_id: input.figma_node_id,
    source_url: input.source_url,
    default_profile_id: null,
    created_at: now,
    updated_at: now
  };

  const files: DemoFileRow[] = artifacts.files.map((f, i) => ({
    id: `demo-file-${generationId}-${i}`,
    generation_id: generationId,
    path: f.path,
    content: f.content,
    content_sha256: sha256(f.content),
    kind: f.kind,
    created_at: now
  }));

  const mappings: DemoMappingRow[] = artifacts.mappings.map((m, i) => ({
    id: `demo-mapping-${generationId}-${i}`,
    generation_id: generationId,
    figma_node_id: m.figma_node_id,
    figma_node_name: m.figma_node_name,
    target_path: m.target_path,
    target_symbol: m.target_symbol,
    loc_start: m.loc_start,
    loc_end: m.loc_end,
    mapping_type: m.mapping_type,
    created_at: now
  }));

  return {
    project,
    generation: {
      id: generationId,
      status: "succeeded",
      figma_snapshot_hash: artifacts.snapshotHash,
      ir_json: artifacts.ir,
      report_json: artifacts.report,
      profileId: null,
      profile: { mode: profile.mode, outputTarget: profile.outputTarget }
    },
    files,
    mappings
  };
}
