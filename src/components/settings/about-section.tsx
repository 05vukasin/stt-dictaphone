import { FiGithub } from "react-icons/fi";
import { SettingsSection } from "./settings-section";

export function AboutSection() {
  return (
    <SettingsSection title="About">
      <div className="flex flex-col gap-2 text-[12px] text-[var(--muted)]">
        <div className="flex items-center justify-between">
          <span>STT Dictaphone</span>
          <span className="tabular">v0.1.0</span>
        </div>
        <p className="leading-relaxed">
          A minimal speech-to-text dictaphone. Records locally, transcribes via Whisper, summarizes
          with your chosen model. No telemetry, no accounts, no cloud sync.
        </p>
        <a
          href="https://github.com/05vukasin/stt-dictaphone"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-[var(--fg)] transition-colors hover:bg-[var(--surface)]"
        >
          <FiGithub aria-hidden />
          GitHub
        </a>
      </div>
    </SettingsSection>
  );
}
