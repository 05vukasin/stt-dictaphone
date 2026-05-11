import { ForbiddenError, UnauthorizedError } from "./errors";
import type { ServerSession } from "./session";

export type Role = "admin" | "user";

export interface SessionUser {
  id: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
}

export interface AuthedSession {
  user: SessionUser;
}

export function isAdmin(session: ServerSession | null): boolean {
  return session?.user?.role === "admin";
}

export function requireAuth(session: ServerSession | null): AuthedSession {
  if (!session?.user?.id) throw new UnauthorizedError();
  return session as AuthedSession;
}

export function requireAdmin(session: ServerSession | null): AuthedSession {
  const authed = requireAuth(session);
  if (authed.user.role !== "admin") throw new ForbiddenError();
  return authed;
}
