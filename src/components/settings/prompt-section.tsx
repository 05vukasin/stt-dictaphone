"use client";

import { patchSettings, useSettings } from "@/lib/storage/settings-store";
import { DEFAULT_STT_PROMPT, DEFAULT_SUMMARY_PROMPT } from "@/types/settings";
import { SettingRow, SettingsSection } from "./settings-section";

export function PromptSection() {
  const s = useSettings();
  return (
    <SettingsSection
      title="Prompts"
      description="Customize how Whisper hears proper nouns and how the summary is structured."
    >
      <SettingRow
        label="STT prompt"
        hint="Optional. Helps Whisper transcribe names, jargon, or initialisms correctly."
      >
        <textarea
          value={s.sttPrompt}
          onChange={(e) => patchSettings({ sttPrompt: e.target.value })}
          rows={3}
          placeholder={DEFAULT_STT_PROMPT || "e.g. Names: Vukasin, Pejovic"}
          className={textareaCx}
        />
      </SettingRow>

      <SettingRow label="Summary prompt" hint="Sent as the system message before the transcript.">
        <textarea
          value={s.summaryPrompt}
          onChange={(e) => patchSettings({ summaryPrompt: e.target.value })}
          rows={6}
          className={textareaCx}
        />
        <button
          type="button"
          onClick={() => patchSettings({ summaryPrompt: DEFAULT_SUMMARY_PROMPT })}
          className="mt-1 self-start text-[11px] text-[var(--muted)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
        >
          Reset to default
        </button>
      </SettingRow>
    </SettingsSection>
  );
}

const textareaCx =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[12px] leading-relaxed outline-none resize-y focus:border-[var(--border-strong)]";
