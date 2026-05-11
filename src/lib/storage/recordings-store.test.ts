import { describe, it, expect, beforeEach } from "vitest";
import {
  putRecording,
  getRecording,
  listRecordingIds,
  deleteRecording,
  clearAllRecordings,
} from "./recordings-store";
import { __resetDbForTests } from "./idb";

const TEST_USER = "user-a";

beforeEach(async () => {
  await __resetDbForTests();
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
    await putRecording(TEST_USER, makeRec("a", 1000));
    const got = await getRecording(TEST_USER, "a");
    expect(got?.id).toBe("a");
    expect(got?.blob).toBeDefined();
    expect(got?.mime).toBe("audio/webm");
  });

  it("lists ids", async () => {
    await putRecording(TEST_USER, makeRec("a", 1));
    await putRecording(TEST_USER, makeRec("b", 2));
    const ids = (await listRecordingIds(TEST_USER)).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("deletes a single recording", async () => {
    await putRecording(TEST_USER, makeRec("a", 1));
    await putRecording(TEST_USER, makeRec("b", 2));
    await deleteRecording(TEST_USER, "a");
    expect(await listRecordingIds(TEST_USER)).toEqual(["b"]);
  });

  it("clears all", async () => {
    await putRecording(TEST_USER, makeRec("a", 1));
    await putRecording(TEST_USER, makeRec("b", 2));
    await clearAllRecordings(TEST_USER);
    expect(await listRecordingIds(TEST_USER)).toEqual([]);
  });

  describe("isolation by userId", () => {
    it("user A's recordings are invisible to user B", async () => {
      await putRecording("alice", makeRec("a1", 1));
      await putRecording("alice", makeRec("a2", 2));
      await putRecording("bob", makeRec("b1", 1));

      const aliceIds = (await listRecordingIds("alice")).sort();
      const bobIds = (await listRecordingIds("bob")).sort();

      expect(aliceIds).toEqual(["a1", "a2"]);
      expect(bobIds).toEqual(["b1"]);
      expect(await getRecording("bob", "a1")).toBeUndefined();
    });

    it("clearAllRecordings only wipes the target user", async () => {
      await putRecording("alice", makeRec("a1", 1));
      await putRecording("bob", makeRec("b1", 1));
      await clearAllRecordings("alice");
      expect(await listRecordingIds("alice")).toEqual([]);
      expect(await listRecordingIds("bob")).toEqual(["b1"]);
    });
  });
});
