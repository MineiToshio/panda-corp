import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { OwnerTurnItem } from "@/lib/inicio/turn";
import { TuTurno } from "../TuTurno";

const item: OwnerTurnItem = {
  kind: "decision",
  id: "2026-10-20-1",
  title: "Choose hosting",
  project: "Example",
  projectId: "example",
  where: "/example",
  command: "/pandacorp:decide 2026-10-20-1",
  date: "2026-10-20",
  ageDays: 10,
  ageLabel: "hace 10 días",
  ask: "Pick a provider",
  recommendation: "Use A",
  context: "Needs storage",
};
describe("Tu turno Órbita", () => {
  it("REQ-18-003: calm means no items AND no read errors", () => {
    const { rerender } = render(<TuTurno result={{ items: [], count: 0, errors: [] }} />);
    expect(screen.getByText("Al día")).toBeVisible();
    expect(screen.getByText("Nada espera tu acción ahora mismo.")).toBeVisible();
    rerender(
      <TuTurno
        result={{ items: [], count: 0, errors: [{ project: "Example", source: "decisions" }] }}
      />,
    );
    expect(screen.queryByText("Al día")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Example");
  });
  it("AC-18-022.2: details expose source fields, scoped command, age, context and stale run sentence; Escape returns focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TuTurno result={{ items: [item], count: 1, errors: [] }} />);
    const trigger = screen.getByRole("button", { name: "Detalles: Choose hosting" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Choose hosting" });
    expect(within(dialog).getByText("Pick a provider")).toBeVisible();
    expect(within(dialog).getByText("Use A")).toBeVisible();
    expect(within(dialog).getByText(/primero te pregunta si sigue vigente/)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: /Copiar/ })).toBeVisible();
    fireEvent.click(within(dialog).getByText("Contexto"));
    expect(within(dialog).getByText("Needs storage")).toBeVisible();
    rerender(
      <TuTurno result={{ items: [{ ...item, ageLabel: "hace 11 días" }], count: 1, errors: [] }} />,
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("AC-18-022.2: young decisions have no unpictured run sentence", async () => {
    render(<TuTurno result={{ items: [{ ...item, ageDays: 2 }], count: 1, errors: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: /Detalles:/ }));
    expect(screen.queryByText(/Te muestra la pregunta/)).not.toBeInTheDocument();
  });
});
