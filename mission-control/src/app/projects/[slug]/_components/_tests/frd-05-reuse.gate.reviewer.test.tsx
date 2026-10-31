/**
 * FRD-05 reviewer gate: DR-057 / DR-062 reuse-before-create, reconciled to the v2 surface (Opus).
 * The FRD chip of the detail and its tab switcher stay on the shared primitives; the FRD filter is
 * now the shared native select (AC-05-008.2), so a bespoke pill row must not return.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderDetail } from "../wo-detail/wo-detail";
import { WoFrdFilter } from "../wo-frd-filter/wo-frd-filter";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const WO: WorkOrder = {
  id: "WO-05-003",
  title: "WO-05-003 — Work-orders tab",
  frd: "frd-05-work-orders",
  state: "in_progress",
  relPath: "docs/frds/frd-05-work-orders/work-orders/wo-05-003-wo-board-tab.md",
  summary: "Render the work-orders tab.",
};
const MD = "# WO-05-003\n\n## Scope\nThe tab.\n";

describe("frd-05 gate (DR-057): one Chip and one select", () => {
  it("the detail's FRD label is the shared Chip", () => {
    render(<WorkOrderDetail order={WO} content={MD} activeWoTab="summary" />);
    const chips = screen.getAllByTestId("chip");
    expect(chips.some((chip) => /FRD-05/.test(chip.textContent ?? ""))).toBe(true);
  });

  it("the FRD filter is one labelled native select, not a pill row", () => {
    render(
      <WoFrdFilter
        frds={["FRD-05", "FRD-04"]}
        index={[
          { slug: "frd-05-work-orders", code: "FRD-05", title: "Work orders" },
          { slug: "frd-04-project-workspace", code: "FRD-04", title: "Workspace" },
        ]}
        selected={null}
        onSelect={() => undefined}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Filtrar por FRD" });
    expect(within(select).getAllByRole("option")).toHaveLength(3);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("frd-05 gate (DR-062): the detail uses the one Tabs primitive", () => {
  it("renders the shared Tabs, not a hand-rolled tablist", () => {
    render(<WorkOrderDetail order={WO} content={MD} activeWoTab="summary" />);
    expect(screen.getByTestId("tabs-root")).toBe(screen.getByRole("tablist"));
  });
});
