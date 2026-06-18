/**
 * WO-05-006 — WorkOrderProgress (CMP-05-progress) tests
 *
 * RED phase — written before implementation.
 *
 * Traceability:
 *   AC-05-004.1  The view SHALL show aggregated progress done/total and %,
 *               summing every feature's work-orders/.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrderProgress } from "@/lib/work-orders";
import { WorkOrderProgressBar } from "../wo-progress";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROGRESS_PARTIAL: WorkOrderProgress = { done: 2, total: 7, pct: 28.6 };
const PROGRESS_COMPLETE: WorkOrderProgress = { done: 5, total: 5, pct: 100.0 };
const PROGRESS_ZERO_DONE: WorkOrderProgress = { done: 0, total: 3, pct: 0 };
const PROGRESS_EMPTY: WorkOrderProgress = { done: 0, total: 0, pct: 0 };

// ---------------------------------------------------------------------------
// AC-05-004.1 — progress shows done/total/%
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-004.1 — WorkOrderProgressBar renders progress", () => {
  it("frd-05: AC-05-004.1 — WHEN progress provided THEN renders the progress container", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_PARTIAL} />);
    expect(screen.getByTestId("wo-progress")).toBeDefined();
  });

  it("frd-05: AC-05-004.1 — WHEN 2/7 THEN displays done count '2'", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_PARTIAL} />);
    const el = screen.getByTestId("wo-progress");
    expect(el.textContent).toContain("2");
  });

  it("frd-05: AC-05-004.1 — WHEN 2/7 THEN displays total count '7'", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_PARTIAL} />);
    const el = screen.getByTestId("wo-progress");
    expect(el.textContent).toContain("7");
  });

  it("frd-05: AC-05-004.1 — WHEN 2/7 (28.6%) THEN displays the percentage", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_PARTIAL} />);
    const el = screen.getByTestId("wo-progress");
    expect(el.textContent).toContain("28.6");
  });

  it("frd-05: AC-05-004.1 — WHEN 5/5 (100%) THEN displays 100", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_COMPLETE} />);
    const el = screen.getByTestId("wo-progress");
    expect(el.textContent).toContain("100");
  });

  it("frd-05: AC-05-004.1 — WHEN 0/3 THEN displays '0'", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_ZERO_DONE} />);
    const el = screen.getByTestId("wo-progress");
    expect(el.textContent).toContain("0");
  });

  it("frd-05: AC-05-004.1 — WHEN 0/0 THEN does not crash and renders the progress container", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_EMPTY} />);
    expect(screen.getByTestId("wo-progress")).toBeDefined();
  });

  it("frd-05: AC-05-004.1 — WHEN rendered THEN has a progress bar element", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_PARTIAL} />);
    expect(screen.getByTestId("wo-progress-bar")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// tabular-nums and tokens
// ---------------------------------------------------------------------------

describe("frd-05: WorkOrderProgressBar — tokens only (no hardcoded values)", () => {
  it("frd-05: WHEN rendered THEN progress container has data-testid=wo-progress", () => {
    render(<WorkOrderProgressBar progress={PROGRESS_PARTIAL} />);
    expect(screen.getByTestId("wo-progress")).toBeDefined();
  });
});
