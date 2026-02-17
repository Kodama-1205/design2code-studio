import { NextResponse } from "next/server";
import { getGenerationBundle } from "@/lib/db";
import { requireUserIdFromRequest } from "@/lib/authApi";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { generationId: string } }) {
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (bundle.project.owner_id !== userId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ bundle });
}

