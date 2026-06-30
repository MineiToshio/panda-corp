/**
 * FRD-04 gate — adversarial reviewer tests for TabSummary (WO-04-005).
 *
 * Regression anchor for a real browser failure observed at the FRD gate: rendering
 * the Summary tab with a pending decision that carries a recommendation once threw
 * React error #418 (a hydration mismatch) in production, caused by invalid
 * <button>-in-<button> nesting (the now-removed "Aprobar la recomendación"
 * affordance wrapped the shared CopyButton — itself a <button> — inside an outer
 * <button>). The affordance itself was removed (owner decision, 2026-06-30 — a
 * pre-baked approve button skipped the context a real `/pandacorp:decide <id>`
 * conversation gives), which makes this exact nesting structurally impossible —
 * but the general invariant (no <button> ever contains another <button>) is kept
 * here as a standing regression guard for the decision card.
 *
 * Why this is a CORRECTION (blocking), not a visual nit:
 *  - Invalid DOM nesting: a <button> cannot contain an interactive <button>
 *    (HTML spec; React validateDOMNesting emits a console.error and the server/
 *    client markup diverge → #418 pageerror).
 *  - Accessibility: nested interactive controls are not correctly operable by
 *    keyboard / assistive tech (accessibility.md — "everything operable by mouse
 *    is operable by keyboard"; the inner control's activation is ambiguous).
 *  - It fails the mandatory Preview Smoke Gate (DR-055): an uncaught pageerror /
 *    console error on the route is a RED gate.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActivityLog, DecisionPoint } from "@/lib/docs/activity";
import { TabSummary } from "../tab-summary";

const EMPTY_LOG: ActivityLog = { entries: [] };

function pendingWithRecommendation(): DecisionPoint[] {
  return [
    {
      id: "2026-06-15-1",
      title: "¿Subir el límite de gasto?",
      date: "2026-06-15",
      status: "pending",
      recommendation: "Usar 500 €/mes",
      resolved: false,
    },
  ];
}

describe("TabSummary — gate: the decision card must not nest interactive controls", () => {
  it("no <button> in the rendered tree contains a descendant <button> (HTML validity + a11y + #418 regression guard)", () => {
    const decisions = pendingWithRecommendation();
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={decisions}
        pendingDecisions={1}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      const nested = within(btn).queryAllByRole("button");
      expect(
        nested,
        "an interactive <button> must not contain another <button> (invalid DOM, breaks keyboard a11y, React #418)",
      ).toHaveLength(0);
    }
  });

  it("no approve-btn exists — recommendation renders as plain context text, never a one-click copy command", () => {
    const decisions = pendingWithRecommendation();
    render(
      <TabSummary
        summary="x"
        keyPoints={[]}
        activityLog={EMPTY_LOG}
        decisions={decisions}
        pendingDecisions={1}
      />,
    );

    expect(screen.queryByTestId("approve-btn")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Aprobado:");
    expect(screen.getByText(/Usar 500 €\/mes/)).toBeInTheDocument();
  });
});
