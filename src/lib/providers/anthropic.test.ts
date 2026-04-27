import { describe, it, expect, vi, beforeEach } from "vitest";
import { anthropicSummary } from "./anthropic";
import { ProviderError } from "./types";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("anthropicSummary.summarize", () => {
  it("posts to claude messages endpoint and joins text blocks", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: [
              { type: "text", text: "Part A. " },
              { type: "text", text: "Part B." },
              { type: "tool_use" },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await anthropicSummary.summarize({
      text: "transcript",
      apiKey: "sk-ant-test",
      prompt: "summarize this",
    });
    expect(out.summary).toBe("Part A. Part B.");
    expect(out.model).toBe("claude-sonnet-4-5");
    const args = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(args[0]).toBe("https://api.anthropic.com/v1/messages");
    const headers = args[1].headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("throws ProviderError on 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad", { status: 400 })),
    );
    await expect(
      anthropicSummary.summarize({ text: "x", apiKey: "k", prompt: "y" }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
