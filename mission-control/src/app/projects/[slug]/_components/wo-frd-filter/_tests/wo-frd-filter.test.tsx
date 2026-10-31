import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { WoFrdFilter } from "../wo-frd-filter";

it("AC-05-008.2 labels FRD options through the shared index", async () => {
  const select = vi.fn();
  render(
    <WoFrdFilter
      frds={["FRD-01"]}
      selected={null}
      onSelect={select}
      index={[{ slug: "frd-01-core", code: "FRD-01", title: "Core" }]}
    />,
  );
  expect(screen.getByRole("option", { name: "Todos los FRDs (1)" })).toBeInTheDocument();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Filtrar por FRD" }),
    "FRD-01",
  );
  expect(select).toHaveBeenCalledWith("FRD-01");
});
