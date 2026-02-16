import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

    // ✅ 重要：ダッシュボードのキャッシュを明示的に破棄
    revalidatePath("/dashboard");

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete project" },
      { status: 500 }
    );
  }
}
