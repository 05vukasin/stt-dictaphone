import { describe, it, expect, vi, beforeEach } from "vitest";
import { openaiStt, openaiSummary } from "./openai";
import { ProviderError } from "./types";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("openaiStt.transcribe", () => {
  it("posts multipart form to whisper endpoint and parses response", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "hello world", language: "en", duration: 1.5 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await openaiStt.transcribe({
      audio: new Blob(["x"], { type: "audio/webm" }),
      apiKey: "sk-test",
      language: "en",
      prompt: "names: Vukasin",
    });
    expect(out.text).toBe("hello world");
    expect(out.language).toBe("en");
    expect(out.durationSec).toBe(1.5);
    expect(fetchMock).toHaveBeenCalledOnce();
    const args = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const init = args[1];
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("omits language when set to 'auto'", async () => {
    let bodyForm: FormData | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodyForm = init.body as FormData;
        return new Response(JSON.stringify({ text: "" }), { status: 200 });
      }),
    );
    await openaiStt.transcribe({
      audio: new Blob(["x"], { type: "audio/webm" }),
      apiKey: "sk-test",
      language: "auto",
    });
    expect(bodyForm!.get("language")).toBeNull();
  });

  it("throws ProviderError on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad key", { status: 401 })),
    );
    await expect(
      openaiStt.transcribe({
        audio: new Blob(["x"]),
        apiKey: "bad",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("openaiSummary.summarize", () => {
  it("posts to chat endpoint and extracts content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: "TL;DR: hi" } }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const out = await openaiSummary.summarize({
      text: "hello",
      apiKey: "sk-test",
      prompt: "summarize this",
    });
    expect(out.summary).toBe("TL;DR: hi");
    expect(out.model).toBe("gpt-4o-mini");
  });

  it("throws ProviderError on rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("slow down", { status: 429 })),
    );
    await expect(
      openaiSummary.summarize({ text: "x", apiKey: "sk", prompt: "y" }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
