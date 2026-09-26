/**
 * FRD-05 gate — reviewer-authored adversarial + acceptance suite for the work-order state
 * filter (WO-05-007) exercised TOGETHER with the FRD filter (WO-05-004) and the five-column
 * board (WO-05-003). Builder-blind (DR-080): the implementer may not edit this file.
 *
 * Traceability:
 *   REQ-05-007 / AC-05-007.1  every state pill narrows the board to exactly its own column
 *   AC-05-007.2               FRD x state AND, exhaustive over every (frd|all) x (state|all) pair
 *   AC-05-007.3               pressed state via aria-pressed + text; keyboard reachable + operable
 *   REQ-05-001 / REQ-05-002   filtered views keep the five columns and the fail danger treatment
 *   REQ-05-006 + real-time    a live re-render (router.refresh) keeps the selection and re-filters
 *   Exclusion (read-only)     filtering never mutates the orders nor exposes a drag/write path
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const STATES: readonly WorkOrderState[] = ["todo", "in_progress", "review", "fail", "done"];

/** The board's canonical column label per state (the copy the owner sees). */
const LABEL: Readonly<Record<WorkOrderState, string>> = {
  todo: "To do",
  in_progress: "En progreso",
  review: "Review / Testing",
  fail: "Falló",
  done: "Hecho",
};

function makeOrder(id: string, frd: string, state: WorkOrderState): WorkOrder {
  return {
    id,
    title: `${id} ${frd} ${state}`,
    frd,
    state,
    relPath: `docs/frds/${frd}/work-orders/${id.toLowerCase()}.md`,
  };
}

/** One work order per state, spread over two FRDs. */
const ONE_PER_STATE: readonly WorkOrder[] = STATES.map((state, i) =>
  makeOrder(`WO-0${(i % 2) + 1}-00${i + 1}`, i % 2 === 0 ? "frd-01-alpha" : "frd-02-beta", state),
);

/**
 * A sparse FRD x state matrix: some pairs populated (one twice), some deliberately EMPTY so the
 * exhaustive AND sweep crosses empty intersections as well as full ones.
 */
const MATRIX: readonly WorkOrder[] = [
  makeOrder("WO-01-001", "frd-01-alpha", "todo"),
  makeOrder("WO-01-002", "frd-01-alpha", "done"),
  makeOrder("WO-01-003", "frd-01-alpha", "done"),
  makeOrder("WO-01-004", "frd-01-alpha", "fail"),
  makeOrder("WO-02-001", "frd-02-beta", "in_progress"),
  makeOrder("WO-02-002", "frd-02-beta", "review"),
  makeOrder("WO-03-001", "frd-03-gamma", "fail"),
  makeOrder("WO-03-002", "frd-03-gamma", "todo"),
];

// ---------------------------------------------------------------------------
// Query helpers (role-first)
// ---------------------------------------------------------------------------

function stateGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Filtrar por estado" });
}

function frdGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Filtrar por FRD" });
}

function statePill(state: WorkOrderState): HTMLElement {
  return within(stateGroup()).getByRole("button", { name: `Filtrar por estado ${LABEL[state]}` });
}

function stateAll(): HTMLElement {
  return within(stateGroup()).getByRole("button", { name: "Todos" });
}

function frdPill(frd: string): HTMLElement {
  return within(frdGroup()).getByRole("button", { name: `Filtrar por ${frd}` });
}

function frdAll(): HTMLElement {
  return within(frdGroup()).getByRole("button", { name: "Todos" });
}

/** Titles of the visible cards, sorted (order-independent comparison). */
function visibleTitles(): string[] {
  return screen
    .queryAllByTestId("wo-card")
    .map((card) => card.getAttribute("aria-label") ?? "")
    .sort();
}

function column(label: string): HTMLElement {
  const escaped = label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return screen.getByRole("region", { name: new RegExp(`^Columna ${escaped}:`) });
}

function selectFrd(frd: string | null): void {
  fireEvent.click(frd === null ? frdAll() : frdPill(frd));
}

function selectState(state: WorkOrderState | null): void {
  fireEvent.click(state === null ? stateAll() : statePill(state));
}

/** The oracle: the AND intersection, computed independently of the component. */
function expectedIntersection(
  orders: readonly WorkOrder[],
  frd: string | null,
  state: WorkOrderState | null,
): string[] {
  return orders
    .filter((o) => (frd === null || o.frd === frd) && (state === null || o.state === state))
    .map((o) => o.title)
    .sort();
}

function pressedIn(group: HTMLElement): HTMLElement[] {
  return within(group)
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true");
}

// ---------------------------------------------------------------------------
// AC-05-007.1 — every state pill narrows the board to exactly its own column
// ---------------------------------------------------------------------------

describe("frd-05 review: AC-05-007.1 — each state pill routes to the matching column", () => {
  for (const state of STATES) {
    it(`frd-05 review: AC-05-007.1 — WHEN '${LABEL[state]}' is pressed THEN only the ${state} order shows, inside the '${LABEL[state]}' column`, () => {
      render(<WoFrdFilteredBoard orders={[...ONE_PER_STATE]} />);
      fireEvent.click(statePill(state));

      const expected = ONE_PER_STATE.filter((o) => o.state === state).map((o) => o.title);
      expect(visibleTitles()).toEqual(expected);

      const target = column(LABEL[state]);
      expect(within(target).getAllByTestId("wo-card")).toHaveLength(1);
      for (const other of STATES.filter((s) => s !== state)) {
        expect(within(column(LABEL[other])).queryAllByTestId("wo-card")).toHaveLength(0);
      }
    });
  }

  it("frd-05 review: AC-05-007.1 — the state pills, in order, carry EXACTLY the board's column labels (no divergent label map)", () => {
    render(<WoFrdFilteredBoard orders={[...ONE_PER_STATE]} />);
    const columnLabels = screen.getAllByTestId("kanban-col-label").map((l) => l.textContent ?? "");
    const pillTexts = within(stateGroup())
      .getAllByTestId("wo-state-filter-option")
      .map((p) => (p.textContent ?? "").trim());
    expect(pillTexts).toEqual(columnLabels);
  });

  it("frd-05 review: limit — the state options are the closed WorkOrderState set (5 + all), independent of the data", () => {
    // A board whose orders cover ONE state still offers all five state pills + "all".
    render(<WoFrdFilteredBoard orders={[makeOrder("WO-09-001", "frd-09-solo", "review")]} />);
    const buttons = within(stateGroup()).getAllByRole("button");
    expect(buttons).toHaveLength(STATES.length + 1);
    for (const state of STATES) {
      expect(statePill(state)).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-05-007.2 — exhaustive AND over every (frd|all) x (state|all) pair
// ---------------------------------------------------------------------------

describe("frd-05 review: AC-05-007.2 — FRD x state combine by logical AND (exhaustive)", () => {
  it("frd-05 review: AC-05-007.2 — WHEN every (frd|all) x (state|all) pair is selected THEN exactly the AND intersection shows", () => {
    render(<WoFrdFilteredBoard orders={[...MATRIX]} />);
    const frds: (string | null)[] = [null, "frd-01-alpha", "frd-02-beta", "frd-03-gamma"];
    const states: (WorkOrderState | null)[] = [null, ...STATES];
    let emptyIntersections = 0;

    for (const frd of frds) {
      selectFrd(frd);
      for (const state of states) {
        selectState(state);
        const expected = expectedIntersection(MATRIX, frd, state);
        if (expected.length === 0) emptyIntersections += 1;
        expect(visibleTitles(), `frd=${String(frd)} state=${String(state)}`).toEqual(expected);
        // The board keeps all five columns even when the intersection is empty (REQ-05-001).
        expect(screen.getAllByRole("region", { name: /^Columna / })).toHaveLength(5);
      }
    }
    // Guard the sweep itself: it must have crossed empty intersections, not only full ones.
    expect(emptyIntersections).toBeGreaterThan(3);
  });

  it("frd-05 review: AC-05-007.2 — WHEN the FRD is switched under an active state THEN the state stays applied", () => {
    render(<WoFrdFilteredBoard orders={[...MATRIX]} />);
    fireEvent.click(statePill("fail"));
    fireEvent.click(frdPill("frd-01-alpha"));
    expect(visibleTitles()).toEqual(["WO-01-004 frd-01-alpha fail"]);
    fireEvent.click(frdPill("frd-03-gamma"));
    expect(visibleTitles()).toEqual(["WO-03-001 frd-03-gamma fail"]);
    expect(statePill("fail").getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05 review: invariant — each filter group has EXACTLY one pressed pill at all times", () => {
    render(<WoFrdFilteredBoard orders={[...MATRIX]} />);
    const steps: (() => void)[] = [
      () => fireEvent.click(statePill("done")),
      () => fireEvent.click(frdPill("frd-02-beta")),
      () => fireEvent.click(statePill("done")), // re-press the already-active pill
      () => fireEvent.click(stateAll()),
      () => fireEvent.click(frdAll()),
    ];
    for (const step of steps) {
      step();
      expect(pressedIn(stateGroup())).toHaveLength(1);
      expect(pressedIn(frdGroup())).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-05-007.3 — aria-pressed + text, keyboard reachable and operable
// ---------------------------------------------------------------------------

describe("frd-05 review: AC-05-007.3 — pressed state is announced and keyboard-operable", () => {
  it("frd-05 review: AC-05-007.3 — WHEN a state is pressed THEN the pressed pill is exposed as pressed AND carries its visible text", () => {
    render(<WoFrdFilteredBoard orders={[...ONE_PER_STATE]} />);
    fireEvent.click(statePill("review"));
    const pressed = within(stateGroup()).getByRole("button", { pressed: true });
    expect(pressed.textContent?.trim()).toBe(LABEL.review);
    expect(
      within(stateGroup()).getByRole("button", { name: "Todos", pressed: false }),
    ).toBeDefined();
  });

  it("frd-05 review: AC-05-007.3 — WHEN tabbing from the top THEN the state pills are reached in the tab order", async () => {
    const user = userEvent.setup();
    render(<WoFrdFilteredBoard orders={[...ONE_PER_STATE]} />);
    const target = statePill("fail");
    let reached = false;
    for (let i = 0; i < 40 && !reached; i += 1) {
      await user.tab();
      reached = document.activeElement === target;
    }
    expect(reached).toBe(true);
  });

  it("frd-05 review: AC-05-007.3 — WHEN a state pill is activated with Enter / Space THEN the board filters and resets", async () => {
    const user = userEvent.setup();
    render(<WoFrdFilteredBoard orders={[...ONE_PER_STATE]} />);

    act(() => statePill("fail").focus());
    await user.keyboard("{Enter}");
    expect(visibleTitles()).toEqual(
      ONE_PER_STATE.filter((o) => o.state === "fail").map((o) => o.title),
    );
    expect(statePill("fail").getAttribute("aria-pressed")).toBe("true");

    act(() => stateAll().focus());
    await user.keyboard(" ");
    expect(visibleTitles()).toHaveLength(ONE_PER_STATE.length);
    expect(stateAll().getAttribute("aria-pressed")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// Integration with the rest of FRD-05
// ---------------------------------------------------------------------------

describe("frd-05 review: integration — the state filter over the live board", () => {
  it("frd-05 review: REQ-05-002 — WHEN filtered to 'Falló' THEN the fail card keeps the danger treatment and the icon", () => {
    render(<WoFrdFilteredBoard orders={[...MATRIX]} />);
    fireEvent.click(statePill("fail"));
    const cards = screen.getAllByTestId("wo-card");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(within(card).getByTestId("wo-fail-indicator")).toBeDefined();
    }
  });

  it("frd-05 review: real-time — WHEN a live refresh moves a WO out of the selected state THEN the selection persists and the board re-filters", () => {
    const moving = makeOrder("WO-07-001", "frd-07-live", "review");
    const other = makeOrder("WO-07-002", "frd-07-live", "todo");
    const { rerender } = render(<WoFrdFilteredBoard orders={[moving, other]} />);
    fireEvent.click(statePill("review"));
    expect(visibleTitles()).toEqual([moving.title]);

    // The agent's gate fails it: the server re-renders with new props (router.refresh()).
    const failed: WorkOrder = { ...moving, state: "fail" };
    rerender(<WoFrdFilteredBoard orders={[failed, other]} />);
    expect(statePill("review").getAttribute("aria-pressed")).toBe("true");
    expect(visibleTitles()).toEqual([]);

    // A new work order arrives in review: it shows without re-pressing the pill.
    const arrived = makeOrder("WO-07-003", "frd-07-live", "review");
    rerender(<WoFrdFilteredBoard orders={[failed, other, arrived]} />);
    expect(visibleTitles()).toEqual([arrived.title]);
  });

  it("frd-05 review: edge — WHEN the selected state has no orders THEN zero cards, five empty columns, no crash", () => {
    render(<WoFrdFilteredBoard orders={[makeOrder("WO-08-001", "frd-08-x", "todo")]} />);
    fireEvent.click(statePill("done"));
    expect(screen.queryAllByTestId("wo-card")).toHaveLength(0);
    const columns = screen.getAllByRole("region", { name: /^Columna / });
    expect(columns).toHaveLength(5);
    for (const col of columns) {
      expect(col.getAttribute("aria-label")).toMatch(/: 0 elementos$/);
    }
  });

  it("frd-05 review: exclusion — WHEN filtering THEN the orders are never mutated and no drag/write affordance appears", () => {
    const frozen = Object.freeze(
      MATRIX.map((o) => Object.freeze({ ...o })),
    ) as readonly WorkOrder[];
    const snapshot = JSON.stringify(frozen);
    render(<WoFrdFilteredBoard orders={frozen as WorkOrder[]} />);
    fireEvent.click(frdPill("frd-01-alpha"));
    fireEvent.click(statePill("done"));
    fireEvent.click(stateAll());
    expect(JSON.stringify(frozen)).toBe(snapshot);
    for (const card of screen.getAllByTestId("wo-card")) {
      expect(card.getAttribute("draggable")).not.toBe("true");
    }
    expect(visibleTitles()).toHaveLength(MATRIX.filter((o) => o.frd === "frd-01-alpha").length);
  });
});
