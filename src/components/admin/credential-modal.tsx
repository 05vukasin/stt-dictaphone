"use client";

import { FiCopy } from "react-icons/fi";
import { toast } from "@/lib/use-toast";

interface Credential {
  email: string;
  tempPassword: string;
}

// Displays the raw, un-hyphenated password — and only the raw value. We
// previously formatted it as "ABCD-EFGH-…" for human readability, but the
// <pre> uses `select-all`, so clicking + copying captured the hyphenated
// version. The stored hash has no hyphens, so sign-in then failed with
// INVALID_PASSWORD. Showing the raw value guarantees copy and read both
// match what was hashed.
export function CredentialModal({
  credential,
  onClose,
}: {
  credential: Credential;
  onClose(): void;
}) {
  function copy() {
    navigator.clipboard
      .writeText(credential.tempPassword)
      .then(() => toast.success("Password copied"))
      .catch(() => toast.error("Copy failed"));
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Temporary password</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          Share this once with <span className="text-[var(--fg)]">{credential.email}</span>. The
          user will be forced to change it on next sign-in. We do not store the plaintext — you
          cannot view it again.
        </p>
        <pre className="mt-3 select-all rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elev)] px-3 py-2 font-mono text-[13px] tracking-wider">
          {credential.tempPassword}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface)]"
          >
            <FiCopy aria-hidden /> Copy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)] transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
