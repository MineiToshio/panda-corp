/**
 * FRD-02 GATE — DR-062 cohesion check (reviewer-authored, DR-015).
 *
 * AC-02-009.1 requires the card detail to render its three tabs "using the SAME tab
 * pattern as the Portfolio project pane (the `stab` selector row)". WO-02-007 scope is
 * explicit: "the shared `Tabs` primitive (the ONE tab pattern, DR-062 — `.stab` level)".
 * `docs/design/components.md` claims CardDetail "uses `Tabs`".
 *
 * These tests assert the CANONICAL behavior the shared `Tabs` primitive guarantees and that
 * a bespoke per-screen switcher does not. They are written to FAIL against the current
 * bespoke `<div role=tablist>` + `tabButtonStyle` implementation and PASS once CardDetail
 * is re-painted onto the shared `Tabs` primitive (the DR-062 fix this gate requires).
 *
 * Stack: Vitest + @testing-library/react (jsdom). No mocks of any FRD-02 unit.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import { Tabs } from "@/components/core/Tabs/Tabs";

function renderDetail(): void {
  render(
    <CardDetail slug="my-idea" title="Mi idea" status="discovered" body="Resumen de la idea." />,
  );
}

describe("FRD-02 DR-062 — the card-detail tab row IS the shared Tabs primitive", () => {
  it("the shared Tabs primitive supports arrow-key navigation between tabs (the canonical contract)", async () => {
    // Baseline: prove the canonical primitive provides ArrowRight focus cycling.
    const user = userEvent.setup();
    let active = "a";
    render(
      <Tabs
        level="sub"
        ariaLabel="ref"
        active={active}
        onChange={(id) => {
          active = id;
        }}
        tabs={[
          { id: "a", label: "Uno" },
          { id: "b", label: "Dos" },
        ]}
      />,
    );
    const first = screen.getByRole("tab", { name: "Uno" });
    first.focus();
    await user.keyboard("{ArrowRight}");
    // The canonical primitive moves focus to the next tab on ArrowRight.
    expect(screen.getByRole("tab", { name: "Dos" })).toHaveFocus();
  });

  it("CardDetail's tab row provides the SAME arrow-key navigation as the shared primitive (AC-02-009.1 / DR-062)", async () => {
    const user = userEvent.setup();
    renderDetail();
    const propuesta = screen.getByTestId("card-detail-tab-propuesta");
    propuesta.focus();
    expect(propuesta).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    // If the bespoke switcher is used, focus stays put (no arrow-key handler) and this fails —
    // exactly the DR-062 divergence: a one-off tab look without the canonical keyboard contract.
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveFocus();
  });
});
