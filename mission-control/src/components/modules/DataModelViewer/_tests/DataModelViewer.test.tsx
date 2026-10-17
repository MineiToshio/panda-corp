import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataModelViewer } from "../DataModelViewer";
import { readyFixture } from "./fixture";

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("published model viewer", () => {
  it("keeps missing, no-persistence, malformed and explicitly empty artifacts distinct", () => {
    const { rerender } = render(<DataModelViewer result={{ kind: "missing" }} />);
    expect(screen.getByText("Todavía no hay un modelo de datos publicado.")).toBeVisible();
    rerender(<DataModelViewer result={{ kind: "none" }} />);
    expect(screen.getByText("Este proyecto no usa base de datos.")).toBeVisible();
    rerender(
      <DataModelViewer result={{ kind: "error", message: "Invalid reference: account.owner" }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid reference: account.owner");
    rerender(
      <DataModelViewer
        result={{
          kind: "ready",
          source: "docs/product/data-model.json",
          model: { schemaVersion: 1, persistence: "document", entities: [], relationships: [] },
        }}
      />,
    );
    expect(screen.getByText("El modelo publicado no contiene entidades.")).toBeVisible();
  });
  it("starts with a readable diagram, exposes every field and never claims implementation", async () => {
    render(<DataModelViewer result={readyFixture()} />);
    await screen.findByRole("searchbox", { name: "Buscar tabla o atributo" });
    expect(screen.getByRole("tab", { name: "Diagrama" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("application", { name: "Diagrama del modelo de datos" })).toBeVisible();
    expect(
      Number.parseInt(screen.getByRole("button", { name: /^Zoom / }).textContent ?? "0", 10),
    ).toBeGreaterThan(0);
    expect(screen.getByText("Modelo diseñado. Implementación sin verificar.")).toBeVisible();
    const fields = screen.getByRole("table", { name: "Atributos Entry" });
    expect(within(fields).getByRole("cell", { name: "reviewerId" })).toBeVisible();
    expect(within(fields).getAllByRole("cell", { name: "FK UQ" })).toHaveLength(2);
    expect(within(fields).getByRole("cell", { name: "Opcional" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Seleccionar entidad Audit" })).toBeVisible();
  });
  it("searches attributes, focuses their entity and displays no-results feedback", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await screen.findByRole("searchbox", { name: "Buscar tabla o atributo" });
    const input = screen.getByRole("searchbox", { name: "Buscar tabla o atributo" });
    await user.type(input, "reviewerId");
    expect(screen.getByRole("button", { name: "Seleccionar entidad Entry" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("1 entidad encontrada")).toBeVisible();
    await user.clear(input);
    await user.type(input, "absent");
    expect(screen.getByText("Sin coincidencias")).toBeVisible();
  });
  it("selects relations on the diagram without a lower inspector", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await user.click(await screen.findByRole("button", { name: "Ver relación Propiedad" }));
    expect(screen.getByRole("button", { name: "Ver relación Propiedad" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("complementary", { name: "Relaciones" })).not.toBeInTheDocument();
  });
  it("offers compact schema blocks with composite keys and relation declarations", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await screen.findByRole("searchbox", { name: "Buscar tabla o atributo" });
    await user.click(screen.getByRole("tab", { name: "Esquema" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/model Entry \{/)).toHaveTextContent("@@unique([ownerId, reviewerId])");
    expect(screen.getByText(/model Account \{/)).toHaveTextContent(
      '@relation("Propiedad", Entry, fields: [accountId], references: [ownerId]',
    );
  });
  it("zooms with explicit controls and wheel without scrolling the document", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await screen.findByRole("searchbox", { name: "Buscar tabla o atributo" });
    const zoom = () =>
      Number.parseInt(screen.getByRole("button", { name: /^Zoom / }).textContent ?? "0", 10);
    const original = zoom();
    await user.click(screen.getByRole("button", { name: "Acercar" }));
    expect(zoom()).toBeGreaterThan(original);
    const afterButton = zoom();
    const canvas = screen.getByRole("application", { name: "Diagrama del modelo de datos" });
    expect(fireEvent.wheel(canvas, { deltaY: -100, clientX: 100, clientY: 100 })).toBe(false);
    await waitFor(() => expect(zoom()).toBeGreaterThan(afterButton));
    await user.click(screen.getByRole("button", { name: /^Zoom / }));
    expect(zoom()).toBe(original);
  });
  it("opens a modal, traps focus, closes with Escape and restores the expand control", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await screen.findByRole("searchbox", { name: "Buscar tabla o atributo" });
    await user.click(screen.getByRole("button", { name: "Ampliar modelo" }));
    const dialog = screen.getByRole("dialog", { name: "Modelo de datos" });
    expect(dialog).toContainElement(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    within(dialog).getByRole("searchbox").focus();
    await user.tab();
    expect(
      within(dialog).getByRole("application", { name: "Diagrama del modelo de datos" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ampliar modelo" })).toHaveFocus();
  });
});
