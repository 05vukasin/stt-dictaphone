"use client";

import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { forceChangePassword } from "./actions";

interface Props {
  email: string;
}

type Phase = "idle" | "saving" | "redirecting";

export function ForcedChangePasswordForm({ email }: Props) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    setPhase("saving");
    try {
      const r = await forceChangePassword(next);
      if (!r.ok) {
        setError(r.error);
        setPhase("idle");
        return;
      }
      // Hard navigation to the home page. The server action also deletes
      // the Better Auth `session_data` cookie cache, so this fresh request
      // re-reads from the DB and sees mustChangePassword=false (no
      // redirect-back to /change-password). The "redirecting" phase keeps
      // the overlay visible until the browser actually unloads the page.
      setPhase("redirecting");
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change password");
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-3">
      <p className="text-[11px] text-[var(--muted)]">
        Signed in as <span className="text-[var(--fg)]">{email}</span>
      </p>
      <PasswordField
        label="New password"
        autoComplete="new-password"
        value={next}
        onChange={setNext}
        disabled={busy}
      />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        disabled={busy}
      />
      {error ? <p className="text-[12px] text-[var(--record)]">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-1 inline-flex items-center justify-center rounded-lg bg-[var(--fg)] px-3 py-2 text-[12px] font-semibold text-[var(--bg)] transition-opacity disabled:opacity-50"
      >
        {phase === "saving" ? "Updating…" : phase === "redirecting" ? "Redirecting…" : "Set new password"}
      </button>

      {busy ? <LoadingOverlay phase={phase} /> : null}
    </form>
  );
}

function LoadingOverlay({ phase }: { phase: Phase }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-auto absolute inset-0 -m-2 flex items-center justify-center rounded-xl bg-[var(--bg)]/85 backdrop-blur-[1px]"
    >
      <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
        <Spinner />
        <span>{phase === "saving" ? "Updating your password…" : "Taking you to the app…"}</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

function PasswordField({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange(v: string): void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          {...rest}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--border-strong)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          disabled={rest.disabled}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)] disabled:opacity-60"
        >
          {show ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
        </button>
      </div>
    </label>
  );
}
