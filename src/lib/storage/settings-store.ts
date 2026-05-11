"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_DEVICE_SETTINGS,
  DeviceSettingsSchema,
  type DeviceSettings,
} from "@/types/settings";
import { useUserId } from "./user-scope";

// Device-local settings = a single field today (micDeviceId) plus a version
// tag. Admin-controlled config lives in Postgres and is resolved by the
// server via getEffectiveSettings (see src/lib/settings/effective.ts).
//
// The localStorage key is namespaced by user so a shared browser doesn't
// leak one user's mic preference to the next. The old v1 blob (which
// carried API keys) is silently dropped on read via the schema-mismatch
// fallback — see settings-store.test.ts for the migration assertion.

const KEY_PREFIX = "stt-dict:settings:v2";

function keyFor(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

const caches = new Map<string, DeviceSettings>();
const initialized = new Set<string>();
const listeners = new Set<() => void>();
let storageListenerAttached = false;

function emit() {
  for (const cb of listeners) cb();
}

function load(userId: string): DeviceSettings {
  if (typeof window === "undefined") return DEFAULT_DEVICE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT_DEVICE_SETTINGS;
    const parsed = JSON.parse(raw);
    return DeviceSettingsSchema.parse(parsed);
  } catch {
    return DEFAULT_DEVICE_SETTINGS;
  }
}

function save(userId: string, settings: DeviceSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(settings));
  } catch {
    // Quota exceeded — ignore silently.
  }
}

function attachStorageListener() {
  if (storageListenerAttached || typeof window === "undefined") return;
  storageListenerAttached = true;
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(KEY_PREFIX + ":")) return;
    const userId = e.key.slice(KEY_PREFIX.length + 1);
    caches.set(userId, load(userId));
    emit();
  });
}

function ensureInit(userId: string) {
  if (initialized.has(userId)) return;
  caches.set(userId, load(userId));
  initialized.add(userId);
  attachStorageListener();
}

export function getDeviceSettings(userId: string): DeviceSettings {
  ensureInit(userId);
  return caches.get(userId) ?? DEFAULT_DEVICE_SETTINGS;
}

export function setDeviceSettings(
  userId: string,
  updater: (prev: DeviceSettings) => DeviceSettings,
) {
  ensureInit(userId);
  const prev = caches.get(userId) ?? DEFAULT_DEVICE_SETTINGS;
  const next = DeviceSettingsSchema.parse(updater(prev));
  caches.set(userId, next);
  save(userId, next);
  emit();
}

export function patchDeviceSettings(userId: string, patch: Partial<DeviceSettings>) {
  setDeviceSettings(userId, (prev) => ({ ...prev, ...patch }));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getServerSnapshot(): DeviceSettings {
  return DEFAULT_DEVICE_SETTINGS;
}

export function useDeviceSettings(): DeviceSettings {
  const userId = useUserId();
  return useSyncExternalStore(subscribe, () => getDeviceSettings(userId), getServerSnapshot);
}

// Drops the cached snapshot and persisted slot for one user. Used by the
// sign-out wipe helper and the explicit "Wipe all data" button.
export function clearDeviceSettingsFor(userId: string) {
  caches.delete(userId);
  initialized.delete(userId);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(keyFor(userId));
    // Best-effort cleanup of the old v1 key (which may carry API keys).
    window.localStorage.removeItem(`stt-dict:settings:v1:${userId}`);
  }
  emit();
}

export function __resetSettingsForTests() {
  caches.clear();
  initialized.clear();
  if (typeof window !== "undefined") {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith(KEY_PREFIX + ":") || k.startsWith("stt-dict:settings:v1:"))) {
        window.localStorage.removeItem(k);
      }
    }
  }
}
