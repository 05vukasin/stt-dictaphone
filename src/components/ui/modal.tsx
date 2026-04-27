"use client";

import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { IconButton } from "./icon-button";

interface ModalProps {
  open: boolean;
  onClose(): void;
  title: string;
  children: React.ReactNode;
  /** Optional element rendered in the title bar (e.g. a back button). */
  leading?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, leading }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-scale-in flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-[var(--shadow-lg)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {leading}
            <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          <IconButton onClick={onClose} label="Close" size="sm">
            <FiX aria-hidden />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
