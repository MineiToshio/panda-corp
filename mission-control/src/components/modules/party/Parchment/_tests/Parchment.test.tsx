/**
 * WO-13-009 — Parchment tests
 *
 * The 📜 Status-Note hand-off element (WO → dependent station).
 * Presentational decoration of the real HandoffWritten event.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Parchment } from "../Parchment";

describe("Parchment", () => {
  it("renders root element", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    expect(screen.getByTestId("parchment-root")).toBeInTheDocument();
  });

  it("shows the scroll emoji", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    expect(screen.getByTestId("parchment-root")).toHaveTextContent("📜");
  });

  it("sets data-from attribute", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    expect(screen.getByTestId("parchment-root")).toHaveAttribute("data-from", "WO-06-001");
  });

  it("sets data-to attribute", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    expect(screen.getByTestId("parchment-root")).toHaveAttribute("data-to", "WO-06-002");
  });

  it("is aria-hidden (decorative — the real status note is accessible in the feed)", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    expect(screen.getByTestId("parchment-root")).toHaveAttribute("aria-hidden", "true");
  });

  it("has pointer-events none (non-interactive, presentational)", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    const root = screen.getByTestId("parchment-root");
    expect(root).toHaveStyle({ pointerEvents: "none" });
  });

  it("has warn-colored glow filter (the hand-off is a warm-tone visual signal)", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    const root = screen.getByTestId("parchment-root");
    const style = root.getAttribute("style") ?? "";
    // filter or box-shadow referencing warn token
    expect(style).toContain("--color-warn");
  });

  it("does not use hardcoded hex in inline styles", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" />);
    const root = screen.getByTestId("parchment-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("accepts optional positioning style", () => {
    render(<Parchment from="WO-06-001" to="WO-06-002" style={{ left: "300px", top: "200px" }} />);
    const root = screen.getByTestId("parchment-root");
    expect(root).toHaveStyle({ left: "300px", top: "200px" });
  });
});
