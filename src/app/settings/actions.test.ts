import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, revalidateMock, setOverridesMock, effectiveMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  revalidateMock: vi.fn(),
  setOverridesMock: vi.fn(),
  effectiveMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getServerSession: sessionMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/settings/queries", () => ({ setUserOverrides: setOverridesMock }));
vi.mock("@/lib/settings/effective", () => ({ getEffectiveSettings: effectiveMock }));

import { setLanguageOverride, setSummaryPromptOverride } from "./actions";

beforeEach(() => {
  sessionMock.mockReset();
  revalidateMock.mockReset();
  setOverridesMock.mockReset();
  effectiveMock.mockReset();
  sessionMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c", role: "user" } });
});

describe("setLanguageOverride", () => {
  it("refuses unauthenticated callers", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await setLanguageOverride("sr")).toEqual({ ok: false, error: expect.any(String) });
    expect(setOverridesMock).not.toHaveBeenCalled();
  });

  it("writes a valid override", async () => {
    expect(await setLanguageOverride("sr")).toEqual({ ok: true });
    expect(setOverridesMock).toHaveBeenCalledWith("u1", { languageOverride: "sr" });
  });

  it("clears the override when null is passed", async () => {
    expect(await setLanguageOverride(null)).toEqual({ ok: true });
    expect(setOverridesMock).toHaveBeenCalledWith("u1", { languageOverride: null });
  });
});

describe("setSummaryPromptOverride", () => {
  it("refuses unauthenticated callers", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await setSummaryPromptOverride("hi")).toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it("rejects when the group locks the prompt", async () => {
    effectiveMock.mockResolvedValue({ allowSummaryPromptOverride: false });
    const r = await setSummaryPromptOverride("hi");
    expect(r).toMatchObject({ ok: false, error: /locked/i });
    expect(setOverridesMock).not.toHaveBeenCalled();
  });

  it("writes the override when allowed", async () => {
    effectiveMock.mockResolvedValue({ allowSummaryPromptOverride: true });
    expect(await setSummaryPromptOverride("hi")).toEqual({ ok: true });
    expect(setOverridesMock).toHaveBeenCalledWith("u1", { summaryPromptOverride: "hi" });
  });
});
