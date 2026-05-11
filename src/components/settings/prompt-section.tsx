"use client";

import { useState, useTransition } from "react";
import { FiLock } from "react-icons/fi";
import { setSummaryPromptOverride } from "@/app/settings/actions";
import { useEffectiveSettings } from "@/lib/settings/client-context";
import { toast } from "@/lib/use-toast";
import { SettingRow, SettingsSection } from "./settings-section";

export function PromptSection() {
  const effective = useEffectiveSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!effective) return null;

  const current = draft ?? effective.summaryPrompt;
  const allowed = effective.allowSummaryPromptOverride;
  const dirty = draft !== null && draft !== effective.summaryPrompt;

  function save() {
    if (draft === null) return;
    start(async () => {
      const r = await setSummaryPromptOverride(draft);
      if (r.ok) {
        toast.success("Summary prompt updated");
        setDraft(null);
      } else {
        toast.error("Couldn't save", r.error);
      }
    });
  }

  function clearOverride() {
    start(async () => {
      const r = await setSummaryPromptOverride(null);
      if (r.ok) {
        toast.success("Reverted to your group's default");
        setDraft(null);
      } else {
        toast.error("Couldn't revert", r.error);
      }
    });
  }

  return (
    <SettingsSection
      title="Summary prompt"
      description={
        allowed ? (
          "Sent as the system message before the transcript. Stored only for you."
        ) : (
          <span className="inline-flex items-center gap-1">
            <FiLock aria-hidden className="size-3" />
            Locked by your admin · group <strong>{effective.groupName}</strong>
          </span>
        )
      }
    >
      <SettingRow label="Prompt">
        <textarea
          value={current}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          disabled={!allowed || pending}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[12px] leading-relaxed outline-none resize-y focus:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        {allowed ? (
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || pending}
              className="rounded-lg bg-[var(--fg)] px-3 py-1 text-[11px] font-semibold text-[var(--bg)] transition-opacity disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save override"}
            </button>
            <button
              type="button"
              onClick={clearOverride}
              disabled={pending}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-[11px] font-medium hover:bg-[var(--surface)] disabled:opacity-40"
            >
              Reset to admin default
            </button>
          </div>
        ) : null}
      </SettingRow>
    </SettingsSection>
  );
}
