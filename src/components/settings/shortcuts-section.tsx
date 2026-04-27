import { Kbd } from "../ui/kbd";
import { SettingsSection } from "./settings-section";

const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ["Space"], action: "Start / stop recording" },
  { keys: ["S"], action: "Open settings" },
  { keys: ["H"], action: "Open history" },
  { keys: ["Esc"], action: "Close any open dialog" },
  { keys: ["/"], action: "Focus history search (on history page)" },
];

export function ShortcutsSection() {
  return (
    <SettingsSection title="Keyboard shortcuts">
      <ul className="flex flex-col divide-y divide-[var(--border)] text-[12px]">
        {SHORTCUTS.map((s) => (
          <li
            key={s.action}
            className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
          >
            <span>{s.action}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
