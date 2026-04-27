"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { FiMonitor, FiMoon, FiSun } from "react-icons/fi";

const OPTIONS = [
  { value: "light", label: "Light", Icon: FiSun },
  { value: "dark", label: "Dark", Icon: FiMoon },
  { value: "system", label: "System", Icon: FiMonitor },
] as const;

const noopSubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

export function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? resolvedTheme ?? "system") : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors " +
              (active
                ? "bg-[var(--fg)] text-[var(--bg)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]")
            }
          >
            <Icon aria-hidden className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
