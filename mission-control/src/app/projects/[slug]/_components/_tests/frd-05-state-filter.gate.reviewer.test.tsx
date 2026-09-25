/**
 * FRD-05 gate — reviewer-authored adversarial + acceptance suite for REQ-05-007
 * (WO-05-007, the secondary work-order state filter). Builder-blind (DR-080): the
 * implementer may not edit this file.
 *
 * Exercises the feature's work orders TOGETHER against a REAL on-disk project:
 *   WO-05-001 listWorkOrders (frontmatter + legacy body markers)
 *   → WO-05-003 TabWorkOrders / WorkOrderBoard (five columns, fail treatment)
 *   → WO-05-004 WoFrdFilter + WO-05-007 WoStateFilter (AND-combined in WoFrdFilteredBoard).
 *
 * Edges the implementer's tests did not cover:
 *   - every state pill routes to EXACTLY its own board column (kills a swapped label map);
 *   - the filter's label set / order never drifts from the board's column headers (the
 *     labels are re-declared, not shared — this is the SSOT guard for that copy);
 *   - a legacy `## Status: blocked` body marker and a frontmatter BLOCKED both land under
 *     the "Falló" pill and keep the danger treatment (REQ-05-002 under filtering);
 *   - a filtered-to-empty board still shows five columns and is NOT the "no work orders"
 *     edge-case message (REQ-05-001 + the FRD edge case);
 *   - a live refresh (new `orders` prop) keeps the selected state and surfaces a WO that
 *     just moved into it (REQ-05-006 real-time + REQ-05-007);
 *   - keyboard-only operation via Enter and Space (AC-05-007.3);
 *   - filtering is view-only: no network write, no drag affordance (REQ-05-006 exclusion);
 *   - a large board (limit) filters exactly.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { listWorkOrders } from "@/lib/work-orders/work-orders";
import { TabWorkOrders } from "../tab-work-orders/tab-work-orders";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board/wo-frd-filtered-board";

// ---------------------------------------------------------------------------
// Real on-disk fixture project
// ---------------------------------------------------------------------------

interface WoFixture {
  readonly frdSlug: string;
  readonly file: string;
  readonly id: string;
  readonly title: string;
  /** DR-050 frontmatter value, or null to use the legacy `## Status:` body marker. */
  readonly implStatus: string | null;
  readonly legacyStatus?: string;
}

const FIXTURES: readonly WoFixture[] = [
  {
    frdSlug: "frd-01-alpha",
    file: "wo-01-001-a.md",
    id: "WO-01-001",
    title: "Alpha planned",
    implStatus: "PLANNED",
  },
  {
    frdSlug: "frd-01-alpha",
    file: "wo-01-002-b.md",
    id: "WO-01-002",
    title: "Alpha building",
    implStatus: "IN_PROGRESS",
  },
  {
    frdSlug: "frd-01-alpha",
    file: "wo-01-003-c.md",
    id: "WO-01-003",
    title: "Alpha reviewing",
    implStatus: "IN_REVIEW",
  },
  {
    frdSlug: "frd-01-alpha",
    file: "wo-01-004-d.md",
    id: "WO-01-004",
    title: "Alpha blocked",
    implStatus: "BLOCKED",
  },
  {
    frdSlug: "frd-01-alpha",
    file: "wo-01-005-e.md",
    id: "WO-01-005",
    title: "Alpha verified",
    implStatus: "VERIFIED",
  },
  {
    frdSlug: "frd-02-beta",
    file: "wo-02-001-a.md",
    id: "WO-02-001",
    title: "Beta verified",
    implStatus: "VERIFIED",
  },
  {
    frdSlug: "frd-02-beta",
    file: "wo-02-002-b.md",
    id: "WO-02-002",
    title: "Beta legacy blocked",
    implStatus: null,
    legacyStatus: "blocked",
  },
  {
    frdSlug: "frd-02-beta",
    file: "wo-02-003-c.md",
    id: "WO-02-003",
    title: "Beta reviewing",
    implStatus: "IN_REVIEW",
  },
];

/** Board column labels in canonical order, keyed by the state each column holds. */
const COLUMN_BY_STATE: Readonly<Record<WorkOrderState, number>> = {
  todo: 0,
  in_progress: 1,
  review: 2,
  fail: 3,
  done: 4,
};

let projectRoot = "";
let orders: WorkOrder[] = [];

function writeWo(root: string, wo: WoFixture): void {
  const dir = path.join(root, "docs", "frds", wo.frdSlug, "work-orders");
  fs.mkdirSync(dir, { recursive: true });
  const front = ["---", `id: ${wo.id}`, "type: work-order"];
  if (wo.implStatus !== null) front.push(`implementation_status: ${wo.implStatus}`);
  front.push("---");
  const body = wo.legacyStatus !== undefined ? [`## Status: ${wo.legacyStatus}`, ""] : [];
  fs.writeFileSync(
    path.join(dir, wo.file),
    [...front, `# ${wo.title}`, "", ...body].join("\n"),
    "utf-8",
  );
}

beforeAll(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd05-state-filter-"));
  for (const wo of FIXTURES) writeWo(projectRoot, wo);
  orders = listWorkOrders(projectRoot);
});

afterAll(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers — query by accessible role/name first
// ---------------------------------------------------------------------------

function stateGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Filtrar por estado" });
}

function frdGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Filtrar por FRD" });
}

/** The state pill whose visible text is exactly `label` (or "Todos"). */
function statePill(label: string): HTMLElement {
  const pill = within(stateGroup())
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").trim() === label);
  if (pill === undefined) throw new Error(`state pill "${label}" not found`);
  return pill;
}

function frdPill(label: string): HTMLElement {
  const pill = within(frdGroup())
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").trim() === label);
  if (pill === undefined) throw new Error(`FRD pill "${label}" not found`);
  return pill;
}

function columns(): HTMLElement[] {
  return screen.getAllByTestId("kanban-col-root");
}

function columnLabels(): string[] {
  return screen.getAllByTestId("kanban-col-label").map((l) => (l.textContent ?? "").trim());
}

function cardTitlesIn(column: HTMLElement): string[] {
  return within(column)
    .queryAllByTestId("wo-card")
    .map((c) => c.getAttribute("aria-label") ?? "");
}

function visibleTitles(): string[] {
  return screen.queryAllByTestId("wo-card").map((c) => c.getAttribute("aria-label") ?? "");
}

function pressedIn(group: HTMLElement): string[] {
  return within(group)
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => (b.textContent ?? "").trim());
}

// ---------------------------------------------------------------------------
// Fixture sanity (the reader is the upstream of every assertion below)
// ---------------------------------------------------------------------------

describe("frd-05 gate: fixture reaches the board through the real reader", () => {
  it("reads all 8 work orders with the expected states (BLOCKED + legacy blocked → fail)", () => {
    expect(orders).toHaveLength(FIXTURES.length);
    const byTitle = new Map(orders.map((o) => [o.title, o.state]));
    expect(byTitle.get("Alpha blocked")).toBe("fail");
    expect(byTitle.get("Beta legacy blocked")).toBe("fail");
    expect(byTitle.get("Alpha reviewing")).toBe("review");
    expect(byTitle.get("Alpha planned")).toBe("todo");
  });
});

// ---------------------------------------------------------------------------
// REQ-05-007 / AC-05-007.1 — options and exact per-state routing
// ---------------------------------------------------------------------------

describe("frd-05 gate: REQ-05-007 — the state filter as mounted in the Work orders tab", () => {
  it("AC-05-007.1 — the tab exposes BOTH filter groups, FRD first then state", () => {
    render(<TabWorkOrders orders={orders} />);
    const groups = screen.getAllByRole("group");
    const names = groups.map((g) => g.getAttribute("aria-label"));
    expect(names).toEqual(["Filtrar por FRD", "Filtrar por estado"]);
  });

  it("AC-05-007.1 (limit) — exactly 'Todos' + one pill per WorkOrderState: 6 pills, no more", () => {
    render(<TabWorkOrders orders={orders} />);
    expect(within(stateGroup()).getAllByRole("button")).toHaveLength(6);
  });

  it("SSOT guard — the state pills carry the board's column labels, in the board's column order", () => {
    render(<TabWorkOrders orders={orders} />);
    const pillLabels = within(stateGroup())
      .getAllByRole("button")
      .map((b) => (b.textContent ?? "").trim());
    expect(pillLabels).toEqual(["Todos", ...columnLabels()]);
  });

  it("the default view is unfiltered: 'Todos' pressed in both groups, every card visible", () => {
    render(<TabWorkOrders orders={orders} />);
    expect(pressedIn(stateGroup())).toEqual(["Todos"]);
    expect(pressedIn(frdGroup())).toEqual(["Todos"]);
    expect(visibleTitles()).toHaveLength(FIXTURES.length);
  });

  for (const state of Object.keys(COLUMN_BY_STATE) as WorkOrderState[]) {
    it(`AC-05-007.1 — selecting the '${state}' pill shows exactly the '${state}' work orders, all in their own column`, () => {
      render(<TabWorkOrders orders={orders} />);
      const colIndex = COLUMN_BY_STATE[state];
      const label = columnLabels()[colIndex] ?? "";
      fireEvent.click(statePill(label));

      const expected = orders.filter((o) => o.state === state).map((o) => o.title);
      expect(expected.length).toBeGreaterThan(0);
      expect([...visibleTitles()].sort()).toEqual([...expected].sort());

      const cols = columns();
      // REQ-05-001 still holds under filtering: five columns, same order.
      expect(cols).toHaveLength(5);
      cols.forEach((col, i) => {
        if (i === colIndex) {
          expect([...cardTitlesIn(col)].sort()).toEqual([...expected].sort());
        } else {
          expect(cardTitlesIn(col)).toEqual([]);
          expect(col.getAttribute("aria-label")).toMatch(/: 0 elementos$/);
        }
      });
      expect(pressedIn(stateGroup())).toEqual([label]);
    });
  }

  it("REQ-05-002 under filtering — the 'Falló' view keeps the danger treatment on every card (frontmatter AND legacy marker)", () => {
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(statePill("Falló"));
    const cards = screen.getAllByTestId("wo-card");
    expect(cards.map((c) => c.getAttribute("aria-label")).sort()).toEqual([
      "Alpha blocked",
      "Beta legacy blocked",
    ]);
    for (const card of cards) {
      expect(within(card).getByTestId("wo-fail-indicator")).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-05-007.2 — AND combination, independence, clearing
// ---------------------------------------------------------------------------

describe("frd-05 gate: AC-05-007.2 — FRD × state AND on real reader output", () => {
  it("FRD beta × 'Falló' → only the legacy-marker blocked WO (not alpha's BLOCKED one)", () => {
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(frdPill("frd-02-beta"));
    fireEvent.click(statePill("Falló"));
    expect(visibleTitles()).toEqual(["Beta legacy blocked"]);
  });

  it("order of selection does not matter (state first, then FRD → same intersection)", () => {
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(statePill("Review / Testing"));
    fireEvent.click(frdPill("frd-01-alpha"));
    expect(visibleTitles()).toEqual(["Alpha reviewing"]);
  });

  it("changing the FRD keeps the selected state pressed and re-intersects", () => {
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(statePill("Hecho"));
    fireEvent.click(frdPill("frd-01-alpha"));
    expect(visibleTitles()).toEqual(["Alpha verified"]);
    fireEvent.click(frdPill("frd-02-beta"));
    expect(visibleTitles()).toEqual(["Beta verified"]);
    expect(pressedIn(stateGroup())).toEqual(["Hecho"]);
    expect(pressedIn(frdGroup())).toEqual(["frd-02-beta"]);
  });

  it("switching state replaces (never accumulates) the previous state selection", () => {
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(statePill("To do"));
    fireEvent.click(statePill("En progreso"));
    expect(visibleTitles()).toEqual(["Alpha building"]);
    expect(pressedIn(stateGroup())).toEqual(["En progreso"]);
  });

  it("clearing both filters restores the complete board", () => {
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(frdPill("frd-01-alpha"));
    fireEvent.click(statePill("Falló"));
    fireEvent.click(statePill("Todos"));
    fireEvent.click(frdPill("Todos"));
    expect(visibleTitles()).toHaveLength(FIXTURES.length);
  });

  it("edge — an empty intersection keeps five empty columns and is NOT the 'no work orders' edge-case state", () => {
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(frdPill("frd-02-beta"));
    fireEvent.click(statePill("En progreso"));
    expect(visibleTitles()).toEqual([]);
    expect(columns()).toHaveLength(5);
    expect(screen.queryByTestId("wo-empty")).toBeNull();
    // Both filter rows stay reachable so the owner can widen the view again.
    expect(stateGroup()).toBeInTheDocument();
    expect(frdGroup()).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-05-007.3 — keyboard operation + non-color pressed signal
// ---------------------------------------------------------------------------

describe("frd-05 gate: AC-05-007.3 — keyboard-only operation", () => {
  it("Tab reaches the state pills and Enter selects one", async () => {
    const user = userEvent.setup();
    render(<TabWorkOrders orders={orders} />);
    const target = statePill("Falló");
    target.focus();
    expect(document.activeElement).toBe(target);
    await user.keyboard("{Enter}");
    expect(target.getAttribute("aria-pressed")).toBe("true");
    expect([...visibleTitles()].sort()).toEqual(["Alpha blocked", "Beta legacy blocked"]);
  });

  it("Space on 'Todos' clears the state filter", async () => {
    const user = userEvent.setup();
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(statePill("Hecho"));
    const all = statePill("Todos");
    all.focus();
    await user.keyboard(" ");
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(visibleTitles()).toHaveLength(FIXTURES.length);
  });

  it("every state pill is in the tab order (no tabindex=-1) and exposes its visible label in its accessible name", () => {
    render(<TabWorkOrders orders={orders} />);
    for (const pill of within(stateGroup()).getAllByRole("button")) {
      expect(pill.getAttribute("tabindex")).not.toBe("-1");
      const visible = (pill.textContent ?? "").trim();
      const name = pill.getAttribute("aria-label") ?? visible;
      // WCAG 2.5.3 label-in-name: the spoken name contains the visible text.
      expect(name).toContain(visible);
    }
  });
});

// ---------------------------------------------------------------------------
// Real-time (REQ-05-006 + FRD "Real-time / event-driven") under an active filter
// ---------------------------------------------------------------------------

describe("frd-05 gate: live refresh keeps the state filter and reflects the move", () => {
  it("a WO that moves INTO the selected state appears without resetting the filter", () => {
    const { rerender } = render(<WoFrdFilteredBoard orders={orders} />);
    fireEvent.click(statePill("Falló"));
    expect(visibleTitles()).toHaveLength(2);

    // Simulate router.refresh() after an agent marks "Alpha reviewing" BLOCKED.
    const moved = orders.map((o) =>
      o.title === "Alpha reviewing" ? { ...o, state: "fail" as const } : o,
    );
    act(() => {
      rerender(<WoFrdFilteredBoard orders={moved} />);
    });
    expect(pressedIn(stateGroup())).toEqual(["Falló"]);
    expect([...visibleTitles()].sort()).toEqual([
      "Alpha blocked",
      "Alpha reviewing",
      "Beta legacy blocked",
    ]);
  });

  it("a backward transition OUT of the selected state removes the card (gate reopen IN_REVIEW → PLANNED)", () => {
    const { rerender } = render(<WoFrdFilteredBoard orders={orders} />);
    fireEvent.click(statePill("Review / Testing"));
    expect([...visibleTitles()].sort()).toEqual(["Alpha reviewing", "Beta reviewing"]);
    const reopened = orders.map((o) =>
      o.title === "Beta reviewing" ? { ...o, state: "todo" as const } : o,
    );
    act(() => {
      rerender(<WoFrdFilteredBoard orders={reopened} />);
    });
    expect(visibleTitles()).toEqual(["Alpha reviewing"]);
  });
});

// ---------------------------------------------------------------------------
// Exclusion — REQ-05-006: the owner does NOT edit the kanban
// ---------------------------------------------------------------------------

describe("frd-05 gate: exclusion — filtering is view-only", () => {
  it("clicking every state pill performs no network write and exposes no drag affordance", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<TabWorkOrders orders={orders} />);
    for (const pill of within(stateGroup()).getAllByRole("button")) {
      fireEvent.click(pill);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(statePill("Todos"));
    const surfaces = [
      ...screen.queryAllByTestId("wo-card-link"),
      ...screen.queryAllByTestId("wo-card"),
    ];
    for (const el of surfaces) {
      expect(el.getAttribute("draggable")).not.toBe("true");
    }
    fetchSpy.mockRestore();
  });

  it("filtering never mutates the orders it was given", () => {
    const snapshot = JSON.stringify(orders);
    render(<TabWorkOrders orders={orders} />);
    fireEvent.click(frdPill("frd-01-alpha"));
    fireEvent.click(statePill("Hecho"));
    expect(JSON.stringify(orders)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Limit — a large board filters exactly
// ---------------------------------------------------------------------------

describe("frd-05 gate: limit — a large multi-FRD board", () => {
  it("300 work orders across 6 FRDs: FRD × state intersection count is exact", () => {
    const states: readonly WorkOrderState[] = ["todo", "in_progress", "review", "fail", "done"];
    const big: WorkOrder[] = Array.from({ length: 300 }, (_, i) => ({
      id: `WO-${String((i % 6) + 1).padStart(2, "0")}-${String(i).padStart(3, "0")}`,
      title: `Big ${i}`,
      frd: `frd-0${(i % 6) + 1}-big`,
      state: states[i % 5] ?? "todo",
      relPath: `docs/frds/frd-0${(i % 6) + 1}-big/work-orders/wo-${i}.md`,
    }));
    render(<WoFrdFilteredBoard orders={big} />);
    fireEvent.click(frdPill("frd-03-big"));
    fireEvent.click(statePill("Falló"));
    const expected = big.filter((o) => o.frd === "frd-03-big" && o.state === "fail");
    expect(expected.length).toBe(10);
    expect(visibleTitles()).toHaveLength(expected.length);
    expect(within(columns()[3] as HTMLElement).getAllByTestId("wo-card")).toHaveLength(10);
  });
});
