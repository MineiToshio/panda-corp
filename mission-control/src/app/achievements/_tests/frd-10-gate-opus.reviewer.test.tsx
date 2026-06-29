/**
 * FRD-10 reviewer GATE — adversarial integration (Opus 4.8, powerful mode).
 *
 * Written by the REVIEWER (a different model from the implementers) at the FRD gate.
 * These exercise the WO-10-005 surfaces TOGETHER, anchored in the EARS criteria and in
 * the SPECIFIC reopen finding (2026-06-21, reopen_count 1): the two forked role="tablist"
 * bars were replaced by the ONE shared Tabs/SubTabs primitive (DR-062 / DR-057).
 *
 * The prior gate test (frd-10-reuse.gate.reviewer.test.tsx) asserts the primitive is
 * PRESENT (data-testid=tabs-root). That is necessary but decorative on its own (DR-016):
 * a component could import the shared Tabs, render it, and wire nothing — the panels would
 * never switch and the "keyboard accessibility" the JSDoc claims would be a lie (exactly
 * the lying comment the reopen finding flagged). These tests close that gap by exercising
 * the BEHAVIOR the real shared primitive provides and the hand-roll lacked:
 *
 *   1. Clicking a sub-tab actually swaps which panel is visible (onChange → setActiveTab
 *      → hidden toggling) — proves the shared Tabs is WIRED, not a decorative wrapper.
 *   2. ArrowRight/ArrowLeft move roving focus across the tab buttons — the capability the
 *      hand-rolled tablist did NOT have; only the genuine shared primitive provides it.
 *      Re-forking a bespoke role=tablist (no key handler) makes this RED → mutation-killing.
 *   3. The UniquesSection category filter (second reopen defect) actually filters via the
 *      shared SubTabs onChange — clicking a category hides the others.
 *
 * Stack: Vitest + @testing-library/react + user-event + jsdom.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ChainState, Secret, Unique } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { HallTabs } from "../_components/HallTabs";
import { UniquesSection } from "../UniquesSection/UniquesSection";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SHIPPED_CHAIN: ChainState = {
  statKey: "shipped",
  label: "Productos lanzados",
  currentTierIndex: 0,
  currentTierName: "Bronce",
  nextTier: { name: "Plata", threshold: 3 },
  pctToNext: 40,
  lowerIsBetter: false,
  unlocks: [{ tier: 0, date: "2026-01-15", project: "demo" }],
};

const UNLOCKED_TROPHY: Unique = {
  name: "El primer ladrillo",
  category: "Discovery",
  rarity: "Común",
  unlocked: true,
  date: "2026-01-15",
  project: "demo",
  condition: "Lanza tu primer producto.",
};

const SECRET: Secret = { hint: "Una sombra entre las ideas…", unlocked: false };

const READER_DATA: ReaderData = { ideas: [], statuses: [], eventsSnapshot: null };

function renderHall() {
  return render(
    <HallTabs
      chains={[SHIPPED_CHAIN]}
      uniques={[UNLOCKED_TROPHY]}
      secrets={[SECRET]}
      readerData={READER_DATA}
      trophiesCount={1}
      trophiesTotal={1}
      missionsActive={1}
      hero={<div data-testid="guild-hero" />}
      level={{ level: 3, title: "Buscador del Alba II", xp: 200, next: 450, pctToNext: 30 }}
    />,
  );
}

describe("FRD-10 GATE [opus]: the shared Tabs primitive is WIRED, not decorative", () => {
  it("clicking a sub-tab swaps the visible panel (onChange → hidden toggling)", async () => {
    const user = userEvent.setup();
    renderHall();

    // Default tab is Resumen — its panel is visible, the others hidden.
    const resumenPanel = document.getElementById("logros-panel-resumen");
    const trofeosPanel = document.getElementById("logros-panel-trofeos");
    expect(resumenPanel?.hidden, "Resumen panel visible by default").toBe(false);
    expect(trofeosPanel?.hidden, "Trofeos panel hidden by default").toBe(true);

    // Click the Trofeos tab (a real <button role=tab> inside the shared Tabs).
    await user.click(screen.getByTestId("logros-tab-trofeos"));

    // The shared primitive's onChange must have flipped the active tab → panels swap.
    expect(
      trofeosPanel?.hidden,
      "after clicking Trofeos its panel must become visible — proves the shared Tabs onChange is wired (not a decorative import)",
    ).toBe(false);
    expect(resumenPanel?.hidden, "Resumen panel hidden after switching away").toBe(true);

    // The Trofeos panel content is the real one (trophy count strip).
    expect(within(trofeosPanel as HTMLElement).getByText(/trofeos conquistados/i)).toBeTruthy();
  });

  it("the active sub-tab carries aria-selected=true and the others false (real tab semantics)", async () => {
    const user = userEvent.setup();
    renderHall();

    const resumenTab = screen.getByTestId("logros-tab-resumen");
    const misionesTab = screen.getByTestId("logros-tab-misiones");
    expect(resumenTab.getAttribute("aria-selected")).toBe("true");
    expect(misionesTab.getAttribute("aria-selected")).toBe("false");

    await user.click(misionesTab);
    expect(misionesTab.getAttribute("aria-selected")).toBe("true");
    expect(resumenTab.getAttribute("aria-selected")).toBe("false");
  });

  it("ArrowRight/ArrowLeft move roving focus across the sub-tabs (the capability the hand-roll lacked)", async () => {
    const user = userEvent.setup();
    renderHall();

    // Roving tabindex: only the active tab is in the tab order (tabIndex 0), others -1.
    const resumenTab = screen.getByTestId("logros-tab-resumen");
    const misionesTab = screen.getByTestId("logros-tab-misiones");
    const rangosTab = screen.getByTestId("logros-tab-rangos"); // the LAST tab now
    expect(resumenTab.getAttribute("tabindex")).toBe("0");
    expect(misionesTab.getAttribute("tabindex")).toBe("-1");

    // Focus the active tab, then arrow-navigate. Only the genuine shared Tabs has the
    // ArrowLeft/ArrowRight handler; a re-forked bespoke role=tablist makes this RED.
    resumenTab.focus();
    expect(document.activeElement).toBe(resumenTab);

    await user.keyboard("{ArrowRight}");
    expect(
      document.activeElement,
      "ArrowRight must move focus to the next tab — proves the real shared Tabs primitive (roving tabindex), not a hand-roll",
    ).toBe(misionesTab);

    // Wraps: from the last tab (rangos) ArrowRight returns to the first.
    rangosTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement, "ArrowRight wraps to the first tab").toBe(resumenTab);

    // ArrowLeft wraps the other way.
    resumenTab.focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement, "ArrowLeft from the first tab wraps to the last").toBe(
      rangosTab,
    );
  });
});

describe("FRD-10 GATE [opus]: UniquesSection category filter is the wired shared SubTabs (2nd reopen defect)", () => {
  const DISCOVERY: Unique = {
    name: "El explorador",
    category: "Discovery",
    rarity: "Común",
    unlocked: false,
    condition: "Crea tu primera idea.",
  };
  const SPEED: Unique = {
    name: "El rápido",
    category: "Speed",
    rarity: "Poco común",
    unlocked: false,
    condition: "Lanza en 48 horas.",
  };

  it("clicking a category chip filters the items to that category (onChange wired)", async () => {
    const user = userEvent.setup();
    render(<UniquesSection uniques={[DISCOVERY, SPEED]} />);

    // Both locked → both shown in "Por conquistar" under the default "Todos" filter.
    const porConquistar = () => screen.getByTestId("uniques-por-conquistar");
    expect(within(porConquistar()).getAllByTestId("unique-item")).toHaveLength(2);

    // Click the Speed chip — the shared SubTabs onChange must filter to Speed only.
    await user.click(screen.getByTestId("uniques-cat-chip-Speed"));
    const afterSpeed = within(porConquistar()).getAllByTestId("unique-item");
    expect(afterSpeed, "only the Speed item remains when its chip is active").toHaveLength(1);
    expect(within(porConquistar()).getByTestId("unique-name").textContent).toContain("El rápido");

    // Back to "Todos" reveals both again.
    await user.click(screen.getByTestId("uniques-cat-chip-all"));
    expect(within(porConquistar()).getAllByTestId("unique-item")).toHaveLength(2);
  });

  it("the category filter chips live inside the shared Tabs primitive (no second fork)", () => {
    render(<UniquesSection uniques={[DISCOVERY, SPEED]} />);
    const tabsRoot = screen.getByTestId("tabs-root");
    const tabButtons = within(tabsRoot).getAllByRole("tab");
    // all + Discovery + Speed = 3 chips, every one a role=tab inside the shared wrapper.
    expect(tabButtons.length).toBe(3);
  });
});
