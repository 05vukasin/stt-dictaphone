"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestAccess } from "./actions";

export function RequestAccessForm() {
  const [state, action] = useActionState(requestAccess, null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
      />
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-[var(--muted)]">Why you want access</span>
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          placeholder="Optional — gives the admin context."
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </label>

      {state?.ok === false ? (
        <p className="text-[12px] text-[var(--record)]">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-[12px] text-[var(--muted)]">
          Thanks — we&apos;ll review your request. If approved, an admin will share your sign-in
          credentials.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex items-center justify-center rounded-lg bg-[var(--fg)] px-3 py-2 text-[12px] font-semibold text-[var(--bg)] transition-opacity disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}

function Field(props: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
      <input
        {...rest}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--border-strong)]"
      />
    </label>
  );
}
