import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { settingsGroup } from "../src/lib/db/schema/groups";
import { encryptSecret, isEncrypted } from "../src/lib/crypto/secrets";

// Idempotent one-shot. For every settings_group row, encrypts each of the
// three API-key columns in place if the stored value is plaintext. Already-
// encrypted (v1: prefix) and empty values are skipped. Each row is updated
// in its own statement so a crash midway is safe — re-running picks up
// where it left off.

export interface RunResult {
  scanned: number;
  rewritten: number;
}

export async function encryptExistingSecrets(): Promise<RunResult> {
  const rows = await db
    .select({
      id: settingsGroup.id,
      openaiApiKey: settingsGroup.openaiApiKey,
      groqApiKey: settingsGroup.groqApiKey,
      anthropicApiKey: settingsGroup.anthropicApiKey,
    })
    .from(settingsGroup);

  let rewritten = 0;
  for (const row of rows) {
    const patch: Partial<typeof settingsGroup.$inferInsert> = {};
    if (row.openaiApiKey && !isEncrypted(row.openaiApiKey)) {
      patch.openaiApiKey = encryptSecret(row.openaiApiKey);
    }
    if (row.groqApiKey && !isEncrypted(row.groqApiKey)) {
      patch.groqApiKey = encryptSecret(row.groqApiKey);
    }
    if (row.anthropicApiKey && !isEncrypted(row.anthropicApiKey)) {
      patch.anthropicApiKey = encryptSecret(row.anthropicApiKey);
    }
    if (Object.keys(patch).length === 0) continue;
    await db.update(settingsGroup).set(patch).where(eq(settingsGroup.id, row.id));
    rewritten++;
  }
  return { scanned: rows.length, rewritten };
}

const isMain = process.argv[1]?.endsWith("encrypt-secrets.ts");
if (isMain) {
  encryptExistingSecrets()
    .then(({ scanned, rewritten }) => {
      console.log(
        `[encrypt-secrets] scanned ${scanned} group(s), encrypted plaintext keys in ${rewritten}.`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("[encrypt-secrets] fatal", err);
      process.exit(1);
    });
}
