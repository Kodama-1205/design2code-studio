import { NextResponse } from "next/server";
import { getGenerationBundle } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { generationId: string } }) {
  const bundle = await getGenerationBundle(params.generationId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(bundle);
}
