import { describe, it, expect } from "vitest";
import { formatBytes, formatDuration, formatRelativeTime, defaultRecordingTitle } from "./format";

describe("formatDuration", () => {
  it("returns 00:00 for zero / invalid", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(-1)).toBe("00:00");
    expect(formatDuration(NaN)).toBe("00:00");
  });

  it("formats sub-hour as mm:ss", () => {
    expect(formatDuration(5_000)).toBe("00:05");
    expect(formatDuration(65_000)).toBe("01:05");
    expect(formatDuration(3_599_000)).toBe("59:59");
  });

  it("includes hours when >= 1h", () => {
    expect(formatDuration(3_600_000)).toBe("01:00:00");
    expect(formatDuration(3_661_000)).toBe("01:01:01");
  });
});

describe("formatBytes", () => {
  it("handles small / invalid", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats KB / MB / GB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatBytes(15 * 1024)).toBe("15 KB");
  });
});

describe("formatRelativeTime", () => {
  const now = 1_700_000_000_000;

  it("returns 'just now' for < 30s", () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe("just now");
  });

  it("returns seconds, minutes, hours, days", () => {
    expect(formatRelativeTime(now - 45_000, now)).toBe("45s ago");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});

describe("defaultRecordingTitle", () => {
  it("starts with 'Recording · '", () => {
    expect(defaultRecordingTitle(Date.now()).startsWith("Recording · ")).toBe(true);
  });
});
