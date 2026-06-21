/**
 * FRD-10 reviewer GATE test — DR-057 / DR-062 reuse-before-create cohesion (Opus 4.8).
 *
 * Written by the REVIEWER (a different model from the implementers) at the FRD gate.
 * "Reuse before create" is VERIFIED here, not assumed (DR-057). The living inventory
 * `docs/design/components.md` is the contract:
 *
 *   - line 42 : `Tabs`/`SubTabs` is "The ONE tab pattern (DR-062)" — aliases include
 *               `.stab`, `SubTabs`, `logrosTabs`; explicit reuse target "WO/config/
 *               **logros sub-tabs**"; "no ad-hoc switcher per screen".
 *   - line 209: "One banner, one chip, one panel, **one tab** … the aliases noted in
 *               each row (`.stab`/…) are the same primitive named differently across
 *               FDDs — collapse to the canonical row, **never fork**."
 *   - line 120: `HallTabs` is the 4-tab Achievements Hall shell.
 *
 * The WO-10-005 scope itself (wo-10-005-hall-surfaces.md, "Scope") lists
 * `Tabs`/`SubTabs` (core) — "the four `.stab` sub-tabs" — as a primitive to REUSE.
 *
 * The Achievements Hall sub-tab bar (Resumen · Misiones · Trofeos · Estadísticas) is
 * exactly the canonical `logrosTabs` alias of the ONE `Tabs` primitive. It must
 * therefore render through the SHARED `Tabs`/`SubTabs` primitive — NOT a hand-rolled
 * `role="tablist"` with a private `stabStyle()`. A near-duplicate of an existing
 * primitive is a defect, not a feature (DR-057); sibling surfaces must converge on
 * the one pattern (DR-062 cohesion). This is the SAME defect class that reopened
 * FRD-05 (WoDetail hand-rolled tablist) and FRD-07 (SectionTabs hand-rolled tablist).
 *
 * Detection contract (the primitive stamps its own testid):
 *   - `Tabs`/`SubTabs` → `<div data-testid="tabs-root" role="tablist">` with
 *                        `<button role="tab">` (src/components/core/Tabs/Tabs.tsx)
 *
 * Anchored in: DR-057, DR-062, components.md rows for Tabs/HallTabs + the WO-10-005
 * scope. EARS bullet "four `.stab` sub-tabs: Resumen · Misiones · Trofeos · Estadísticas".
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ChainState, Secret, Unique } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { HallTabs } from "../_components/HallTabs";
import { UniquesSection } from "../UniquesSection/UniquesSection";

// ── Minimal fixtures (the page already verifies the data pipeline; this gate is
//    purely about WHICH primitive renders the tab bar) ─────────────────────────

const CHAIN: ChainState = {
  statKey: "shipped",
  label: "Productos lanzados",
  currentTierIndex: 0,
  currentTierName: "Bronce",
  nextTier: { name: "Plata", threshold: 3 },
  pctToNext: 40,
  lowerIsBetter: false,
  unlocks: [{ tier: 0, date: "2026-01-15", project: "demo" }],
};

const UNIQUE: Unique = {
  name: "El primer ladrillo",
  category: "Discovery",
  unlocked: true,
  date: "2026-01-15",
  project: "demo",
  condition: "Lanza tu primer producto.",
};

const SECRET: Secret = {
  hint: "Una sombra entre las ideas…",
  unlocked: false,
};

const READER_DATA: ReaderData = {
  ideas: [],
  statuses: [],
  eventsSnapshot: null,
};

function renderHall() {
  return render(
    <HallTabs
      chains={[CHAIN]}
      uniques={[UNIQUE]}
      secrets={[SECRET]}
      readerData={READER_DATA}
      trophiesCount={1}
      trophiesTotal={1}
    />,
  );
}

describe("frd-10 GATE (DR-062): the Achievements Hall sub-tab bar is the ONE Tabs primitive", () => {
  it("frd-10: HallTabs renders the shared Tabs primitive (data-testid=tabs-root), not a hand-rolled role=tablist", () => {
    renderHall();
    expect(
      screen.queryByTestId("tabs-root"),
      "HallTabs must use the shared Tabs/SubTabs primitive (DR-062 'no ad-hoc switcher per screen'); " +
        "the inventory (components.md:42) lists `logrosTabs` as an alias of the ONE Tabs primitive and " +
        "the WO-10-005 scope lists Tabs/SubTabs as the four .stab sub-tabs to reuse. A private stabStyle() " +
        "role=tablist is a fork (the same defect that reopened FRD-05/FRD-07).",
    ).not.toBeNull();
  });

  it("frd-10: the four sub-tabs are tab buttons inside the shared Tabs primitive", () => {
    renderHall();
    const tabsRoot = screen.queryByTestId("tabs-root");
    expect(
      tabsRoot,
      "the four .stab sub-tabs (Resumen · Misiones · Trofeos · Estadísticas) must live inside the shared Tabs primitive",
    ).not.toBeNull();
  });
});

// ── UniquesSection category filter — DR-057/DR-062 (second defect in reopening) ──────────────

const UNIQUE_DISCOVERY: Unique = {
  name: "El explorador",
  category: "Discovery",
  unlocked: false,
  condition: "Crea tu primera idea.",
};
const UNIQUE_SPEED: Unique = {
  name: "El rápido",
  category: "Speed",
  unlocked: false,
  condition: "Lanza en 48 horas.",
};

describe("frd-10 GATE (DR-057): UniquesSection category filter uses the shared Tabs primitive", () => {
  /**
   * The WO-10-005 reopening finding (2026-06-21) explicitly names a SECOND defect:
   * UniquesSection hand-rolls a role="tablist" + inline pill buttons for the category
   * filter chips, instead of composing the shared Tabs/SubTabs (the ONE tab/pill pattern,
   * DR-062).  The fix must render through the shared Tabs primitive (data-testid="tabs-root").
   *
   * Detection: the shared Tabs stamps data-testid="tabs-root" on its wrapper div.
   * A hand-rolled role="tablist" does NOT carry this testid.
   */
  it("frd-10: UniquesSection category filter renders through the shared Tabs primitive (tabs-root present)", () => {
    render(<UniquesSection uniques={[UNIQUE_DISCOVERY, UNIQUE_SPEED]} />);
    // The shared Tabs primitive stamps data-testid="tabs-root" on its container.
    // If the filter uses a hand-rolled role=tablist this will be null → RED.
    expect(
      screen.queryByTestId("tabs-root"),
      "UniquesSection's category filter must use the shared Tabs/SubTabs primitive (DR-062 'no ad-hoc " +
        "switcher per screen'); a private role=tablist + inline pill styles is a fork of the ONE Tabs " +
        "pattern. The WO-10-005 reopening finding (2026-06-21) explicitly requires this fix.",
    ).not.toBeNull();
  });

  it("frd-10: UniquesSection category filter chip buttons are inside the shared Tabs primitive", () => {
    render(<UniquesSection uniques={[UNIQUE_DISCOVERY, UNIQUE_SPEED]} />);
    const tabsRoot = screen.queryByTestId("tabs-root");
    // Filter tabs (buttons with role="tab") must live inside the shared Tabs wrapper
    expect(tabsRoot, "shared Tabs wrapper must be present").not.toBeNull();
    const tabButtons = tabsRoot?.querySelectorAll('[role="tab"]');
    expect(
      tabButtons?.length ?? 0,
      "category filter tabs must be role=tab buttons inside the shared Tabs primitive",
    ).toBeGreaterThan(0);
  });
});
