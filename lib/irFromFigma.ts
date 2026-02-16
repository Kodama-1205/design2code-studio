import type { FigmaNode } from "@/lib/figma";
import { figmaColorToRgba } from "@/lib/figma";

/**
 * MVP IR（Intermediate Representation）
 * - まずは「元画像に寄せる」ため、absolute座標で描画できる要素に絞る
 * - 対応：FRAME/RECTANGLE/TEXT（最小）
 * - 非対応：VECTOR, COMPONENT, EFFECT, IMAGE fill 等（順次拡張）
 */

export type IrCanvas = {
  width: number;
  height: number;
  background?: string;
  elements: IrElement[];
};

export type IrElement =
  | {
      kind: "rect";
      id: string;
      name: string;
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
      radius?: number;
    }
  | {
      kind: "text";
      id: string;
      name: string;
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      color: string;
      fontSize: number;
      fontFamily?: string;
      fontWeight?: number;
      align?: "left" | "center" | "right";
      lineHeightPx?: number;
    };

function bbox(n: FigmaNode) {
  return n.absoluteBoundingBox ?? n.absoluteRenderBounds ?? null;
}

function isVisible(n: FigmaNode) {
  return n.visible !== false;
}

function extractFill(n: FigmaNode): { fill: string; color?: any } {
  const fills = Array.isArray(n.fills) ? n.fills : [];
  const solid = fills.find((f) => f?.type === "SOLID" && f?.visible !== false);
  if (solid?.color) {
    return { fill: figmaColorToRgba({ ...solid.color, a: solid.opacity ?? solid.color?.a ?? 1 }), color: solid.color };
  }
  return { fill: "rgba(0,0,0,0)" };
}

function extractStroke(n: FigmaNode): { stroke?: string; strokeWidth?: number } {
  const strokes = Array.isArray(n.strokes) ? n.strokes : [];
  const solid = strokes.find((s) => s?.type === "SOLID" && s?.visible !== false);
  if (!solid?.color) return {};
  return {
    stroke: figmaColorToRgba({ ...solid.color, a: solid.opacity ?? solid.color?.a ?? 1 }),
    strokeWidth: typeof n.strokeWeight === "number" ? n.strokeWeight : 1
  };
}

function extractRadius(n: FigmaNode): number | undefined {
  if (typeof n.cornerRadius === "number") return n.cornerRadius;
  if (Array.isArray(n.rectangleCornerRadii) && n.rectangleCornerRadii.length) {
    // MVP: 4つの平均を単一radiusに丸める
    const s = n.rectangleCornerRadii.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
    return s / n.rectangleCornerRadii.length;
  }
  return undefined;
}

/**
 * ノードツリーから、描画できる要素をフラットに収集
 * - 位置は「ルートノード左上を(0,0)」に正規化
 */
export function buildIrFromFigma(root: FigmaNode): IrCanvas {
  const b = bbox(root);
  const rootX = b?.x ?? 0;
  const rootY = b?.y ?? 0;
  const width = Math.max(1, Math.round(b?.width ?? 1200));
  const height = Math.max(1, Math.round(b?.height ?? 800));

  const out: IrCanvas = { width, height, elements: [] };

  const walk = (n: FigmaNode) => {
    if (!isVisible(n)) return;
    const bb = bbox(n);
    if (!bb) {
      (n.children ?? []).forEach(walk);
      return;
    }

    const x = bb.x - rootX;
    const y = bb.y - rootY;
    const w = bb.width;
    const h = bb.height;

    // TEXT
    if (n.type === "TEXT" && typeof n.characters === "string") {
      const fills = Array.isArray(n.fills) ? n.fills : [];
      const solid = fills.find((f) => f?.type === "SOLID" && f?.visible !== false);
      const color = solid?.color ? figmaColorToRgba({ ...solid.color, a: solid.opacity ?? 1 }) : "rgba(255,255,255,1)";
      const fontSize = typeof n.style?.fontSize === "number" ? n.style.fontSize : 14;
      const alignRaw = (n.style?.textAlignHorizontal ?? "LEFT").toLowerCase();
      const align = alignRaw === "center" ? "center" : alignRaw === "right" ? "right" : "left";

      out.elements.push({
        kind: "text",
        id: n.id,
        name: n.name,
        x,
        y,
        w,
        h,
        text: n.characters,
        color,
        fontSize,
        fontFamily: n.style?.fontFamily,
        fontWeight: n.style?.fontWeight,
        align,
        lineHeightPx: typeof n.style?.lineHeightPx === "number" ? n.style.lineHeightPx : undefined
      });

      (n.children ?? []).forEach(walk);
      return;
    }

    // RECTANGLE / FRAME / GROUP
    if (n.type === "RECTANGLE" || n.type === "FRAME" || n.type === "GROUP") {
      const { fill } = extractFill(n);
      const hasVisibleFill = fill !== "rgba(0,0,0,0)";
      const st = extractStroke(n);
      const radius = extractRadius(n);

      if (hasVisibleFill || st.stroke) {
        out.elements.push({
          kind: "rect",
          id: n.id,
          name: n.name,
          x,
          y,
          w,
          h,
          fill,
          stroke: st.stroke,
          strokeWidth: st.strokeWidth,
          radius
        });
      }

      (n.children ?? []).forEach(walk);
      return;
    }

    (n.children ?? []).forEach(walk);
  };

  walk(root);
  return out;
}
