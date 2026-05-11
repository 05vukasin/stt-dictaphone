import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  // Drizzle-like minimal stub. `state.rows` is the in-memory table; the
  // builder methods read/write it so we can simulate idempotency.
  type Row = {
    id: string;
    openaiApiKey: string;
    groqApiKey: string;
    anthropicApiKey: string;
  };
  const state: { rows: Row[]; targetId?: string } = { rows: [] };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => Promise.resolve(state.rows)),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Partial<(typeof state.rows)[number]>) => ({
        where: vi.fn(() => {
          // Find a matching row by the predicate-shaped fake (eq returns an
          // object; we don't model it, we just write the patch to whichever
          // row was last "targeted"). Tests pre-seed `targetId` so we know
          // which row to mutate; if absent we patch the first row.
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

// `eq` is called to build the where-clause object. We stub it so we can
// snoop the id and target the right row.
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

import { encryptExistingSecrets } from "./encrypt-secrets";
import { isEncrypted } from "../src/lib/crypto/secrets";

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-32-bytes-long-pad-xx";
  mocks.state.rows = [];
  mocks.state.targetId = undefined;
  mocks.db.update.mockClear();
});

describe("encryptExistingSecrets", () => {
  it("encrypts plaintext API keys and reports the count", async () => {
    mocks.state.rows = [
      {
        id: "g1",
        openaiApiKey: "sk-plaintext-aaaaaaa",
        groqApiKey: "",
        anthropicApiKey: "sk-ant-plaintext",
      },
    ];
    const r = await encryptExistingSecrets();
    expect(r).toEqual({ scanned: 1, rewritten: 1 });
    expect(isEncrypted(mocks.state.rows[0].openaiApiKey)).toBe(true);
    expect(mocks.state.rows[0].groqApiKey).toBe(""); // empty stays empty
    expect(isEncrypted(mocks.state.rows[0].anthropicApiKey)).toBe(true);
  });

  it("is a no-op for rows that are already encrypted", async () => {
    // Seed an already-encrypted row by running once, then again.
    mocks.state.rows = [
      { id: "g1", openaiApiKey: "sk-plain", groqApiKey: "", anthropicApiKey: "" },
    ];
    await encryptExistingSecrets();
    expect(isEncrypted(mocks.state.rows[0].openaiApiKey)).toBe(true);

    mocks.db.update.mockClear();
    const r2 = await encryptExistingSecrets();
    expect(r2).toEqual({ scanned: 1, rewritten: 0 });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("skips rows that have no plaintext keys at all", async () => {
    mocks.state.rows = [
      { id: "g-empty", openaiApiKey: "", groqApiKey: "", anthropicApiKey: "" },
    ];
    const r = await encryptExistingSecrets();
    expect(r).toEqual({ scanned: 1, rewritten: 0 });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("handles a mix of plaintext + already-encrypted columns on one row", async () => {
    mocks.state.rows = [
      {
        id: "g1",
        openaiApiKey: "v1:already-something",
        groqApiKey: "sk-plain",
        anthropicApiKey: "",
      },
    ];
    const r = await encryptExistingSecrets();
    expect(r).toEqual({ scanned: 1, rewritten: 1 });
    // OpenAI key untouched (we detected the v1: prefix and skipped it).
    expect(mocks.state.rows[0].openaiApiKey).toBe("v1:already-something");
    // Groq key encrypted.
    expect(isEncrypted(mocks.state.rows[0].groqApiKey)).toBe(true);
  });
});
