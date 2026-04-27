import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/providers")>("@/lib/providers");
  return {
    ...actual,
    getSttProvider: vi.fn(),
  };
});

import { POST } from "./route";
import { getSttProvider, ProviderError } from "@/lib/providers";

const getSttProviderMock = vi.mocked(getSttProvider);

beforeEach(() => {
  getSttProviderMock.mockReset();
});

function makeReq(opts: {
  apiKey?: string;
  provider?: string;
  audio?: Blob | null;
  language?: string;
  prompt?: string;
  asJson?: boolean;
  badForm?: boolean;
}): Request {
  const headers = new Headers();
  if (opts.apiKey !== undefined) headers.set("x-api-key", opts.apiKey);
  if (opts.provider) headers.set("x-stt-provider", opts.provider);

  // We bypass the actual Request body parsing (jsdom has flaky FormData support)
  // by attaching a stub formData() method that returns whatever the test specifies.
  const stubFormData = () => {
    if (opts.badForm) throw new TypeError("invalid form");
    const fd = new FormData();
    if (opts.audio) fd.append("audio", opts.audio, "rec.webm");
    if (opts.language) fd.append("language", opts.language);
    if (opts.prompt) fd.append("prompt", opts.prompt);
    return Promise.resolve(fd);
  };

  const req = new Request("http://x/api/transcribe", { method: "POST", headers });
  Object.defineProperty(req, "formData", { value: stubFormData });
  return req;
}

describe("POST /api/transcribe", () => {
  it("400s when api key missing", async () => {
    const res = await POST(makeReq({ audio: new Blob(["x"]) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/api key/i) });
  });

  it("400s on unknown provider", async () => {
    const res = await POST(makeReq({ apiKey: "sk", provider: "weird", audio: new Blob(["x"]) }));
    expect(res.status).toBe(400);
  });

  it("400s on bad body", async () => {
    const res = await POST(makeReq({ apiKey: "sk", badForm: true }));
    expect(res.status).toBe(400);
  });

  it("400s on missing audio field", async () => {
    const res = await POST(makeReq({ apiKey: "sk" }));
    expect(res.status).toBe(400);
  });

  it("forwards to provider on success", async () => {
    getSttProviderMock.mockReturnValue({
      name: "openai",
      transcribe: vi.fn(async () => ({ text: "hello", language: "en" })),
    });
    const res = await POST(
      makeReq({ apiKey: "sk", audio: new Blob(["x"]), language: "en", prompt: "hint" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ text: "hello", language: "en" });
  });

  it("maps ProviderError to its status", async () => {
    getSttProviderMock.mockReturnValue({
      name: "openai",
      transcribe: vi.fn(async () => {
        throw new ProviderError("openai", 429, "Too many requests");
      }),
    });
    const res = await POST(makeReq({ apiKey: "sk", audio: new Blob(["x"]) }));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "Too many requests" });
  });
});
