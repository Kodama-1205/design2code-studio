import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function requireUserIdFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) throw new Error("missing_authorization");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("invalid_token");
  return data.user.id;
}

