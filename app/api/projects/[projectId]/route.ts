import { NextResponse } from "next/server";
import { deleteProject } from "@/lib/db";

export const runtime = "nodejs";

/**
 * DELETE /api/projects/:projectId
 * - ダッシュボードの「削除」ボタンから呼ばれる
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    await deleteProject(params.projectId);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete project" },
      { status: 500 }
    );
  }
}
