"use client";

import { createContext, useContext, type ReactNode } from "react";

export const ANON_USER_ID = "__anon__";

const UserIdContext = createContext<string>(ANON_USER_ID);

export interface UserScopeProviderProps {
  userId: string | null | undefined;
  children: ReactNode;
}

// Wraps the recorder tree with the current user's id so every store hook can
// namespace its localStorage / IndexedDB reads. When the user is not signed
// in we fall back to a sentinel; the proxy will redirect to /login before
// the recorder ever mounts in production, but the sentinel keeps stores
// well-behaved in tests and during the brief render before redirect.
export function UserScopeProvider({ userId, children }: UserScopeProviderProps) {
  return <UserIdContext.Provider value={userId ?? ANON_USER_ID}>{children}</UserIdContext.Provider>;
}

export function useUserId(): string {
  return useContext(UserIdContext);
}
