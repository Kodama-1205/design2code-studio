import { NextResponse } from "next/server";

/**
 * Figma Preview Proxy API
 *
 * クライアントから token を受け取り、Figma API を叩いて画像を取得し、画像バイナリを返す。
 * - 画像取得は2段階:
 *   1) GET /v1/images/{fileKey}?ids={nodeId} で image URL を得る
 *   2) 返ってきた image URL を fetch してバイナリ取得
 *
 * 目的:
 * - ブラウザ直叩き時の CORS/認可問題を回避
 * - token をクエリに載せず POST body で受ける
 */

type Body = {
  fileKey: string;
  nodeId: string;
  token: string;
  format?: "png" | "jpg" | "svg";
  scale?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const fileKey = (body.fileKey || "").trim();
    const nodeId = (body.nodeId || "").trim();
    const token = (body.token || "").trim();

    const format = body.format ?? "png";
    const scale = typeof body.scale === "number" ? body.scale : 2;

    if (!fileKey || !nodeId || !token) {
      return new NextResponse("Missing fileKey/nodeId/token", { status: 400 });
    }

    // 1) 画像URLを取得
    const imagesApi = new URL(`https://api.figma.com/v1/images/${fileKey}`);
    imagesApi.searchParams.set("ids", nodeId);
    imagesApi.searchParams.set("format", format);
    imagesApi.searchParams.set("scale", String(scale));

    const metaRes = await fetch(imagesApi.toString(), {
      method: "GET",
      headers: {
        "X-Figma-Token": token,
      },
      // ここはキャッシュすると混乱しやすいので基本no-store
      cache: "no-store",
    });

    if (!metaRes.ok) {
      const text = await metaRes.text().catch(() => "");
      return new NextResponse(
        text || `Figma images meta request failed: ${metaRes.status}`,
        { status: metaRes.status }
      );
    }

    const meta = (await metaRes.json()) as {
      err?: string;
      images?: Record<string, string>;
    };

    if (meta.err) {
      return new NextResponse(meta.err, { status: 400 });
    }

    const imageUrl = meta.images?.[nodeId];
    if (!imageUrl) {
      return new NextResponse(
        "Image URL not found. nodeId may be invalid or not accessible with the token.",
        { status: 404 }
      );
    }

    // 2) 画像バイナリ取得（このURLは期限付きの可能性あり）
    const imgRes = await fetch(imageUrl, { cache: "no-store" });
    if (!imgRes.ok) {
      const text = await imgRes.text().catch(() => "");
      return new NextResponse(
        text || `Image fetch failed: ${imgRes.status}`,
        { status: imgRes.status }
      );
    }

    const contentType = imgRes.headers.get("content-type") || "image/png";
    const arrayBuffer = await imgRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 画像は少しだけキャッシュしてもOK（要件に合わせて調整）
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Unexpected error", { status: 500 });
  }
}
