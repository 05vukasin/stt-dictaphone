import {
  ProviderError,
  type SummaryProviderImpl,
  type SummaryRequest,
  type SummaryResponse,
} from "./types";

const URL = "https://api.anthropic.com/v1/messages";
const SUMMARY_MODEL = "claude-sonnet-4-5";

export const anthropicSummary: SummaryProviderImpl = {
  name: "anthropic",
  async summarize(req: SummaryRequest): Promise<SummaryResponse> {
    const model = req.model ?? SUMMARY_MODEL;
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: req.prompt,
        messages: [{ role: "user", content: req.text }],
      }),
    });
    if (!res.ok) {
      const body = await safeText(res);
      throw new ProviderError("anthropic", res.status, body || res.statusText);
    }
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const summary =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim() ?? "";
    return { summary, model };
  },
};

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
