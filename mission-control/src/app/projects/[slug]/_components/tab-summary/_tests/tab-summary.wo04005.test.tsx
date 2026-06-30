/**
 * WO-04-005 — TabSummary re-paint tests
 *
 * These tests verify the additional acceptance criteria introduced by the
 * WO-04-005 re-paint:
 *
 *   AC-WO-04-005-B   Each pending decision SHALL render the /pandacorp:decide <id>
 *                    command row via CmdRow (data-testid="cmd-row") so the copy can
 *                    work — scoped to that one decision, never the bare un-scoped form.
 *   AC-WO-04-005-D   The decisions section uses Panel primitive for warn-bg container
 *                    (data-testid="decision-warn-panel" on each card).
 *   AC-WO-04-005-E   The summary section uses Panel primitive
 *                    (data-testid="panel" at the section level).
 *
 * The "Aprobar la recomendación" one-click affordance was REMOVED (owner decision,
 * 2026-06-30): a pre-baked approve button let the owner record an answer without the
 * context a real /pandacorp:decide <id> conversation provides. The recommendation
 * TEXT still renders as context; there is no longer a one-click command for it.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * This file tests rendering contracts only — I/O is tested in lib/docs tests.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActivityLog, DecisionPoint } from "@/lib/docs/activity";
import { TabSummary } from "../tab-summary";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_LOG: ActivityLog = { entries: [] };

const DECISION_WITH_REC: DecisionPoint = {
  id: "2026-06-15-1",
  title: "¿Usar Playwright para e2e?",
  date: "2026-06-15",
  status: "pending",
  resolved: false,
  recommendation: "Usar Playwright con fixtures para e2e.",
};

// ---------------------------------------------------------------------------
// AC-WO-04-005-B  CmdRow present for the /pandacorp:decide <id> command
// ---------------------------------------------------------------------------

describe("WO-04-005: TabSummary re-paint — CmdRow for /pandacorp:decide <id>", () => {
  it("AC-WO-04-005-B: WHEN pending decisions exist THEN cmd-row is rendered (for /pandacorp:decide <id>)", () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[DECISION_WITH_REC]}
        pendingDecisions={1}
      />,
    );
    // CmdRow renders a data-testid="cmd-row" element
    expect(screen.getByTestId("cmd-row")).toBeDefined();
  });

  it("AC-WO-04-005-B: cmd-row displays the /pandacorp:decide <id> command, scoped to this decision", () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[DECISION_WITH_REC]}
        pendingDecisions={1}
      />,
    );
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain("/pandacorp:decide 2026-06-15-1");
  });

  it("AC-WO-04-005-B / owner decision: no approve-btn exists anywhere (the one-click affordance was removed)", () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[DECISION_WITH_REC]}
        pendingDecisions={1}
      />,
    );
    expect(screen.queryByTestId("approve-btn")).not.toBeInTheDocument();
    // The recommendation TEXT still renders as context.
    expect(screen.getByText(/Usar Playwright con fixtures para e2e\./)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-WO-04-005-E  Summary section uses Panel primitive
// ---------------------------------------------------------------------------

describe("WO-04-005: TabSummary re-paint — Panel usage", () => {
  it("AC-WO-04-005-E: WHEN rendered THEN summary section wraps its content in a Panel (data-testid=panel)", () => {
    render(
      <TabSummary
        summary="Proyecto de prueba"
        keyPoints={["Key 1"]}
        activityLog={EMPTY_LOG}
        decisions={[]}
        pendingDecisions={0}
      />,
    );
    // The Panel component renders data-testid="panel"
    const panels = screen.getAllByTestId("panel");
    expect(panels.length).toBeGreaterThan(0);
  });

  it("AC-WO-04-005-E: WHEN rendered with decisions THEN multiple panels are present (one per section)", () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={{ entries: ["Actividad 1"] }}
        decisions={[DECISION_WITH_REC]}
        pendingDecisions={1}
      />,
    );
    // Expect at least 3 panels: summary + decisions + activity log
    const panels = screen.getAllByTestId("panel");
    expect(panels.length).toBeGreaterThanOrEqual(3);
  });
});
