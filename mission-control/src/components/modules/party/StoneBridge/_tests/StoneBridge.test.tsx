/**
 * WO-13-009 — StoneBridge tests
 *
 * The stone-bridge PNG connector between rooms.
 * - orientation h/v selects the correct asset
 * - flow prop applies the flowing state
 * - presentational: pointer-events none
 * - tokens only, no hardcoded hex
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StoneBridge } from "../StoneBridge";

describe("StoneBridge", () => {
  it("renders with horizontal orientation", () => {
    render(<StoneBridge orientation="h" flow={false} />);
    const root = screen.getByTestId("stone-bridge-root");
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("data-orientation", "h");
  });

  it("renders with vertical orientation", () => {
    render(<StoneBridge orientation="v" flow={false} />);
    expect(screen.getByTestId("stone-bridge-root")).toHaveAttribute("data-orientation", "v");
  });

  it("uses bridge-h.png for horizontal orientation", () => {
    render(<StoneBridge orientation="h" flow={false} />);
    const img = screen.getByTestId("stone-bridge-img");
    expect(img.getAttribute("src")).toContain("bridge-h");
  });

  it("uses bridge-v.png for vertical orientation", () => {
    render(<StoneBridge orientation="v" flow={false} />);
    const img = screen.getByTestId("stone-bridge-img");
    expect(img.getAttribute("src")).toContain("bridge-v");
  });

  it("sets data-flow attribute when flow=true", () => {
    render(<StoneBridge orientation="h" flow={true} />);
    expect(screen.getByTestId("stone-bridge-root")).toHaveAttribute("data-flow", "true");
  });

  it("sets data-flow=false when not flowing", () => {
    render(<StoneBridge orientation="h" flow={false} />);
    expect(screen.getByTestId("stone-bridge-root")).toHaveAttribute("data-flow", "false");
  });

  it("renders img with pixelated rendering", () => {
    render(<StoneBridge orientation="h" flow={false} />);
    const img = screen.getByTestId("stone-bridge-img");
    expect(img).toHaveStyle({ imageRendering: "pixelated" });
  });

  it("is presentational (aria-hidden or empty alt)", () => {
    render(<StoneBridge orientation="h" flow={false} />);
    const img = screen.getByTestId("stone-bridge-img");
    // Presentational: empty alt text
    expect(img.getAttribute("alt")).toBe("");
  });

  it("accepts custom style for positioning (pos prop)", () => {
    render(<StoneBridge orientation="h" flow={false} style={{ left: "415px", top: "140px" }} />);
    const root = screen.getByTestId("stone-bridge-root");
    expect(root).toHaveStyle({ left: "415px", top: "140px" });
  });
});
