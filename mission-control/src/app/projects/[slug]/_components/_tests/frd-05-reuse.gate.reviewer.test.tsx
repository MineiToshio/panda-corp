/**
 * FRD-05 reviewer GATE test — DR-057 / DR-062 reuse-before-create cohesion (Opus 4.8).
 *
 * Written by the REVIEWER (different model from the implementers) at the FRD gate.
 * "Reuse before create" is VERIFIED here, not assumed (DR-057). The living
 * inventory `docs/design/components.md` is the contract:
 *
 *   - line 102: `WoDetail` … "uses `Tabs`, `DocView`"
 *   - line 42 : `Tabs` is "The ONE tab pattern (DR-062)" — "no ad-hoc switcher per screen"
 *   - line 33 : `Chip` is "the one pill primitive" — `frdChip` is a tone preset, NOT a fork
 *   - line 101: `WorkOrderCard` … "wrapping title + FRD chip" (board uses `Chip` — the canonical one)
 *
 * The FRD-05 surface must therefore render its FRD chip through the SHARED `Chip`
 * primitive everywhere (board, detail, filter) and its tab switcher through the
 * SHARED `Tabs` primitive — NOT three bespoke pill styles and a hand-rolled
 * `role="tablist"`. A near-duplicate of an existing primitive is a defect, not a
 * feature (DR-057), and sibling components of one surface must converge on the
 * one pattern (DR-062 cohesion).
 *
 * Detection contract (the primitives stamp their own testids):
 *   - `Chip`  → `<span data-testid="chip" data-tone=…>`  (src/components/core/Chip/Chip.tsx)
 *   - `Tabs`  → `<div data-testid="tabs-root" role="tablist">` with `<button role="tab">`
 *               (src/components/core/Tabs/Tabs.tsx)
 *
 * Anchored in: DR-057, DR-062, components.md inventory rows for WoDetail/Tabs/Chip.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderDetail } from "../wo-detail/wo-detail";
import { WoFrdFilter } from "../wo-frd-filter/wo-frd-filter";

const WO: WorkOrder = {
  id: "WO-05-003",
  title: "WO-05-003 — Work-orders tab",
  frd: "frd-05-work-orders",
  state: "in_progress",
  relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-003-wo-board-tab.md",
  summary: "Render the work-orders tab.",
};

const MD = "# WO-05-003\n\n## Scope\nThe tab.\n";

describe("frd-05 GATE (DR-057): the FRD chip is the SHARED Chip primitive everywhere", () => {
  it("frd-05: the WoDetail FRD chip is rendered via the Chip primitive (data-testid=chip), not a bespoke pill", () => {
    render(<WorkOrderDetail order={WO} content={MD} activeWoTab="summary" />);
    const frdChip = screen.getByTestId("wo-detail-frd-chip");
    // The shared Chip stamps data-testid="chip"; a bespoke <span> does not.
    // Either the slot IS the chip, or it CONTAINS one.
    const isChip = frdChip.getAttribute("data-testid") === "chip";
    const containsChip = within(frdChip).queryByTestId("chip") !== null;
    expect(
      isChip || containsChip,
      "WoDetail must render its FRD chip through the shared Chip primitive (DR-057), not a hand-rolled FRD_CHIP_STYLE span",
    ).toBe(true);
  });

  it("frd-05: the WoFrdFilter option pills are rendered via the Chip primitive (DR-057), not a bespoke chipStyle()", () => {
    render(
      <WoFrdFilter
        frds={["frd-05-work-orders", "frd-04-project-workspace"]}
        selected={null}
        onSelect={() => undefined}
      />,
    );
    // At least one shared Chip must be present in the filter bar.
    expect(
      screen.queryAllByTestId("chip").length,
      "WoFrdFilter must build its FRD pills from the shared Chip primitive (DR-057), not a private chipStyle()",
    ).toBeGreaterThan(0);
  });
});

describe("frd-05 GATE (DR-062): the WoDetail tab switcher is the ONE Tabs primitive, not an ad-hoc tablist", () => {
  it("frd-05: WoDetail renders the shared Tabs primitive (data-testid=tabs-root), not a hand-rolled role=tablist", () => {
    render(<WorkOrderDetail order={WO} content={MD} activeWoTab="summary" />);
    expect(
      screen.queryByTestId("tabs-root"),
      "WoDetail must use the shared Tabs primitive (DR-062 'no ad-hoc switcher per screen'); the inventory (components.md:102) states WoDetail 'uses Tabs'",
    ).not.toBeNull();
  });
});
