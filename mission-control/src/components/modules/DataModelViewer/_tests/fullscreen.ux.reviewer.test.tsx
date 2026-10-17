import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataModelViewer } from "../DataModelViewer";
import { readyFixture } from "./fixture";

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    },
    close: {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      }),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderReady() {
  render(<DataModelViewer result={readyFixture()} />);
  await screen.findByRole("button", { name: "Seleccionar entidad Entry" });
}

describe("diagram-only expanded UX independent acceptance", () => {
  it("removes the lower relationship inspector and duplicate relationship buttons", async () => {
    await renderReady();
    expect(screen.queryByRole("complementary", { name: "Relaciones" })).not.toBeInTheDocument();
    const relations = screen.getAllByRole("button", { name: /^Ver relación / });
    expect(relations).toHaveLength(3);
    for (const relation of relations)
      expect(relation.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("expands only one diagram while keeping source, tabs and schema out of the modal", async () => {
    await renderReady();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar modelo" }));
    const dialog = screen.getByRole("dialog");
    const expanded = within(dialog);
    expect(expanded.queryByRole("tablist")).not.toBeInTheDocument();
    expect(expanded.queryByText("docs/product/data-model.json")).not.toBeInTheDocument();
    expect(
      expanded.queryByText("Modelo diseñado. Implementación sin verificar."),
    ).not.toBeInTheDocument();
    expect(expanded.queryByRole("complementary")).not.toBeInTheDocument();
    expect(expanded.getByRole("application")).toBeVisible();
    expect(document.querySelectorAll('[data-testid="model-viewport"]')).toHaveLength(1);
    expect(expanded.getAllByRole("table")).toHaveLength(3);
  });

  it("preserves independently keyboard-selectable edges and both endpoint cardinalities without an inspector", async () => {
    await renderReady();
    const edge = screen.getByRole("button", { name: "Ver relación Referencia propia" });
    fireEvent.keyDown(edge, { key: "Enter" });
    expect(edge).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ver relación Propiedad" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(edge.querySelectorAll("[data-cardinality]")).toHaveLength(2);
    expect(
      [...edge.querySelectorAll("[data-cardinality]")].map((marker) =>
        marker.getAttribute("data-cardinality"),
      ),
    ).toEqual(["0..1", "0..many"]);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("keeps no-match search feedback inside the active expanded diagram", async () => {
    await renderReady();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar modelo" }));
    const expanded = within(screen.getByRole("dialog"));
    fireEvent.change(expanded.getByRole("searchbox"), { target: { value: "missing-field-987" } });
    expect(
      expanded
        .getAllByRole("status")
        .some((status) => status.textContent?.includes("Sin coincidencias")),
    ).toBe(true);
  });

  it("traps both focus directions and restores the persistent trigger after repeated close/reopen", async () => {
    const user = userEvent.setup();
    await renderReady();
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const trigger = screen.getByRole("button", { name: "Ampliar modelo" });
      trigger.focus();
      await user.click(trigger);
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input,[tabindex="0"]'),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) throw new Error("Expanded graph needs focusable controls");
      first.focus();
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
      fireEvent.keyDown(dialog, { key: "Tab" });
      expect(first).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ampliar modelo" })).toHaveFocus();
      expect(screen.getByRole("button", { name: "Seleccionar entidad Entry" })).toBeVisible();
    }
  });
});
