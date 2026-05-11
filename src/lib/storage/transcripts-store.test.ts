import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetTranscriptsForTests,
  listTranscripts,
  upsertTranscript,
  patchTranscript,
  deleteTranscript,
  clearAllTranscripts,
  getTranscript,
} from "./transcripts-store";
import type { Transcript } from "@/types/recording";

const TEST_USER = "user-a";

function makeT(id: string, createdAt: number, overrides: Partial<Transcript> = {}): Transcript {
  return {
    id,
    title: `Recording ${id}`,
    text: "",
    durationMs: 1000,
    sizeBytes: 100,
    mime: "audio/webm",
    createdAt,
    status: "idle",
    summaryStatus: "idle",
    ...overrides,
  };
}

beforeEach(() => {
  __resetTranscriptsForTests();
});

describe("transcripts-store", () => {
  it("starts empty", () => {
    expect(listTranscripts(TEST_USER)).toEqual([]);
  });

  it("upserts a new transcript at the front", () => {
    upsertTranscript(TEST_USER, makeT("a", 1));
    upsertTranscript(TEST_USER, makeT("b", 2));
    const list = listTranscripts(TEST_USER);
    expect(list.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("upsert replaces an existing entry in place", () => {
    upsertTranscript(TEST_USER, makeT("a", 1, { text: "hello" }));
    upsertTranscript(TEST_USER, makeT("a", 1, { text: "world" }));
    expect(listTranscripts(TEST_USER)).toHaveLength(1);
    expect(getTranscript(TEST_USER, "a")?.text).toBe("world");
  });

  it("patchTranscript merges fields", () => {
    upsertTranscript(TEST_USER, makeT("a", 1));
    patchTranscript(TEST_USER, "a", { status: "done", text: "hi" });
    const t = getTranscript(TEST_USER, "a");
    expect(t?.status).toBe("done");
    expect(t?.text).toBe("hi");
  });

  it("deleteTranscript removes one entry", () => {
    upsertTranscript(TEST_USER, makeT("a", 1));
    upsertTranscript(TEST_USER, makeT("b", 2));
    deleteTranscript(TEST_USER, "a");
    expect(listTranscripts(TEST_USER).map((t) => t.id)).toEqual(["b"]);
  });

  it("clearAllTranscripts wipes everything", () => {
    upsertTranscript(TEST_USER, makeT("a", 1));
    clearAllTranscripts(TEST_USER);
    expect(listTranscripts(TEST_USER)).toEqual([]);
  });

  describe("isolation by userId", () => {
    it("user A's transcripts are invisible to user B", () => {
      upsertTranscript("alice", makeT("a1", 1));
      upsertTranscript("alice", makeT("a2", 2));
      upsertTranscript("bob", makeT("b1", 1));

      expect(
        listTranscripts("alice")
          .map((t) => t.id)
          .sort(),
      ).toEqual(["a1", "a2"]);
      expect(listTranscripts("bob").map((t) => t.id)).toEqual(["b1"]);
      expect(getTranscript("bob", "a1")).toBeUndefined();
    });

    it("deleteTranscript only affects the target user", () => {
      upsertTranscript("alice", makeT("shared", 1));
      upsertTranscript("bob", makeT("shared", 1));
      deleteTranscript("alice", "shared");
      expect(getTranscript("alice", "shared")).toBeUndefined();
      expect(getTranscript("bob", "shared")).toBeDefined();
    });
  });
});
