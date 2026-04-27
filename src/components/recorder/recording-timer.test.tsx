import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecordingTimer } from "./recording-timer";

describe("RecordingTimer", () => {
  it("renders mm:ss for sub-hour durations", () => {
    render(<RecordingTimer ms={65_000} active={true} />);
    expect(screen.getByRole("timer")).toHaveTextContent("01:05");
  });

  it("dims when inactive", () => {
    render(<RecordingTimer ms={0} active={false} />);
    const el = screen.getByRole("timer");
    expect(el.className).toMatch(/opacity-50/);
  });
});
