import { NextResponse } from "next/server";
import { listProjects } from "@/lib/db";
import { requireUserIdFromRequest } from "@/lib/authApi";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await requireUserIdFromRequest(req);

    // Primary path (includes preview/last_generation)
    let projects = await listProjects(userId);

    // Diagnostics + fallback: if something goes wrong and we get an empty list,
    // re-check via a direct query so the dashboard never "mysteriously" shows empty.
    if (projects.length === 0) {
      const headCount = await supabaseAdmin
        .from("d2c_projects")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .then((r) => (r.error ? null : (r.count ?? null)))
        .catch(() => null);

      if (headCount && headCount > 0) {
        const { data: raw, error } = await supabaseAdmin
          .from("d2c_projects")
          .select("id,owner_id,name,figma_file_key,figma_node_id,source_url,default_profile_id,created_at,updated_at")
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false });

        if (!error && (raw?.length ?? 0) > 0) {
          projects = (raw as any[]).map((p) => ({
            ...p,
            last_generation_id: null,
            preview_image: null
          }));
          if (process.env.NODE_ENV !== "production") {
            console.warn("listProjects returned empty; using raw fallback", { userId, headCount, raw: raw?.length ?? 0 });
          }
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("GET /api/projects", {
        userId,
        count: projects.length,
        firstId: projects[0]?.id ?? null
      });
    }
    return NextResponse.json({ projects });
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    if (msg === "missing_authorization" || msg === "invalid_token") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: "failed_to_list_projects", message: msg }, { status: 500 });
  }
}

