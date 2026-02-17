import crypto from "crypto";
import { envServer } from "@/lib/envServer";

type EncPayload = {
  v: 1;
  alg: "aes-256-gcm";
  iv: string; // base64
  tag: string; // base64
  ct: string; // base64
};

function getKeyBytes(): Buffer {
  const raw = envServer.D2C_ENCRYPTION_KEY.trim();
  // Prefer base64, fallback to utf8 hashed
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {}
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plain: string): string {
  const key = getKeyBytes();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plain, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncPayload = {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64")
  };
  return JSON.stringify(payload);
}

export function decryptSecret(enc: string): string {
  const key = getKeyBytes();
  const payload = JSON.parse(enc) as EncPayload;
  if (!payload || payload.v !== 1 || payload.alg !== "aes-256-gcm") {
    throw new Error("invalid_secret_payload");
  }
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ct = Buffer.from(payload.ct, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

