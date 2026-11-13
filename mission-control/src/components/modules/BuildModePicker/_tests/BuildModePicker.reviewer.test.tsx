import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BuildModePicker } from "../BuildModePicker";

it("AC-11-008.2: a vanished target and forged browser value never produce a command", () => {
  const view = render(
    <BuildModePicker project="a" targets={[{ value: "FRD-01", label: "Feature" }]} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Objetivo: FRD o tarjeta" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "FRD-01" } });
  expect(screen.getByRole("button", { name: "Copiar /pandacorp:implement FRD-01" })).toBeVisible();
  view.rerender(<BuildModePicker project="a" targets={[]} />);
  expect(screen.queryByRole("button", { name: /^Copiar/ })).toBeNull();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "change:forged" } });
  expect(screen.queryByRole("button", { name: /^Copiar/ })).toBeNull();
  expect(screen.getByText("No hay objetivos disponibles para construir.")).toBeVisible();
});
