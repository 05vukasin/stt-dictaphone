import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/providers")>("@/lib/providers");
  return {
    ...actual,
    getSummaryProvider: vi.fn(),
  };
});

import { POST } from "./route";
import { getSummaryProvider, ProviderError } from "@/lib/providers";

const getSummaryProviderMock = vi.mocked(getSummaryProvider);

beforeEach(() => {
  getSummaryProviderMock.mockReset();
});

function makeJsonReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://x/api/summarize", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/summarize", () => {
  it("400s when api key missing", async () => {
    const res = await POST(makeJsonReq({ text: "x", prompt: "y" }));
    expect(res.status).toBe(400);
  });

  it("400s when text/prompt missing", async () => {
    const res = await POST(makeJsonReq({}, { "x-api-key": "sk" }));
    expect(res.status).toBe(400);
  });

  it("400s on unknown provider", async () => {
    const res = await POST(
      makeJsonReq({ text: "x", prompt: "y" }, { "x-api-key": "sk", "x-summary-provider": "weird" }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards to provider", async () => {
    getSummaryProviderMock.mockReturnValue({
      name: "openai",
      summarize: vi.fn(async () => ({ summary: "S", model: "gpt-4o-mini" })),
    });
    const res = await POST(makeJsonReq({ text: "x", prompt: "y" }, { "x-api-key": "sk" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ summary: "S" });
  });

  it("maps ProviderError to status", async () => {
    getSummaryProviderMock.mockReturnValue({
      name: "openai",
      summarize: vi.fn(async () => {
        throw new ProviderError("openai", 401, "bad key");
      }),
    });
    const res = await POST(makeJsonReq({ text: "x", prompt: "y" }, { "x-api-key": "sk" }));
    expect(res.status).toBe(401);
  });
});
