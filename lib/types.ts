export type Project = {
  id: string;
  owner_id: string;
  name: string;
  figma_file_key: string;
  figma_node_id: string;
  source_url: string;
  default_profile_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GenerationProfile = {
  mode: string;
  outputTarget: string;
};

export type Generation = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  figma_snapshot_hash: string | null;
  ir_json: any | null;
  report_json: any | null;
  error_json: any | null;
  profileId: string | null;
  profile: GenerationProfile;
};

export type GenerationFile = {
  id: string;
  generation_id: string;
  path: string;
  content: string;
  kind: string;
  created_at: string;
};

export type Mapping = {
  id: string;
  generation_id: string;
  figma_node_id: string;
  figma_node_name: string | null;
  target_path: string;
  target_symbol: string | null;
  loc_start: number | null;
  loc_end: number | null;
  mapping_type: string;
  created_at: string;
};

export type GenerationBundle = {
  project: Project;
  generation: Generation;
  files: GenerationFile[];
  mappings: Mapping[];
};

