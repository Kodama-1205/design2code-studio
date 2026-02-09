import crypto from "crypto";
import { getFigmaImageCache, upsertFigmaImageCache } from "@/lib/db";

const FIGMA_API_BASE = "https://api.figma.com/v1";

export class FigmaRateLimitError extends Error {
  retryAfterSec: number;
  constructor(message: string, retryAfterSec: number) {
    super(message);
    this.name = "FigmaRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

type CacheEntry<T> = { value: T; expiresAt: number };
const CACHE_TTL_MS = 60_000;
const figmaCache: Map<string, CacheEntry<any>> = (globalThis as any).__d2cFigmaCache ?? new Map();
(globalThis as any).__d2cFigmaCache = figmaCache;

type FigmaNodeResponse = {
  name: string;
  lastModified: string;
  nodes: Record<
    string,
    {
      document: { id: string; name: string; type: string };
      components?: Record<string, any>;
      styles?: Record<string, any>;
    }
  >;
};

function getCached<T>(key: string): T | null {
  const hit = figmaCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    figmaCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T, ttlMs = CACHE_TTL_MS) {
  figmaCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(input: {
  url: string;
  init?: RequestInit;
  label: string;
  maxAttempts?: number;
  timeoutMs?: number;
}) {
  const maxAttempts = input.maxAttempts ?? 4;
  const timeoutMs = input.timeoutMs ?? 20_000;
  const maxWaitMs = 20_000; // avoid hanging for hours/days
  const maxReportedWaitSec = 600; // don't show multi-day values
  let lastErr: any = null;

  function parseRetryAfterMs(h: string | null): number | null {
    if (!h) return null;
    // seconds
    const n = Number(h);
    if (Number.isFinite(n) && n >= 0) return n * 1000;
    // HTTP-date
    const t = Date.parse(h);
    if (Number.isFinite(t)) return Math.max(0, t - Date.now());
    return null;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(input.url, { ...input.init, signal: controller.signal });
      clearTimeout(t);
      if (res.status === 429 || res.status === 503) {
        const retryAfter = res.headers.get("retry-after");
        const retryAfterMs = parseRetryAfterMs(retryAfter);
        const backoffMs = Math.min(4000, 500 * Math.pow(2, attempt - 1));
        const waitMs = retryAfterMs ?? backoffMs;
        const waitSecRaw = Math.ceil(waitMs / 1000);
        const waitSec = Math.min(waitSecRaw, maxReportedWaitSec);
        const msg =
          waitSecRaw > maxReportedWaitSec
            ? `${input.label} rate limited (${res.status}). Please retry later.`
            : `${input.label} rate limited (${res.status}). Retry after ~${waitSec}s`;
        lastErr = new FigmaRateLimitError(msg, waitSec);
        if (attempt < maxAttempts) {
          // If server asks to wait too long, fail fast.
          if (waitMs > maxWaitMs) {
            throw lastErr;
          }
          console.warn(`${input.label}: ${res.status} (attempt ${attempt}/${maxAttempts}) waiting ${waitSec}s`);
          await sleep(waitMs + Math.floor(Math.random() * 150));
          continue;
        }
        // last attempt: fail fast with a proper error
        throw lastErr;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        const backoffMs = Math.min(4000, 500 * Math.pow(2, attempt - 1));
        if ((e as any)?.name === "AbortError") {
          console.warn(`${input.label}: timeout after ${Math.ceil(timeoutMs / 1000)}s (attempt ${attempt}/${maxAttempts}) retrying...`);
        }
        await sleep(backoffMs + Math.floor(Math.random() * 150));
        continue;
      }
    }
  }

  throw lastErr ?? new Error(`${input.label} failed`);
}

export async function fetchFigmaNode(input: { fileKey: string; nodeId: string; token: string }) {
  const cacheKey = `nodes:${input.fileKey}:${input.nodeId}`;
  const cached = getCached<Awaited<ReturnType<typeof _fetchFigmaNodeUnsafe>>>(cacheKey);
  if (cached) return cached;
  const data = await _fetchFigmaNodeUnsafe(input);
  setCached(cacheKey, data);
  return data;
}

async function _fetchFigmaNodeUnsafe(input: { fileKey: string; nodeId: string; token: string }) {
  const url = `${FIGMA_API_BASE}/files/${input.fileKey}/nodes?ids=${encodeURIComponent(input.nodeId)}`;
  const res = await fetchWithRetry({
    url,
    label: "Figma nodes fetch",
    init: { headers: { "X-Figma-Token": input.token } }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Figma nodes fetch failed (${res.status}) ${text}`);
  }
  const data = (await res.json()) as FigmaNodeResponse;
  const node = data.nodes?.[input.nodeId]?.document;
  return {
    fileName: data.name,
    lastModified: data.lastModified,
    node
  };
}

export async function fetchFigmaNodeImage(input: { ownerId: string; fileKey: string; nodeId: string; token: string }) {
  const cacheKey = `image:${input.fileKey}:${input.nodeId}`;

  // Persistent cache (Supabase) - makes 2nd run instant even under rate limits.
  try {
    const persistent = await getFigmaImageCache({ ownerId: input.ownerId, fileKey: input.fileKey, nodeId: input.nodeId });
    if (persistent) {
      const hit = { mime: persistent.mime, base64: persistent.base64 };
      setCached(cacheKey, hit, 5 * 60_000);
      return hit;
    }
  } catch {
    // ignore cache errors
  }

  const cached = getCached<Awaited<ReturnType<typeof _fetchFigmaNodeImageUnsafe>>>(cacheKey);
  if (cached) return cached;
  const data = await _fetchFigmaNodeImageUnsafe(input);
  if (data) {
    setCached(cacheKey, data);
    try {
      await upsertFigmaImageCache({ ownerId: input.ownerId, fileKey: input.fileKey, nodeId: input.nodeId, mime: data.mime, base64: data.base64 });
    } catch {
      // ignore persist errors
    }
  }
  return data;
}

async function _fetchFigmaNodeImageUnsafe(input: { ownerId: string; fileKey: string; nodeId: string; token: string }) {
  const url = `${FIGMA_API_BASE}/images/${input.fileKey}?ids=${encodeURIComponent(input.nodeId)}&format=png&scale=1`;
  const res = await fetchWithRetry({
    url,
    label: "Figma image request",
    init: { headers: { "X-Figma-Token": input.token } }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Figma image request failed (${res.status}) ${text}`);
  }
  const data = (await res.json()) as { images?: Record<string, string | null>; err?: string };
  if (data.err) {
    throw new Error(`Figma image response error: ${data.err}`);
  }
  const imageUrl = data.images?.[input.nodeId];
  if (!imageUrl) {
    console.error("Figma image URL missing", { nodeId: input.nodeId, images: data.images });
    return null;
  }

  const imageRes = await fetchWithRetry({ url: imageUrl, label: "Figma image download" });
  if (!imageRes.ok) {
    throw new Error(`Figma image download failed (${imageRes.status})`);
  }
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  const base64 = buffer.toString("base64");
  return {
    mime: "image/png",
    base64
  };
}

export async function validateFigmaToken(token: string): Promise<
  | { ok: true }
  | {
      ok: false;
      status: number;
      message: string;
    }
> {
  const res = await fetchWithRetry({
    url: `${FIGMA_API_BASE}/me`,
    label: "Figma token validation",
    maxAttempts: 1,
    timeoutMs: 10_000,
    init: { headers: { "X-Figma-Token": token } }
  });

  if (res.ok) return { ok: true };

  const text = await res.text().catch(() => "");
  const msg =
    res.status === 403
      ? "Figmaトークンが無効、または権限（scope）が不足しています。推奨: file_content:read"
      : res.status === 401
        ? "Figmaトークンが無効です（401）。"
        : res.status === 429
          ? "Figma API が混雑/制限中です（429）。時間を置いて再保存してください。"
          : `Figmaトークンの検証に失敗しました（${res.status}）。`;

  return { ok: false, status: res.status, message: text ? `${msg}\n${text}` : msg };
}

export function buildSnapshotHash(input: { fileKey: string; nodeId: string; lastModified?: string; sourceUrl: string }) {
  const raw = `${input.fileKey}|${input.nodeId}|${input.lastModified ?? ""}|${input.sourceUrl}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return `sha256:${hash}`;
}
