"use client";

import { useSyncExternalStore } from "react";
import { newId } from "./id";

export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  durationMs: number;
}

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return items;
}

function getServerSnapshot() {
  return items;
}

function push(kind: ToastKind, title: string, description?: string, durationMs = 4000) {
  const id = newId();
  items = [...items, { id, kind, title, description, durationMs }];
  emit();
  if (durationMs > 0) {
    timers.set(
      id,
      setTimeout(() => dismiss(id), durationMs),
    );
  }
  return id;
}

export function dismiss(id: string) {
  items = items.filter((t) => t.id !== id);
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  emit();
}

export const toast = {
  info: (title: string, description?: string) => push("info", title, description),
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description, 6000),
};

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
