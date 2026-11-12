import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { BuildModePicker } from "../BuildModePicker";

it("AC-11-007/010: keyboard selection copies exact build and resume commands, ignoring legacy storage", async () => {
  localStorage.setItem("mc:build-mode:alpha", "powerful");
  const user = userEvent.setup();
  render(<BuildModePicker project="alpha" />);
  const group = screen.getByRole("group", { name: "Acción de construcción" });
  expect(within(group).getAllByRole("button")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Construir" })).toHaveAttribute("aria-pressed", "true");
  await user.tab();
  await user.tab();
  await user.keyboard(" ");
  expect(screen.getByRole("button", { name: "Reanudar" })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "Copiar /pandacorp:implement --resume" }));
  expect(await navigator.clipboard.readText()).toBe("/pandacorp:implement --resume");
  expect(screen.queryByRole("img", { name: /Potencia/ })).toBeNull();
  expect(screen.getByText(/Mission Control nunca lo ejecuta/)).toBeVisible();
});

it("AC-11-008: excludes unsupported/terminal targets and clears the executable command", async () => {
  const user = userEvent.setup();
  render(
    <BuildModePicker
      targets={[
        { value: "FRD-01", label: "FRD-01" },
        { value: "WO-01-001", label: "Individual work" },
        { value: "change:fix", label: "Fix", status: "draft" },
        { value: "change:stale", label: "Stale", status: "ready", staleSuspect: "Already shipped" },
        ...["building", "closing", "done", "discarded"].map((status) => ({
          value: `change:${status}`,
          label: status,
          status,
        })),
      ]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Objetivo: FRD o tarjeta" }));
  const select = screen.getByRole("combobox", { name: "Objetivo del build" });
  expect(within(select).getAllByRole("option")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: /^Copiar/ })).toBeNull();
  for (const value of ["FRD-01", "change:fix"]) {
    await user.selectOptions(select, value);
    expect(
      screen.getByRole("button", { name: `Copiar /pandacorp:implement ${value}` }),
    ).toBeVisible();
  }
  expect(screen.getByText(/valida el alcance del borrador/)).toBeVisible();
  await user.selectOptions(select, "");
  expect(screen.queryByRole("button", { name: /^Copiar/ })).toBeNull();
});

it("AC-11-009.2: project switches reset action and targets", async () => {
  const user = userEvent.setup();
  const view = render(<BuildModePicker project="alpha" />);
  await user.click(screen.getByRole("button", { name: "Reanudar" }));
  view.rerender(<BuildModePicker project="beta" />);
  expect(screen.getByRole("button", { name: "Construir" })).toHaveAttribute("aria-pressed", "true");
  view.rerender(<BuildModePicker project="alpha" />);
  expect(screen.queryByRole("button", { name: "Copiar /pandacorp:implement --resume" })).toBeNull();
});
