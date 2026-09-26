/**
 * FRD-05 reviewer GATE — REQ-05-007 state filter (WO-05-007), adversarial + integration.
 *
 * Written by the REVIEWER (a different model from the implementer, DR-015) at the
 * FRD gate. Exercises WoStateFilter TOGETHER with the VERIFIED foundation it composes
 * with (WoFrdFilter, WorkOrderBoard, TabWorkOrders) — never the filter in isolation:
 *
 *   - Label/column parity (DR-115 drift guard): the filter re-declares the board's
 *     column labels (COLUMNS in wo-board.tsx is not exported). Selecting pill i must
 *     route a card of state STATES[i] into board column i AND the pill text must equal
 *     that column's header — a relabel/reorder of either copy turns this RED.
 *   - Exhaustive AND matrix: every (FRD | all) x (state | all) combination against a
 *     fixture with holes and duplicates, driven through ONE render (so each filter's
 *     independence under the other's changes is exercised, not just fresh mounts).
 *   - Frame invariants under filtering: five columns in order (REQ-05-001), the Fail
 *     danger treatment (REQ-05-002) and the FRD chip (REQ-05-003) survive a filter.
 *   - Live refresh: a router.refresh()-driven prop change keeps the chosen filters and
 *     re-derives the view from the NEW orders (a WO moving review -> fail leaves the
 *     "review" view and appears in the "fail" view) — the real-time clause x REQ-05-007.
 *   - Keyboard + a11y (AC-05-007.3): tabbable pills, Space/Enter activation, exactly one
 *     aria-pressed=true per group, label-in-name.
 *   - Read-only (REQ-05-006): the filter adds no form/input/submit, never mutates the
 *     orders it is given and never navigates.
 *   - Edges/limits: the empty project shows the architecture message and no filter; an
 *     empty intersection keeps the frame and does NOT show the "no work orders" message;
 *     state pills are the fixed enum (never derived from the data); a 600-order board.
 *
 * Anchored in: FRD-05 REQ-05-001/002/003/006/007, the real-time clause, the edge case;
 * WO-05-007 AC-05-007.1/.2/.3.
 *
 * Stack: Vitest + @testing-library/react + user-event + jsdom.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { TabWorkOrders } from "../tab-work-orders/tab-work-orders";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board/wo-frd-filtered-board";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Canonical state order = the board's column order (REQ-05-001). */
const STATES: readonly WorkOrderState[] = ["todo", "in_progress", "review", "fail", "done"];
const FRDS = ["frd-01-alpha", "frd-02-beta", "frd-03-gamma"] as const;

/** Build a WorkOrder whose title equals its id (so a rendered card names its WO). */
function wo(id: string, frd: string, state: WorkOrderState): WorkOrder {
  return {
    id,
    title: id,
    frd,
    state,
    relPath: `docs/frds/${frd}/work-orders/${id.toLowerCase()}.md`,
    summary: "fixture",
  };
}

/**
 * 3 FRDs x 5 states with deliberate HOLES (alpha has no review; gamma has no todo and
 * no fail) and DUPLICATES (beta has two in_progress, alpha two done), so both
 * "empty intersection" and "more than one match" are exercised.
 */
function matrixOrders(): WorkOrder[] {
  const holes = new Set(["frd-01-alpha:review", "frd-03-gamma:todo", "frd-03-gamma:fail"]);
  const orders: WorkOrder[] = [];
  let n = 0;
  for (const frd of FRDS) {
    for (const state of STATES) {
      if (holes.has(`${frd}:${state}`)) continue;
      n += 1;
      orders.push(wo(`WO-M-${String(n).padStart(3, "0")}`, frd, state));
    }
  }
  orders.push(wo("WO-M-DUP-1", "frd-02-beta", "in_progress"));
  orders.push(wo("WO-M-DUP-2", "frd-01-alpha", "done"));
  return orders;
}

// ---------------------------------------------------------------------------
// Queries (role-first; test ids only for the board's own structural slots)
// ---------------------------------------------------------------------------

function stateGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Filtrar por estado" });
}

function frdGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Filtrar por FRD" });
}

/** The five state pills, in rendered order (excludes "Todos"). */
function statePills(): HTMLElement[] {
  return within(stateGroup()).getAllByTestId("wo-state-filter-option");
}

function stateAll(): HTMLElement {
  return within(stateGroup()).getByRole("button", { name: "Todos" });
}

function frdAll(): HTMLElement {
  return within(frdGroup()).getByRole("button", { name: "Todos" });
}

function frdPill(frd: string): HTMLElement {
  return within(frdGroup()).getByRole("button", { name: `Filtrar por ${frd}` });
}

function statePill(state: WorkOrderState): HTMLElement {
  const pill = statePills()[STATES.indexOf(state)];
  if (!pill) throw new Error(`no state pill for ${state}`);
  return pill;
}

/** Ids of the cards currently visible on the board, sorted. */
function visibleIds(): string[] {
  return screen
    .queryAllByTestId("wo-card")
    .map((c) => c.getAttribute("aria-label") ?? "")
    .sort();
}

function columnLabels(): string[] {
  return screen.getAllByTestId("kanban-col-label").map((l) => (l.textContent ?? "").trim());
}

function expectOnlyPressed(group: HTMLElement, pressed: HTMLElement): void {
  const buttons = within(group).getAllByRole("button");
  for (const b of buttons) {
    expect(b.getAttribute("aria-pressed"), "aria-pressed must be an explicit true/false").toMatch(
      /^(true|false)$/,
    );
  }
  expect(buttons.filter((b) => b.getAttribute("aria-pressed") === "true")).toEqual([pressed]);
}

function selectFrd(frd: string | null): void {
  fireEvent.click(frd === null ? frdAll() : frdPill(frd));
}

function selectState(state: WorkOrderState | null): void {
  fireEvent.click(state === null ? stateAll() : statePill(state));
}

/** The ids the AND of both filters must leave visible. */
function expectedIds(
  orders: readonly WorkOrder[],
  frd: string | null,
  state: WorkOrderState | null,
): string[] {
  return orders
    .filter((o) => frd === null || o.frd === frd)
    .filter((o) => state === null || o.state === state)
    .map((o) => o.id)
    .sort();
}

/** Select `state` (FRD already selected), assert the intersection; returns 1 if it is empty. */
function assertCombination(
  orders: readonly WorkOrder[],
  frd: string | null,
  state: WorkOrderState | null,
): number {
  selectState(state);
  const expected = expectedIds(orders, frd, state);
  expect(visibleIds(), `frd=${frd ?? "all"} state=${state ?? "all"}`).toEqual(expected);
  expectOnlyPressed(frdGroup(), frd === null ? frdAll() : frdPill(frd));
  expectOnlyPressed(stateGroup(), state === null ? stateAll() : statePill(state));
  return expected.length === 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// REQ-05-007 x REQ-05-001 — the filter's pills ARE the board's columns
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (REQ-05-007): state pills route to the matching board column", () => {
  it("pill i selects exactly the card of STATES[i], that card sits in column i, and the pill text equals column i's header", () => {
    const orders = STATES.map((s) => wo(`WO-S-${s}`, "frd-01-alpha", s));
    render(<WoFrdFilteredBoard orders={orders} />);

    const unfilteredLabels = columnLabels();
    expect(unfilteredLabels).toHaveLength(5);
    expect(statePills()).toHaveLength(STATES.length);

    STATES.forEach((state, i) => {
      const pill = statePills()[i] as HTMLElement;
      fireEvent.click(pill);

      expect(visibleIds(), `pill ${i} must isolate the ${state} work order`).toEqual([
        `WO-S-${state}`,
      ]);
      const col = screen.getAllByTestId("kanban-col-root")[i] as HTMLElement;
      expect(
        within(col)
          .queryAllByTestId("wo-card")
          .map((c) => c.getAttribute("aria-label")),
        `the ${state} card must land in column ${i}`,
      ).toEqual([`WO-S-${state}`]);
      expect(
        (pill.textContent ?? "").trim(),
        "the state pill must read exactly like its board column header (single wording)",
      ).toBe(unfilteredLabels[i]);
      expectOnlyPressed(stateGroup(), pill);
    });
  });

  it("the state pills are the fixed WorkOrderState enum, never derived from the data (a one-state board still offers all five)", () => {
    render(<WoFrdFilteredBoard orders={[wo("WO-ONLY-DONE", "frd-01-alpha", "done")]} />);
    expect(statePills()).toHaveLength(5);
    fireEvent.click(statePill("fail"));
    expect(visibleIds()).toEqual([]);
    fireEvent.click(statePill("done"));
    expect(visibleIds()).toEqual(["WO-ONLY-DONE"]);
  });
});

// ---------------------------------------------------------------------------
// AC-05-007.2 — exhaustive AND matrix, one render, independent filters
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (AC-05-007.2): FRD x state combine by logical AND for EVERY combination", () => {
  it("every (FRD|all) x (state|all) pair shows exactly the intersection — driven through one mounted board", () => {
    const orders = matrixOrders();
    render(<WoFrdFilteredBoard orders={orders} />);

    let emptyCombos = 0;
    for (const frd of [null, ...FRDS] as (string | null)[]) {
      selectFrd(frd);
      for (const state of [null, ...STATES] as (WorkOrderState | null)[]) {
        emptyCombos += assertCombination(orders, frd, state);
      }
    }
    // The fixture's holes must actually have produced empty intersections (fixture sanity).
    expect(emptyCombos).toBe(3);
  });

  it("changing the FRD while a state is pinned keeps the state (and vice versa) — neither filter resets the other", () => {
    const orders = matrixOrders();
    render(<WoFrdFilteredBoard orders={orders} />);
    fireEvent.click(statePill("in_progress"));
    fireEvent.click(frdPill("frd-02-beta"));
    expect(visibleIds()).toEqual(
      orders
        .filter((o) => o.frd === "frd-02-beta" && o.state === "in_progress")
        .map((o) => o.id)
        .sort(),
    );
    expect(visibleIds()).toHaveLength(2);
    fireEvent.click(frdPill("frd-03-gamma"));
    expect(statePill("in_progress").getAttribute("aria-pressed")).toBe("true");
    expect(visibleIds()).toEqual(
      orders.filter((o) => o.frd === "frd-03-gamma" && o.state === "in_progress").map((o) => o.id),
    );
  });
});

// ---------------------------------------------------------------------------
// Invariants of the board frame under a filter (REQ-05-001/002/003)
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (REQ-05-001/002/003 under REQ-05-007): filtering never breaks the board frame", () => {
  it("a state filter keeps all five columns in their order; the Fail card keeps its danger marker and FRD chip", () => {
    render(<WoFrdFilteredBoard orders={matrixOrders()} />);
    const before = columnLabels();
    fireEvent.click(statePill("fail"));

    expect(columnLabels(), "five columns, same order, even when four are empty").toEqual(before);
    const cards = screen.getAllByTestId("wo-card");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(within(card).getByTestId("wo-fail-indicator")).toBeDefined();
      expect(within(card).getByTestId("wo-frd-chip").textContent).toMatch(/^frd-0[1-3]-/);
    }
    const failCol = screen.getAllByTestId("kanban-col-root")[3] as HTMLElement;
    expect(within(failCol).getAllByTestId("wo-card")).toHaveLength(cards.length);
  });

  it("an EMPTY intersection keeps the five-column frame and does NOT claim the project has no work orders", () => {
    render(<TabWorkOrders orders={matrixOrders()} />);
    fireEvent.click(frdPill("frd-01-alpha"));
    fireEvent.click(statePill("review"));
    expect(visibleIds()).toEqual([]);
    expect(screen.getAllByTestId("kanban-col-root")).toHaveLength(5);
    expect(
      screen.queryByTestId("wo-empty"),
      "a filtered-to-nothing board is not the 'no work orders yet' edge case",
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Real-time clause x REQ-05-007 — a live refresh re-derives the filtered view
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (real-time x REQ-05-007): a live refresh keeps the filters and re-derives from the new state", () => {
  it("a WO moving review -> fail leaves the 'review' view and appears in the 'fail' view without the owner reselecting", () => {
    const v1 = [
      wo("WO-L-1", "frd-01-alpha", "review"),
      wo("WO-L-2", "frd-01-alpha", "todo"),
      wo("WO-L-3", "frd-02-beta", "review"),
    ];
    const { rerender } = render(<WoFrdFilteredBoard orders={v1} />);
    fireEvent.click(frdPill("frd-01-alpha"));
    fireEvent.click(statePill("review"));
    expect(visibleIds()).toEqual(["WO-L-1"]);

    // router.refresh() re-runs the Server Component tree: same client instance, NEW orders.
    const v2 = [
      wo("WO-L-1", "frd-01-alpha", "fail"),
      wo("WO-L-2", "frd-01-alpha", "review"),
      wo("WO-L-3", "frd-02-beta", "review"),
    ];
    rerender(<WoFrdFilteredBoard orders={v2} />);

    expect(statePill("review").getAttribute("aria-pressed")).toBe("true");
    expect(frdPill("frd-01-alpha").getAttribute("aria-pressed")).toBe("true");
    expect(visibleIds(), "the view must follow the NEW state, not a stale copy").toEqual([
      "WO-L-2",
    ]);

    fireEvent.click(statePill("fail"));
    expect(visibleIds()).toEqual(["WO-L-1"]);
    const card = screen.getByTestId("wo-card");
    expect(within(card).getByTestId("wo-fail-indicator")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-05-007.3 — keyboard-operable, state not by colour alone
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (AC-05-007.3): the state filter is fully keyboard-operable", () => {
  it("every state pill is reachable by Tab, Space selects it, Enter on 'Todos' restores the set", async () => {
    const user = userEvent.setup();
    const orders = matrixOrders();
    render(<WoFrdFilteredBoard orders={orders} />);

    const targets = new Set<HTMLElement>([stateAll(), ...statePills()]);
    const reached = new Set<HTMLElement>();
    for (let i = 0; i < 40 && reached.size < targets.size; i += 1) {
      await user.tab();
      const active = document.activeElement as HTMLElement | null;
      if (active && targets.has(active)) reached.add(active);
    }
    expect(reached.size, "every state pill (and Todos) must be in the tab order").toBe(
      targets.size,
    );

    statePill("fail").focus();
    await user.keyboard(" ");
    expect(statePill("fail").getAttribute("aria-pressed")).toBe("true");
    expect(visibleIds()).toEqual(
      orders
        .filter((o) => o.state === "fail")
        .map((o) => o.id)
        .sort(),
    );

    stateAll().focus();
    await user.keyboard("{Enter}");
    expect(visibleIds()).toHaveLength(orders.length);
    expectOnlyPressed(stateGroup(), stateAll());
  });

  it("each pill's accessible name contains its visible text (label-in-name) and names the group it filters", () => {
    render(<WoFrdFilteredBoard orders={matrixOrders()} />);
    for (const pill of statePills()) {
      const visible = (pill.textContent ?? "").trim();
      expect(visible.length).toBeGreaterThan(0);
      expect(pill.getAttribute("aria-label") ?? visible).toContain(visible);
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-05-006 — the filter is read-only chrome over the live state
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (REQ-05-006): the state filter adds no write path", () => {
  it("clicking every pill never mutates the (frozen) orders, never navigates, and renders no form/input/submit", () => {
    const orders = Object.freeze(matrixOrders().map((o) => Object.freeze({ ...o }))) as WorkOrder[];
    const snapshot = JSON.stringify(orders);
    const hrefBefore = window.location.href;
    render(<WoFrdFilteredBoard orders={orders} />);

    for (const pill of [...statePills(), stateAll()]) {
      expect(() => fireEvent.click(pill)).not.toThrow();
    }
    expect(JSON.stringify(orders)).toBe(snapshot);
    expect(window.location.href).toBe(hrefBefore);

    const group = stateGroup();
    expect(within(group).queryByRole("textbox")).toBeNull();
    expect(within(group).queryByRole("combobox")).toBeNull();
    for (const b of within(group).getAllByRole("button")) {
      expect(b.getAttribute("type"), "a filter pill must never submit").toBe("button");
    }
  });
});

// ---------------------------------------------------------------------------
// Edge case + composition inside the real tab coordinator
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (edge case x REQ-05-007): the tab composes the state filter correctly", () => {
  it("a project with NO work orders shows the architecture message and offers no state filter", () => {
    render(<TabWorkOrders orders={[]} />);
    expect(screen.getByTestId("wo-empty")).toBeDefined();
    expect(screen.getByTestId("wo-empty").textContent).toContain("/pandacorp:architecture");
    expect(screen.queryByRole("group", { name: "Filtrar por estado" })).toBeNull();
  });

  it("with work orders, the state row sits below the FRD row and both precede the board (DOM order)", () => {
    render(<TabWorkOrders orders={matrixOrders()} />);
    const frd = frdGroup();
    const state = stateGroup();
    const board = screen.getByTestId("wo-board");
    expect(frd.compareDocumentPosition(state) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(state.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Limit — a large multi-feature board stays exact
// ---------------------------------------------------------------------------

describe("FRD-05 GATE (limit): 600 work orders across 12 features filter exactly", () => {
  it("FRD x state narrows a 600-order board to the exact intersection count", () => {
    const orders: WorkOrder[] = [];
    for (let i = 0; i < 600; i += 1) {
      const frd = `frd-${String((i % 12) + 1).padStart(2, "0")}-f`;
      const state = STATES[i % STATES.length] as WorkOrderState;
      orders.push(wo(`WO-X-${String(i).padStart(4, "0")}`, frd, state));
    }
    render(<WoFrdFilteredBoard orders={orders} />);
    expect(visibleIds()).toHaveLength(600);

    fireEvent.click(statePill("review"));
    expect(visibleIds()).toHaveLength(120);

    fireEvent.click(frdPill("frd-07-f"));
    const expected = orders
      .filter((o) => o.frd === "frd-07-f" && o.state === "review")
      .map((o) => o.id)
      .sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(visibleIds()).toEqual(expected);
  });
});
