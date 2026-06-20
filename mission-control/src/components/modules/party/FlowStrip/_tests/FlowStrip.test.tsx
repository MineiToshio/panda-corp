/**
 * WO-13-009 — FlowStrip tests
 *
 * The always-visible 8-beat pipeline row.
 * - renders 8 beats (7 steps + separating arrows)
 * - active beat(s) are lit; inactive at .45 opacity
 * - each beat has a hover tooltip
 * - no hardcoded hex
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlowStrip } from "../FlowStrip";

const EIGHT_BEATS = [
  { key: "product", icon: "📋", label: "Producto", sub: "spec" },
  { key: "design", icon: "🎨", label: "Diseño", sub: "tokens" },
  { key: "architecture", icon: "📐", label: "Arquitectura", sub: "blueprint" },
  { key: "foundation", icon: "🧱", label: "Fundación", sub: "FND" },
  { key: "build", icon: "⚒️", label: "Construcción", sub: "FRD×N" },
  { key: "review", icon: "⚖️", label: "Revisión", sub: "gate" },
  { key: "integration", icon: "🔗", label: "Integración", sub: "cross" },
  { key: "release", icon: "🚀", label: "Release", sub: "deploy" },
] as const;

describe("FlowStrip", () => {
  it("renders the strip root", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    expect(screen.getByTestId("flow-strip-root")).toBeInTheDocument();
  });

  it("renders exactly 8 beat steps", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    const steps = screen.getAllByTestId(/^flow-beat-/);
    expect(steps).toHaveLength(8);
  });

  it("marks active beat with data-active=true", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={["build"]} />);
    expect(screen.getByTestId("flow-beat-build")).toHaveAttribute("data-active", "true");
  });

  it("marks inactive beats with data-active=false", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={["build"]} />);
    expect(screen.getByTestId("flow-beat-product")).toHaveAttribute("data-active", "false");
  });

  it("can have multiple active beats", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={["build", "review"]} />);
    expect(screen.getByTestId("flow-beat-build")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("flow-beat-review")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("flow-beat-product")).toHaveAttribute("data-active", "false");
  });

  it("renders icon + label for each beat", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    expect(screen.getByTestId("flow-beat-product")).toHaveTextContent("Producto");
    expect(screen.getByTestId("flow-beat-build")).toHaveTextContent("Construcción");
  });

  it("renders tooltip content for each beat", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    // Each beat should have a tooltip element
    const tooltips = screen.getAllByTestId(/^flow-tip-/);
    expect(tooltips).toHaveLength(8);
  });

  it("renders arrow separators between beats", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    const arrows = screen.getAllByTestId("flow-arrow");
    // 7 arrows between 8 beats
    expect(arrows).toHaveLength(7);
  });

  it("uses cursor=help for keyboard/mouse usability", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    const beat = screen.getByTestId("flow-beat-build");
    expect(beat).toHaveStyle({ cursor: "help" });
  });

  it("does not use hardcoded hex in root inline styles", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    const root = screen.getByTestId("flow-strip-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("has aria-label on the strip", () => {
    render(<FlowStrip beats={EIGHT_BEATS} activeKeys={[]} />);
    const root = screen.getByTestId("flow-strip-root");
    expect(root).toHaveAttribute("aria-label");
  });
});
