import { z } from "zod";

export const SttProviderSchema = z.enum(["openai", "groq"]);
export const SummaryProviderSchema = z.enum(["openai", "anthropic", "groq"]);

export const AudioFormatSchema = z.enum(["webm", "wav"]);

export const DEFAULT_SUMMARY_PROMPT =
  "You are an assistant that turns voice transcripts into structured Markdown notes. Produce a concise note with: a one-line TL;DR, 3-7 key points as a bulleted list, and an Action Items section if any concrete tasks were mentioned. Keep it short and high-signal. Match the language of the transcript.";

export const DEFAULT_STT_PROMPT = "";

export const SettingsSchema = z.object({
  version: z.literal(1).default(1),

  // Providers
  sttProvider: SttProviderSchema.default("openai"),
  summaryProvider: SummaryProviderSchema.default("openai"),

  // API keys (held only in localStorage on the device)
  openaiApiKey: z.string().default(""),
  groqApiKey: z.string().default(""),
  anthropicApiKey: z.string().default(""),

  // Behavior
  language: z.string().default("auto"),
  autoSummarize: z.boolean().default(true),
  audioFormat: AudioFormatSchema.default("webm"),
  micDeviceId: z.string().default(""),

  // Prompts
  sttPrompt: z.string().default(DEFAULT_STT_PROMPT),
  summaryPrompt: z.string().default(DEFAULT_SUMMARY_PROMPT),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type SttProvider = z.infer<typeof SttProviderSchema>;
export type SummaryProvider = z.infer<typeof SummaryProviderSchema>;
export type AudioFormat = z.infer<typeof AudioFormatSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

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
