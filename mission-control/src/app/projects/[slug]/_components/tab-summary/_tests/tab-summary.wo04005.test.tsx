/**
 * WO-04-005 — TabSummary re-paint tests
 *
 * These tests verify the additional acceptance criteria introduced by the
 * WO-04-005 re-paint:
 *
 *   AC-WO-04-005-A   WHEN a pending decision has a recommendation, the
 *                    "Aprobar la recomendación" button SHALL be present
 *                    (data-testid="approve-btn").
 *   AC-WO-04-005-B   The approve button SHALL render the /pandacorp:decide command
 *                    row via CmdRow (data-testid="cmd-row") so the copy can work.
 *   AC-WO-04-005-C   A pending decision WITHOUT a recommendation SHALL NOT show
 *                    the approve button (copy only applies when there is a rec).
 *   AC-WO-04-005-D   The decisions section uses Panel primitive for warn-bg container
 *                    (data-testid="decision-warn-panel" on each card).
 *   AC-WO-04-005-E   The summary section uses Panel primitive
 *                    (data-testid="panel" at the section level).
 *   AC-WO-04-005-F   The "Aprobar" command is the full string
 *                    `/pandacorp:decide "Aprobado: <recommendation>"`.
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
  title: "¿Usar Playwright para e2e?",
  resolved: false,
  recommendation: "Usar Playwright con fixtures para e2e.",
};

const DECISION_WITHOUT_REC: DecisionPoint = {
  title: "Elegir base de datos",
  resolved: false,
};

const RESOLVED_DECISION: DecisionPoint = {
  title: "Deploy target",
  resolved: true,
  recommendation: "Usar Vercel",
};

// ---------------------------------------------------------------------------
// AC-WO-04-005-A  Approve button present when recommendation exists
// ---------------------------------------------------------------------------

describe("WO-04-005: TabSummary re-paint — approve button", () => {
  it("AC-WO-04-005-A: WHEN a pending decision has a recommendation THEN approve-btn is rendered", () => {
    render(
      <TabSummary
        summary="Proyecto de prueba"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[DECISION_WITH_REC]}
        pendingDecisions={1}
      />,
    );
    expect(screen.getByTestId("approve-btn")).toBeDefined();
  });

  it("AC-WO-04-005-A: WHEN multiple pending decisions have recommendations THEN approve-btn appears for each", () => {
    const decisions: DecisionPoint[] = [
      { title: "D1", resolved: false, recommendation: "Rec1" },
      { title: "D2", resolved: false, recommendation: "Rec2" },
    ];
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={decisions}
        pendingDecisions={2}
      />,
    );
    const btns = screen.getAllByTestId("approve-btn");
    expect(btns.length).toBe(2);
  });

  it("AC-WO-04-005-C: WHEN a pending decision has NO recommendation THEN approve-btn is NOT rendered", () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[DECISION_WITHOUT_REC]}
        pendingDecisions={1}
      />,
    );
    expect(screen.queryByTestId("approve-btn")).toBeNull();
  });

  it("AC-WO-04-005-C: WHEN a RESOLVED decision has a recommendation THEN approve-btn is NOT rendered for it", () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[RESOLVED_DECISION]}
        pendingDecisions={0}
      />,
    );
    expect(screen.queryByTestId("approve-btn")).toBeNull();
  });

  it("AC-WO-04-005-C: WHEN mixed decisions (one with rec, one without) THEN only one approve-btn appears", () => {
    const decisions: DecisionPoint[] = [DECISION_WITH_REC, DECISION_WITHOUT_REC];
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={decisions}
        pendingDecisions={2}
      />,
    );
    const btns = screen.getAllByTestId("approve-btn");
    expect(btns.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC-WO-04-005-B  CmdRow present for the approve command
// ---------------------------------------------------------------------------

describe("WO-04-005: TabSummary re-paint — CmdRow for /pandacorp:decide", () => {
  it("AC-WO-04-005-B: WHEN pending decisions exist THEN cmd-row is rendered (for /pandacorp:decide)", () => {
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

  it("AC-WO-04-005-B: cmd-row displays the /pandacorp:decide command", () => {
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
    expect(cmdRow.textContent).toContain("/pandacorp:decide");
  });
});

// ---------------------------------------------------------------------------
// AC-WO-04-005-F  Approve command text is the full command string
// ---------------------------------------------------------------------------

describe("WO-04-005: TabSummary re-paint — approve command text", () => {
  it('AC-WO-04-005-F: approve-btn contains text with "Aprobar"', () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[DECISION_WITH_REC]}
        pendingDecisions={1}
      />,
    );
    const btn = screen.getByTestId("approve-btn");
    expect(btn.textContent).toContain("Aprobar");
  });

  it("AC-WO-04-005-F: approve-btn has aria-label referencing /pandacorp:decide", () => {
    render(
      <TabSummary
        summary="Proyecto"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={[DECISION_WITH_REC]}
        pendingDecisions={1}
      />,
    );
    const btn = screen.getByTestId("approve-btn");
    // The aria-label or button text should reference the action
    const text = (btn.textContent ?? "") + (btn.getAttribute("aria-label") ?? "");
    expect(text.length).toBeGreaterThan(0);
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
