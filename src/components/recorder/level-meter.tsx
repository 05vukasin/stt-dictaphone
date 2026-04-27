interface LevelMeterProps {
  /** Peak amplitude 0..1 */
  peak: number;
  active: boolean;
}

export function LevelMeter({ peak, active }: LevelMeterProps) {
  const width = active ? Math.max(2, Math.round(peak * 100)) : 0;
  return (
    <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--surface-strong)]" aria-hidden>
      <div
        className="h-full rounded-full bg-[var(--fg)] transition-[width] duration-75"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
