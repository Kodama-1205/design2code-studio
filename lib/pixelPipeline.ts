import crypto from "crypto";
import { fetchFigmaNodes, fetchFigmaImageUrl } from "@/lib/figma";
import { buildIrFromFigma } from "@/lib/irFromFigma";
import { codegenPixel } from "@/lib/codegenPixel";
import { buildPixelHtmlDocument, diffPngBuffers, renderHtmlToPng } from "@/lib/visualDiff";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function normalizeNodeIdForApi(nodeId: string): string {
  if (nodeId.includes(":")) return nodeId;
  if (nodeId.includes("-")) return nodeId.replace("-", ":");
  return nodeId;
}

/**
 * 最終フェーズ（MVP版）
 * - Figma Nodes API でノードJSON取得
 * - IR生成（FRAME/RECT/TEXT）
 * - Pixel codegen（absolute）
 * - 画像比較（Figma PNG vs 生成レンダリング）
 */
export async function runPixelFigmaPipeline(input: {
  figmaFileKey: string;
  figmaNodeId: string; // 保存用（10-55 でもOK）
  sourceUrl: string;
  figmaToken: string;
}) {
  const snapshotHash = `sha256:${sha256(`${input.figmaFileKey}|${input.figmaNodeId}|${input.sourceUrl}`)}`;
  const nodeIdApi = normalizeNodeIdForApi(input.figmaNodeId);

  // 1) Figma node JSON
  const root = await fetchFigmaNodes({ fileKey: input.figmaFileKey, nodeId: nodeIdApi, token: input.figmaToken });
  const canvas = buildIrFromFigma(root);

  // 2) codegen
  const { files, mappings } = codegenPixel({
    canvas,
    sourceUrl: input.sourceUrl,
    figmaFileKey: input.figmaFileKey,
    figmaNodeId: input.figmaNodeId
  });

  // 3) 評価（diff）
  // - Figma PNG
  const figmaImageUrl = await fetchFigmaImageUrl({
    fileKey: input.figmaFileKey,
    nodeId: nodeIdApi,
    token: input.figmaToken,
    scale: 1
  });
  const figmaPng = new Uint8Array(await (await fetch(figmaImageUrl, { cache: "no-store" })).arrayBuffer());

  // - 生成レンダリング（IRをHTML化してヘッドレスで描画）
  let renderPng: Uint8Array | null = null;
  let diffPng: Uint8Array | null = null;
  let diffMeta: { diffRatio: number; diffPixels: number; totalPixels: number } | null = null;
  const qcWarnings: string[] = [];
  try {
    const body = buildHtmlBodyFromCanvas(canvas);
    const html = buildPixelHtmlDocument({
      width: Math.round(canvas.width),
      height: Math.round(canvas.height),
      body,
      background: canvas.background
    });
    renderPng = await renderHtmlToPng({ html, width: Math.round(canvas.width), height: Math.round(canvas.height) });
    const diff = await diffPngBuffers({ aPng: figmaPng, bPng: renderPng, threshold: 0.12 });
    diffPng = diff.diffPng;
    diffMeta = { diffRatio: diff.diffRatio, diffPixels: diff.diffPixels, totalPixels: diff.totalPixels };
  } catch (e: any) {
    qcWarnings.push(e?.message ?? "visual diff failed");
  }

  const report = {
    pipeline: "pixel_figma_v1",
    snapshotHash,
    figma: {
      fileKey: input.figmaFileKey,
      nodeIdSaved: input.figmaNodeId,
      nodeIdApi,
      imageUrlNote: "Images API URL is temporary; stored image should be persisted separately."
    },
    visualDiff: diffMeta
      ? {
          ...diffMeta,
          threshold: 0.12,
          note:
            "MVP: FRAME/RECTANGLE/TEXT のみ描画。画像/ベクタ/エフェクト/AutoLayoutは未対応なのでdiffが大きい場合があります。"
        }
      : {
          skipped: true,
          reason: qcWarnings[0] ?? "unknown",
          note: "Headless Chromium が使えない環境では diff をスキップします（Vercel上では実行可能）。"
        },
    coverage: {
      elementCount: canvas.elements.length,
      supportedKinds: ["rect", "text"]
    }
  };

  return {
    snapshotHash,
    ir: {
      irVersion: "pixel_ir_1",
      source: {
        tool: "figma",
        fileKey: input.figmaFileKey,
        nodeId: input.figmaNodeId,
        url: input.sourceUrl,
        fetchedAt: new Date().toISOString(),
        snapshotHash
      },
      canvas,
      rawNode: root // ✅ 後で精度上げるため（容量が大きい場合は将来削る）
    },
    report,
    profileSnapshot: {
      mode: "pixel",
      outputTarget: "static_html_css",
      useShadcn: false,
      stylingStrategy: "absolute",
      namingConvention: "camel",
      tokenClusterThreshold: 0.08
    },
    files,
    mappings,
    // 画像は呼び出し元でStorageへ保存する
    figmaPng,
    renderPng,
    diffPng
  };
}

function buildHtmlBodyFromCanvas(canvas: { elements: any[] }) {
  // rect -> text の順で重なり順を安定
  const rects = canvas.elements.filter((e) => e.kind === "rect");
  const texts = canvas.elements.filter((e) => e.kind === "text");

  const toDiv = (e: any) => {
    if (e.kind === "rect") {
      const border = e.stroke ? `border:${e.strokeWidth ?? 1}px solid ${e.stroke};` : "";
      const radius = typeof e.radius === "number" ? `border-radius:${e.radius}px;` : "";
      return `<div style="position:absolute;left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;background:${e.fill};${border}${radius}"></div>`;
    }
    const align = e.align ? `text-align:${e.align};` : "";
    const lh = typeof e.lineHeightPx === "number" ? `line-height:${e.lineHeightPx}px;` : "";
    const fw = e.fontWeight ? `font-weight:${e.fontWeight};` : "";
    const ff = e.fontFamily
      ? `font-family:${e.fontFamily}, Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans JP', sans-serif;`
      : "font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans JP', sans-serif;";
    const safe = String(e.text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<div style="position:absolute;left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;color:${e.color};font-size:${e.fontSize}px;${ff}${fw}${align}${lh}white-space:pre-wrap;overflow:hidden;">${safe}</div>`;
  };

  return `<div style="position:relative;width:100%;height:100%;">${rects.map(toDiv).join("")}${texts.map(toDiv).join("")}</div>`;
}
