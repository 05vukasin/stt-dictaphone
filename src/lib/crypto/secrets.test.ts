import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetKeyCacheForTests,
  decryptSecret,
  encryptSecret,
  isEncrypted,
} from "./secrets";

const ORIGINAL = process.env.BETTER_AUTH_SECRET;

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-32-bytes-long-pad-xx";
  __resetKeyCacheForTests();
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = ORIGINAL;
  __resetKeyCacheForTests();
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips short and long secrets", () => {
    for (const sample of ["x", "sk-proj-abc", "sk-" + "x".repeat(2000)]) {
      const env = encryptSecret(sample);
      expect(isEncrypted(env)).toBe(true);
      expect(env.startsWith("v1:")).toBe(true);
      expect(decryptSecret(env)).toBe(sample);
    }
  });

  it("returns empty string for empty input on both sides", () => {
    expect(encryptSecret("")).toBe("");
    expect(decryptSecret("")).toBe("");
  });

  it("decryptSecret returns the input as-is for non-v1 values (migration passthrough)", () => {
    expect(decryptSecret("sk-proj-plaintext")).toBe("sk-proj-plaintext");
    expect(decryptSecret("anything that lacks the v1: prefix")).toBe(
      "anything that lacks the v1: prefix",
    );
  });

  it("does not double-encrypt an already-encrypted value", () => {
    const once = encryptSecret("sk-key");
    expect(encryptSecret(once)).toBe(once);
  });

  it("uses a fresh nonce per call — ciphertext for the same input differs", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("rejects tampered ciphertext (auth tag failure)", () => {
    const env = encryptSecret("integrity");
    // Flip a byte in the middle of the payload (base64url). Padding-free, so
    // we slice and rebuild safely. Any single-byte change must invalidate
    // the GCM auth tag.
    const body = env.slice(3);
    const flipped = body.slice(0, 20) + (body[20] === "A" ? "B" : "A") + body.slice(21);
    expect(() => decryptSecret("v1:" + flipped)).toThrow();
  });

  it("rejects malformed envelopes (too short)", () => {
    expect(() => decryptSecret("v1:AAAA")).toThrow(/too short|auth|tag/i);
  });

  it("derives a different key per BETTER_AUTH_SECRET — old ciphertext can't decrypt under a new secret", () => {
    const enc = encryptSecret("user-secret");
    process.env.BETTER_AUTH_SECRET = "different-secret-32-bytes-x-yyyy";
    __resetKeyCacheForTests();
    expect(() => decryptSecret(enc)).toThrow();
  });
});

describe("isEncrypted", () => {
  it("recognises only the v1: prefix", () => {
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted("sk-foo")).toBe(false);
    expect(isEncrypted("v2:somefuturething")).toBe(false);
    expect(isEncrypted("v1:" + Buffer.from("x").toString("base64url"))).toBe(true);
  });
});
