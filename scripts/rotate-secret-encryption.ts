import { eq } from "drizzle-orm";
import { createDecipheriv, createCipheriv, hkdfSync, randomBytes } from "node:crypto";
import { db } from "../src/lib/db/client";
import { settingsGroup } from "../src/lib/db/schema/groups";

// Re-encrypts every API key in settings_group from OLD_SECRET to NEW_SECRET.
// Run when rotating BETTER_AUTH_SECRET. After this script completes, update
// .env (BETTER_AUTH_SECRET=NEW_SECRET) and restart the stack.
//
// Usage:
//   OLD_SECRET=… NEW_SECRET=… tsx scripts/rotate-secret-encryption.ts
//
// Inlines the key-derivation + AES-GCM logic so a single process can hold
// both the OLD and NEW keys at the same time (the secrets module derives
// from a single env var via a cached key, which doesn't suit rotation).

const PREFIX = "v1:";
const HKDF_INFO = "settings-group-api-keys";
const HKDF_SALT = "dictaphone-secrets-v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function deriveKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret), Buffer.from(HKDF_SALT), Buffer.from(HKDF_INFO), 32),
  );
}

function decryptWith(key: Buffer, envelope: string): string {
  if (!envelope) return "";
  if (!envelope.startsWith(PREFIX)) return envelope; // tolerate stragglers
  const blob = Buffer.from(envelope.slice(PREFIX.length), "base64url");
  const nonce = blob.subarray(0, NONCE_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ciphertext = blob.subarray(NONCE_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function encryptWith(key: Buffer, plaintext: string): string {
  if (!plaintext) return "";
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([nonce, ciphertext, tag]).toString("base64url");
}

interface RotateResult {
  scanned: number;
  rewritten: number;
  failed: { id: string; column: string; error: string }[];
}

export async function rotateSecrets(oldSecret: string, newSecret: string): Promise<RotateResult> {
  if (!oldSecret || oldSecret.length < 16) {
    throw new Error("OLD_SECRET must be ≥ 16 chars.");
  }
  if (!newSecret || newSecret.length < 16) {
    throw new Error("NEW_SECRET must be ≥ 16 chars.");
  }
  const oldKey = deriveKey(oldSecret);
  const newKey = deriveKey(newSecret);
  if (oldKey.equals(newKey)) {
    return { scanned: 0, rewritten: 0, failed: [] };
  }

  const rows = await db
    .select({
      id: settingsGroup.id,
      openaiApiKey: settingsGroup.openaiApiKey,
      groqApiKey: settingsGroup.groqApiKey,
      anthropicApiKey: settingsGroup.anthropicApiKey,
    })
    .from(settingsGroup);

  let rewritten = 0;
  const failed: RotateResult["failed"] = [];

  for (const row of rows) {
    const patch: Partial<typeof settingsGroup.$inferInsert> = {};
    for (const column of ["openaiApiKey", "groqApiKey", "anthropicApiKey"] as const) {
      const v = row[column];
      if (!v || !v.startsWith(PREFIX)) continue;
      try {
        const plain = decryptWith(oldKey, v);
        patch[column] = encryptWith(newKey, plain);
      } catch (err) {
        failed.push({
          id: row.id,
          column,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (Object.keys(patch).length === 0) continue;
    await db.update(settingsGroup).set(patch).where(eq(settingsGroup.id, row.id));
    rewritten++;
  }
  return { scanned: rows.length, rewritten, failed };
}

const isMain = process.argv[1]?.endsWith("rotate-secret-encryption.ts");
if (isMain) {
  const oldSecret = process.env.OLD_SECRET ?? "";
  const newSecret = process.env.NEW_SECRET ?? "";
  rotateSecrets(oldSecret, newSecret)
    .then(({ scanned, rewritten, failed }) => {
      console.log(
        `[rotate-secrets] scanned ${scanned} row(s), re-encrypted ${rewritten}. ${failed.length} failure(s).`,
      );
      for (const f of failed) {
        console.error(`  ! ${f.id}.${f.column}: ${f.error}`);
      }
      process.exit(failed.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("[rotate-secrets] fatal", err);
      process.exit(1);
    });
}
