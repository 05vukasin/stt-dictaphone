"use client";

import { FiLock } from "react-icons/fi";
import { useEffectiveSettings } from "@/lib/settings/client-context";
import { SettingsSection } from "./settings-section";

// Provider, summary provider, audio format, autoSummarize are admin-managed
// and shown here as read-only chips so the user knows what's in effect.
export function ProviderSection() {
  const effective = useEffectiveSettings();
  if (!effective) return null;

  return (
    <SettingsSection
      title="Provider & format"
      description={
        <span className="inline-flex items-center gap-1">
          <FiLock aria-hidden className="size-3" />
          Managed by your admin · group <strong>{effective.groupName}</strong>
        </span>
      }
    >
      <ReadOnlyRow label="STT provider" value={providerLabel(effective.sttProvider)} />
      <ReadOnlyRow label="Summary provider" value={summaryLabel(effective.summaryProvider)} />
      <ReadOnlyRow label="Audio format" value={effective.audioFormat.toUpperCase()} />
      <ReadOnlyRow
        label="Auto-summarize after transcription"
        value={effective.autoSummarize ? "On" : "Off"}
      />
    </SettingsSection>
  );
}

function providerLabel(p: string): string {
  if (p === "openai") return "OpenAI · whisper-1";
  if (p === "groq") return "Groq · whisper-large-v3";
  return p;
}
function summaryLabel(p: string): string {
  if (p === "openai") return "OpenAI · GPT-4o-mini";
  if (p === "anthropic") return "Anthropic · Claude Sonnet 4.5";
  if (p === "groq") return "Groq · Llama 3.3 70B";
  return p;
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px]">
      <span className="font-medium">{label}</span>
      <span className="text-[var(--muted)]">{value}</span>
    </div>
  );
}
