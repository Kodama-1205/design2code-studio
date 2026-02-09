import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUserIdFromRequest } from "@/lib/authApi";

const ParamsSchema = z.object({
  projectId: z.string().uuid()
});

export async function DELETE(req: Request, { params }: { params: { projectId: string } }) {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", details: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId } = parsed.data;
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("d2c_projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", userId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });
  }

  const deleted = (data ?? []).length;
  if (deleted === 0) {
    return NextResponse.json(
      { ok: false, error: "not_deleted", message: "対象が見つからないか、owner_id が一致しません。", deleted },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, deleted });
}

