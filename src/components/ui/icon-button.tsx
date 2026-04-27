"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "ghost" | "solid" | "outline";
type Size = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  label: string;
}

const SIZES: Record<Size, string> = {
  sm: "size-8 text-base",
  md: "size-10 text-lg",
  lg: "size-12 text-xl",
};

const VARIANTS: Record<Variant, string> = {
  ghost: "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]",
  outline:
    "border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--surface)] hover:border-[var(--border-strong)]",
  solid:
    "bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "ghost", size = "md", label, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={
        "inline-flex items-center justify-center rounded-full transition-colors duration-150 " +
        SIZES[size] +
        " " +
        VARIANTS[variant] +
        " " +
        className
      }
      {...rest}
    >
      {children}
    </button>
  );
});
