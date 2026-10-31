// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ColumnChart } from "../_components/charts/ColumnChart";
import { LedgerCard } from "../_components/Stats/LedgerCard";
import { RecordTile } from "../_components/Stats/RecordTile";

/** Reviewer-authored (DR-080): statistics contracts the worker suites did not see. */
it("FRD-10#U14: a level of 0 never renders as a Nv 0 chip", () => {
  render(
    <LedgerCard
      title="Producción"
      tone="gold"
      rows={[{ key: "shipped", label: "Productos lanzados", value: 0, level: 0 }]}
    />,
  );
  expect(within(screen.getByRole("listitem")).queryByText("Nv 0")).toBeNull();
  render(<RecordTile label="Productos lanzados" sub="tu marca" value={0} level={0} />);
  expect(screen.queryByText("Nv 0")).toBeNull();
});

it("FRD-10#U14: a hero tile carries the level chip and its band pip, as ledger rows do", () => {
  const { container } = render(<RecordTile label="Pico" sub="tu marca" value={3} level={7} />);
  expect(screen.getByText("Nv 7")).toBeInTheDocument();
  expect(container.querySelector("[data-band]")).toHaveAttribute("data-band", "1");
});

it("AC-10-021.1: per-column chart titles are one text node, so they hydrate", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const html = renderToString(
    <ColumnChart points={[{ label: "sem 2026-25", value: 76 }]} label="Semanas" />,
  );
  expect(html).toContain("<title>sem 2026-25: 76</title>");
  expect(error).not.toHaveBeenCalled();
});
