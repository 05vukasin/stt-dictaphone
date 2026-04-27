import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetSettingsForTests,
  getSettings,
  patchSettings,
  setSettings,
  resetSettings,
  exportSettings,
  importSettings,
} from "./settings-store";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(() => {
  __resetSettingsForTests();
});

describe("settings-store", () => {
  it("returns defaults when nothing is stored", () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("persists patches", () => {
    patchSettings({ openaiApiKey: "sk-test" });
    expect(getSettings().openaiApiKey).toBe("sk-test");

    __resetSettingsForTests();
    // Reseed localStorage manually
    window.localStorage.setItem(
      "stt-dict:settings:v1",
      JSON.stringify({ ...DEFAULT_SETTINGS, openaiApiKey: "sk-test" }),
    );
    expect(getSettings().openaiApiKey).toBe("sk-test");
  });

  it("falls back to defaults on invalid JSON", () => {
    window.localStorage.setItem("stt-dict:settings:v1", "{not-valid-json");
    __resetSettingsForTests();
    window.localStorage.setItem("stt-dict:settings:v1", "{not-valid-json");
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("falls back to defaults on schema mismatch", () => {
    window.localStorage.setItem(
      "stt-dict:settings:v1",
      JSON.stringify({ version: 999, sttProvider: "nope" }),
    );
    __resetSettingsForTests();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("setSettings replaces the whole object", () => {
    setSettings(() => ({ ...DEFAULT_SETTINGS, language: "en" }));
    expect(getSettings().language).toBe("en");
  });

  it("resetSettings restores defaults", () => {
    patchSettings({ openaiApiKey: "sk-test" });
    resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("exportSettings strips api keys by default", () => {
    patchSettings({ openaiApiKey: "sk-test", groqApiKey: "gsk-test" });
    const exported = JSON.parse(exportSettings());
    expect(exported.openaiApiKey).toBe("");
    expect(exported.groqApiKey).toBe("");
  });

  it("exportSettings(true) includes api keys", () => {
    patchSettings({ openaiApiKey: "sk-test" });
    const exported = JSON.parse(exportSettings(true));
    expect(exported.openaiApiKey).toBe("sk-test");
  });

  it("importSettings round-trips", () => {
    patchSettings({ language: "sr" });
    const dump = exportSettings(true);
    resetSettings();
    expect(getSettings().language).toBe("auto");
    const result = importSettings(dump);
    expect(result.ok).toBe(true);
    expect(getSettings().language).toBe("sr");
  });

  it("importSettings rejects bad JSON", () => {
    const result = importSettings("not-json");
    expect(result.ok).toBe(false);
  });
});
