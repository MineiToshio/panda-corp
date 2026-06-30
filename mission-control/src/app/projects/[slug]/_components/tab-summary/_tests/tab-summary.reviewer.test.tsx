/**
 * FRD-04 gate — adversarial reviewer tests for TabSummary (WO-04-005).
 *
 * These pin defects the implementer did not see, anchored in the FRD's EARS
 * acceptance criteria (the "Aprobar la recomendación" one-click) and in a real
 * browser failure observed at the FRD gate: rendering the Summary tab with a
 * pending decision that carries a recommendation throws React error #418 (a
 * hydration mismatch) in production, caused by invalid <button>-in-<button>
 * nesting (the AC-mandated approve affordance wraps the shared CopyButton — itself
 * a <button> — inside an outer <button>).
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
 *
 * The fix is NOT to drop the approve affordance — the EARS AC requires a
 * one-click that copies `/pandacorp:decide "Aprobado: <recommendation>"`. The fix
 * is to make the approve affordance a SINGLE interactive control (e.g. a single
 * <button> that copies on click, or reuse CopyButton directly with its own label
 * — not a <button> wrapping another <button>).
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
      recommendation: "Usar 500 €/mes",
      resolved: false,
    },
  ];
}

describe("TabSummary — gate: approve affordance must not nest interactive controls", () => {
  it("the 'Aprobar la recomendación' affordance does NOT render a <button> inside a <button> (HTML validity + a11y + #418)", () => {
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

    // Every <button> in the rendered tree must NOT contain a descendant <button>.
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

  it("the approve affordance still copies the exact /pandacorp:decide command (the AC behavior must survive the fix)", () => {
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

    // The exact command must be present as the copy value somewhere in the approve UI.
    const expected = '/pandacorp:decide 2026-06-15-1 "Aprobado: Usar 500 €/mes"';
    const html = document.body.innerHTML;
    expect(html).toContain(expected);
  });
});
