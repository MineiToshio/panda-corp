/**
 * Observability Timeline v2 — TimelineView tests (CMP-12-timeline).
 *
 * The timeline now consumes a BuildTimeline (read from `.pandacorp/track.jsonl`),
 * not a flat GanttWorkOrder[]. Three modes are exercised:
 *   - empty:      honest "no build data yet" status.
 *   - structural: FRD rows + WO state list, no duration bars, honest banner.
 *   - durations:  FRD rows + nested WO bars by real wall-clock + review segment +
 *                 jump-to-first-error.
 *
 * Design rules (FRD-13): tokens only (no hex), icon+text state, tabular-nums.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BuildTimeline, TLFrd } from "@/lib/build-track/build-track";
import { TimelineView } from "../TimelineView";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T0 = Date.parse("2026-06-23T10:00:00Z");
const MIN = 60_000;

const FRD_01: TLFrd = {
  id: "frd-01-data-reading",
  label: "FRD-01",
  startMs: T0,
  endMs: T0 + 62 * MIN,
  state: "fail",
  workOrders: [
    {
      id: "WO-01-001",
      title: "Esquema de datos",
      frd: "frd-01-data-reading",
      state: "done",
      startMs: T0,
      endMs: T0 + 34 * MIN,
      durationMin: 34,
      attempts: 1,
    },
    {
      id: "WO-01-002",
      title: "CRUD de grupos",
      frd: "frd-01-data-reading",
      state: "fail",
      startMs: T0 + 34 * MIN,
      endMs: T0 + 62 * MIN,
      durationMin: 28,
      attempts: 2,
    },
  ],
  review: {
    startMs: T0 + 62 * MIN,
    endMs: T0 + 72 * MIN,
    verdict: "reject",
    durationMin: 10,
  },
};

const DURATIONS_TIMELINE: BuildTimeline = {
  frds: [FRD_01],
  hasDurations: true,
  source: "track",
  buildStartMs: T0,
};

const STRUCTURAL_TIMELINE: BuildTimeline = {
  frds: [
    {
      id: "frd-01-data-reading",
      label: "FRD-01",
      startMs: null,
      endMs: null,
      state: "todo",
      workOrders: [
        {
          id: "WO-01-001",
          title: "Esquema de datos",
          frd: "frd-01-data-reading",
          state: "done",
          startMs: null,
          endMs: null,
          durationMin: null,
          attempts: 1,
        },
        {
          id: "WO-01-002",
          title: "CRUD de grupos",
          frd: "frd-01-data-reading",
          state: "todo",
          startMs: null,
          endMs: null,
          durationMin: null,
          attempts: 1,
        },
      ],
      review: null,
    },
  ],
  hasDurations: false,
  source: "structural",
  buildStartMs: null,
};

const EMPTY_TIMELINE: BuildTimeline = {
  frds: [],
  hasDurations: false,
  source: "empty",
  buildStartMs: null,
};

// ---------------------------------------------------------------------------
// Empty mode
// ---------------------------------------------------------------------------

describe("TimelineView — empty mode", () => {
  it("renders the honest 'no build data yet' status", () => {
    render(<TimelineView timeline={EMPTY_TIMELINE} />);
    const empty = screen.getByTestId("timeline-gantt-empty");
    expect(empty).toBeTruthy();
    expect(empty.textContent).toMatch(/Sin datos de build/i);
  });

  it("treats a timeline with no FRDs as empty even if source claims otherwise", () => {
    render(<TimelineView timeline={{ ...EMPTY_TIMELINE, source: "track", hasDurations: true }} />);
    expect(screen.getByTestId("timeline-gantt-empty")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Structural mode
// ---------------------------------------------------------------------------

describe("TimelineView — structural mode", () => {
  it("renders the historical banner (no fabricated durations)", () => {
    render(<TimelineView timeline={STRUCTURAL_TIMELINE} />);
    const banner = screen.getByTestId("timeline-gantt-structural-banner");
    expect(banner.textContent).toMatch(/Histórico/i);
    expect(banner.textContent).toMatch(/sin duraciones/i);
  });

  it("groups WOs under their FRD with a state for each (icon+label, not color alone)", () => {
    render(<TimelineView timeline={STRUCTURAL_TIMELINE} />);
    expect(screen.getByTestId("timeline-gantt-frd-frd-01-data-reading")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-wo-WO-01-001")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-label-WO-01-001").textContent).toContain(
      "Esquema de datos",
    );
    // The per-WO state chip carries the textual state label.
    expect(screen.getByTestId("timeline-gantt-state-WO-01-001").textContent).toMatch(/Hecho/i);
  });

  it("renders NO duration bars in structural mode", () => {
    render(<TimelineView timeline={STRUCTURAL_TIMELINE} />);
    expect(screen.queryByTestId("timeline-gantt-bar-WO-01-001")).toBeNull();
    expect(screen.queryByTestId("timeline-gantt-axis")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Durations mode
// ---------------------------------------------------------------------------

describe("TimelineView — durations mode", () => {
  it("renders an FRD row with nested WO bars", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    expect(screen.getByTestId("timeline-gantt")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-frd-frd-01-data-reading")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-bar-WO-01-001")).toBeTruthy();
    expect(screen.getByTestId("timeline-gantt-bar-WO-01-002")).toBeTruthy();
  });

  it("shows the real duration in the WO meta and the bar title (tabular-nums)", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    expect(screen.getByTestId("timeline-gantt-meta-WO-01-001").textContent).toMatch(/34m/);
    expect(screen.getByTestId("timeline-gantt-bar-WO-01-001").title).toMatch(/34/);
  });

  it("renders each FRD as a collapsible <details> (open by default)", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    const frd = screen.getByTestId("timeline-gantt-frd-frd-01-data-reading");
    expect(frd.tagName.toLowerCase()).toBe("details");
    expect(frd.hasAttribute("open")).toBe(true);
  });

  it("sizes each WO bar proportionally to its duration (no equal-width floor bug)", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    const p1 = Number.parseFloat(screen.getByTestId("timeline-gantt-bar-WO-01-001").style.width);
    const p2 = Number.parseFloat(screen.getByTestId("timeline-gantt-bar-WO-01-002").style.width);
    expect(p1).toBeGreaterThan(p2); // 34m must be wider than 28m
    expect(Math.abs(p1 - p2)).toBeGreaterThan(1); // genuinely different, not floored to the same width
  });

  it("surfaces reopen attempts in the WO meta", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    expect(screen.getByTestId("timeline-gantt-meta-WO-01-002").textContent).toMatch(/2 intentos/);
  });

  it("renders a review segment bar for the FRD", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    expect(screen.getByTestId("timeline-gantt-review-frd-01-data-reading")).toBeTruthy();
  });

  it("renders an FRD summary bar = the sum of its work orders", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    // WO durations 34 + 28 = 62 min.
    const frdBar = screen.getByTestId("timeline-gantt-frd-bar-frd-01-data-reading");
    expect(frdBar.textContent).toMatch(/62m/);
  });

  it("AC-12-003.2 — renders the jump-to-first-error note for a fail WO", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    const note = screen.getByTestId("timeline-gantt-first-error");
    expect(note.textContent).toContain("WO-01-002");
    expect(note.textContent).toMatch(/primer error/i);
  });

  it("AC-12-003.2 — no jump note when nothing failed", () => {
    const allDone: BuildTimeline = {
      ...DURATIONS_TIMELINE,
      frds: [
        {
          ...FRD_01,
          state: "done",
          workOrders: FRD_01.workOrders.map((w) => ({ ...w, state: "done" as const })),
        },
      ],
    };
    render(<TimelineView timeline={allDone} />);
    expect(screen.queryByTestId("timeline-gantt-first-error")).toBeNull();
  });

  it("renders state icons (Tabler ti-*) per WO — state never by color alone", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    expect(screen.getByTestId("timeline-gantt-icon-WO-01-001").className).toMatch(/ti ti-/);
    expect(screen.getByTestId("timeline-gantt-icon-WO-01-002").className).toMatch(/ti ti-/);
  });

  it("uses CSS token colors, no hardcoded hex", () => {
    render(<TimelineView timeline={DURATIONS_TIMELINE} />);
    const bar1 = screen.getByTestId("timeline-gantt-bar-WO-01-001");
    const bar2 = screen.getByTestId("timeline-gantt-bar-WO-01-002");
    for (const el of [bar1, bar2]) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(style).toMatch(/var\(--/);
    }
  });
});
