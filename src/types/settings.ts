import { z } from "zod";

export const SttProviderSchema = z.enum(["openai", "groq"]);
export const SummaryProviderSchema = z.enum(["openai", "anthropic", "groq"]);

export const AudioFormatSchema = z.enum(["webm", "wav"]);

export const DEFAULT_SUMMARY_PROMPT =
  "You are an assistant that turns voice transcripts into structured Markdown notes. Produce a concise note with: a one-line TL;DR, 3-7 key points as a bulleted list, and an Action Items section if any concrete tasks were mentioned. Keep it short and high-signal. Match the language of the transcript.";

export const DEFAULT_STT_PROMPT = "";

// Device-local user settings. The admin tier (providers, API keys, prompts,
// language default, autoSummarize, audioFormat) moved to Postgres and is
// resolved server-side via `getEffectiveSettings`; the only thing that
// stays on the device is the per-browser microphone choice.
export const DeviceSettingsSchema = z.object({
  version: z.literal(2).default(2),
  micDeviceId: z.string().default(""),
});

export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;
export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = DeviceSettingsSchema.parse({});

export type SttProvider = z.infer<typeof SttProviderSchema>;
export type SummaryProvider = z.infer<typeof SummaryProviderSchema>;
export type AudioFormat = z.infer<typeof AudioFormatSchema>;

export const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "sr", label: "Serbian" },
  { code: "hr", label: "Croatian" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
];
