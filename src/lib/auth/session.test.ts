import { describe, expect, it, vi } from "vitest";

const { headersMock, getSessionMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("./server", () => ({
  auth: { api: { getSession: getSessionMock } },
}));

import { getServerSession } from "./session";

describe("auth/session", () => {
  it("forwards the awaited request headers to auth.api.getSession", async () => {
    const h = new Headers({ cookie: "foo=bar" });
    headersMock.mockResolvedValue(h);
    getSessionMock.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } });

    const result = await getServerSession();

    expect(headersMock).toHaveBeenCalledOnce();
    expect(getSessionMock).toHaveBeenCalledWith({ headers: h });
    expect(result).toEqual({ user: { id: "u1" }, session: { id: "s1" } });
  });

  it("returns null when there is no active session", async () => {
    headersMock.mockResolvedValue(new Headers());
    getSessionMock.mockResolvedValue(null);
    expect(await getServerSession()).toBeNull();
  });
});
