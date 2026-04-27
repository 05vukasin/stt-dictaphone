import { describe, it, expect, vi, beforeEach } from "vitest";
import { groqStt, groqSummary } from "./groq";
import { ProviderError } from "./types";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("groqStt.transcribe", () => {
  it("hits the groq endpoint and parses response", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ text: "hi", language: "en" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await groqStt.transcribe({
      audio: new Blob(["x"], { type: "audio/webm" }),
      apiKey: "gsk-test",
    });
    expect(out.text).toBe("hi");
    const args = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(args[0]).toContain("groq.com");
  });

  it("throws ProviderError on 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("oops", { status: 503 })),
    );
    await expect(
      groqStt.transcribe({ audio: new Blob(["x"]), apiKey: "gsk-test" }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("groqSummary.summarize", () => {
  it("returns summary text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: "S" } }] }), {
            status: 200,
          }),
      ),
    );
    const out = await groqSummary.summarize({
      text: "x",
      apiKey: "gsk",
      prompt: "y",
    });
    expect(out.summary).toBe("S");
    expect(out.model).toBe("llama-3.3-70b-versatile");
  });
});
