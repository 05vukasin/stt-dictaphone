import type { SttProvider, SummaryProvider } from "@/types/settings";

export interface SttRequest {
  audio: Blob;
  apiKey: string;
  language?: string;
  prompt?: string;
}

export interface SttResponse {
  text: string;
  language?: string;
  durationSec?: number;
}

export interface SummaryRequest {
  text: string;
  apiKey: string;
  prompt: string;
  model?: string;
}

export interface SummaryResponse {
  summary: string;
  model: string;
}

export interface SttProviderImpl {
  name: SttProvider;
  transcribe(req: SttRequest): Promise<SttResponse>;
}

export interface SummaryProviderImpl {
  name: SummaryProvider;
  summarize(req: SummaryRequest): Promise<SummaryResponse>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
