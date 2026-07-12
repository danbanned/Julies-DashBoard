// AES-256-GCM encryption for OAuth refresh tokens at rest (Phase 9b).
// Key: TOKEN_ENCRYPTION_KEY env var, 64 hex chars (32 bytes). Ciphertext is
// stored as "iv:authTag:data" (base64 parts) on the user row.
import crypto from "crypto";

function key() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars — see docs/GOOGLE_CALENDAR.md");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptToken(stored) {
  const [iv, tag, data] = String(stored).split(":").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
