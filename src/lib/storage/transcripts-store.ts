"use client";

import { useSyncExternalStore } from "react";
import type { Transcript, RecordingId } from "@/types/recording";
import { useUserId } from "./user-scope";

const KEY_PREFIX = "stt-dict:transcripts:v1";

function keyFor(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

const caches = new Map<string, Transcript[]>();
const initialized = new Set<string>();
const listeners = new Set<() => void>();
let storageListenerAttached = false;

function emit() {
  for (const cb of listeners) cb();
}

function load(userId: string): Transcript[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Transcript[];
  } catch {
    return [];
  }
}

function save(userId: string, list: Transcript[]) {
  if (typeof window === "undefined") return;
  const k = keyFor(userId);
  try {
    window.localStorage.setItem(k, JSON.stringify(list));
  } catch {
    const trimmed = list.slice(-Math.max(1, Math.floor(list.length * 0.8)));
    try {
      window.localStorage.setItem(k, JSON.stringify(trimmed));
    } catch {
      // Still too big — give up silently.
    }
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

export function listTranscripts(userId: string): Transcript[] {
  ensureInit(userId);
  return caches.get(userId) ?? [];
}

export function getTranscript(userId: string, id: RecordingId): Transcript | undefined {
  return listTranscripts(userId).find((t) => t.id === id);
}

export function upsertTranscript(userId: string, t: Transcript): void {
  ensureInit(userId);
  const list = caches.get(userId) ?? [];
  const idx = list.findIndex((x) => x.id === t.id);
  const next = idx === -1 ? [t, ...list] : list.map((x, i) => (i === idx ? t : x));
  caches.set(userId, next);
  save(userId, next);
  emit();
}

export function patchTranscript(userId: string, id: RecordingId, patch: Partial<Transcript>): void {
  ensureInit(userId);
  const list = caches.get(userId) ?? [];
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const next = list.map((x, i) => (i === idx ? { ...x, ...patch } : x));
  caches.set(userId, next);
  save(userId, next);
  emit();
}

export function deleteTranscript(userId: string, id: RecordingId): void {
  ensureInit(userId);
  const list = caches.get(userId) ?? [];
  const next = list.filter((x) => x.id !== id);
  caches.set(userId, next);
  save(userId, next);
  emit();
}

export function clearAllTranscripts(userId: string): void {
  caches.set(userId, []);
  save(userId, []);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getServerSnapshot(): Transcript[] {
  return [];
}

export function useTranscripts(): Transcript[] {
  const userId = useUserId();
  return useSyncExternalStore(subscribe, () => listTranscripts(userId), getServerSnapshot);
}

export function useTranscript(id: RecordingId): Transcript | undefined {
  const list = useTranscripts();
  return list.find((t) => t.id === id);
}

// Drops the cached snapshot and persisted slot for one user.
export function clearTranscriptsFor(userId: string) {
  caches.delete(userId);
  initialized.delete(userId);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(keyFor(userId));
  }
  emit();
}

export function __resetTranscriptsForTests() {
  caches.clear();
  initialized.clear();
  if (typeof window !== "undefined") {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX + ":")) window.localStorage.removeItem(k);
    }
  }
}
