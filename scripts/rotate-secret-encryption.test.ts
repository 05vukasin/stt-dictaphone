import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = {
    id: string;
    openaiApiKey: string;
    groqApiKey: string;
    anthropicApiKey: string;
  };
  const state: { rows: Row[]; targetId?: string } = { rows: [] };
  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => Promise.resolve(state.rows)) })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Partial<Row>) => ({
        where: vi.fn(() => {
          const row = state.rows.find((r) => r.id === state.targetId) ?? state.rows[0];
          if (row) Object.assign(row, patch);
          return Promise.resolve();
        }),
      })),
    })),
  };
  return { db, state };
});

vi.mock("../src/lib/db/client", () => ({ db: mocks.db }));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (_col: unknown, value: unknown) => {
      mocks.state.targetId = String(value);
      return { __eq: value };
    },
  };
});

import { rotateSecrets } from "./rotate-secret-encryption";

// Helper: produce a "v1:" envelope under a given secret. Mirrors the same
// AES-GCM/HKDF derivation as the production code so the test fixtures are
// independent of the secrets module under rotation.
function encryptUnder(secret: string, plaintext: string): string {
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret),
      Buffer.from("dictaphone-secrets-v1"),
      Buffer.from("settings-group-api-keys"),
      32,
    ),
  );
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1:" + Buffer.concat([nonce, ciphertext, tag]).toString("base64url");
}

const OLD = "rot-test-old-secret-32-bytes-xx";
const NEW = "rot-test-new-secret-32-bytes-xx";

beforeEach(() => {
  mocks.state.rows = [];
  mocks.state.targetId = undefined;
  mocks.db.update.mockClear();
});

describe("rotateSecrets", () => {
  it("re-encrypts every v1: column from OLD to NEW", async () => {
    mocks.state.rows = [
      {
        id: "g1",
        openaiApiKey: encryptUnder(OLD, "sk-openai"),
        groqApiKey: encryptUnder(OLD, "gsk-groq"),
        anthropicApiKey: encryptUnder(OLD, "sk-ant"),
      },
    ];
    const r = await rotateSecrets(OLD, NEW);
    expect(r.rewritten).toBe(1);
    expect(r.failed).toEqual([]);
    // Re-encrypted: still v1: prefix but different ciphertext.
    expect(mocks.state.rows[0].openaiApiKey.startsWith("v1:")).toBe(true);
    // It's a different nonce + key, so the envelope changed.
    expect(mocks.state.rows[0].openaiApiKey).not.toBe(encryptUnder(OLD, "sk-openai"));
  });

  it("returns a no-op when OLD === NEW", async () => {
    mocks.state.rows = [
      {
        id: "g1",
        openaiApiKey: encryptUnder(OLD, "x"),
        groqApiKey: "",
        anthropicApiKey: "",
      },
    ];
    const r = await rotateSecrets(OLD, OLD);
    expect(r).toEqual({ scanned: 0, rewritten: 0, failed: [] });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("rejects short secrets", async () => {
    await expect(rotateSecrets("short", NEW)).rejects.toThrow(/16 chars/);
    await expect(rotateSecrets(OLD, "short")).rejects.toThrow(/16 chars/);
  });

  it("ignores empty + non-v1: values (plaintext stragglers)", async () => {
    mocks.state.rows = [
      { id: "g1", openaiApiKey: "sk-plain", groqApiKey: "", anthropicApiKey: "" },
    ];
    const r = await rotateSecrets(OLD, NEW);
    expect(r.rewritten).toBe(0);
    expect(mocks.state.rows[0].openaiApiKey).toBe("sk-plain");
  });

  it("collects per-column failures without aborting the run", async () => {
    mocks.state.rows = [
      {
        id: "g1",
        openaiApiKey: encryptUnder(OLD, "sk"),
        groqApiKey: "v1:tampered-garbage-not-valid-base64url",
        anthropicApiKey: "",
      },
    ];
    const r = await rotateSecrets(OLD, NEW);
    expect(r.failed.length).toBeGreaterThan(0);
    // Good column still rotated even when a sibling fails.
    expect(mocks.state.rows[0].openaiApiKey).not.toBe(encryptUnder(OLD, "sk"));
  });
});
