import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// AES-256-GCM with a data-encryption key derived from BETTER_AUTH_SECRET via
// HKDF-SHA256. Envelope format: "v1:<base64url(nonce(12) || ciphertext || authTag(16))>"
//
// - The "v1:" prefix lets us evolve the algorithm or KDF later without
//   rewriting existing rows in a breaking way.
// - The same BETTER_AUTH_SECRET can power other purposes (cookies, JWKS)
//   safely because HKDF's `info` parameter pins this key to one use case.
// - Empty strings are passed through unchanged so the "no key configured"
//   default in `settings_group` stays an empty string in the DB.
// - `decryptSecret` is tolerant: a non-`v1:` input is returned as-is. That
//   makes the database migration safe (rows that haven't been encrypted yet
//   still work) and lets us roll back without rewriting data.

const VERSION = "v1";
const PREFIX = `${VERSION}:`;
const HKDF_INFO = "settings-group-api-keys";
const HKDF_SALT = "dictaphone-secrets-v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

// `next build`'s "Collecting page data" phase evaluates every module — read
// the secret lazily so a missing var at build time doesn't crash the build.
// At request time, the layer that consumes us (queries.ts, effective.ts)
// runs under a real env.
let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      // Build-time placeholder — never used at runtime.
      cachedKey = Buffer.alloc(32, 0);
      return cachedKey;
    }
    throw new Error(
      "BETTER_AUTH_SECRET must be set to a strong random value (≥16 chars) before encrypting secrets.",
    );
  }
  const derived = hkdfSync(
    "sha256",
    Buffer.from(secret),
    Buffer.from(HKDF_SALT),
    Buffer.from(HKDF_INFO),
    32,
  );
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  if (isEncrypted(plaintext)) return plaintext; // already encrypted — don't double-wrap
  const key = getKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([nonce, ciphertext, tag]);
  return PREFIX + blob.toString("base64url");
}

export function decryptSecret(envelope: string): string {
  if (!envelope) return "";
  if (!isEncrypted(envelope)) return envelope;
  const key = getKey();
  let blob: Buffer;
  try {
    blob = Buffer.from(envelope.slice(PREFIX.length), "base64url");
  } catch {
    throw new Error("decryptSecret: invalid base64url payload");
  }
  if (blob.length < NONCE_BYTES + TAG_BYTES + 1) {
    throw new Error("decryptSecret: envelope is too short to be a valid ciphertext");
  }
  const nonce = blob.subarray(0, NONCE_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ciphertext = blob.subarray(NONCE_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

// Test-only: drop the cached key so a test that mutates BETTER_AUTH_SECRET
// can re-derive on the next call.
export function __resetKeyCacheForTests() {
  cachedKey = null;
}
