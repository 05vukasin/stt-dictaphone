"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from "@/types/settings";

const STORAGE_KEY = "stt-dict:settings:v1";

let cache: Settings = DEFAULT_SETTINGS;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

function load(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return SettingsSchema.parse(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(settings: Settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or storage disabled — ignore silently.
  }
}

function ensureInit() {
  if (initialized) return;
  cache = load();
  initialized = true;
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) {
        cache = load();
        emit();
      }
    });
  }
}

export function getSettings(): Settings {
  ensureInit();
  return cache;
}

export function setSettings(updater: (prev: Settings) => Settings) {
  ensureInit();
  const next = SettingsSchema.parse(updater(cache));
  cache = next;
  save(next);
  emit();
}

export function patchSettings(patch: Partial<Settings>) {
  setSettings((prev) => ({ ...prev, ...patch }));
}

export function resetSettings() {
  setSettings(() => DEFAULT_SETTINGS);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getServerSnapshot);
}

// Export settings as a JSON blob, omitting API keys for safety.
export function exportSettings(includeKeys = false): string {
  const s = getSettings();
  const out = includeKeys ? s : { ...s, openaiApiKey: "", groqApiKey: "", anthropicApiKey: "" };
  return JSON.stringify(out, null, 2);
}

export function importSettings(json: string): { ok: boolean; error?: string } {
  try {
    const parsed = SettingsSchema.parse(JSON.parse(json));
    setSettings(() => parsed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

// Test-only: clear the in-memory cache so each test gets a fresh load.
export function __resetSettingsForTests() {
  cache = DEFAULT_SETTINGS;
  initialized = false;
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}
