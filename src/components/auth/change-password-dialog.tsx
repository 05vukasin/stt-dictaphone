"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { clearMustChangePassword } from "@/app/change-password/actions";
import { toast } from "@/lib/use-toast";

interface Props {
  open: boolean;
  onClose(): void;
}

export function ChangePasswordDialog({ open, onClose }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  function close() {
    if (pending) return;
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
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
    setPending(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (error) {
        setError(error.message ?? "Couldn't change password");
        return;
      }
      // Clear the must-change-password flag in case an admin had just
      // regenerated a temp password and the user happened to know it.
      // Idempotent — safe to call when the flag was already false.
      await clearMustChangePassword();
      toast.success("Password updated", "Other sessions were signed out.");
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change password");
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={close}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5"
      >
        <h2 className="text-base font-semibold">Change password</h2>
        <p className="text-[12px] text-[var(--muted)]">
          Sessions on other devices will be signed out.
        </p>

        <Field
          label="Current password"
          name="current"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
        />
        <Field
          label="New password"
          name="new"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
        />
        <Field
          label="Confirm new password"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />

        {error ? <p className="text-[12px] text-[var(--record)]">{error}</p> : null}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--surface)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)] disabled:opacity-50"
          >
            {pending ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange(v: string): void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
      <input
        {...rest}
        type="password"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--border-strong)]"
      />
    </label>
  );
}
