"use client";

import { useSyncExternalStore } from "react";
import type { Transcript, RecordingId } from "@/types/recording";

const STORAGE_KEY = "stt-dict:transcripts:v1";

let cache: Transcript[] = [];
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

function load(): Transcript[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Transcript[];
  } catch {
    return [];
  }
}

function save(list: Transcript[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage quota exceeded — drop oldest until it fits.
    const trimmed = list.slice(-Math.max(1, Math.floor(list.length * 0.8)));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Still too big — give up silently.
    }
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

export function listTranscripts(): Transcript[] {
  ensureInit();
  return cache;
}

export function getTranscript(id: RecordingId): Transcript | undefined {
  return listTranscripts().find((t) => t.id === id);
}

export function upsertTranscript(t: Transcript): void {
  ensureInit();
  const idx = cache.findIndex((x) => x.id === t.id);
  if (idx === -1) cache = [t, ...cache];
  else cache = cache.map((x, i) => (i === idx ? t : x));
  save(cache);
  emit();
}

export function patchTranscript(id: RecordingId, patch: Partial<Transcript>): void {
  ensureInit();
  const idx = cache.findIndex((x) => x.id === id);
  if (idx === -1) return;
  cache = cache.map((x, i) => (i === idx ? { ...x, ...patch } : x));
  save(cache);
  emit();
}

export function deleteTranscript(id: RecordingId): void {
  ensureInit();
  cache = cache.filter((x) => x.id !== id);
  save(cache);
  emit();
}

export function clearAllTranscripts(): void {
  cache = [];
  save(cache);
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
  return useSyncExternalStore(subscribe, listTranscripts, getServerSnapshot);
}

export function useTranscript(id: RecordingId): Transcript | undefined {
  const list = useTranscripts();
  return list.find((t) => t.id === id);
}

export function __resetTranscriptsForTests() {
  cache = [];
  initialized = false;
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}
