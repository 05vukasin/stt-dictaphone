"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

interface SignInFormProps {
  nextPath?: string;
}

export function SignInForm({ nextPath }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(error.message ?? "Sign-in failed");
        return;
      }
      // Hard navigation. A client-side `router.replace` + `router.refresh`
      // combo races the just-set session cookie against the next RSC fetch,
      // and the root layout's `redirect()` doesn't always propagate across
      // a soft nav in Next 16 — full-page navigation re-runs everything
      // against the fresh cookie deterministically.
      const mustChange = Boolean(
        (data?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword,
      );
      const target = mustChange
        ? "/change-password"
        : nextPath && nextPath.startsWith("/")
          ? nextPath
          : "/";
      window.location.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={setEmail}
      />
      <Field
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={setPassword}
      />
      {error ? <p className="text-[12px] text-[var(--record)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex items-center justify-center rounded-lg bg-[var(--fg)] px-3 py-2 text-[12px] font-semibold text-[var(--bg)] transition-opacity disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
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
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--border-strong)]"
      />
    </label>
  );
}
