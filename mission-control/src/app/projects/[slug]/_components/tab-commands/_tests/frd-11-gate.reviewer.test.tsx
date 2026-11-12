import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { TabCommands } from "../tab-commands";

it.each([
  "product",
  "design",
  "architecture",
  "implementation",
  "release",
  undefined,
] as const)("REQ-11-007: shared entry exists in phase %s", (phase) => {
  render(<TabCommands phase={phase} slug="mc" />);
  const picker = within(screen.getByTestId("build-mode-picker"));
  expect(picker.getByRole("button", { name: "Construir" })).toHaveAttribute("aria-pressed", "true");
  expect(picker.getByRole("button", { name: "Copiar /pandacorp:implement" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Construir o reanudar" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Copiar.*:change$/ })).toBeNull();
  expect(screen.queryByRole("form")).toBeNull();
});
