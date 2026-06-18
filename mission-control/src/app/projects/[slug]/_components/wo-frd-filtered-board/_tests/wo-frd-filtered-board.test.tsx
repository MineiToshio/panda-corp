/**
 * WO-05-004 — WoFrdFilteredBoard integration tests (CMP-05-frd-filter)
 *
 * RED phase — written before implementation.
 *
 * Tests the stateful wrapper that combines WoFrdFilter + WorkOrderBoard
 * so that selecting an FRD actually narrows the visible cards.
 *
 * Traceability:
 *   AC-05-002.2  The kanban SHALL allow grouping/filtering by FRD.
 *
 * TDD requirements (from WO-05-004):
 *   1. Lists distinct FRDs present in the work orders.
 *   2. Selecting an FRD narrows the visible cards to that FRD.
 *   3. "All" restores the full set.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WO_ALPHA_1: WorkOrder = {
  id: "WO-01-001",
  title: "Alpha work order one",
  frd: "frd-01-alpha",
  state: "todo",
  relPath: "docs/frds/frd-01-alpha/work-orders/wo-01-001.md",
};

const WO_ALPHA_2: WorkOrder = {
  id: "WO-01-002",
  title: "Alpha work order two",
  frd: "frd-01-alpha",
  state: "done",
  relPath: "docs/frds/frd-01-alpha/work-orders/wo-01-002.md",
};

const WO_BETA_1: WorkOrder = {
  id: "WO-02-001",
  title: "Beta work order one",
  frd: "frd-02-beta",
  state: "in_progress",
  relPath: "docs/frds/frd-02-beta/work-orders/wo-02-001.md",
};

const WO_GAMMA_1: WorkOrder = {
  id: "WO-03-001",
  title: "Gamma work order one",
  frd: "frd-03-gamma",
  state: "review",
  relPath: "docs/frds/frd-03-gamma/work-orders/wo-03-001.md",
};

const ALL_ORDERS: WorkOrder[] = [WO_ALPHA_1, WO_ALPHA_2, WO_BETA_1, WO_GAMMA_1];

// ---------------------------------------------------------------------------
// TDD requirement 1 — Lists distinct FRDs present in the work orders
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-002.2 — WoFrdFilteredBoard lists distinct FRDs", () => {
  it("frd-05: AC-05-002.2 — WHEN rendered THEN shows the FRD filter control", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    expect(screen.getByTestId("wo-frd-filter")).toBeDefined();
  });

  it("frd-05: AC-05-002.2 — WHEN 3 distinct FRDs present THEN renders 3 FRD filter options", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    const options = screen.getAllByTestId("wo-frd-filter-option");
    expect(options).toHaveLength(3);
  });

  it("frd-05: AC-05-002.2 — WHEN orders provided THEN each distinct FRD slug appears in the filter", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const texts = options.map((o) => o.textContent ?? "");
    expect(texts.some((t) => t.includes("frd-01-alpha"))).toBe(true);
    expect(texts.some((t) => t.includes("frd-02-beta"))).toBe(true);
    expect(texts.some((t) => t.includes("frd-03-gamma"))).toBe(true);
  });

  it("frd-05: AC-05-002.2 — WHEN empty orders THEN filter renders without crash", () => {
    render(<WoFrdFilteredBoard orders={[]} />);
    expect(screen.getByTestId("wo-frd-filter")).toBeDefined();
  });

  it("frd-05: AC-05-002.2 — WHEN empty orders THEN no FRD filter options rendered", () => {
    render(<WoFrdFilteredBoard orders={[]} />);
    expect(screen.queryAllByTestId("wo-frd-filter-option")).toHaveLength(0);
  });

  it("frd-05: AC-05-002.2 — WHEN rendered with orders THEN board is also rendered", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    expect(screen.getByTestId("wo-board")).toBeDefined();
  });

  it("frd-05: AC-05-002.2 — WHEN FRDs have duplicates THEN only distinct FRDs shown in filter", () => {
    // frd-01-alpha appears twice — should show only once as filter option
    render(<WoFrdFilteredBoard orders={[WO_ALPHA_1, WO_ALPHA_2, WO_BETA_1]} />);
    const options = screen.getAllByTestId("wo-frd-filter-option");
    expect(options).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// TDD requirement 2 — Selecting an FRD narrows the visible cards to that FRD
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-002.2 — WoFrdFilteredBoard filtering narrows cards", () => {
  it("frd-05: AC-05-002.2 — WHEN no filter selected THEN all cards are visible", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    const cards = screen.getAllByTestId("wo-card");
    expect(cards).toHaveLength(ALL_ORDERS.length);
  });

  it("frd-05: AC-05-002.2 — WHEN frd-01-alpha selected THEN only alpha cards visible", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    // Click the frd-01-alpha filter option
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const alphaOption = options.find((o) => o.textContent?.includes("frd-01-alpha"));
    if (alphaOption) {
      fireEvent.click(alphaOption);
    }
    // Should show only alpha cards (2 of them)
    const cards = screen.getAllByTestId("wo-card");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      const chip = card.querySelector("[data-testid='wo-frd-chip']");
      expect(chip?.textContent).toContain("frd-01-alpha");
    }
  });

  it("frd-05: AC-05-002.2 — WHEN frd-02-beta selected THEN only beta cards visible", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const betaOption = options.find((o) => o.textContent?.includes("frd-02-beta"));
    if (betaOption) {
      fireEvent.click(betaOption);
    }
    const cards = screen.getAllByTestId("wo-card");
    expect(cards).toHaveLength(1);
    const chip = cards[0]?.querySelector("[data-testid='wo-frd-chip']");
    expect(chip?.textContent).toContain("frd-02-beta");
  });

  it("frd-05: AC-05-002.2 — WHEN a filter is selected THEN that option is aria-pressed=true", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const alphaOption = options.find((o) => o.textContent?.includes("frd-01-alpha"));
    if (alphaOption) {
      fireEvent.click(alphaOption);
    }
    const pressedOption = screen
      .getAllByTestId("wo-frd-filter-option")
      .find((o) => o.textContent?.includes("frd-01-alpha"));
    expect(pressedOption?.getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05: AC-05-002.2 — WHEN a filter selected THEN 'All' button is aria-pressed=false", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const alphaOption = options.find((o) => o.textContent?.includes("frd-01-alpha"));
    if (alphaOption) {
      fireEvent.click(alphaOption);
    }
    const allBtn = screen.getByTestId("wo-frd-filter-all");
    expect(allBtn.getAttribute("aria-pressed")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// TDD requirement 3 — "All" restores the full set
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-002.2 — WoFrdFilteredBoard 'All' restores full set", () => {
  it("frd-05: AC-05-002.2 — WHEN FRD selected then 'All' clicked THEN all cards restored", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    // Filter to beta
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const betaOption = options.find((o) => o.textContent?.includes("frd-02-beta"));
    if (betaOption) {
      fireEvent.click(betaOption);
    }
    // Confirm filtered
    expect(screen.getAllByTestId("wo-card")).toHaveLength(1);
    // Click "All"
    const allBtn = screen.getByTestId("wo-frd-filter-all");
    fireEvent.click(allBtn);
    // All cards restored
    expect(screen.getAllByTestId("wo-card")).toHaveLength(ALL_ORDERS.length);
  });

  it("frd-05: AC-05-002.2 — WHEN 'All' is active THEN 'All' button aria-pressed=true", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    const allBtn = screen.getByTestId("wo-frd-filter-all");
    expect(allBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05: AC-05-002.2 — WHEN 'All' is clicked after filter THEN 'All' becomes aria-pressed=true", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    // Select a filter
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const alphaOption = options.find((o) => o.textContent?.includes("frd-01-alpha"));
    if (alphaOption) {
      fireEvent.click(alphaOption);
    }
    // Click All
    fireEvent.click(screen.getByTestId("wo-frd-filter-all"));
    expect(screen.getByTestId("wo-frd-filter-all").getAttribute("aria-pressed")).toBe("true");
  });

  it("frd-05: AC-05-002.2 — WHEN FRD switched from alpha to gamma THEN only gamma cards shown", () => {
    render(<WoFrdFilteredBoard orders={ALL_ORDERS} />);
    // Click alpha
    const options = screen.getAllByTestId("wo-frd-filter-option");
    const alphaOption = options.find((o) => o.textContent?.includes("frd-01-alpha"));
    if (alphaOption) {
      fireEvent.click(alphaOption);
    }
    expect(screen.getAllByTestId("wo-card")).toHaveLength(2);
    // Now click gamma
    const gammaOption = screen
      .getAllByTestId("wo-frd-filter-option")
      .find((o) => o.textContent?.includes("frd-03-gamma"));
    if (gammaOption) {
      fireEvent.click(gammaOption);
    }
    expect(screen.getAllByTestId("wo-card")).toHaveLength(1);
    const chip = screen.getAllByTestId("wo-card")[0]?.querySelector("[data-testid='wo-frd-chip']");
    expect(chip?.textContent).toContain("frd-03-gamma");
  });
});
