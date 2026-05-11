import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, sessionMock, headersMock, revalidateMock } = vi.hoisted(() => ({
  authMock: {
    setRole: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
    removeUser: vi.fn(),
  },
  sessionMock: vi.fn(),
  headersMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { api: authMock },
}));

vi.mock("@/lib/auth/session", () => ({
  getServerSession: sessionMock,
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidateMock,
}));

import { banUser, removeUser, setRole, unbanUser } from "./actions";

const ADMIN_ID = "admin-1";

beforeEach(() => {
  sessionMock.mockResolvedValue({
    user: { id: ADMIN_ID, email: "admin@x.co", role: "admin" },
  });
  headersMock.mockResolvedValue(new Headers());
  authMock.setRole.mockReset();
  authMock.banUser.mockReset();
  authMock.unbanUser.mockReset();
  authMock.removeUser.mockReset();
  revalidateMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin/users actions", () => {
  it("rejects non-admin callers", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u9", role: "user" } });
    expect(await setRole("u1", "admin")).toEqual({ ok: false, error: expect.any(String) });
    expect(authMock.setRole).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await banUser("u1")).toEqual({ ok: false, error: expect.any(String) });
  });

  it("setRole refuses to change the caller's own role", async () => {
    const r = await setRole(ADMIN_ID, "user");
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/your own role/i) });
    expect(authMock.setRole).not.toHaveBeenCalled();
  });

  it("setRole forwards to auth.api with the right body", async () => {
    authMock.setRole.mockResolvedValue({});
    const r = await setRole("u2", "admin");
    expect(r).toEqual({ ok: true });
    expect(authMock.setRole).toHaveBeenCalledWith({
      body: { userId: "u2", role: "admin" },
      headers: expect.any(Headers),
    });
    expect(revalidateMock).toHaveBeenCalledWith("/admin/users");
  });

  it("banUser refuses self-ban", async () => {
    expect(await banUser(ADMIN_ID)).toEqual({ ok: false, error: expect.any(String) });
    expect(authMock.banUser).not.toHaveBeenCalled();
  });

  it("unbanUser is allowed even for the caller", async () => {
    authMock.unbanUser.mockResolvedValue({});
    expect(await unbanUser(ADMIN_ID)).toEqual({ ok: true });
  });

  it("removeUser refuses self-delete", async () => {
    expect(await removeUser(ADMIN_ID)).toEqual({ ok: false, error: expect.any(String) });
    expect(authMock.removeUser).not.toHaveBeenCalled();
  });

  it("propagates auth errors", async () => {
    authMock.banUser.mockRejectedValue(new Error("nope"));
    expect(await banUser("u2")).toEqual({ ok: false, error: "nope" });
  });
});
