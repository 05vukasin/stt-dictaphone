import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { isAdmin, requireAdmin, requireAuth } from "./roles";
import type { ServerSession } from "./session";

function asSession(user: { id: string; email: string; role?: string } | null): ServerSession {
  if (!user) return null as ServerSession;
  return { user, session: { id: "s", userId: user.id } } as unknown as ServerSession;
}

describe("auth/roles", () => {
  describe("isAdmin", () => {
    it("returns false for null", () => {
      expect(isAdmin(null)).toBe(false);
    });
    it("returns false for non-admin role", () => {
      expect(isAdmin(asSession({ id: "u1", email: "a@b.c", role: "user" }))).toBe(false);
    });
    it("returns true for admin role", () => {
      expect(isAdmin(asSession({ id: "u1", email: "a@b.c", role: "admin" }))).toBe(true);
    });
  });

  describe("requireAuth", () => {
    it("throws UnauthorizedError when session is null", () => {
      expect(() => requireAuth(null)).toThrow(UnauthorizedError);
    });
    it("returns the session when authenticated", () => {
      const s = asSession({ id: "u1", email: "a@b.c", role: "user" });
      expect(requireAuth(s).user.id).toBe("u1");
    });
  });

  describe("requireAdmin", () => {
    it("throws UnauthorizedError when not signed in", () => {
      expect(() => requireAdmin(null)).toThrow(UnauthorizedError);
    });
    it("throws ForbiddenError when role is not admin", () => {
      expect(() => requireAdmin(asSession({ id: "u1", email: "a@b.c", role: "user" }))).toThrow(
        ForbiddenError,
      );
    });
    it("returns the session when admin", () => {
      const s = asSession({ id: "u1", email: "a@b.c", role: "admin" });
      expect(requireAdmin(s).user.role).toBe("admin");
    });
  });
});
