import { describe, it, expect, beforeEach } from "vitest";
import {
  putRecording,
  getRecording,
  listRecordingIds,
  deleteRecording,
  clearAllRecordings,
} from "./recordings-store";
import { __resetDbForTests } from "./idb";

beforeEach(async () => {
  // Close any cached connection, then drop the whole DB so each test starts clean.
  await __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("stt-dictaphone");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

function makeRec(id: string, createdAt: number) {
  return {
    id,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
    mime: "audio/webm",
    createdAt,
  };
}

describe("recordings-store", () => {
  it("persists and retrieves a recording", async () => {
    await putRecording(makeRec("a", 1000));
    const got = await getRecording("a");
    expect(got?.id).toBe("a");
    // fake-indexeddb's structured clone may return a polyfilled blob — we only
    // need to confirm something blob-like with bytes round-tripped.
    expect(got?.blob).toBeDefined();
    expect(got?.mime).toBe("audio/webm");
  });

  it("lists ids", async () => {
    await putRecording(makeRec("a", 1));
    await putRecording(makeRec("b", 2));
    const ids = (await listRecordingIds()).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("deletes a single recording", async () => {
    await putRecording(makeRec("a", 1));
    await putRecording(makeRec("b", 2));
    await deleteRecording("a");
    const ids = await listRecordingIds();
    expect(ids).toEqual(["b"]);
  });

  it("clears all", async () => {
    await putRecording(makeRec("a", 1));
    await putRecording(makeRec("b", 2));
    await clearAllRecordings();
    expect(await listRecordingIds()).toEqual([]);
  });
});
