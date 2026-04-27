"use client";

import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { patchSettings, useSettings } from "@/lib/storage/settings-store";
import { LANGUAGES } from "@/types/settings";
import { SettingRow, SettingsSection } from "./settings-section";

export function ProviderSection() {
  const settings = useSettings();
  return (
    <>
      <SettingsSection
        title="Speech-to-Text"
        description="Whisper is used for transcription. Pick the provider hosting your key."
      >
        <SettingRow label="Provider">
          <select
            value={settings.sttProvider}
            onChange={(e) =>
              patchSettings({ sttProvider: e.target.value as typeof settings.sttProvider })
            }
            className={selectCx}
          >
            <option value="openai">OpenAI · whisper-1</option>
            <option value="groq">Groq · whisper-large-v3</option>
          </select>
        </SettingRow>

        <SettingRow label="Language hint" hint="Auto-detect works for most users.">
          <select
            value={settings.language}
            onChange={(e) => patchSettings({ language: e.target.value })}
            className={selectCx}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Summary"
        description="Generates a structured note from the transcript."
      >
        <SettingRow label="Provider">
          <select
            value={settings.summaryProvider}
            onChange={(e) =>
              patchSettings({
                summaryProvider: e.target.value as typeof settings.summaryProvider,
              })
            }
            className={selectCx}
          >
            <option value="openai">OpenAI · GPT-4o-mini</option>
            <option value="anthropic">Anthropic · Claude Sonnet 4.5</option>
            <option value="groq">Groq · Llama 3.3 70B</option>
          </select>
        </SettingRow>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px]">
          <span className="font-medium">Auto-summarize after transcription</span>
          <input
            type="checkbox"
            className="size-4 accent-[var(--fg)]"
            checked={settings.autoSummarize}
            onChange={(e) => patchSettings({ autoSummarize: e.target.checked })}
          />
        </label>
      </SettingsSection>

      <SettingsSection
        title="API Keys"
        description="Stored only in this browser. Sent per request to the provider via the local API route."
      >
        <ApiKeyInput
          label="OpenAI"
          value={settings.openaiApiKey}
          onChange={(v) => patchSettings({ openaiApiKey: v })}
          placeholder="sk-..."
        />
        <ApiKeyInput
          label="Groq"
          value={settings.groqApiKey}
          onChange={(v) => patchSettings({ groqApiKey: v })}
          placeholder="gsk_..."
        />
        <ApiKeyInput
          label="Anthropic"
          value={settings.anthropicApiKey}
          onChange={(v) => patchSettings({ anthropicApiKey: v })}
          placeholder="sk-ant-..."
        />
      </SettingsSection>
    </>
  );
}

function ApiKeyInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <SettingRow label={label}>
      <div className="flex items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--border-strong)]"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
          aria-label={show ? "Hide key" : "Show key"}
        >
          {show ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
        </button>
      </div>
    </SettingRow>
  );
}

const selectCx =
  "rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] outline-none focus:border-[var(--border-strong)]";
