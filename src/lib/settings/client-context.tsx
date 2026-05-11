"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicEffectiveSettings } from "./effective";

export type ClientEffectiveSettings = PublicEffectiveSettings;

const EffectiveSettingsContext = createContext<ClientEffectiveSettings | null>(null);

export interface EffectiveSettingsProviderProps {
  value: ClientEffectiveSettings | null;
  children: ReactNode;
}

// Wraps the recorder tree with the user's resolved (group + override)
// settings. Set on every server render by the root layout. The value is
// `null` for unauthenticated pages (e.g. /login) so consumers must be
// defensive — `useEffectiveSettings()` returns null in that case and
// `useEffectiveSettingsOrThrow()` is available for code that should never
// run unauthenticated.
export function EffectiveSettingsProvider({ value, children }: EffectiveSettingsProviderProps) {
  return (
    <EffectiveSettingsContext.Provider value={value}>{children}</EffectiveSettingsContext.Provider>
  );
}

export function useEffectiveSettings(): ClientEffectiveSettings | null {
  return useContext(EffectiveSettingsContext);
}

export function useEffectiveSettingsOrThrow(): ClientEffectiveSettings {
  const v = useContext(EffectiveSettingsContext);
  if (!v) {
    throw new Error(
      "useEffectiveSettingsOrThrow() called without an EffectiveSettingsProvider above it.",
    );
  }
  return v;
}
