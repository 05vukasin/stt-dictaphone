"use client";

import { useEffect, useState } from "react";
import { FiDownload, FiX } from "react-icons/fi";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "stt-dict:install-dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(DISMISS_KEY) !== null;
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Lazy initializer — runs once on mount, no setState-in-effect.
  const [hidden, setHidden] = useState<boolean>(readDismissed);

  useEffect(() => {
    if (typeof window === "undefined" || hidden) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [hidden]);

  if (hidden || !event) return null;

  return (
    <div className="anim-slide-up fixed bottom-4 left-1/2 z-40 flex w-[min(92vw,360px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2 shadow-[var(--shadow-md)]">
      <FiDownload aria-hidden className="size-4 text-[var(--muted)]" />
      <div className="flex-1">
        <p className="text-[12px] font-medium leading-tight">Install Dictaphone</p>
        <p className="text-[11px] leading-snug text-[var(--muted)]">
          Add to your home screen for quick access.
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await event.prompt();
          await event.userChoice;
          setEvent(null);
          setHidden(true);
        }}
        className="rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[11px] font-medium text-[var(--bg)] transition-opacity hover:opacity-90"
      >
        Install
      </button>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, "1");
          setHidden(true);
        }}
        aria-label="Dismiss"
        className="rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
      >
        <FiX aria-hidden />
      </button>
    </div>
  );
}
