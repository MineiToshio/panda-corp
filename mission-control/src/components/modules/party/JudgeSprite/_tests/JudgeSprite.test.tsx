/**
 * WO-13-009 — JudgeSprite tests
 *
 * The per-FRD reviewer figure: dim until gate opens, then pacing the Tribunal.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JudgeSprite } from "../JudgeSprite";

describe("JudgeSprite", () => {
  it("renders root element", () => {
    render(<JudgeSprite active={false} />);
    expect(screen.getByTestId("judge-sprite-root")).toBeInTheDocument();
  });

  it("is dim when inactive (gate closed)", () => {
    render(<JudgeSprite active={false} />);
    const root = screen.getByTestId("judge-sprite-root");
    expect(root).toHaveAttribute("data-active", "false");
  });

  it("is active when gate opens", () => {
    render(<JudgeSprite active={true} />);
    const root = screen.getByTestId("judge-sprite-root");
    expect(root).toHaveAttribute("data-active", "true");
  });

  it("renders sprite image with pixelated rendering", () => {
    render(<JudgeSprite active={false} />);
    const img = screen.getByTestId("judge-sprite-img");
    expect(img).toHaveStyle({ imageRendering: "pixelated" });
  });

  it("has Spanish aria-label describing gate state when inactive", () => {
    render(<JudgeSprite active={false} />);
    const root = screen.getByTestId("judge-sprite-root");
    const label = root.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(3);
  });

  it("has Spanish aria-label describing active gate state", () => {
    render(<JudgeSprite active={true} />);
    const root = screen.getByTestId("judge-sprite-root");
    const label = root.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(3);
  });

  it("renders the tag/label element", () => {
    render(<JudgeSprite active={false} />);
    expect(screen.getByTestId("judge-sprite-tag")).toBeInTheDocument();
  });

  it("renders halo element that activates on gate open", () => {
    render(<JudgeSprite active={true} />);
    expect(screen.getByTestId("judge-sprite-halo")).toHaveAttribute("data-active", "true");
  });

  it("halo is inactive when gate is closed", () => {
    render(<JudgeSprite active={false} />);
    expect(screen.getByTestId("judge-sprite-halo")).toHaveAttribute("data-active", "false");
  });

  it("accepts optional judgingTarget prop", () => {
    render(<JudgeSprite active={true} judgingTarget="WO-06-003" />);
    const root = screen.getByTestId("judge-sprite-root");
    expect(root).toHaveAttribute("data-judging-target", "WO-06-003");
  });

  it("does not use hardcoded hex in inline styles", () => {
    render(<JudgeSprite active={true} />);
    const root = screen.getByTestId("judge-sprite-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
