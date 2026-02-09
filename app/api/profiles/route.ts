import { NextResponse } from "next/server";
import { listProfiles } from "@/lib/db";
import { requireUserIdFromRequest } from "@/lib/authApi";

export async function GET(req: Request) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const profiles = await listProfiles(userId);
    return NextResponse.json({ profiles });
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    if (msg === "missing_authorization" || msg === "invalid_token") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: "failed_to_list_profiles", message: msg }, { status: 500 });
  }
}
