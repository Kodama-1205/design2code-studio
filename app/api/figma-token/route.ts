import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdFromRequest } from "@/lib/authApi";
import { deleteUserFigmaPat, hasUserFigmaPat, upsertUserFigmaPat } from "@/lib/userSecrets";
import { validateFigmaToken } from "@/lib/figma";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  token: z.string().min(10)
});

export async function GET(req: Request) {
  try {
    const userId = await requireUserIdFromRequest(req);
    const hasToken = await hasUserFigmaPat(userId);
    return NextResponse.json({ hasToken });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  // Validate token upfront to prevent endless failures later.
  const validation = await validateFigmaToken(parsed.data.token);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "invalid_figma_token", message: validation.message, status: validation.status },
      { status: 400 }
    );
  }

  await upsertUserFigmaPat(userId, parsed.data.token);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let userId: string;
  try {
    userId = await requireUserIdFromRequest(req);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }

  await deleteUserFigmaPat(userId);
  return NextResponse.json({ ok: true });
}

