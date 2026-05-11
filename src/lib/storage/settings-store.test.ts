import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetSettingsForTests,
  getDeviceSettings,
  patchDeviceSettings,
  clearDeviceSettingsFor,
} from "./settings-store";
import { DEFAULT_DEVICE_SETTINGS } from "@/types/settings";

const TEST_USER = "user-a";

beforeEach(() => {
  __resetSettingsForTests();
});

describe("device settings store (v2)", () => {
  it("returns defaults when nothing is stored", () => {
    expect(getDeviceSettings(TEST_USER)).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it("persists a mic device id", () => {
    patchDeviceSettings(TEST_USER, { micDeviceId: "device-abc" });
    expect(getDeviceSettings(TEST_USER).micDeviceId).toBe("device-abc");
  });

  it("falls back to defaults on invalid JSON", () => {
    window.localStorage.setItem(`stt-dict:settings:v2:${TEST_USER}`, "{not-valid-json");
    __resetSettingsForTests();
    window.localStorage.setItem(`stt-dict:settings:v2:${TEST_USER}`, "{not-valid-json");
    expect(getDeviceSettings(TEST_USER)).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it("silently drops a stale v1 blob (carrying API keys) on read", () => {
    // Pre-populate the old v1 key with admin-tier fields. The loader for v2
    // doesn't read it; the cleanup below verifies it gets cleared too.
    window.localStorage.setItem(
      `stt-dict:settings:v1:${TEST_USER}`,
      JSON.stringify({ version: 1, openaiApiKey: "sk-LEAKED" }),
    );
    expect(getDeviceSettings(TEST_USER)).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it("clearDeviceSettingsFor wipes both the v2 slot and any stale v1 blob", () => {
    patchDeviceSettings(TEST_USER, { micDeviceId: "device-abc" });
    window.localStorage.setItem(
      `stt-dict:settings:v1:${TEST_USER}`,
      JSON.stringify({ version: 1, openaiApiKey: "sk-LEAKED" }),
    );
    clearDeviceSettingsFor(TEST_USER);
    expect(window.localStorage.getItem(`stt-dict:settings:v2:${TEST_USER}`)).toBeNull();
    expect(window.localStorage.getItem(`stt-dict:settings:v1:${TEST_USER}`)).toBeNull();
  });

  describe("isolation by userId", () => {
    it("each user has an independent slot", () => {
      patchDeviceSettings("alice", { micDeviceId: "alice-mic" });
      patchDeviceSettings("bob", { micDeviceId: "bob-mic" });
      expect(getDeviceSettings("alice").micDeviceId).toBe("alice-mic");
      expect(getDeviceSettings("bob").micDeviceId).toBe("bob-mic");
    });

    it("clear only affects the target user", () => {
      patchDeviceSettings("alice", { micDeviceId: "alice-mic" });
      patchDeviceSettings("bob", { micDeviceId: "bob-mic" });
      clearDeviceSettingsFor("alice");
      expect(getDeviceSettings("alice")).toEqual(DEFAULT_DEVICE_SETTINGS);
      expect(getDeviceSettings("bob").micDeviceId).toBe("bob-mic");
    });
  });
});
