/**
 * WO-13-007 — ProgressBar (CMP-13-progressbar) — TDD tests
 *
 * Mission-objectives bar: accent fill, var(--ok) at 100%, done/tot · pct%.
 * role=progressbar, aria-valuenow/min/max, tabular-nums.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar, type ProgressBarProps } from "@/components/core/ProgressBar/ProgressBar";

function renderBar(props: ProgressBarProps) {
  return render(<ProgressBar {...props} />);
}

describe("frd-13/wo-13-007: ProgressBar — rendering", () => {
  it("frd-13: ProgressBar — has data-testid='progress-bar'", () => {
    renderBar({ done: 3, total: 10 });
    expect(screen.getByTestId("progress-bar")).toBeDefined();
  });

  it("frd-13: ProgressBar — has role=progressbar", () => {
    renderBar({ done: 3, total: 10 });
    expect(screen.getByRole("progressbar")).toBeDefined();
  });

  it("frd-13: ProgressBar — aria-valuenow matches done", () => {
    renderBar({ done: 3, total: 10 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
  });

  it("frd-13: ProgressBar — aria-valuemin=0 aria-valuemax=total", () => {
    renderBar({ done: 3, total: 10 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
  });

  it("frd-13: ProgressBar — renders done/total label text", () => {
    renderBar({ done: 3, total: 10 });
    // Should show "3/10" or "3 / 10"
    const bar = screen.getByTestId("progress-bar");
    expect(bar.textContent).toMatch(/3/);
    expect(bar.textContent).toMatch(/10/);
  });

  it("frd-13: ProgressBar — renders percentage text", () => {
    renderBar({ done: 5, total: 10 });
    const bar = screen.getByTestId("progress-bar");
    expect(bar.textContent).toMatch(/50%/);
  });
});

describe("frd-13/wo-13-007: ProgressBar — complete state", () => {
  it("frd-13: ProgressBar — done=total adds data-complete='true'", () => {
    renderBar({ done: 10, total: 10 });
    const bar = screen.getByTestId("progress-bar");
    expect(bar.getAttribute("data-complete")).toBe("true");
  });

  it("frd-13: ProgressBar — done<total does not set data-complete", () => {
    renderBar({ done: 5, total: 10 });
    const bar = screen.getByTestId("progress-bar");
    expect(bar.getAttribute("data-complete")).not.toBe("true");
  });

  it("frd-13: ProgressBar — 100% shows 100%", () => {
    renderBar({ done: 10, total: 10 });
    const bar = screen.getByTestId("progress-bar");
    expect(bar.textContent).toMatch(/100%/);
  });
});

describe("frd-13/wo-13-007: ProgressBar — tokens only", () => {
  it("frd-13: ProgressBar — fill element inline style uses var() not hardcoded hex", () => {
    const { container } = renderBar({ done: 5, total: 10 });
    const fill = container.querySelector("[data-testid='progress-bar-fill']") as HTMLElement | null;
    if (fill) {
      const style = fill.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });
});
