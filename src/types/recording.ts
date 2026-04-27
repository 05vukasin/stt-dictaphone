export type RecordingId = string;

export interface RecordingBlob {
  id: RecordingId;
  blob: Blob;
  mime: string;
  createdAt: number;
}

export type TranscriptStatus = "idle" | "queued" | "transcribing" | "done" | "error";
export type SummaryStatus = "idle" | "queued" | "summarizing" | "done" | "error";

export interface Transcript {
  id: RecordingId;
  title: string;
  text: string;
  language?: string;
  durationMs: number;
  sizeBytes: number;
  mime: string;
  createdAt: number;
  status: TranscriptStatus;
  errorMessage?: string;
  summary?: string;
  summaryStatus: SummaryStatus;
  summaryError?: string;
}
