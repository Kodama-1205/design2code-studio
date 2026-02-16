// lib/server/capturePreview.ts
// ページを開いてスクリーンショットPNG（Buffer）を返す（Nodeサーバー専用）
//
// ポイント：public/ への書き込みは本番環境で制約が出るため、
//         ここではPNGを Buffer として返し、呼び出し側でStorage等へ保存する。

import { chromium } from "playwright";

export async function capturePreviewPng(args: {
  url: string; // スクショ対象URL
  width?: number;
  height?: number;
  headers?: Record<string, string>; // Cookie/Authorization等の引き継ぎ用
}) {
  const width = args.width ?? 1200;
  const height = args.height ?? 750;

  const browser = await chromium.launch();

  const context = await browser.newContext({
    viewport: { width, height }
  });

  if (args.headers && Object.keys(args.headers).length > 0) {
    await context.setExtraHTTPHeaders(args.headers);
  }

  const page = await context.newPage();

  // 認証/リダイレクトを含むページでも安定させる
  await page.goto(args.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const finalUrl = page.url();

  // ✅ Bufferで取得（Storageにそのままアップロードできる）
  const pngBuffer = await page.screenshot({ fullPage: true, type: "png" });

  await context.close();
  await browser.close();

  return { finalUrl, pngBuffer };
}
