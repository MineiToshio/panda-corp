import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TabCommands } from "../tab-commands";

it("REQ-04-006: deduplicates the current next step and keeps phase guidance", () => {
  render(
    <TabCommands
      phase="design"
      slug="mc"
      nextStep={{ command: "/pandacorp:architecture", sentence: null }}
    />,
  );
  expect(screen.getAllByRole("button", { name: "Copiar /pandacorp:architecture" })).toHaveLength(1);
  expect(screen.getByText("Define la arquitectura del proyecto")).toBeVisible();
});
it("REQ-04-006: unknown phase shows explicit empty guidance with a usable build entry", () => {
  render(<TabCommands phase={undefined} slug="mc" />);
  expect(screen.getByText("No hay comandos de fase para este proyecto.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Construir" })).toBeVisible();
});
