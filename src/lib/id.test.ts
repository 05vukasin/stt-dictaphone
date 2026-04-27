import { describe, it, expect } from "vitest";
import { newId } from "./id";

describe("newId", () => {
  it("returns a 26-char ULID", () => {
    const id = newId();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
  });

  it("returns sortable values when called in sequence", () => {
    const a = newId();
    const b = newId();
    expect(b >= a).toBe(true);
  });
});
