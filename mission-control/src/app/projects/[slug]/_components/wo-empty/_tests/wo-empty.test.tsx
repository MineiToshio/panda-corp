import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { WorkOrderEmpty } from "../wo-empty";

it("AC-05-008.2 legitimate empty project offers a copy-only architecture command", () => {
  render(<WorkOrderEmpty />);
  expect(screen.getByText(/todavía no tiene work orders/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Copiar /pandacorp:architecture" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
