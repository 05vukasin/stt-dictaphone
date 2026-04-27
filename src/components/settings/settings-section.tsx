interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <header className="mb-3">
        <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{description}</p>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px]">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}
