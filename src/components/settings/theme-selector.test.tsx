import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setThemeMock = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "system",
    resolvedTheme: "dark",
    setTheme: setThemeMock,
  }),
}));

import { ThemeSelector } from "./theme-selector";

describe("ThemeSelector", () => {
  it("renders three theme options as radios", () => {
    render(<ThemeSelector />);
    expect(screen.getByRole("radio", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /system/i })).toBeInTheDocument();
  });

  it("clicking a non-active option calls setTheme with the value", async () => {
    setThemeMock.mockClear();
    render(<ThemeSelector />);
    await userEvent.click(screen.getByRole("radio", { name: /light/i }));
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
