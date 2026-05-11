"use client";

import { useTransition } from "react";
import { setLanguageOverride } from "@/app/settings/actions";
import { useEffectiveSettings } from "@/lib/settings/client-context";
import { LANGUAGES } from "@/types/settings";
import { toast } from "@/lib/use-toast";
import { SettingRow, SettingsSection } from "./settings-section";

export function LanguageSection() {
  const effective = useEffectiveSettings();
  const [pending, start] = useTransition();
  if (!effective) return null;

  function onChange(next: string) {
    start(async () => {
      const r = await setLanguageOverride(next);
      if (r.ok) {
        toast.success("Language updated");
      } else {
        toast.error("Couldn't save", r.error);
      }
    });
  }

  return (
    <SettingsSection
      title="Language hint"
      description="Auto-detect works for most users. Your choice sticks across sessions."
    >
      <SettingRow label="Language">
        <select
          value={effective.language}
          onChange={(e) => onChange(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] outline-none focus:border-[var(--border-strong)] disabled:opacity-60"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </SettingRow>
    </SettingsSection>
  );
}
