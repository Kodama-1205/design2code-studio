import { NextResponse } from "next/server";
import { envServer } from "@/lib/envServer";

export const dynamic = "force-dynamic";

function toApiNodeId(nodeId: string): string {
  if (nodeId.includes(":")) return nodeId;
  return nodeId.replace(/-/g, ":");
}

/** GET /api/figma-preview?fileKey=xxx&nodeId=yyy → 静的PNGを返す */
export async function GET(req: Request) {
  const token = envServer.FIGMA_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "FIGMA_ACCESS_TOKEN not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const fileKey = searchParams.get("fileKey");
  const rawNodeId = searchParams.get("nodeId");
  if (!fileKey || !rawNodeId) {
    return NextResponse.json({ error: "fileKey and nodeId required" }, { status: 400 });
  }

  const nodeId = toApiNodeId(rawNodeId);
  try {
    const apiUrl = new URL(`https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}`);
    apiUrl.searchParams.set("ids", nodeId);
    apiUrl.searchParams.set("format", "png");
    apiUrl.searchParams.set("scale", "2");

    const apiRes = await fetch(apiUrl.toString(), {
      headers: { "X-Figma-Token": token },
      cache: "no-store"
    });
    if (!apiRes.ok) {
      return NextResponse.json({ error: "Figma API error", status: apiRes.status }, { status: 502 });
    }

    const json = (await apiRes.json()) as { err?: string; images?: Record<string, string> };
    if (json.err) return NextResponse.json({ error: json.err }, { status: 502 });

    const imageUrl = json.images?.[nodeId] ?? json.images?.[rawNodeId];
    if (!imageUrl) return NextResponse.json({ error: "No image URL" }, { status: 502 });

    const imgRes = await fetch(imageUrl, { cache: "no-store" });
    if (!imgRes.ok) return NextResponse.json({ error: "Figma CDN error" }, { status: 502 });

    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": imgRes.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown" }, { status: 500 });
  }
}
