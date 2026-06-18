/**
 * WO-04-005 — TabSummary (CMP-04-tab-summary) tests
 *
 * Traceability:
 *   AC-04-003.1 Summary tab SHALL render the project summary and key points.
 *   AC-04-003.2 Summary tab SHALL render the activity log; absent → "no activity" empty state.
 *   AC-04-003.3 Summary tab SHALL render decision points, each highlighted, with a count badge.
 *   AC-04-004.1 WHEN pending_decisions > 0 → warning treatment + count; 0 → neutral state.
 *
 * Data layer (IF-04-docs):
 *   readActivityLog → ActivityLog { entries: string[] }
 *   readDecisions   → DecisionPoint[] { title, recommendation?, resolved }
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * This file tests rendering contracts only — I/O is tested in lib/docs.wo04002.test.ts.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActivityLog, DecisionPoint } from "@/lib/docs";
import { TabSummary } from "./tab-summary";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_LOG: ActivityLog = { entries: [] };

const LOG_WITH_ENTRIES: ActivityLog = {
  entries: [
    "WO-04-001 completado: listProjectDocs implementado.",
    "WO-04-002 en progreso: readActivityLog listo.",
    "Decisión pendiente sobre Playwright.",
  ],
};

const EMPTY_DECISIONS: DecisionPoint[] = [];

const TWO_OPEN_DECISIONS: DecisionPoint[] = [
  { title: "¿Usar Playwright para e2e?", resolved: false },
  {
    title: "Límite de eventos para readEvents",
    resolved: false,
    recommendation: "Usar 500 como límite por defecto.",
  },
];

const MIXED_DECISIONS: DecisionPoint[] = [
  { title: "Elegir base de datos", resolved: true },
  { title: "Estrategia de testing", resolved: false },
];

const ALL_RESOLVED: DecisionPoint[] = [
  { title: "Auth library", resolved: true },
  { title: "Deploy target", resolved: true },
];

const SAMPLE_SUMMARY = "Este proyecto implementa el panel de control de la fábrica.";
const SAMPLE_KEY_POINTS = ["Lectura de ideas", "Panel de proyectos", "Tablero Kanban"];

// ---------------------------------------------------------------------------
// AC-04-003.1 — Summary + key points
// ---------------------------------------------------------------------------

describe("frd-04: TabSummary — AC-04-003.1 summary and key points", () => {
  it("frd-04: AC-04-003.1 — WHEN summary is provided THEN renders the summary-section element", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={SAMPLE_KEY_POINTS}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("summary-section")).toBeDefined();
  });

  it("frd-04: AC-04-003.1 — WHEN summary is provided THEN renders the summary text", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={SAMPLE_KEY_POINTS}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("summary-text").textContent).toContain(SAMPLE_SUMMARY);
  });

  it("frd-04: AC-04-003.1 — WHEN key points are provided THEN renders the key-points-list element", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={SAMPLE_KEY_POINTS}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("key-points-list")).toBeDefined();
  });

  it("frd-04: AC-04-003.1 — WHEN key points are provided THEN each point is rendered as a list item", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={SAMPLE_KEY_POINTS}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    const items = screen.getAllByTestId("key-point-item");
    expect(items.length).toBe(SAMPLE_KEY_POINTS.length);
  });

  it("frd-04: AC-04-003.1 — WHEN keyPoints is empty THEN key-points-list is not rendered", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.queryByTestId("key-points-list")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.2 — Activity log rendering + empty state
// ---------------------------------------------------------------------------

describe("frd-04: TabSummary — AC-04-003.2 activity log", () => {
  it("frd-04: AC-04-003.2 — WHEN entries exist THEN renders the activity-log element", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={LOG_WITH_ENTRIES}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("activity-log")).toBeDefined();
  });

  it("frd-04: AC-04-003.2 — WHEN entries exist THEN renders each activity item", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={LOG_WITH_ENTRIES}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    const items = screen.getAllByTestId("activity-log-item");
    expect(items.length).toBe(LOG_WITH_ENTRIES.entries.length);
  });

  it("frd-04: AC-04-003.2 — WHEN entries is empty THEN renders activity-log-empty", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("activity-log-empty")).toBeDefined();
  });

  it("frd-04: AC-04-003.2 — WHEN entries is empty THEN empty state has role='status' for a11y", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    const empty = screen.getByTestId("activity-log-empty");
    expect(empty.getAttribute("role")).toBe("status");
  });

  it("frd-04: AC-04-003.2 — WHEN entries is empty THEN does NOT render activity-log-item elements", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.queryByTestId("activity-log-item")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-04-003.3 — Decision points rendering + count badge
// ---------------------------------------------------------------------------

describe("frd-04: TabSummary — AC-04-003.3 decision points", () => {
  it("frd-04: AC-04-003.3 — WHEN decisions is empty THEN renders decisions-empty", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("decisions-empty")).toBeDefined();
  });

  it("frd-04: AC-04-003.3 — WHEN decisions exist THEN renders the decisions-list element", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    expect(screen.getByTestId("decisions-list")).toBeDefined();
  });

  it("frd-04: AC-04-003.3 — WHEN decisions exist THEN renders one decision-item per DecisionPoint", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    const items = screen.getAllByTestId("decision-item");
    expect(items.length).toBe(TWO_OPEN_DECISIONS.length);
  });

  it("frd-04: AC-04-003.3 — WHEN pending decisions > 0 THEN renders decisions-count-badge", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    expect(screen.getByTestId("decisions-count-badge")).toBeDefined();
  });

  it("frd-04: AC-04-003.3 — WHEN pending decisions > 0 THEN badge shows the count", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    const badge = screen.getByTestId("decisions-count-badge");
    expect(badge.textContent).toContain("2");
  });

  it("frd-04: AC-04-003.3 — WHEN pending decisions is 0 THEN does NOT render decisions-count-badge", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={ALL_RESOLVED}
        pendingDecisions={0}
      />,
    );
    expect(screen.queryByTestId("decisions-count-badge")).toBeNull();
  });

  it("frd-04: AC-04-003.3 — WHEN a decision has a recommendation THEN it renders the recommendation text", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    const body = document.body;
    expect(body.textContent).toContain("Usar 500 como límite por defecto.");
  });
});

// ---------------------------------------------------------------------------
// AC-04-004.1 — Warning treatment for pending decisions
// ---------------------------------------------------------------------------

describe("frd-04: TabSummary — AC-04-004.1 warning highlight for pending decisions", () => {
  it("frd-04: AC-04-004.1 — WHEN pending_decisions > 0 THEN decisions-section has data-pending='true'", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    const section = screen.getByTestId("decisions-section");
    expect(section.getAttribute("data-pending")).toBe("true");
  });

  it("frd-04: AC-04-004.1 — WHEN pending_decisions === 0 THEN decisions-section has data-pending='false'", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={ALL_RESOLVED}
        pendingDecisions={0}
      />,
    );
    const section = screen.getByTestId("decisions-section");
    expect(section.getAttribute("data-pending")).toBe("false");
  });

  it("frd-04: AC-04-004.1 — WHEN pending_decisions > 0 THEN decision items have a warning indicator (not color-alone — icon present)", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    const indicators = screen.getAllByTestId("decision-warning-icon");
    expect(indicators.length).toBeGreaterThan(0);
  });

  it("frd-04: AC-04-004.1 — WHEN pending_decisions === 0 THEN renders the neutral decisions-empty state", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("decisions-empty")).toBeDefined();
  });

  it("frd-04: AC-04-004.1 — WHEN there are mixed decisions THEN pending count reflects only open ones", () => {
    // 1 open + 1 resolved = pendingDecisions = 1
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={MIXED_DECISIONS}
        pendingDecisions={1}
      />,
    );
    const badge = screen.getByTestId("decisions-count-badge");
    expect(badge.textContent).toContain("1");
  });
});

// ---------------------------------------------------------------------------
// Empty / loading states — no-content variants
// ---------------------------------------------------------------------------

describe("frd-04: TabSummary — empty and loading states", () => {
  it("frd-04: WHEN summary is empty string THEN still renders summary-section without crashing", () => {
    expect(() =>
      render(
        <TabSummary
          summary=""
          keyPoints={[]}
          activityLog={EMPTY_LOG}
          decisions={EMPTY_DECISIONS}
          pendingDecisions={0}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByTestId("summary-section")).toBeDefined();
  });

  it("frd-04: WHEN all data is absent/empty THEN renders without crash and shows both empty states", () => {
    render(
      <TabSummary
        summary=""
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={EMPTY_DECISIONS}
        pendingDecisions={0}
      />,
    );
    expect(screen.getByTestId("activity-log-empty")).toBeDefined();
    expect(screen.getByTestId("decisions-empty")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// data-testid coverage — every interactive/significant element
// ---------------------------------------------------------------------------

describe("frd-04: TabSummary — data-testid coverage (test-writer contract)", () => {
  it("frd-04: WHEN rendered with full data THEN all required testids are present", () => {
    render(
      <TabSummary
        summary={SAMPLE_SUMMARY}
        keyPoints={SAMPLE_KEY_POINTS}
        activityLog={LOG_WITH_ENTRIES}
        decisions={TWO_OPEN_DECISIONS}
        pendingDecisions={2}
      />,
    );
    // Core structure
    expect(screen.getByTestId("tab-summary")).toBeDefined();
    expect(screen.getByTestId("summary-section")).toBeDefined();
    expect(screen.getByTestId("summary-text")).toBeDefined();
    expect(screen.getByTestId("key-points-list")).toBeDefined();
    expect(screen.getByTestId("decisions-section")).toBeDefined();
    expect(screen.getByTestId("decisions-list")).toBeDefined();
    expect(screen.getByTestId("decisions-count-badge")).toBeDefined();
    expect(screen.getByTestId("activity-log")).toBeDefined();
  });
});
