import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/providers")>("@/lib/providers");
  return {
    ...actual,
    getSttProvider: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/settings/effective", () => ({
  getEffectiveSettings: vi.fn(),
}));

import { POST } from "./route";
import { getSttProvider, ProviderError } from "@/lib/providers";
import { getServerSession } from "@/lib/auth/session";
import { getEffectiveSettings } from "@/lib/settings/effective";

const getSttProviderMock = vi.mocked(getSttProvider);
const getServerSessionMock = vi.mocked(getServerSession);
const getEffectiveSettingsMock = vi.mocked(getEffectiveSettings);

function makeReq(opts: {
  audio?: Blob | null;
  language?: string;
  prompt?: string;
  badForm?: boolean;
}): Request {
  const stubFormData = () => {
    if (opts.badForm) throw new TypeError("invalid form");
    const fd = new FormData();
    if (opts.audio) fd.append("audio", opts.audio, "rec.webm");
    if (opts.language) fd.append("language", opts.language);
    if (opts.prompt) fd.append("prompt", opts.prompt);
    return Promise.resolve(fd);
  };
  const req = new Request("http://x/api/transcribe", { method: "POST" });
  Object.defineProperty(req, "formData", { value: stubFormData });
  return req;
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
  summaryPrompt: "",
  allowSummaryPromptOverride: true,
};

beforeEach(() => {
  getSttProviderMock.mockReset();
  getServerSessionMock.mockResolvedValue({
    user: { id: "u1", email: "a@b.co", role: "user" },
  } as Awaited<ReturnType<typeof getServerSession>>);
  getEffectiveSettingsMock.mockResolvedValue({ ...defaultEffective });
});

describe("POST /api/transcribe", () => {
  it("401s when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null as Awaited<ReturnType<typeof getServerSession>>);
    const res = await POST(makeReq({ audio: new Blob(["x"]) }));
    expect(res.status).toBe(401);
  });

  it("503s when the admin has not configured an API key", async () => {
    getEffectiveSettingsMock.mockResolvedValue({ ...defaultEffective, openaiApiKey: "" });
    const res = await POST(makeReq({ audio: new Blob(["x"]) }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/no api key/i) });
  });

  it("400s on bad multipart body", async () => {
    const res = await POST(makeReq({ badForm: true }));
    expect(res.status).toBe(400);
  });

  it("400s on missing audio field", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("forwards to the resolved provider on success", async () => {
    const transcribe = vi.fn(async () => ({ text: "hello", language: "en" }));
    getSttProviderMock.mockReturnValue({ name: "openai", transcribe });
    const res = await POST(makeReq({ audio: new Blob(["x"]) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ text: "hello", language: "en" });
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-test", language: "auto" }),
    );
  });

  it("per-request language wins over the saved override", async () => {
    const transcribe = vi.fn(async () => ({ text: "" }));
    getSttProviderMock.mockReturnValue({ name: "openai", transcribe });
    getEffectiveSettingsMock.mockResolvedValue({ ...defaultEffective, language: "sr" });
    await POST(makeReq({ audio: new Blob(["x"]), language: "en" }));
    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ language: "en" }));
  });

  it("maps ProviderError to its status", async () => {
    getSttProviderMock.mockReturnValue({
      name: "openai",
      transcribe: vi.fn(async () => {
        throw new ProviderError("openai", 429, "Too many requests");
      }),
    });
    const res = await POST(makeReq({ audio: new Blob(["x"]) }));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "Too many requests" });
  });
});
