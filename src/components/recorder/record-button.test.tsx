import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordButton } from "./record-button";

describe("RecordButton", () => {
  it("shows 'Start recording' label and calls onToggle when idle", async () => {
    const onToggle = vi.fn();
    render(<RecordButton state="idle" onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: /start recording/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows 'Stop recording' and aria-pressed=true while recording", async () => {
    render(<RecordButton state="recording" onToggle={() => {}} />);
    const btn = screen.getByRole("button", { name: /stop recording/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("disabled while stopping", () => {
    render(<RecordButton state="stopping" onToggle={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("respects external disabled prop", async () => {
    const onToggle = vi.fn();
    render(<RecordButton state="idle" onToggle={onToggle} disabled />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
