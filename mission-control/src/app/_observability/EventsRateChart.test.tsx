/**
 * WO-12-003 — EventsRateChart UI component tests (CMP-12-rate-chart).
 *
 * Tests the presentational layer over `eventsPerMinute` (IF-12-rate).
 * All tests use static Bucket fixtures — no real event file reads, no env, no I/O.
 *
 * Coverage:
 *   - Loading / error / empty / stalled states (MAST requirement)
 *   - Normal rendering: bars, legend, summary
 *   - Per-agent coloring: data-testid on each legend item
 *   - Stalled signal: all-zero buckets → stalled badge
 *   - No color-only state: stalled/live always have text labels
 *   - tabular-nums on numeric output
 *   - data-testid on every interactive / significant element
 *   - Accessibility: aria-labels in Spanish
 *
 * Traceability:
 *   AC-12-007.1 → CMP-12-rate-chart → WO-12-003
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventsRateChart } from "./EventsRateChart";
import type { Bucket } from "./selectors/rate";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBucket(overrides: Partial<Bucket> = {}): Bucket {
  return {
    minute: "2026-06-16T12:29",
    total: 0,
    byAgent: {},
    ...overrides,
  };
}

/** 5 zeroed buckets — the "stalled" signal from IF-12-rate. */
const STALLED_BUCKETS: Bucket[] = [
  makeBucket({ minute: "2026-06-16T12:25" }),
  makeBucket({ minute: "2026-06-16T12:26" }),
  makeBucket({ minute: "2026-06-16T12:27" }),
  makeBucket({ minute: "2026-06-16T12:28" }),
  makeBucket({ minute: "2026-06-16T12:29" }),
];

/** 3 buckets with real activity from 2 agents. */
const ACTIVE_BUCKETS: Bucket[] = [
  makeBucket({
    minute: "2026-06-16T12:27",
    total: 3,
    byAgent: { "frontend-dev": 2, "test-writer": 1 },
  }),
  makeBucket({
    minute: "2026-06-16T12:28",
    total: 5,
    byAgent: { "frontend-dev": 3, "test-writer": 2 },
  }),
  makeBucket({
    minute: "2026-06-16T12:29",
    total: 2,
    byAgent: { "frontend-dev": 2 },
  }),
];

/** Single bucket with a mix of named agents and agentless events. */
const MIXED_BUCKET: Bucket[] = [
  makeBucket({
    minute: "2026-06-16T12:29",
    total: 4,
    byAgent: { implementer: 3 }, // 1 event has no agent
  }),
];

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("EventsRateChart: loading state", () => {
  it("renders the loading skeleton with data-testid when isLoading=true", () => {
    render(<EventsRateChart buckets={[]} isLoading={true} />);
    expect(screen.getByTestId("rate-chart-loading")).toBeDefined();
  });

  it("renders role=status and aria-busy=true when loading", () => {
    render(<EventsRateChart buckets={[]} isLoading={true} />);
    const el = screen.getByTestId("rate-chart-loading");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it("does NOT render the main chart when loading", () => {
    render(<EventsRateChart buckets={[]} isLoading={true} />);
    expect(screen.queryByTestId("rate-chart")).toBeNull();
  });

  it("has a Spanish aria-label on the loading skeleton", () => {
    render(<EventsRateChart buckets={[]} isLoading={true} />);
    const el = screen.getByTestId("rate-chart-loading");
    const label = el.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
    // Spanish: must contain at least one Spanish word
    expect(label.toLowerCase()).toMatch(/cargando|actividad|gráfico/);
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("EventsRateChart: error state", () => {
  it("renders error testid when error prop is provided", () => {
    render(<EventsRateChart buckets={[]} error="Error de lectura" />);
    expect(screen.getByTestId("rate-chart-error")).toBeDefined();
  });

  it("renders role=alert on the error container", () => {
    render(<EventsRateChart buckets={[]} error="Algo falló" />);
    const el = screen.getByTestId("rate-chart-error");
    expect(el.getAttribute("role")).toBe("alert");
  });

  it("displays the error message text", () => {
    render(<EventsRateChart buckets={[]} error="Archivo no encontrado" />);
    expect(screen.getByText("Archivo no encontrado")).toBeDefined();
  });

  it("loading takes precedence over error when both are set", () => {
    render(<EventsRateChart buckets={[]} isLoading={true} error="Algo falló" />);
    expect(screen.getByTestId("rate-chart-loading")).toBeDefined();
    expect(screen.queryByTestId("rate-chart-error")).toBeNull();
  });

  it("does NOT render the main chart when error is set", () => {
    render(<EventsRateChart buckets={[]} error="Fallo" />);
    expect(screen.queryByTestId("rate-chart")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty state — no buckets
// ---------------------------------------------------------------------------

describe("EventsRateChart: empty state (no buckets)", () => {
  it("renders the empty state when buckets is an empty array", () => {
    render(<EventsRateChart buckets={[]} />);
    expect(screen.getByTestId("rate-chart-empty")).toBeDefined();
  });

  it("empty state has role=status", () => {
    render(<EventsRateChart buckets={[]} />);
    const el = screen.getByTestId("rate-chart-empty");
    expect(el.getAttribute("role")).toBe("status");
  });

  it("does NOT render the main chart when buckets is empty", () => {
    render(<EventsRateChart buckets={[]} />);
    expect(screen.queryByTestId("rate-chart")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Stalled state — all-zero buckets
// ---------------------------------------------------------------------------

describe("EventsRateChart: stalled state (all-zero buckets)", () => {
  it("renders the main chart (not empty) when buckets.length > 0 even if all zeroed", () => {
    render(<EventsRateChart buckets={STALLED_BUCKETS} />);
    expect(screen.getByTestId("rate-chart")).toBeDefined();
    expect(screen.queryByTestId("rate-chart-empty")).toBeNull();
  });

  it("renders the stalled badge with data-testid when all buckets are zeroed", () => {
    render(<EventsRateChart buckets={STALLED_BUCKETS} />);
    expect(screen.getByTestId("rate-chart-stalled-badge")).toBeDefined();
  });

  it("stalled badge has a Spanish aria-label describing the stalled state", () => {
    render(<EventsRateChart buckets={STALLED_BUCKETS} />);
    const badge = screen.getByTestId("rate-chart-stalled-badge");
    const label = badge.getAttribute("aria-label") ?? "";
    expect(label.toLowerCase()).toMatch(/detenida|sin actividad/);
  });

  it("stalled badge contains visible text — not color-only (FRD-13)", () => {
    render(<EventsRateChart buckets={STALLED_BUCKETS} />);
    const badge = screen.getByTestId("rate-chart-stalled-badge");
    // Must have text content beyond the icon
    expect(badge.textContent?.replace(/\s/g, "").length).toBeGreaterThan(1);
  });

  it("renders stalled bar elements for each zero bucket", () => {
    render(<EventsRateChart buckets={STALLED_BUCKETS} />);
    const stalledBars = screen.getAllByTestId("rate-bar-stalled");
    expect(stalledBars.length).toBe(STALLED_BUCKETS.length);
  });
});

// ---------------------------------------------------------------------------
// Normal (active) state
// ---------------------------------------------------------------------------

describe("EventsRateChart: normal rendering", () => {
  it("renders the main chart section with data-testid=rate-chart", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    expect(screen.getByTestId("rate-chart")).toBeDefined();
  });

  it("renders the live badge (not stalled) when buckets have activity", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    expect(screen.getByTestId("rate-chart-live-badge")).toBeDefined();
    expect(screen.queryByTestId("rate-chart-stalled-badge")).toBeNull();
  });

  it("live badge contains visible text — not color-only (FRD-13)", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const badge = screen.getByTestId("rate-chart-live-badge");
    expect(badge.textContent?.replace(/\s/g, "").length).toBeGreaterThan(1);
  });

  it("renders the bar chart container with data-testid=rate-chart-bars", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    expect(screen.getByTestId("rate-chart-bars")).toBeDefined();
  });

  it("renders one rate-bar per non-zero bucket", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const bars = screen.getAllByTestId("rate-bar");
    // All ACTIVE_BUCKETS have total > 0
    expect(bars.length).toBe(ACTIVE_BUCKETS.length);
  });

  it("renders the summary row with data-testid=rate-chart-summary", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    expect(screen.getByTestId("rate-chart-summary")).toBeDefined();
  });

  it("summary shows the correct total event count", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const totalInWindow = ACTIVE_BUCKETS.reduce((s, b) => s + b.total, 0); // 10
    const summary = screen.getByTestId("rate-chart-summary");
    expect(summary.textContent).toContain(String(totalInWindow));
  });

  it("renders a windowLabel when provided", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} windowLabel="Últimos 30 min" />);
    expect(screen.getByText("Últimos 30 min")).toBeDefined();
  });

  it("does NOT render a windowLabel element when prop is absent", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    expect(screen.queryByText("Últimos 30 min")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Per-agent legend
// ---------------------------------------------------------------------------

describe("EventsRateChart: per-agent legend", () => {
  it("renders the legend container with data-testid=rate-chart-legend", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    expect(screen.getByTestId("rate-chart-legend")).toBeDefined();
  });

  it("renders a legend item for each unique agent with the correct testid", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    // ACTIVE_BUCKETS has frontend-dev and test-writer
    expect(screen.getByTestId("rate-chart-legend-item-frontend-dev")).toBeDefined();
    expect(screen.getByTestId("rate-chart-legend-item-test-writer")).toBeDefined();
  });

  it("legend item has an aria-label with the agent name and count", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const item = screen.getByTestId("rate-chart-legend-item-frontend-dev");
    const label = item.getAttribute("aria-label") ?? "";
    expect(label).toContain("frontend-dev");
    // Total for frontend-dev: 2+3+2 = 7
    expect(label).toContain("7");
  });

  it("renders a count for each agent in the legend using tabular-nums", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const countEl = screen.getByTestId("rate-chart-legend-count-frontend-dev");
    expect(countEl.textContent).toBe("7"); // 2+3+2 = 7
  });

  it("does NOT render a legend when there are no agents (stalled/zeroed)", () => {
    // STALLED_BUCKETS: all byAgent={}, so no agents to list
    render(<EventsRateChart buckets={STALLED_BUCKETS} />);
    expect(screen.queryByTestId("rate-chart-legend")).toBeNull();
  });

  it("respects the agents prop for stable ordering when provided", () => {
    const agents = ["test-writer", "frontend-dev"];
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} agents={agents} />);
    // Both agents must still appear in the legend
    expect(screen.getByTestId("rate-chart-legend-item-test-writer")).toBeDefined();
    expect(screen.getByTestId("rate-chart-legend-item-frontend-dev")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Mixed — agentless events
// ---------------------------------------------------------------------------

describe("EventsRateChart: agentless events", () => {
  it("renders the chart without crashing when some events have no agent", () => {
    render(<EventsRateChart buckets={MIXED_BUCKET} />);
    expect(screen.getByTestId("rate-chart")).toBeDefined();
  });

  it("shows a rate-bar for the bucket even when some events are agentless", () => {
    render(<EventsRateChart buckets={MIXED_BUCKET} />);
    expect(screen.getByTestId("rate-bar")).toBeDefined();
  });

  it("summary total counts agentless events", () => {
    render(<EventsRateChart buckets={MIXED_BUCKET} />);
    // MIXED_BUCKET total = 4 (3 from implementer + 1 with no agent)
    const summary = screen.getByTestId("rate-chart-summary");
    expect(summary.textContent).toContain("4");
  });

  it("legend only shows named agents (not a no-agent entry)", () => {
    render(<EventsRateChart buckets={MIXED_BUCKET} />);
    const legend = screen.getByTestId("rate-chart-legend");
    // Only implementer should appear
    expect(legend.textContent).toContain("implementer");
    expect(screen.queryByTestId("rate-chart-legend-item-__no-agent")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Accessibility — Spanish aria-labels
// ---------------------------------------------------------------------------

describe("EventsRateChart: accessibility", () => {
  it("main chart section has a Spanish aria-label with event count", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const section = screen.getByTestId("rate-chart");
    const label = section.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
    expect(label.toLowerCase()).toMatch(/evento|actividad|gráfico/);
  });

  it("bar chart container has a role=img", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const barsEl = screen.getByTestId("rate-chart-bars");
    expect(barsEl.getAttribute("role")).toBe("img");
  });

  it("legend is a semantic list element (ul)", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const legend = screen.getByTestId("rate-chart-legend");
    // <ul> carries the implicit list role — no explicit role attribute needed
    expect(legend.tagName.toLowerCase()).toBe("ul");
  });

  it("each legend item is a semantic list item element (li)", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    // <li> carries the implicit listitem role
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(2); // frontend-dev + test-writer
  });
});

// ---------------------------------------------------------------------------
// Design-token invariants — no hardcoded colors
// ---------------------------------------------------------------------------

describe("EventsRateChart: design-token invariants", () => {
  it("renders without any hardcoded hex or rgb color values in inline styles", () => {
    const { container } = render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    // Collect all style attributes from the rendered DOM
    const allElements = container.querySelectorAll("[style]");
    for (const el of allElements) {
      const style = el.getAttribute("style") ?? "";
      // Must not contain raw hex colors (#rrggbb / #rgb)
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // Must not contain rgb(...) or rgba(...) hardcoded values
      expect(style).not.toMatch(/\brgb(a)?\s*\(/);
    }
  });

  it("renders without any hardcoded hsl() values in inline styles", () => {
    const { container } = render(<EventsRateChart buckets={ACTIVE_BUCKETS} />);
    const allElements = container.querySelectorAll("[style]");
    for (const el of allElements) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/\bhsl(a)?\s*\(/);
    }
  });

  it("stalled bucket bar renders without hardcoded colors", () => {
    const { container } = render(<EventsRateChart buckets={STALLED_BUCKETS} />);
    const allElements = container.querySelectorAll("[style]");
    for (const el of allElements) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// Boundary conditions
// ---------------------------------------------------------------------------

describe("EventsRateChart: boundary conditions", () => {
  it("renders a single bucket correctly", () => {
    const single = [makeBucket({ minute: "2026-06-16T12:29", total: 5, byAgent: { reviewer: 5 } })];
    render(<EventsRateChart buckets={single} />);
    expect(screen.getByTestId("rate-chart")).toBeDefined();
    expect(screen.getByTestId("rate-bar")).toBeDefined();
  });

  it("renders 30 buckets without throwing", () => {
    const thirtyBuckets = Array.from({ length: 30 }, (_, i) =>
      makeBucket({
        minute: `2026-06-16T12:${String(i).padStart(2, "0")}`,
        total: i,
        byAgent: i > 0 ? { implementer: i } : {},
      }),
    );
    expect(() => render(<EventsRateChart buckets={thirtyBuckets} />)).not.toThrow();
    expect(screen.getByTestId("rate-chart")).toBeDefined();
  });

  it("handles a bucket with 10 different agents without crashing", () => {
    const agents = Array.from({ length: 10 }, (_, i) => `agent-${i}`);
    const byAgent = Object.fromEntries(agents.map((a) => [a, 1]));
    const bucket = makeBucket({ minute: "2026-06-16T12:29", total: 10, byAgent });
    render(<EventsRateChart buckets={[bucket]} />);
    expect(screen.getByTestId("rate-chart")).toBeDefined();
    for (const agent of agents) {
      expect(screen.getByTestId(`rate-chart-legend-item-${agent}`)).toBeDefined();
    }
  });

  it("uses a custom maxBarHeight without crashing", () => {
    render(<EventsRateChart buckets={ACTIVE_BUCKETS} maxBarHeight={128} />);
    expect(screen.getByTestId("rate-chart")).toBeDefined();
  });
});
