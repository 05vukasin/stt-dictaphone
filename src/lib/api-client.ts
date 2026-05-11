"use client";

// The client no longer chooses the provider or carries an API key — those
// live in the user's effective settings (admin-controlled, server-only). The
// browser just hands the audio blob over and optionally suggests a language
// or prompt override; the server is the source of truth.

export interface TranscribeOpts {
  audio: Blob;
  // Optional per-request overrides. The server will use these instead of the
  // user's saved override if provided, but the saved override is sufficient
  // for the normal flow.
  language?: string;
  prompt?: string;
}

export interface TranscribeResult {
  text: string;
  language?: string;
  durationSec?: number;
}

export async function callTranscribe(opts: TranscribeOpts): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("audio", opts.audio, "recording.webm");
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt);
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(extractError(body) || `Transcription failed (${res.status})`);
  }
  return (await res.json()) as TranscribeResult;
}

export interface SummarizeOpts {
  text: string;
  prompt?: string;
  model?: string;
}

export interface SummarizeResult {
  summary: string;
  model: string;
}

export async function callSummarize(opts: SummarizeOpts): Promise<SummarizeResult> {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: opts.text, prompt: opts.prompt, model: opts.model }),
  });
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(extractError(body) || `Summary failed (${res.status})`);
  }
  return (await res.json()) as SummarizeResult;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function extractError(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed.error === "string" ? parsed.error : null;
  } catch {
    return body || null;
  }
}
