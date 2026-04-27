import {
  ProviderError,
  type SttProviderImpl,
  type SttRequest,
  type SttResponse,
  type SummaryProviderImpl,
  type SummaryRequest,
  type SummaryResponse,
} from "./types";

const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

const STT_MODEL = "whisper-1";
const SUMMARY_MODEL = "gpt-4o-mini";

export const openaiStt: SttProviderImpl = {
  name: "openai",
  async transcribe(req: SttRequest): Promise<SttResponse> {
    const form = new FormData();
    form.append("file", req.audio, "recording.webm");
    form.append("model", STT_MODEL);
    form.append("response_format", "verbose_json");
    if (req.language && req.language !== "auto") form.append("language", req.language);
    if (req.prompt) form.append("prompt", req.prompt);

    const res = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${req.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await safeText(res);
      throw new ProviderError("openai", res.status, body || res.statusText);
    }
    const data = (await res.json()) as { text: string; language?: string; duration?: number };
    return { text: data.text, language: data.language, durationSec: data.duration };
  },
};

export const openaiSummary: SummaryProviderImpl = {
  name: "openai",
  async summarize(req: SummaryRequest): Promise<SummaryResponse> {
    const model = req.model ?? SUMMARY_MODEL;
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: req.prompt },
          { role: "user", content: req.text },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const body = await safeText(res);
      throw new ProviderError("openai", res.status, body || res.statusText);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const summary = data.choices?.[0]?.message?.content?.trim() ?? "";
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
