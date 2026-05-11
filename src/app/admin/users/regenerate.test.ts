import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const ctx = {
    internalAdapter: {
      updateUser: vi.fn(),
      deleteSessions: vi.fn(),
    },
    password: { hash: vi.fn() },
  };
  const dbBuilder = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: "acc-1" }])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  };
  return {
    ctx,
    db: dbBuilder,
    sessionMock: vi.fn(),
    headersMock: vi.fn(),
    revokeMock: vi.fn(),
    revalidateMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/server", () => ({
  auth: {
    $context: Promise.resolve(mocks.ctx),
    api: { revokeUserSessions: mocks.revokeMock },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getServerSession: mocks.sessionMock }));
vi.mock("next/headers", () => ({ headers: mocks.headersMock }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidateMock }));
vi.mock("@/lib/db/client", () => ({ db: mocks.db }));

import { regenerateTempPassword } from "./actions";

beforeEach(() => {
  mocks.ctx.internalAdapter.updateUser.mockReset();
  mocks.ctx.internalAdapter.deleteSessions.mockReset();
  mocks.ctx.password.hash.mockReset();
  mocks.ctx.password.hash.mockResolvedValue("hashed-pw");
  mocks.sessionMock.mockReset();
  mocks.headersMock.mockReset();
  mocks.revokeMock.mockReset();
  mocks.revalidateMock.mockReset();
  mocks.sessionMock.mockResolvedValue({
    user: { id: "admin-1", email: "a@b.c", role: "admin" },
  });
  mocks.headersMock.mockResolvedValue(new Headers());
});

describe("regenerateTempPassword", () => {
  it("refuses non-admin callers", async () => {
    mocks.sessionMock.mockResolvedValue({ user: { id: "u9", role: "user" } });
    const r = await regenerateTempPassword("target");
    expect(r.ok).toBe(false);
    expect(mocks.ctx.password.hash).not.toHaveBeenCalled();
  });

  it("refuses self-reset", async () => {
    const r = await regenerateTempPassword("admin-1");
    expect(r).toMatchObject({ ok: false, error: /your own password/i });
  });

  it("rotates the password, flags the user, and revokes sessions", async () => {
    mocks.revokeMock.mockResolvedValue({});
    const r = await regenerateTempPassword("target");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tempPassword).toMatch(/^[A-Z2-9]{16}$/);
    }
    expect(mocks.ctx.password.hash).toHaveBeenCalledWith(expect.stringMatching(/^[A-Z2-9]{16}$/));
    expect(mocks.ctx.internalAdapter.updateUser).toHaveBeenCalledWith("target", {
      mustChangePassword: true,
    });
    expect(mocks.revokeMock).toHaveBeenCalledWith({
      body: { userId: "target" },
      headers: expect.any(Headers),
    });
    expect(mocks.revalidateMock).toHaveBeenCalledWith("/admin/users");
  });

  it("falls back to internal deleteSessions when revokeUserSessions throws", async () => {
    mocks.revokeMock.mockRejectedValue(new Error("not available"));
    mocks.ctx.internalAdapter.deleteSessions.mockResolvedValue(undefined);
    const r = await regenerateTempPassword("target");
    expect(r.ok).toBe(true);
    expect(mocks.ctx.internalAdapter.deleteSessions).toHaveBeenCalledWith("target");
  });
});
