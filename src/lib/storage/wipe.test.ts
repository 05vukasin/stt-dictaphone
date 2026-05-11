import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetSettingsForTests, getDeviceSettings, patchDeviceSettings } from "./settings-store";
import { __resetTranscriptsForTests, listTranscripts, upsertTranscript } from "./transcripts-store";
import { __resetDbForTests } from "./idb";
import { putRecording, listRecordingIds } from "./recordings-store";
import { softResetCachesFor, wipeCurrentUserLocalData } from "./wipe";
import { DEFAULT_DEVICE_SETTINGS } from "@/types/settings";

beforeEach(async () => {
  __resetSettingsForTests();
  __resetTranscriptsForTests();
  await __resetDbForTests();
});

afterEach(async () => {
  await __resetDbForTests();
});

function seed(userId: string) {
  patchDeviceSettings(userId, { micDeviceId: `${userId}-mic` });
  upsertTranscript(userId, {
    id: `${userId}-t`,
    title: "t",
    text: "",
    durationMs: 0,
    sizeBytes: 0,
    mime: "audio/webm",
    createdAt: 1,
    status: "idle",
    summaryStatus: "idle",
  });
  return putRecording(userId, {
    id: `${userId}-r`,
    blob: new Blob([new Uint8Array([1])], { type: "audio/webm" }),
    mime: "audio/webm",
    createdAt: 1,
  });
}

describe("wipeCurrentUserLocalData", () => {
  it("removes device settings, transcripts, and the IDB namespace for the target user", async () => {
    await seed("alice");
    await seed("bob");

    await wipeCurrentUserLocalData("alice");

    expect(getDeviceSettings("alice")).toEqual(DEFAULT_DEVICE_SETTINGS);
    expect(listTranscripts("alice")).toEqual([]);
    expect(await listRecordingIds("alice")).toEqual([]);

    expect(getDeviceSettings("bob").micDeviceId).toBe("bob-mic");
    expect(listTranscripts("bob").map((t) => t.id)).toEqual(["bob-t"]);
    expect(await listRecordingIds("bob")).toEqual(["bob-r"]);
  });
});

describe("softResetCachesFor", () => {
  it("drops the in-memory caches and the persisted device-settings slot", () => {
    patchDeviceSettings("alice", { micDeviceId: "alice-mic" });
    upsertTranscript("alice", {
      id: "t1",
      title: "t",
      text: "",
      durationMs: 0,
      sizeBytes: 0,
      mime: "audio/webm",
      createdAt: 1,
      status: "idle",
      summaryStatus: "idle",
    });
    softResetCachesFor("alice");
    expect(getDeviceSettings("alice")).toEqual(DEFAULT_DEVICE_SETTINGS);
    expect(listTranscripts("alice")).toEqual([]);
  });
});
