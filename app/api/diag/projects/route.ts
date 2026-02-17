import { NextResponse } from "next/server";
import { envServer } from "@/lib/envServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUserIdFromRequest } from "@/lib/authApi";

export const dynamic = "force-dynamic";

function decodeJwtRole(jwt: string): { ref: string | null; role: string | null } {
  try {
    const seg = jwt.split(".")[1] ?? "";
    const pad = seg.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(pad, "base64").toString("utf8"));
    return { ref: typeof json?.ref === "string" ? json.ref : null, role: typeof json?.role === "string" ? json.role : null };
  } catch {
    return { ref: null, role: null };
  }
}

export async function GET(req: Request) {
  // Dev-only diagnostic endpoint.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const ownerIdParam = searchParams.get("ownerId");

  const urlHost = (() => {
    try {
      return new URL(envServer.NEXT_PUBLIC_SUPABASE_URL).host;
    } catch {
      return null;
    }
  })();
  const keyInfo = decodeJwtRole(envServer.SUPABASE_SERVICE_ROLE_KEY);

  let userId: string | null = null;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch {
    userId = null;
  }

  const total = await supabaseAdmin
    .from("d2c_projects")
    .select("id", { count: "exact", head: true })
    .then((r) => (r.error ? null : (r.count ?? null)))
    .catch(() => null);

  const mine =
    userId === null
      ? null
      : await supabaseAdmin
          .from("d2c_projects")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .then((r) => (r.error ? null : (r.count ?? null)))
          .catch(() => null);

  const byOwnerParam =
    ownerIdParam && ownerIdParam.length >= 8
      ? await supabaseAdmin
          .from("d2c_projects")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ownerIdParam)
          .then((r) => (r.error ? null : (r.count ?? null)))
          .catch(() => null)
      : null;

  return NextResponse.json({
    supabaseUrlHost: urlHost,
    serviceKey: keyInfo,
    userId,
    ownerIdParam,
    counts: { totalProjects: total, myProjects: mine, byOwnerIdParam: byOwnerParam }
  });
}

