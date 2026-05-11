import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const dbBuilder = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: "acc-1" }])),
        })),
      })),
    })),
  };
  const cookieStore = { delete: vi.fn() };
  return {
    sessionMock: vi.fn(),
    cookiesMock: vi.fn(() => Promise.resolve(cookieStore)),
    cookieStore,
    updateUserMock: vi.fn(),
    updateAccountMock: vi.fn(),
    hashMock: vi.fn(),
    db: dbBuilder,
  };
});

vi.mock("@/lib/auth/session", () => ({ getServerSession: mocks.sessionMock }));
vi.mock("next/headers", () => ({ cookies: mocks.cookiesMock }));
vi.mock("@/lib/db/client", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/server", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: {
        updateUser: mocks.updateUserMock,
        updateAccount: mocks.updateAccountMock,
      },
      password: { hash: mocks.hashMock },
    }),
  },
}));

import { clearMustChangePassword, forceChangePassword } from "./actions";

beforeEach(() => {
  mocks.sessionMock.mockReset();
  mocks.updateUserMock.mockReset();
  mocks.updateAccountMock.mockReset();
  mocks.hashMock.mockReset();
  mocks.cookieStore.delete.mockReset();
  mocks.hashMock.mockResolvedValue("hashed-new");
  mocks.sessionMock.mockResolvedValue({ user: { id: "u1", email: "a@b.co", role: "user" } });
});

describe("forceChangePassword", () => {
  it("requires an authenticated session", async () => {
    mocks.sessionMock.mockResolvedValue(null);
    const r = await forceChangePassword("permanent-pass");
    expect(r).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.updateAccountMock).not.toHaveBeenCalled();
  });

  it("rejects too-short new passwords", async () => {
    const r = await forceChangePassword("short");
    expect(r).toMatchObject({ ok: false, error: /at least 8/i });
    expect(mocks.updateAccountMock).not.toHaveBeenCalled();
  });

  it("updates the credential account, clears the flag, busts the cookie cache, and returns ok", async () => {
    mocks.updateAccountMock.mockResolvedValue({});
    mocks.updateUserMock.mockResolvedValue(undefined);
    const r = await forceChangePassword("permanent-pass");
    expect(r).toEqual({ ok: true });
    expect(mocks.hashMock).toHaveBeenCalledWith("permanent-pass");
    expect(mocks.updateAccountMock).toHaveBeenCalledWith("acc-1", { password: "hashed-new" });
    expect(mocks.updateUserMock).toHaveBeenCalledWith("u1", { mustChangePassword: false });
    // Cookie cache is busted so the next request re-reads from the DB and
    // sees mustChangePassword=false (no redirect-back to /change-password).
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("better-auth.session_data");
  });

  it("surfaces error when the user has no credential account", async () => {
    mocks.db.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) })),
      })),
    });
    const r = await forceChangePassword("permanent-pass");
    expect(r).toMatchObject({ ok: false, error: /credential account/i });
    expect(mocks.updateAccountMock).not.toHaveBeenCalled();
  });
});

describe("clearMustChangePassword", () => {
  it("is a no-op when unauthenticated", async () => {
    mocks.sessionMock.mockResolvedValue(null);
    const r = await clearMustChangePassword();
    expect(r.ok).toBe(false);
    expect(mocks.updateUserMock).not.toHaveBeenCalled();
  });

  it("clears the flag and busts the cookie cache when signed in", async () => {
    expect(await clearMustChangePassword()).toEqual({ ok: true });
    expect(mocks.updateUserMock).toHaveBeenCalledWith("u1", { mustChangePassword: false });
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("better-auth.session_data");
  });
});
