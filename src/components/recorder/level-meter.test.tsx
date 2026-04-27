import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LevelMeter } from "./level-meter";

function getFill(container: HTMLElement): HTMLElement {
  // The level-meter renders <div bg><div fill/></div>; container is a wrapper
  // div from RTL, so the fill is two levels deep.
  const root = container.firstElementChild as HTMLElement;
  return root.firstElementChild as HTMLElement;
}

describe("LevelMeter", () => {
  it("shows 0 width when inactive", () => {
    const { container } = render(<LevelMeter peak={0.8} active={false} />);
    expect(getFill(container).style.width).toBe("0%");
  });

  it("scales width with peak when active", () => {
    const { container } = render(<LevelMeter peak={0.5} active={true} />);
    expect(getFill(container).style.width).toBe("50%");
  });

  it("clamps to a tiny minimum when active even with peak ~ 0", () => {
    const { container } = render(<LevelMeter peak={0} active={true} />);
    expect(getFill(container).style.width).toBe("2%");
  });
});
