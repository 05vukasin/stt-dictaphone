export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-1 font-mono text-[10px] font-medium text-[var(--muted)]">
      {children}
    </kbd>
  );
}
