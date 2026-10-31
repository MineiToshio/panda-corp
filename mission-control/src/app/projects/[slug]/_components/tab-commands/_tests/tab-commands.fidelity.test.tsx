import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { TabCommands } from "../tab-commands";

it("REQ-04-006: four shared cards and command boxes replace the v1 main and inline selector", () => {
  const { container } = render(<TabCommands phase="product" slug="project" />);
  expect(container.querySelectorAll(".card")).toHaveLength(4);
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
  expect(screen.queryByText("Comandos a la mano")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: /Modo/ })).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId("mode-selector-slot")).getByTestId("build-mode-picker"),
  ).toBeInTheDocument();
  for (const row of screen.getAllByTestId("cmd-row"))
    expect(within(row).getByRole("button", { name: /Copiar/ })).toBeInTheDocument();
});
