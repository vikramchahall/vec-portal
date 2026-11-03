import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Field encryption for Aadhaar, PAN and bank account numbers (AES-256-GCM).
 * The key is DATA_ENCRYPTION_KEY (64 hex characters) in the server's .env and
 * nowhere else — keep an offline copy, without it these fields cannot be read.
 * Stored form: "v1:<iv>:<tag>:<ciphertext>" (base64).
 */
function key(): Buffer {
  const hex = process.env.DATA_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("DATA_ENCRYPTION_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decrypt(stored: string): string {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1") throw new Error("unknown encryption version");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}

/** Encrypted value plus last 4 characters for display; empty input clears both. */
export function sealed(value: string | null | undefined): { enc: string | null; last4: string | null } {
  const v = (value ?? "").replace(/\s+/g, "");
  return v ? { enc: encrypt(v), last4: v.slice(-4) } : { enc: null, last4: null };
}
