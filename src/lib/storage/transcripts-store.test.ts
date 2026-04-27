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
    expect(listTranscripts()).toEqual([]);
  });

  it("upserts a new transcript at the front", () => {
    upsertTranscript(makeT("a", 1));
    upsertTranscript(makeT("b", 2));
    const list = listTranscripts();
    expect(list.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("upsert replaces an existing entry in place", () => {
    upsertTranscript(makeT("a", 1, { text: "hello" }));
    upsertTranscript(makeT("a", 1, { text: "world" }));
    expect(listTranscripts()).toHaveLength(1);
    expect(getTranscript("a")?.text).toBe("world");
  });

  it("patchTranscript merges fields", () => {
    upsertTranscript(makeT("a", 1));
    patchTranscript("a", { status: "done", text: "hi" });
    const t = getTranscript("a");
    expect(t?.status).toBe("done");
    expect(t?.text).toBe("hi");
  });

  it("deleteTranscript removes one entry", () => {
    upsertTranscript(makeT("a", 1));
    upsertTranscript(makeT("b", 2));
    deleteTranscript("a");
    expect(listTranscripts().map((t) => t.id)).toEqual(["b"]);
  });

  it("clearAllTranscripts wipes everything", () => {
    upsertTranscript(makeT("a", 1));
    clearAllTranscripts();
    expect(listTranscripts()).toEqual([]);
  });
});
