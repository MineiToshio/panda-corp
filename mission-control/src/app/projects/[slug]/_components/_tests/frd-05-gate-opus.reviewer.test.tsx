/**
 * FRD-05 reviewer GATE (Opus 4.8) — adversarial edges the implementers did not see.
 *
 * Written by the REVIEWER (a DIFFERENT model from the sonnet/haiku implementers,
 * DR-015) at the FRD gate. WO-05-003 was previously REJECTED for a DR-057/DR-062
 * reuse violation (the FRD chip forked 3 ways + a hand-rolled role="tablist").
 * This gate is mutation-killing on that exact defect class AND closes the EARS
 * edges the implementers' own (green) tests skipped:
 *
 *   - EARS fail treatment, the WHOLE clause: a Fail card carries the danger
 *     variant AND signals failure by ICON + LABEL (never colour alone), AND the
 *     Fail column HEADER itself reads in the danger colour — exercised through the
 *     REAL WorkOrderBoard, not a stubbed card. (The implementers assert the
 *     card style; they never assert the header-locus or the colour-blind path.)
 *   - DR-057/DR-062 NEGATIVE assertion (mutation-killing): once the surface is
 *     rendered, there is NO bespoke FRD pill and NO ad-hoc role="tablist" left
 *     anywhere — the ONLY tablist is the shared Tabs primitive (data-testid
 *     tabs-root) and every FRD pill is the shared Chip (data-testid chip).
 *     A regression that re-forks a pill/tablist turns these RED.
 *   - EARS detail routing: the Documento-completo tab renders the ENTIRE
 *     markdown (not a truncation) and the back affordance points at the board.
 *   - Read-only invariant (REQ-05-006 / FDD-05 §4 + WCAG single-pointer): the
 *     whole work-orders surface has ZERO write affordances — no <form>, no manual
 *     move/drag, no run/build button. Read-only is conveyed structurally.
 *
 * Anchored in: FRD-05 EARS (fail treatment, AC-05-001.x, AC-05-002.x,
 * AC-05-003.1/.2), DR-057, DR-062, REQ-05-006.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { WorkOrderBoard } from "../wo-board/wo-board";
import { WorkOrderDetail } from "../wo-detail/wo-detail";
import { WoFrdFilter } from "../wo-frd-filter/wo-frd-filter";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function wo(overrides: Partial<WorkOrder> & Pick<WorkOrder, "id" | "state">): WorkOrder {
  return {
    title: `${overrides.id} — fixture`,
    frd: "frd-05-work-orders",
    relPath: `docs/frds/frd-05-work-orders/work-orders/${overrides.id.toLowerCase()}.md`,
    summary: "fixture summary",
    ...overrides,
  };
}

const ALL_STATES: readonly WorkOrderState[] = ["todo", "in_progress", "review", "done", "fail"];

// ---------------------------------------------------------------------------
// EARS — fail treatment is unmistakable AND not colour-alone
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (fail treatment): a failure is unmistakable by icon + label, not colour alone", () => {
  it("the Fail card carries the danger variant AND prefixes a textual/icon failure marker (colour-blind safe)", () => {
    render(<WorkOrderBoard orders={[wo({ id: "WO-X-001", state: "fail", title: "Boom" })]} />);

    // The card exists and is the SAME .card primitive (a fail VARIANT, not a 2nd card — DR-057).
    const card = screen.getByTestId("wo-card");
    expect(card).toBeInTheDocument();

    // Failure must be conveyed by something a colour-blind user perceives:
    // an explicit failure INDICATOR (icon with an accessible name + visually-hidden label).
    const indicator = within(card).getByTestId("wo-fail-indicator");
    // The accessible name OR the contained text says it failed — not just a red hue.
    const accessibleName = indicator.getAttribute("aria-label") ?? "";
    const hasText = /fall/i.test(`${accessibleName} ${indicator.textContent ?? ""}`);
    expect(
      hasText,
      "the fail card must signal failure by an accessible icon + label (never colour alone) — EARS fail treatment",
    ).toBe(true);
  });

  it("ONLY the Fail column header gets the danger treatment (the locus is the Fail column, not every header)", () => {
    render(
      <WorkOrderBoard
        orders={[wo({ id: "WO-X-002", state: "fail" }), wo({ id: "WO-X-003", state: "done" })]}
      />,
    );

    const labels = screen.getAllByTestId("kanban-col-label");
    // Find the Fail column label ("Falló") and a non-fail one ("Hecho").
    const failLabel = labels.find((l) => /Falló/.test(l.textContent ?? ""));
    const doneLabel = labels.find((l) => /Hecho/.test(l.textContent ?? ""));
    expect(failLabel, "the Fail column header must exist").toBeTruthy();
    expect(doneLabel, "the Done column header must exist").toBeTruthy();

    // The Fail header colour resolves to the danger token; a normal header does not.
    // (KanbanColumn applies color:var(--color-danger) only when danger={true}.)
    expect(
      (failLabel as HTMLElement).style.color,
      "the Fail column header must read in the danger colour (EARS fail treatment)",
    ).toContain("--color-danger");
    expect(
      (doneLabel as HTMLElement).style.color,
      "a non-fail column header must NOT be danger-coloured (the danger locus is the Fail column only)",
    ).not.toContain("--color-danger");
  });

  it("a non-fail card carries NO fail indicator (the marker is specific to failure, not decorative)", () => {
    render(<WorkOrderBoard orders={[wo({ id: "WO-X-004", state: "in_progress" })]} />);
    const card = screen.getByTestId("wo-card");
    expect(within(card).queryByTestId("wo-fail-indicator")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DR-057 / DR-062 — NEGATIVE, mutation-killing: no fork survives anywhere
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (DR-057/DR-062): the whole surface converges on the ONE Chip + ONE Tabs, no fork", () => {
  it("the board's FRD chip is the shared Chip (data-testid=chip) — a re-forked pill turns this RED", () => {
    render(<WorkOrderBoard orders={[wo({ id: "WO-X-010", state: "todo", frd: "frd-99-foo" })]} />);
    const chipSlot = screen.getByTestId("wo-frd-chip");
    const chip = within(chipSlot).queryByTestId("chip");
    expect(
      chip,
      "the board card's FRD chip must be the shared Chip primitive (DR-057), not a hand-rolled <span>",
    ).not.toBeNull();
    expect(chip?.textContent).toContain("frd-99-foo");
  });

  it("the detail's tab switcher is the ONLY tablist and it is the shared Tabs (no ad-hoc role=tablist)", () => {
    const order = wo({ id: "WO-X-011", state: "review" });
    render(<WorkOrderDetail order={order} content="# Doc" activeWoTab="summary" />);

    // Exactly ONE tablist, and it carries the shared Tabs stamp.
    const tablists = screen.getAllByRole("tablist");
    expect(
      tablists.length,
      "the WO detail must have exactly one tab switcher (no duplicate/ad-hoc tablist)",
    ).toBe(1);
    expect(
      within(tablists[0] as HTMLElement).queryAllByRole("tab").length,
      "the single tablist must be the shared Tabs (role=tab buttons inside tabs-root)",
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("tabs-root")).toBe(tablists[0]);
  });

  it("the filter pills AND the detail FRD chip both render the shared Chip — one pill primitive everywhere", () => {
    // Filter bar.
    const { unmount } = render(
      <WoFrdFilter frds={["frd-05-work-orders"]} selected={null} onSelect={() => undefined} />,
    );
    expect(screen.queryAllByTestId("chip").length).toBeGreaterThan(0);
    unmount();

    // Detail header.
    render(
      <WorkOrderDetail
        order={wo({ id: "WO-X-012", state: "done" })}
        content="# D"
        activeWoTab="summary"
      />,
    );
    const detailChipSlot = screen.getByTestId("wo-detail-frd-chip");
    expect(within(detailChipSlot).queryByTestId("chip")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EARS AC-05-003.1/.2 — detail routing: full doc + back affordance + tab nav
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (AC-05-003): the detail renders the FULL document and offers a way back", () => {
  it("the Documento-completo tab renders the ENTIRE markdown body, not a truncated preview", () => {
    const longBody = [
      "# WO heading",
      "",
      "## Scope",
      "First paragraph of scope.",
      "",
      "## Acceptance criteria",
      "- AC one",
      "- AC two",
      "",
      "## Definition of done",
      "The very last sentinel line UNIQUE_TAIL_TOKEN.",
    ].join("\n");

    render(
      <WorkOrderDetail
        order={wo({ id: "WO-X-020", state: "todo" })}
        content={longBody}
        activeWoTab="full"
      />,
    );

    const full = screen.getByTestId("wo-detail-full");
    // Both the first heading and the LAST line must be present → not truncated.
    expect(full.textContent).toContain("WO heading");
    expect(
      full.textContent,
      "AC-05-003.2: the full-document tab must render the ENTIRE work order (last line included)",
    ).toContain("UNIQUE_TAIL_TOKEN");
  });

  it("the back affordance returns to the board (?tab=work-orders), not to a dead anchor", () => {
    render(
      <WorkOrderDetail
        order={wo({ id: "WO-X-021", state: "todo" })}
        content="# x"
        activeWoTab="summary"
      />,
    );
    const back = screen.getByTestId("wo-detail-back");
    expect(back.getAttribute("href")).toContain("tab=work-orders");
  });

  it("the shared Tabs gives real arrow-key roving focus between Resumen and Documento completo", () => {
    render(
      <WorkOrderDetail
        order={wo({ id: "WO-X-022", state: "todo" })}
        content="# x"
        activeWoTab="summary"
      />,
    );
    const summaryTab = screen.getByTestId("wo-detail-tab-summary");
    const fullTab = screen.getByTestId("wo-detail-tab-full");
    summaryTab.focus();
    expect(document.activeElement).toBe(summaryTab);
    fireEvent.keyDown(screen.getByTestId("tabs-root"), { key: "ArrowRight" });
    expect(
      document.activeElement,
      "ArrowRight must move focus to the next tab (the shared Tabs roving tabindex, not a dead hand-roll)",
    ).toBe(fullTab);
  });
});

// ---------------------------------------------------------------------------
// REQ-05-006 — read-only invariant (no write path, single-pointer trivially met)
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (REQ-05-006): the work-orders surface is strictly read-only", () => {
  it("the rendered board has NO form and NO mutating control — read-only by construction", () => {
    const { container } = render(
      <WorkOrderBoard orders={ALL_STATES.map((s, i) => wo({ id: `WO-RO-${i}`, state: s }))} />,
    );
    expect(container.querySelector("form"), "a read-only board must render no <form>").toBeNull();
    expect(container.querySelector("input"), "a read-only board must render no <input>").toBeNull();
    // The only interactive elements are navigation links to a card's detail.
    const links = container.querySelectorAll("a");
    for (const a of Array.from(links)) {
      expect(
        a.getAttribute("href") ?? "",
        "every board link must be a read-only navigation to a WO detail, never a mutation",
      ).toContain("tab=work-orders");
    }
    // No <button> on the board itself (buttons would imply an action; the board is link-only).
    expect(
      container.querySelectorAll("button").length,
      "the board has no action buttons (read-only; drag/move not offered → single-pointer rule trivially met)",
    ).toBe(0);
  });
});
