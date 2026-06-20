/**
 * WO-13-009 — Tooltip tests (.wotip)
 *
 * WO id+title / flow-beat hover tooltip. Presentational.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "../Tooltip";

describe("Tooltip", () => {
  it("renders with content", () => {
    render(<Tooltip content={<span>WO-06-001 · build primitives</span>} />);
    expect(screen.getByTestId("tooltip-root")).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <Tooltip
        content={
          <>
            <b>WO-06-001</b>
            <span> · build primitives</span>
          </>
        }
      />,
    );
    const root = screen.getByTestId("tooltip-root");
    expect(root).toHaveTextContent("WO-06-001");
    expect(root).toHaveTextContent("build primitives");
  });

  it("renders the tooltip tail pointer", () => {
    render(<Tooltip content={<span>tip</span>} />);
    expect(screen.getByTestId("tooltip-tail")).toBeInTheDocument();
  });

  it("accepts anchor positioning prop without throwing", () => {
    render(<Tooltip content={<span>tip</span>} anchor={{ bottom: "52px", left: "50%" }} />);
    expect(screen.getByTestId("tooltip-root")).toBeInTheDocument();
  });

  it("does not use hardcoded hex in root inline styles", () => {
    render(<Tooltip content={<span>tip</span>} />);
    const root = screen.getByTestId("tooltip-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("uses monospace font family (class or style) for WO ids", () => {
    render(<Tooltip content={<span>WO-06-001</span>} />);
    const root = screen.getByTestId("tooltip-root");
    // font-family should reference the mono token
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("--font-mono");
  });

  it("has a border with accent color token", () => {
    render(<Tooltip content={<span>tip</span>} />);
    const root = screen.getByTestId("tooltip-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("--color-accent");
  });
});
