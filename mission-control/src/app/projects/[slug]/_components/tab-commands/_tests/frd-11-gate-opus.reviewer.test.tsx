import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TabCommands } from "../tab-commands";

it("REQ-11-009.2: workspace switch resets a scoped selection and old preferences are ignored", () => {
  localStorage.setItem("mc:build-mode:a", "deep");
  const targets = [{ value: "FRD-02", label: "Feature" }];
  const view = render(<TabCommands phase="product" slug="a" targets={targets} />);
  fireEvent.click(screen.getByRole("button", { name: "Objetivo: FRD o tarjeta" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "FRD-02" } });
  expect(screen.getByRole("button", { name: "Copiar /pandacorp:implement FRD-02" })).toBeVisible();
  view.rerender(<TabCommands phase="product" slug="b" targets={targets} />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByRole("button", { name: "Construir" })).toHaveAttribute("aria-pressed", "true");
});
