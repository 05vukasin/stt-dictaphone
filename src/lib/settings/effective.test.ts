import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDefault, getById, getProfile, setGroup } = vi.hoisted(() => ({
  getDefault: vi.fn(),
  getById: vi.fn(),
  getProfile: vi.fn(),
  setGroup: vi.fn(),
}));

vi.mock("./queries", () => ({
  getDefaultGroup: getDefault,
  getGroupById: getById,
  getUserProfile: getProfile,
  setUserGroup: setGroup,
}));

import { ensureUserProfile, getEffectiveSettings, getPublicEffectiveSettings } from "./effective";

const baseGroup = {
  id: "g1",
  name: "default",
  description: "",
  isDefault: true,
  sttProvider: "openai",
  summaryProvider: "openai",
  openaiApiKey: "sk-secret",
  groqApiKey: "",
  anthropicApiKey: "",
  language: "auto",
  autoSummarize: true,
  audioFormat: "webm",
  sttPrompt: "",
  summaryPrompt: "GROUP_PROMPT",
  allowSummaryPromptOverride: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: null,
};

beforeEach(() => {
  getDefault.mockReset();
  getById.mockReset();
  getProfile.mockReset();
  setGroup.mockReset();
});

describe("getEffectiveSettings", () => {
  it("returns the user's group with override fields applied", async () => {
    getProfile.mockResolvedValue({
      userId: "u1",
      groupId: "g1",
      languageOverride: "sr",
      summaryPromptOverride: "USER_PROMPT",
      updatedAt: new Date(0),
    });
    getById.mockResolvedValue(baseGroup);

    const r = await getEffectiveSettings("u1");
    expect(r.language).toBe("sr");
    expect(r.summaryPrompt).toBe("USER_PROMPT");
    expect(r.openaiApiKey).toBe("sk-secret");
  });

  it("falls back to the group's default when the user override is null", async () => {
    getProfile.mockResolvedValue({
      userId: "u1",
      groupId: "g1",
      languageOverride: null,
      summaryPromptOverride: null,
      updatedAt: new Date(0),
    });
    getById.mockResolvedValue(baseGroup);

    const r = await getEffectiveSettings("u1");
    expect(r.language).toBe("auto");
    expect(r.summaryPrompt).toBe("GROUP_PROMPT");
  });

  it("ignores summary override when allowSummaryPromptOverride is false", async () => {
    getProfile.mockResolvedValue({
      userId: "u1",
      groupId: "g1",
      languageOverride: null,
      summaryPromptOverride: "USER_PROMPT",
      updatedAt: new Date(0),
    });
    getById.mockResolvedValue({ ...baseGroup, allowSummaryPromptOverride: false });

    const r = await getEffectiveSettings("u1");
    expect(r.summaryPrompt).toBe("GROUP_PROMPT");
    expect(r.allowSummaryPromptOverride).toBe(false);
  });

  it("falls back to the default group when the user's group is missing", async () => {
    getProfile.mockResolvedValue({
      userId: "u1",
      groupId: "deleted-id",
      languageOverride: null,
      summaryPromptOverride: null,
      updatedAt: new Date(0),
    });
    getById.mockResolvedValue(null);
    getDefault.mockResolvedValue({ ...baseGroup, id: "g-default" });

    const r = await getEffectiveSettings("u1");
    expect(r.groupId).toBe("g-default");
    expect(setGroup).toHaveBeenCalledWith("u1", "g-default");
  });

  it("creates a profile pointing at the default group when none exists", async () => {
    getProfile.mockResolvedValue(null);
    getDefault.mockResolvedValue(baseGroup);

    const r = await getEffectiveSettings("u1");
    expect(r.groupId).toBe("g1");
    expect(setGroup).toHaveBeenCalledWith("u1", "g1");
  });

  it("throws if no default group has been seeded", async () => {
    getProfile.mockResolvedValue(null);
    getDefault.mockResolvedValue(null);
    await expect(getEffectiveSettings("u1")).rejects.toThrow(/default group/i);
  });
});

describe("getPublicEffectiveSettings", () => {
  it("drops every *ApiKey field", async () => {
    getProfile.mockResolvedValue({
      userId: "u1",
      groupId: "g1",
      languageOverride: null,
      summaryPromptOverride: null,
      updatedAt: new Date(0),
    });
    getById.mockResolvedValue({ ...baseGroup, groqApiKey: "gsk", anthropicApiKey: "sk-ant" });

    const r = (await getPublicEffectiveSettings("u1")) as Record<string, unknown>;
    expect(r.openaiApiKey).toBeUndefined();
    expect(r.groqApiKey).toBeUndefined();
    expect(r.anthropicApiKey).toBeUndefined();
    expect(r.sttProvider).toBe("openai");
  });
});

describe("ensureUserProfile", () => {
  it("does nothing if the user already has a profile", async () => {
    getProfile.mockResolvedValue({ userId: "u1", groupId: "g1" });
    await ensureUserProfile("u1");
    expect(setGroup).not.toHaveBeenCalled();
  });

  it("attaches the user to the default group when no profile exists", async () => {
    getProfile.mockResolvedValue(null);
    getDefault.mockResolvedValue(baseGroup);
    await ensureUserProfile("u1");
    expect(setGroup).toHaveBeenCalledWith("u1", "g1");
  });

  it("attaches with a null group if no default exists yet", async () => {
    getProfile.mockResolvedValue(null);
    getDefault.mockResolvedValue(null);
    await ensureUserProfile("u1");
    expect(setGroup).toHaveBeenCalledWith("u1", null);
  });
});
