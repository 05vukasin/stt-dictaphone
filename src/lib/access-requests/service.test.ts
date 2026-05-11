import { describe, expect, it, vi, beforeEach } from "vitest";

const { insertMock, markApprovedMock, markRejectedMock, revertMock, createUserMock } = vi.hoisted(
  () => ({
    insertMock: vi.fn(),
    markApprovedMock: vi.fn(),
    markRejectedMock: vi.fn(),
    revertMock: vi.fn(),
    createUserMock: vi.fn(),
  }),
);

vi.mock("./queries", () => ({
  insertRequest: insertMock,
  markApproved: markApprovedMock,
  markRejected: markRejectedMock,
  revertToPending: revertMock,
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { api: { createUser: createUserMock } },
}));

import { approveRequest, rejectRequest, submitRequest } from "./service";

beforeEach(() => {
  insertMock.mockReset();
  markApprovedMock.mockReset();
  markRejectedMock.mockReset();
  revertMock.mockReset();
  createUserMock.mockReset();
});

describe("submitRequest", () => {
  it("rejects invalid emails", async () => {
    const r = await submitRequest({ email: "not-an-email", reason: "" });
    expect(r).toEqual({ ok: false, error: expect.any(String) });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts a pending row for a valid email and returns ok", async () => {
    insertMock.mockResolvedValue({ id: "r1" });
    const r = await submitRequest({ email: "Hello@Example.COM", reason: "  please  " });
    expect(r).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "hello@example.com", status: "pending" }),
    );
  });

  it("treats a duplicate pending row as a silent ok", async () => {
    insertMock.mockResolvedValue(null);
    expect(await submitRequest({ email: "a@b.co" })).toEqual({ ok: true });
  });
});

describe("approveRequest", () => {
  const headers = new Headers();

  it("returns an error if the row was already decided", async () => {
    markApprovedMock.mockResolvedValue(null);
    const r = await approveRequest("r1", "admin1", headers);
    expect(r).toEqual({ ok: false, error: expect.any(String) });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("creates the user with a temp password and returns it", async () => {
    markApprovedMock.mockResolvedValue({ id: "r1", email: "u@x.y", status: "approved" });
    createUserMock.mockResolvedValue({});
    const r = await approveRequest("r1", "admin1", headers);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.email).toBe("u@x.y");
      expect(r.tempPassword).toMatch(/^[A-Z2-9]{16}$/);
    }
    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: "u@x.y", role: "user" }),
        headers,
      }),
    );
  });

  it("reverts the row when createUser fails", async () => {
    markApprovedMock.mockResolvedValue({ id: "r1", email: "u@x.y", status: "approved" });
    createUserMock.mockRejectedValue(new Error("boom"));
    const r = await approveRequest("r1", "admin1", headers);
    expect(r).toEqual({ ok: false, error: "boom" });
    expect(revertMock).toHaveBeenCalledWith("r1");
  });
});

describe("rejectRequest", () => {
  it("returns an error if no pending row matched", async () => {
    markRejectedMock.mockResolvedValue(null);
    expect(await rejectRequest("r1", "admin1", null)).toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it("returns ok when a pending row was rejected", async () => {
    markRejectedMock.mockResolvedValue({ id: "r1", status: "rejected" });
    expect(await rejectRequest("r1", "admin1", "spammer")).toEqual({ ok: true });
    expect(markRejectedMock).toHaveBeenCalledWith("r1", "admin1", "spammer");
  });
});
