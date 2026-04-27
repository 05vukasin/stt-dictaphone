import type { SttProvider, SummaryProvider } from "@/types/settings";
import { openaiStt, openaiSummary } from "./openai";
import { groqStt, groqSummary } from "./groq";
import { anthropicSummary } from "./anthropic";
import type { SttProviderImpl, SummaryProviderImpl } from "./types";

export const STT_PROVIDERS: Record<SttProvider, SttProviderImpl> = {
  openai: openaiStt,
  groq: groqStt,
};

export const SUMMARY_PROVIDERS: Record<SummaryProvider, SummaryProviderImpl> = {
  openai: openaiSummary,
  groq: groqSummary,
  anthropic: anthropicSummary,
};

export function getSttProvider(name: SttProvider): SttProviderImpl {
  const p = STT_PROVIDERS[name];
  if (!p) throw new Error(`Unknown STT provider: ${name}`);
  return p;
}

export function getSummaryProvider(name: SummaryProvider): SummaryProviderImpl {
  const p = SUMMARY_PROVIDERS[name];
  if (!p) throw new Error(`Unknown summary provider: ${name}`);
  return p;
}

export { ProviderError } from "./types";
export type {
  SttRequest,
  SttResponse,
  SummaryRequest,
  SummaryResponse,
  SttProviderImpl,
  SummaryProviderImpl,
} from "./types";
