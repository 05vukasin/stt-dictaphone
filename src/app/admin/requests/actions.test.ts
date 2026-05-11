import { beforeEach, describe, expect, it, vi } from "vitest";

const { approveMock, rejectMock, sessionMock, headersMock, revalidateMock } = vi.hoisted(() => ({
  approveMock: vi.fn(),
  rejectMock: vi.fn(),
  sessionMock: vi.fn(),
  headersMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@/lib/access-requests/service", () => ({
  approveRequest: approveMock,
  rejectRequest: rejectMock,
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

import { approve, reject } from "./actions";

beforeEach(() => {
  sessionMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  headersMock.mockResolvedValue(new Headers({ cookie: "x" }));
  approveMock.mockReset();
  rejectMock.mockReset();
  revalidateMock.mockReset();
});

describe("admin/requests actions", () => {
  it("approve calls service with the admin id and request headers", async () => {
    approveMock.mockResolvedValue({ ok: true, email: "u@x.y", tempPassword: "abc" });
    const r = await approve("req-1");
    expect(r).toEqual({ ok: true, email: "u@x.y", tempPassword: "abc" });
    expect(approveMock).toHaveBeenCalledWith("req-1", "admin-1", expect.any(Headers));
    expect(revalidateMock).toHaveBeenCalledWith("/admin/requests");
  });

  it("approve refuses non-admin callers", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u9", role: "user" } });
    await expect(approve("req-1")).rejects.toThrow();
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("reject calls service with note", async () => {
    rejectMock.mockResolvedValue({ ok: true });
    const r = await reject("req-1", "spam");
    expect(r).toEqual({ ok: true });
    expect(rejectMock).toHaveBeenCalledWith("req-1", "admin-1", "spam");
  });

  it("does not revalidate on service failure", async () => {
    approveMock.mockResolvedValue({ ok: false, error: "boom" });
    await approve("req-1");
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});
