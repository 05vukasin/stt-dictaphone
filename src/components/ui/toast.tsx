"use client";

import { dismiss, useToasts, type ToastItem } from "@/lib/use-toast";
import { FiAlertCircle, FiCheck, FiInfo, FiX } from "react-icons/fi";

const ICONS = {
  info: FiInfo,
  success: FiCheck,
  error: FiAlertCircle,
} as const;

export function ToastStack() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastView({ toast }: { toast: ToastItem }) {
  const Icon = ICONS[toast.kind];
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className="anim-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3 shadow-[var(--shadow-md)]"
    >
      <Icon
        aria-hidden
        className={
          "mt-0.5 size-4 shrink-0 " + (toast.kind === "error" ? "text-[var(--record)]" : "")
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{toast.description}</p>
        ) : null}
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        className="rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
        aria-label="Dismiss"
      >
        <FiX aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
