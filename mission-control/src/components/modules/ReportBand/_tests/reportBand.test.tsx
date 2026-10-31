import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FrdCard } from "../../Spec/FrdCard";
import { EnvFold } from "../EnvRow";
import { PlanMosaic } from "../PlanMosaic";

it("AC-02-016.8: env groups over twelve fold and identify missing descriptions", () => {
  render(
    <EnvFold
      group="Analytics"
      entries={Array.from({ length: 13 }, (_, i) => ({
        name: `KEY_${i}`,
        comment: "",
        section: "Analytics",
        described: false,
      }))}
    />,
  );
  expect(screen.getByText("Analytics").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText("13 de 13 sin descripción")).toBeInTheDocument();
  expect(screen.getAllByText("Sin descripción en", { exact: false })).toHaveLength(13);
});
it("AC-02-013.3: live states group by FRD and planned projects show a count", () => {
  const orders = [
    {
      id: "WO-01-001",
      title: "Reader",
      frd: "frd-01-reader",
      state: "review" as const,
      relPath: "docs/one.md",
    },
  ];
  const view = render(<PlanMosaic workOrders={orders} started={false} />);
  expect(screen.getByText("1 work order planificada")).toBeVisible();
  view.rerender(<PlanMosaic workOrders={orders} started />);
  expect(screen.getByRole("img", { name: "WO-01-001 · Reader · En revisión" })).toBeVisible();
});
it("AC-02-016.7: the whole FRD card opens, with kind fallback and progress only after construction", () => {
  const onOpen = vi.fn();
  const view = render(
    <FrdCard frd={{ id: "FRD-01", title: "Reader", ui: "api" }} workOrders={[]} onOpen={onOpen} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /FRD-01 Reader/ }));
  expect(onOpen).toHaveBeenCalledOnce();
  expect(screen.getByText("API")).toHaveAttribute("data-tone", "blue");
  expect(screen.getByText("0 work orders planificadas")).toBeVisible();
  view.rerender(
    <FrdCard
      frd={{ id: "FRD-01", title: "Reader", ui: "api" }}
      workOrders={[]}
      started
      onOpen={onOpen}
    />,
  );
  expect(screen.queryByText("0 work orders planificadas")).not.toBeInTheDocument();
});
