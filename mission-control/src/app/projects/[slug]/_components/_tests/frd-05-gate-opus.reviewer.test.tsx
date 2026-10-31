/**
 * FRD-05 reviewer gate (Opus), reconciled to the Órbita surface of WO-05-008 and WO-05-009.
 * Keeps the v1 intent: failure is unmistakable and never colour alone, no forked primitive,
 * the full document is complete, the return link is real, and the surface stays read-only.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder, WorkOrderState } from "@/lib/work-orders/work-orders";
import { WorkOrderBoard } from "../wo-board/wo-board";
import { WorkOrderDetail } from "../wo-detail/wo-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

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

describe("FRD-05 gate (REQ-05-002): a failure reads by icon and word", () => {
  it("the failed card names the failure in text and carries the same-card fail variant", () => {
    render(<WorkOrderBoard orders={[wo({ id: "WO-05-001", state: "fail", title: "Boom" })]} />);
    const card = screen.getByRole("link", { name: /WO-05-001/ });
    expect(card).toHaveClass("wocard", "is-failed");
    expect(within(card).getByText("Bloqueado")).toBeInTheDocument();
    expect(card.querySelector("svg")).not.toBeNull();
  });

  it("only the Bloqueado column takes the danger tone, and it sits after Verificado", () => {
    render(
      <WorkOrderBoard
        orders={[wo({ id: "WO-05-002", state: "fail" }), wo({ id: "WO-05-003", state: "done" })]}
      />,
    );
    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => region.getAttribute("data-testid"))).toEqual([
      "wo-column-todo",
      "wo-column-in_progress",
      "wo-column-review",
      "wo-column-done",
      "wo-column-fail",
    ]);
    expect(regions.at(-1)).toHaveAttribute("data-tone", "coral");
    expect(
      regions.slice(0, -1).some((region) => region.getAttribute("data-tone") === "coral"),
    ).toBe(false);
  });

  it("a healthy order carries no fail marker and no Bloqueado column exists", () => {
    render(<WorkOrderBoard orders={[wo({ id: "WO-05-004", state: "in_progress" })]} />);
    expect(screen.getByRole("link", { name: /WO-05-004/ })).not.toHaveClass("is-failed");
    expect(screen.queryByTestId("wo-column-fail")).toBeNull();
  });
});

describe("FRD-05 gate (REQ-05-004): the detail", () => {
  it("has exactly one tablist, the shared Tabs, with real arrow-key roving focus", () => {
    render(
      <WorkOrderDetail
        order={wo({ id: "WO-05-022", state: "todo" })}
        content="# x"
        activeWoTab="summary"
      />,
    );
    expect(screen.getByRole("tablist")).toBe(screen.getByTestId("tabs-root"));
    const summary = screen.getByTestId("wo-detail-tab-summary");
    summary.focus();
    fireEvent.keyDown(screen.getByTestId("tabs-root"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByTestId("wo-detail-tab-full"));
  });

  it("Documento completo renders the whole body through to its last line", () => {
    const body = [
      "# WO heading",
      "",
      "## Scope",
      "First paragraph of scope.",
      "",
      "## Acceptance criteria",
      "- AC one",
      "",
      "## Definition of done",
      "The very last sentinel line UNIQUE_TAIL_TOKEN.",
    ].join("\n");
    render(
      <WorkOrderDetail
        order={wo({ id: "WO-05-020", state: "todo" })}
        content={body}
        activeWoTab="full"
      />,
    );
    const full = screen.getByTestId("wo-detail-full");
    expect(full).toHaveTextContent("WO heading");
    expect(full).toHaveTextContent("UNIQUE_TAIL_TOKEN");
  });

  it("Volver drops only the order selection and keeps the list's filters", () => {
    render(
      <WorkOrderDetail
        order={wo({ id: "WO-05-021", state: "todo" })}
        content="# x"
        activeWoTab="full"
        navigationBaseHref="/portfolio/demo/observability?view=tablero&state=review&wo=WO-05-021&woview=full"
      />,
    );
    expect(screen.getByTestId("wo-detail-back")).toHaveAttribute(
      "href",
      "/portfolio/demo/observability?view=tablero&state=review",
    );
  });
});

describe("FRD-05 gate (REQ-05-006): strictly read-only", () => {
  it("the board has no form, input or action, and every link opens an order", () => {
    const { container } = render(
      <WorkOrderBoard
        navigationBaseHref="/portfolio/demo/observability?view=tablero"
        orders={ALL_STATES.map((state, index) => wo({ id: `WO-05-10${index}`, state }))}
      />,
    );
    expect(container.querySelector("form,input,select,textarea")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(0);
    for (const link of screen.getAllByRole("link"))
      expect(link.getAttribute("href")).toMatch(/[?&]wo=WO-05-10\d/);
  });
});
