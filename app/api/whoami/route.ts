import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Dev-only diagnostic endpoint.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return NextResponse.json({ error: "missing_authorization" }, { status: 401 });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email ?? null
    }
  });
}

