import { formatDuration } from "@/lib/format";

interface RecordingTimerProps {
  ms: number;
  active: boolean;
}

export function RecordingTimer({ ms, active }: RecordingTimerProps) {
  return (
    <div
      role="timer"
      aria-live="off"
      className={
        "tabular text-2xl font-medium tracking-tight transition-opacity " +
        (active ? "opacity-100" : "opacity-50")
      }
    >
      {formatDuration(ms)}
    </div>
  );
}
