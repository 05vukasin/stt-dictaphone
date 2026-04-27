"use client";

import { FiMic, FiSquare } from "react-icons/fi";
import type { RecorderState } from "@/lib/recorder";

interface RecordButtonProps {
  state: RecorderState;
  onToggle(): void;
  disabled?: boolean;
}

export function RecordButton({ state, onToggle, disabled }: RecordButtonProps) {
  const isRecording = state === "recording" || state === "paused";
  const isStopping = state === "stopping";
  const label = isRecording ? "Stop recording" : "Start recording";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isStopping}
      aria-label={label}
      aria-pressed={isRecording}
      title={label}
      className={
        "group relative inline-flex size-24 items-center justify-center rounded-full transition-all duration-200 sm:size-28 " +
        (isRecording
          ? "bg-[var(--record)] text-white shadow-[var(--shadow-md)]"
          : "bg-[var(--fg)] text-[var(--bg)] shadow-[var(--shadow-md)] hover:scale-[1.03] active:scale-[0.97]") +
        " disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <span
        aria-hidden
        className={
          "absolute inset-0 rounded-full " +
          (isRecording
            ? "animate-[pulse-record_1.6s_ease-in-out_infinite] bg-[var(--record)] opacity-40 blur-md"
            : "")
        }
      />
      <span className="relative flex items-center justify-center">
        {isRecording ? (
          <FiSquare className="size-7" aria-hidden />
        ) : (
          <FiMic className="size-8" aria-hidden />
        )}
      </span>
    </button>
  );
}
