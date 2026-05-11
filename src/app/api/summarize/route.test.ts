import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/providers")>("@/lib/providers");
  return {
    ...actual,
    getSummaryProvider: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/settings/effective", () => ({
  getEffectiveSettings: vi.fn(),
}));

import { POST } from "./route";
import { getSummaryProvider, ProviderError } from "@/lib/providers";
import { getServerSession } from "@/lib/auth/session";
import { getEffectiveSettings } from "@/lib/settings/effective";

const getSummaryProviderMock = vi.mocked(getSummaryProvider);
const getServerSessionMock = vi.mocked(getServerSession);
const getEffectiveSettingsMock = vi.mocked(getEffectiveSettings);

function makeJsonReq(body: unknown) {
  return new Request("http://x/api/summarize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const defaultEffective = {
  groupId: "g1",
  groupName: "default",
  sttProvider: "openai" as const,
  summaryProvider: "openai" as const,
  openaiApiKey: "sk-test",
  groqApiKey: "",
  anthropicApiKey: "",
  language: "auto",
  autoSummarize: true,
  audioFormat: "webm" as const,
  sttPrompt: "",
  summaryPrompt: "DEFAULT_PROMPT",
  allowSummaryPromptOverride: true,
};

beforeEach(() => {
  getSummaryProviderMock.mockReset();
  getServerSessionMock.mockResolvedValue({
    user: { id: "u1", email: "a@b.co", role: "user" },
  } as Awaited<ReturnType<typeof getServerSession>>);
  getEffectiveSettingsMock.mockResolvedValue({ ...defaultEffective });
});

describe("POST /api/summarize", () => {
  it("401s when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null as Awaited<ReturnType<typeof getServerSession>>);
    const res = await POST(makeJsonReq({ text: "x" }));
    expect(res.status).toBe(401);
  });

  it("503s when no API key is configured for the summary provider", async () => {
    getEffectiveSettingsMock.mockResolvedValue({
      ...defaultEffective,
      summaryProvider: "anthropic",
      anthropicApiKey: "",
    });
    const res = await POST(makeJsonReq({ text: "x" }));
    expect(res.status).toBe(503);
  });

  it("400s when text is missing", async () => {
    const res = await POST(makeJsonReq({}));
    expect(res.status).toBe(400);
  });

  it("uses the resolved summary prompt by default", async () => {
    const summarize = vi.fn(async () => ({ summary: "S", model: "gpt-4o-mini" }));
    getSummaryProviderMock.mockReturnValue({ name: "openai", summarize });
    await POST(makeJsonReq({ text: "hi" }));
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "DEFAULT_PROMPT", apiKey: "sk-test" }),
    );
  });

  it("a per-request prompt wins over the resolved prompt", async () => {
    const summarize = vi.fn(async () => ({ summary: "S", model: "gpt-4o-mini" }));
    getSummaryProviderMock.mockReturnValue({ name: "openai", summarize });
    await POST(makeJsonReq({ text: "hi", prompt: "PER_REQUEST" }));
    expect(summarize).toHaveBeenCalledWith(expect.objectContaining({ prompt: "PER_REQUEST" }));
  });

  it("maps ProviderError to status", async () => {
    getSummaryProviderMock.mockReturnValue({
      name: "openai",
      summarize: vi.fn(async () => {
        throw new ProviderError("openai", 401, "bad key");
      }),
    });
    const res = await POST(makeJsonReq({ text: "x" }));
    expect(res.status).toBe(401);
  });
});
