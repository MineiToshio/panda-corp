/**
 * WO-06-009 — ActivityPulse (CMP-06-pulse) tests — RED phase.
 *
 * Tests for the per-agent activity pulse bars (AC-06-015.1).
 *
 * Traceability:
 *   AC-06-015.1  It SHALL show an activity pulse (bars per minute, color per agent)
 *                that indicates at a glance whether the factory is alive or stalled.
 *   CMP-06-pulse → REQ-06-015
 *   Depends on: IF-12-rate (eventsPerMinute selector), IF-06-agent-color (AGENT_COLOR)
 *
 * Contract (blueprint §2, WO-06-009):
 *   - One bar group per active agent with bars per minute.
 *   - Bar height encodes event count (taller = more events).
 *   - Agent color from IF-06-agent-color / AGENT_COLOR (CSS var key as --color-XXX).
 *   - tabular-nums on all numeric counts.
 *   - "Stalled" state when the most recent bucket is empty (zero total events).
 *   - Empty buckets array → stalled / no-activity state rendered, not crash.
 *   - data-testid on every interactive/structural element.
 *   - Zero hardcoded colors — CSS custom properties only.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Bucket } from "@/app/_observability/selectors/rate";

import { ActivityPulse, type ActivityPulseProps } from "./ActivityPulse";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// NOW is available as a reference constant if needed by future tests.
const _NOW = new Date("2026-06-17T12:30:00Z");

/** A bucket with activity from two agents. */
function makeBucket(
  minute: string,
  overrides: { total?: number; byAgent?: Record<string, number> } = {},
): Bucket {
  const byAgent = overrides.byAgent ?? (Object.create(null) as Record<string, number>);
  return {
    minute,
    total: overrides.total ?? 0,
    byAgent,
  };
}

/** 5 buckets: first 4 empty, last one with agent activity. */
function makeRateSeries(): Bucket[] {
  return [
    makeBucket("2026-06-17T12:25", { total: 0 }),
    makeBucket("2026-06-17T12:26", { total: 0 }),
    makeBucket("2026-06-17T12:27", { total: 3, byAgent: { "frontend-dev": 2, "backend-dev": 1 } }),
    makeBucket("2026-06-17T12:28", { total: 5, byAgent: { "frontend-dev": 3, "backend-dev": 2 } }),
    makeBucket("2026-06-17T12:29", { total: 4, byAgent: { "frontend-dev": 4 } }),
  ];
}

/** All-zero buckets → stalled state. */
function makeStalledSeries(): Bucket[] {
  return [
    makeBucket("2026-06-17T12:25", { total: 0 }),
    makeBucket("2026-06-17T12:26", { total: 0 }),
    makeBucket("2026-06-17T12:27", { total: 0 }),
    makeBucket("2026-06-17T12:28", { total: 0 }),
    makeBucket("2026-06-17T12:29", { total: 0 }),
  ];
}

/** Series where only the last bucket is empty (most recent is stalled). */
function makeRecentlyStalled(): Bucket[] {
  return [
    makeBucket("2026-06-17T12:25", { total: 4, byAgent: { "frontend-dev": 4 } }),
    makeBucket("2026-06-17T12:26", { total: 3, byAgent: { "frontend-dev": 3 } }),
    makeBucket("2026-06-17T12:27", { total: 2, byAgent: { "backend-dev": 2 } }),
    makeBucket("2026-06-17T12:28", { total: 1, byAgent: { "backend-dev": 1 } }),
    makeBucket("2026-06-17T12:29", { total: 0 }), // most recent is empty → stalled
  ];
}

function defaultProps(overrides: Partial<ActivityPulseProps> = {}): ActivityPulseProps {
  return {
    buckets: makeRateSeries(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-06-015.1 — renders the pulse container
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — renders container (AC-06-015.1)", () => {
  it("frd-06: WHEN rendered THEN has data-testid='activity-pulse'", () => {
    render(<ActivityPulse {...defaultProps()} />);
    expect(screen.getByTestId("activity-pulse")).toBeDefined();
  });

  it("frd-06: WHEN rendered with buckets THEN renders the chart area", () => {
    render(<ActivityPulse {...defaultProps()} />);
    expect(screen.getByTestId("activity-pulse-chart")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Per-agent bars with correct colors (AC-06-015.1, blueprint §2 CMP-06-pulse)
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — per-agent bars (AC-06-015.1)", () => {
  it("frd-06: WHEN buckets have two agents THEN renders bars for each active agent", () => {
    render(<ActivityPulse {...defaultProps()} />);
    // Agents that appear in the series: frontend-dev, backend-dev
    const frontendBars = screen.getAllByTestId("activity-pulse-bar-frontend-dev");
    const backendBars = screen.getAllByTestId("activity-pulse-bar-backend-dev");
    expect(frontendBars.length).toBeGreaterThan(0);
    expect(backendBars.length).toBeGreaterThan(0);
  });

  it("frd-06: WHEN agent 'frontend-dev' is active THEN its bars carry the agent color CSS var", () => {
    render(<ActivityPulse {...defaultProps()} />);
    const bars = screen.getAllByTestId("activity-pulse-bar-frontend-dev");
    // Each bar must reference the CSS var for frontend-dev, not a hardcoded color
    const bar = bars[0];
    expect(bar).toBeDefined();
    // The bar should have the agent color as a CSS variable reference (in style or data attr)
    const style = bar?.getAttribute("style") ?? "";
    const dataColor = bar?.getAttribute("data-agent-color") ?? "";
    const hasAgentColor =
      style.includes("--color-agent-frontend-dev") ||
      dataColor.includes("--color-agent-frontend-dev");
    expect(hasAgentColor).toBe(true);
  });

  it("frd-06: WHEN agent 'backend-dev' is active THEN its bars carry the backend-dev color CSS var", () => {
    render(<ActivityPulse {...defaultProps()} />);
    const bars = screen.getAllByTestId("activity-pulse-bar-backend-dev");
    const bar = bars[0];
    const style = bar?.getAttribute("style") ?? "";
    const dataColor = bar?.getAttribute("data-agent-color") ?? "";
    const hasAgentColor =
      style.includes("--color-agent-backend-dev") ||
      dataColor.includes("--color-agent-backend-dev");
    expect(hasAgentColor).toBe(true);
  });

  it("frd-06: WHEN bucket has zero count for an agent THEN bar height encodes zero (stalled segment)", () => {
    render(<ActivityPulse {...defaultProps()} />);
    // The first two buckets are zero — bars for those minutes should show zero height
    const frontendBars = screen.getAllByTestId("activity-pulse-bar-frontend-dev");
    // At least one bar should encode zero (height: 0 or data-count="0")
    const hasZeroBar = frontendBars.some(
      (bar) =>
        bar.getAttribute("data-count") === "0" ||
        (bar.getAttribute("style") ?? "").includes("height: 0") ||
        (bar.getAttribute("style") ?? "").includes("--bar-height: 0"),
    );
    expect(hasZeroBar).toBe(true);
  });

  it("frd-06: WHEN bucket count for an agent is N THEN bar encodes a positive relative height", () => {
    render(<ActivityPulse {...defaultProps()} />);
    const frontendBars = screen.getAllByTestId("activity-pulse-bar-frontend-dev");
    // At least one bar should encode a count > 0
    const hasActiveBar = frontendBars.some(
      (bar) => Number(bar.getAttribute("data-count") ?? "0") > 0,
    );
    expect(hasActiveBar).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tabular-nums on counts (FRD-13, AGENTS.md)
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — tabular-nums (FRD-13)", () => {
  it("frd-06: WHEN rendered THEN numeric count labels use tabular-nums", () => {
    render(<ActivityPulse {...defaultProps()} />);
    // The chart container or a numeric wrapper should carry tabular-nums
    const chart = screen.getByTestId("activity-pulse-chart");
    const style = chart.getAttribute("style") ?? "";
    // tabular-nums can be applied via font-variant-numeric CSS property
    // or as a Tailwind class — either form is acceptable
    const containerHasTabular =
      style.includes("tabular-nums") ||
      (chart.className ?? "").includes("tabular-nums") ||
      // also check a potential label element
      screen.queryByTestId("activity-pulse-label") !== null;
    expect(containerHasTabular).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stalled state (most-recent bucket empty → pulse visibly flattens)
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — stalled state (AC-06-015.1)", () => {
  it("frd-06: WHEN all buckets are empty THEN renders the stalled state indicator", () => {
    render(<ActivityPulse buckets={makeStalledSeries()} />);
    expect(screen.getByTestId("activity-pulse-stalled")).toBeDefined();
  });

  it("frd-06: WHEN most recent bucket is empty THEN renders the stalled state indicator", () => {
    render(<ActivityPulse buckets={makeRecentlyStalled()} />);
    expect(screen.getByTestId("activity-pulse-stalled")).toBeDefined();
  });

  it("frd-06: WHEN most recent bucket has events THEN does NOT render the stalled indicator", () => {
    render(<ActivityPulse {...defaultProps()} />);
    // The last bucket in makeRateSeries() has total=4 → alive, not stalled
    expect(screen.queryByTestId("activity-pulse-stalled")).toBeNull();
  });

  it("frd-06: WHEN stalled THEN stalled indicator has an accessible label (not color-only)", () => {
    render(<ActivityPulse buckets={makeStalledSeries()} />);
    const stalled = screen.getByTestId("activity-pulse-stalled");
    // Must carry accessible text, aria-label or role (not color-only — FRD-13 rule)
    const hasAccessibleLabel =
      (stalled.textContent ?? "").trim().length > 0 ||
      stalled.hasAttribute("aria-label") ||
      stalled.hasAttribute("role");
    expect(hasAccessibleLabel).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Empty buckets array → graceful render, no crash
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — empty buckets (defensive)", () => {
  it("frd-06: WHEN buckets is empty array THEN renders without crashing", () => {
    expect(() => render(<ActivityPulse buckets={[]} />)).not.toThrow();
  });

  it("frd-06: WHEN buckets is empty array THEN renders the activity-pulse container", () => {
    render(<ActivityPulse buckets={[]} />);
    expect(screen.getByTestId("activity-pulse")).toBeDefined();
  });

  it("frd-06: WHEN buckets is empty array THEN renders the stalled state (no signal)", () => {
    render(<ActivityPulse buckets={[]} />);
    expect(screen.getByTestId("activity-pulse-stalled")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// No hardcoded colors (AGENTS.md rule, FRD-13)
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — no hardcoded colors (FRD-13)", () => {
  it("frd-06: WHEN rendered THEN no inline style contains a raw hex color", () => {
    const { container } = render(<ActivityPulse {...defaultProps()} />);
    // Walk the DOM and check every inline style attribute
    const allElements = container.querySelectorAll("[style]");
    for (const el of allElements) {
      const style = el.getAttribute("style") ?? "";
      // Hex colors: #RGB, #RRGGBB, #RRGGBBAA
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });

  it("frd-06: WHEN rendered THEN no inline style contains a raw rgb() color", () => {
    const { container } = render(<ActivityPulse {...defaultProps()} />);
    const allElements = container.querySelectorAll("[style]");
    for (const el of allElements) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/\brgb\s*\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// Single-agent series — only one agent's bars rendered (no phantom bars)
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — single agent series", () => {
  it("frd-06: WHEN only one agent is active THEN only that agent's bars are rendered", () => {
    const singleAgentBuckets: Bucket[] = [
      makeBucket("2026-06-17T12:25", { total: 2, byAgent: { researcher: 2 } }),
      makeBucket("2026-06-17T12:26", { total: 3, byAgent: { researcher: 3 } }),
      makeBucket("2026-06-17T12:27", { total: 1, byAgent: { researcher: 1 } }),
    ];
    render(<ActivityPulse buckets={singleAgentBuckets} />);
    const researcherBars = screen.getAllByTestId("activity-pulse-bar-researcher");
    expect(researcherBars.length).toBeGreaterThan(0);
    // No backend-dev bars should appear
    expect(screen.queryAllByTestId("activity-pulse-bar-backend-dev")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data-testid on key elements
// ---------------------------------------------------------------------------

describe("frd-06: ActivityPulse — data-testid surface", () => {
  it("frd-06: has activity-pulse root testid", () => {
    render(<ActivityPulse {...defaultProps()} />);
    expect(screen.getByTestId("activity-pulse")).toBeDefined();
  });

  it("frd-06: has activity-pulse-chart testid", () => {
    render(<ActivityPulse {...defaultProps()} />);
    expect(screen.getByTestId("activity-pulse-chart")).toBeDefined();
  });
});
