import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  revalidateMock: vi.fn(),
  createGroupMock: vi.fn(),
  deleteGroupMock: vi.fn(),
  setGroupConfigMock: vi.fn(),
  setDefaultGroupMock: vi.fn(),
  setUserGroupMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getServerSession: mocks.sessionMock }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidateMock }));
vi.mock("@/lib/settings/queries", () => ({
  createGroup: mocks.createGroupMock,
  deleteGroup: mocks.deleteGroupMock,
  setGroupConfig: mocks.setGroupConfigMock,
  setDefaultGroup: mocks.setDefaultGroupMock,
  setUserGroup: mocks.setUserGroupMock,
}));

import {
  createGroup,
  deleteGroup,
  moveUserToGroup,
  setDefaultGroup,
  setGroupConfig,
} from "./actions";

beforeEach(() => {
  for (const fn of Object.values(mocks)) (fn as ReturnType<typeof vi.fn>).mockReset();
  mocks.sessionMock.mockResolvedValue({
    user: { id: "admin-1", email: "a@b.c", role: "admin" },
  });
});

describe("createGroup", () => {
  it("rejects non-admin callers", async () => {
    mocks.sessionMock.mockResolvedValue({ user: { id: "u9", role: "user" } });
    expect(await createGroup({ name: "team-a" })).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.createGroupMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input via zod", async () => {
    expect(await createGroup({ name: "x" })).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.createGroupMock).not.toHaveBeenCalled();
  });

  it("creates a group and surfaces it", async () => {
    mocks.createGroupMock.mockResolvedValue({ id: "g2", name: "team-a" });
    const r = await createGroup({ name: "team-a", description: "the team" });
    expect(r).toMatchObject({ ok: true, group: { id: "g2" } });
    expect(mocks.createGroupMock).toHaveBeenCalledWith({
      name: "team-a",
      description: "the team",
      createdBy: "admin-1",
    });
    expect(mocks.revalidateMock).toHaveBeenCalledWith("/admin/groups");
  });

  it("surfaces a friendly error on unique-constraint failures", async () => {
    mocks.createGroupMock.mockRejectedValue(new Error("unique constraint violation"));
    expect(await createGroup({ name: "team-a" })).toMatchObject({
      ok: false,
      error: /already exists/i,
    });
  });
});

describe("deleteGroup", () => {
  it("refuses non-admin", async () => {
    mocks.sessionMock.mockResolvedValue(null);
    expect(await deleteGroup("g1")).toEqual({ ok: false, error: expect.any(String) });
  });

  it("reports missing groups", async () => {
    mocks.deleteGroupMock.mockResolvedValue({ deleted: false });
    expect(await deleteGroup("g404")).toEqual({
      ok: false,
      error: expect.stringMatching(/not found/i),
    });
  });

  it("propagates the default-group refusal", async () => {
    mocks.deleteGroupMock.mockRejectedValue(new Error("Cannot delete the default group"));
    expect(await deleteGroup("g1")).toMatchObject({ ok: false, error: /default group/i });
  });

  it("succeeds for a non-default group", async () => {
    mocks.deleteGroupMock.mockResolvedValue({ deleted: true });
    expect(await deleteGroup("g2")).toEqual({ ok: true });
    expect(mocks.revalidateMock).toHaveBeenCalledWith("/admin/groups");
  });
});

describe("setGroupConfig", () => {
  it("zod-validates the patch", async () => {
    const r = await setGroupConfig("g1", { sttProvider: "weird" });
    expect(r).toMatchObject({ ok: false, error: expect.any(String) });
    expect(mocks.setGroupConfigMock).not.toHaveBeenCalled();
  });

  it("rejects unknown fields (strict schema)", async () => {
    expect(await setGroupConfig("g1", { foo: "bar" })).toMatchObject({ ok: false });
  });

  it("applies a valid patch", async () => {
    mocks.setGroupConfigMock.mockResolvedValue({ id: "g1" });
    const r = await setGroupConfig("g1", {
      sttProvider: "groq",
      openaiApiKey: "sk-…",
      allowSummaryPromptOverride: false,
    });
    expect(r).toEqual({ ok: true });
    expect(mocks.setGroupConfigMock).toHaveBeenCalledWith("g1", {
      sttProvider: "groq",
      openaiApiKey: "sk-…",
      allowSummaryPromptOverride: false,
    });
  });
});

describe("setDefaultGroup", () => {
  it("flips the default flag", async () => {
    expect(await setDefaultGroup("g2")).toEqual({ ok: true });
    expect(mocks.setDefaultGroupMock).toHaveBeenCalledWith("g2");
  });
});

describe("moveUserToGroup", () => {
  it("moves the user and revalidates both admin views", async () => {
    expect(await moveUserToGroup("u2", "g2")).toEqual({ ok: true });
    expect(mocks.setUserGroupMock).toHaveBeenCalledWith("u2", "g2");
    expect(mocks.revalidateMock).toHaveBeenCalledWith("/admin/users");
    expect(mocks.revalidateMock).toHaveBeenCalledWith("/admin/groups");
  });

  it("accepts a null group (clears membership)", async () => {
    expect(await moveUserToGroup("u2", null)).toEqual({ ok: true });
    expect(mocks.setUserGroupMock).toHaveBeenCalledWith("u2", null);
  });
});
