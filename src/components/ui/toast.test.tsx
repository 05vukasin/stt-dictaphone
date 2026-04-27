import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastStack } from "./toast";
import { toast } from "@/lib/use-toast";

describe("ToastStack", () => {
  it("renders pushed toasts and dismisses them on click", async () => {
    render(<ToastStack />);
    act(() => {
      toast.success("Saved", "Recording saved");
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();

    const dismiss = screen.getByRole("button", { name: /dismiss/i });
    act(() => dismiss.click());
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("renders error toasts with role=alert", () => {
    render(<ToastStack />);
    act(() => {
      toast.error("Boom");
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Boom");
  });
});
