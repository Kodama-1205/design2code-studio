import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium as pwChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";

/**
 * Vercel(Lambda) で動く headless Chromium 設定
 * - playwright の full は重いので playwright-core + @sparticuz/chromium を採用
 */
async function getBrowser() {
  try {
    // Vercel(Lambda)向け
    const executablePath = await chromium.executablePath();
    return pwChromium.launch({
      args: chromium.args,
      executablePath,
      headless: chromium.headless,
      defaultViewport: { width: 1280, height: 720 }
    });
  } catch (e: any) {
    // ローカル開発で chromium が見つからないケース（Windows等）
    // → 生成そのものは継続できるように、明確なエラーにして呼び出し側で握れるようにする
    throw new Error(
      `Headless Chromium is not available in this environment. Visual diff requires Vercel runtime or a local Playwright setup. (${e?.message ?? "unknown"})`
    );
  }
}

export async function renderHtmlToPng(input: { html: string; width: number; height: number }): Promise<Uint8Array> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: input.width, height: input.height } });
    await page.setContent(input.html, { waitUntil: "networkidle" });
    const buf = await page.screenshot({ type: "png", fullPage: false });
    return new Uint8Array(buf);
  } finally {
    await browser.close();
  }
}

export async function diffPngBuffers(input: {
  aPng: Uint8Array;
  bPng: Uint8Array;
  threshold?: number;
}): Promise<{ diffPng: Uint8Array; diffRatio: number; diffPixels: number; totalPixels: number }> {
  const a = PNG.sync.read(Buffer.from(input.aPng));
  const b = PNG.sync.read(Buffer.from(input.bPng));

  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);

  // サイズが違う場合、左上で揃えて比較（MVP）
  const aCrop = new PNG({ width, height });
  const bCrop = new PNG({ width, height });
  PNG.bitblt(a, aCrop, 0, 0, width, height, 0, 0);
  PNG.bitblt(b, bCrop, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(aCrop.data, bCrop.data, diff.data, width, height, {
    threshold: input.threshold ?? 0.12
  });
  const totalPixels = width * height;
  const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 1;

  return {
    diffPng: new Uint8Array(PNG.sync.write(diff)),
    diffRatio,
    diffPixels,
    totalPixels
  };
}

export function buildPixelHtmlDocument(input: {
  width: number;
  height: number;
  body: string;
  background?: string;
}): string {
  // CSSは完全に固定（差分が安定する）
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html,body{margin:0;padding:0;width:${input.width}px;height:${input.height}px;overflow:hidden;background:${
      input.background ?? "rgba(0,0,0,0)"
    };}
    *{box-sizing:border-box;}
  </style>
</head>
<body>
  ${input.body}
</body>
</html>`;
}
