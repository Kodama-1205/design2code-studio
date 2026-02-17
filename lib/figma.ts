/**
 * Figma API クライアント（最小）
 * - token は絶対にDB保存しない
 * - server runtime でのみ使用
 */

/**
 * Figma URL から fileKey と nodeId を抽出する
 * - 対応: https://www.figma.com/design/XXX/YYY?node-id=12%3A345 および /file/XXX/YYY
 * - node-id が無い場合は null を返す
 */
export function parseFigmaUrl(sourceUrl: string): { fileKey: string; nodeId: string } | null {
  const trimmed = (sourceUrl || "").trim();
  if (trimmed.length < 10) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!url.hostname.includes("figma.com")) return null;

  const segs = url.pathname.split("/").filter(Boolean);
  const designOrFile = segs[0];
  const fileKey = segs[1];
  if ((designOrFile !== "design" && designOrFile !== "file") || !fileKey) return null;

  const nodeIdParam = url.searchParams.get("node-id") ?? url.searchParams.get("node_id");
  if (!nodeIdParam || nodeIdParam.length < 2) return null;
  const nodeId = decodeURIComponent(nodeIdParam).replace(/-/g, ":");

  return { fileKey, nodeId };
}

export type FigmaColor = { r: number; g: number; b: number; a?: number };

export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number };
  children?: FigmaNode[];
  fills?: any[];
  strokes?: any[];
  strokeWeight?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  characters?: string;
  style?: {
    fontFamily?: string;
    fontPostScriptName?: string;
    fontWeight?: number;
    fontSize?: number;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
    letterSpacing?: number;
    lineHeightPx?: number;
    lineHeightPercent?: number;
  };
};

export type FigmaNodesResponse = {
  nodes: Record<
    string,
    {
      document: FigmaNode;
      components?: Record<string, any>;
      styles?: Record<string, any>;
    }
  >;
};

export async function fetchFigmaNodes(input: {
  fileKey: string;
  nodeId: string; // 例: 10:55
  token: string;
}): Promise<FigmaNode> {
  const { fileKey, nodeId, token } = input;

  const url = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}`;
  const res = await fetch(url, {
    headers: {
      "X-Figma-Token": token
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Figma nodes fetch failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as FigmaNodesResponse;
  const hit = json?.nodes?.[nodeId]?.document;
  if (!hit) throw new Error("Figma nodes response does not include target node");
  return hit;
}

/**
 * Images API（PNG）
 * - 返ってくるURLは一時URLなので、呼び出し側で必要ならStorageに保存
 */
export async function fetchFigmaImageUrl(input: {
  fileKey: string;
  nodeId: string; // Images API 用（10:55 が安定）
  token: string;
  scale?: number;
}): Promise<string> {
  const { fileKey, nodeId, token, scale = 1 } = input;

  const url =
    `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}` +
    `?ids=${encodeURIComponent(nodeId)}&format=png&scale=${encodeURIComponent(String(scale))}`;

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
    cache: "no-store"
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new Error(`Figma images fetch failed: ${res.status} ${JSON.stringify(json)}`);
  }
  const u = json?.images?.[nodeId];
  if (typeof u !== "string" || u.length < 10) {
    throw new Error(`Figma images response missing url for nodeId=${nodeId}`);
  }
  return u;
}

export function figmaColorToRgba(c: FigmaColor | undefined, fallback = "rgba(0,0,0,0)") {
  if (!c) return fallback;
  const r = Math.round((c.r ?? 0) * 255);
  const g = Math.round((c.g ?? 0) * 255);
  const b = Math.round((c.b ?? 0) * 255);
  const a = c.a ?? 1;
  return `rgba(${r},${g},${b},${a})`;
}
