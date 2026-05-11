import { describe, expect, it } from "vitest";
import { generateTempPassword } from "./temp-password";
import { formatForDisplay } from "./format";

const ALPHABET = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]+$/;

describe("temp-password", () => {
  it("returns a 16-char password by default", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(16);
    expect(pw).toMatch(ALPHABET);
  });

  it("respects a custom length", () => {
    expect(generateTempPassword(24)).toHaveLength(24);
  });

  it("refuses lengths shorter than 8", () => {
    expect(() => generateTempPassword(4)).toThrow(/≥ 8/);
  });

  it("does not produce duplicates over many samples", () => {
    const samples = new Set<string>();
    for (let i = 0; i < 1000; i++) samples.add(generateTempPassword());
    expect(samples.size).toBe(1000);
  });

  it("formats as hyphenated 4-char blocks", () => {
    expect(formatForDisplay("ABCDEFGHJKMNPQRS")).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(formatForDisplay("ABCDE")).toBe("ABCD-E");
  });
});
