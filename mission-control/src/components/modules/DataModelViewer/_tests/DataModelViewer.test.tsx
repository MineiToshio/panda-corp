import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataModelViewer } from "../DataModelViewer";
import { readyFixture } from "./fixture";
import { waitForLayout } from "./waitForLayout";

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
  it("AC-02-015.7: keeps missing, no-persistence, malformed and explicitly empty artifacts distinct", () => {
    const { rerender } = render(<DataModelViewer result={{ kind: "missing" }} />);
    expect(
      screen.getByText(
        "Todavía no hay un modelo de datos publicado; queda visiblemente pendiente.",
      ),
    ).toBeVisible();
    rerender(<DataModelViewer result={{ kind: "none" }} />);
    expect(
      screen.getByText("Este proyecto declara explícitamente que no usa base de datos."),
    ).toBeVisible();
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
  it("AC-02-015.1 AC-02-015.3 AC-02-015.8: starts with a readable diagram, exposes every field and never claims implementation", async () => {
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    await screen.findByRole("searchbox", { name: "Buscar entidad o atributo" });
    expect(screen.getByRole("button", { name: "Diagrama" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("application", {
        name: "Diagrama de entidades. Arrastra o usa los controles para desplazarte; el esquema textual tiene la misma información.",
      }),
    ).toBeVisible();
    expect(
      Number.parseInt(screen.getByRole("button", { name: /^Zoom / }).textContent ?? "0", 10),
    ).toBeGreaterThan(0);
    expect(screen.getByText("Modelo diseñado, no verificado contra una base viva")).toBeVisible();
    const fields = screen.getByRole("table", { name: "Atributos Entry" });
    expect(within(fields).getByRole("cell", { name: "reviewerId" })).toBeVisible();
    expect(within(fields).getAllByText("FK")).toHaveLength(2);
    expect(within(fields).getAllByText("UQ")).toHaveLength(2);
    expect(within(fields).getByRole("cell", { name: "Opcional" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Seleccionar entidad Audit" })).toBeVisible();
  });
  it("AC-02-015.5: searches attributes, focuses their entity and displays no-results feedback", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    await screen.findByRole("searchbox", { name: "Buscar entidad o atributo" });
    const input = screen.getByRole("searchbox", { name: "Buscar entidad o atributo" });
    await user.type(input, "reviewerId");
    expect(screen.getByRole("button", { name: "Seleccionar entidad Entry" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("1 entidad encontrada")).toBeVisible();
    await user.clear(input);
    await user.type(input, "absent");
    expect(screen.getByText("Ninguna entidad coincide.")).toBeVisible();
  });
  it("AC-02-015.2 AC-02-015.5: selects relations on the diagram without a lower inspector", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    await screen.findByRole("searchbox");
    const entity = screen.getByRole("button", { name: "Seleccionar entidad Account" });
    await user.click(entity);
    await user.click(screen.getByText("Relaciones 3"));
    expect(screen.getByRole("button", { name: "Ver relación Propiedad" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Ver relación Propiedad" }));
    expect(screen.getByRole("button", { name: "Ver relación Propiedad" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("complementary", { name: "Relaciones" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver relación Propiedad" }));
    expect(screen.getByRole("button", { name: "Ver relación Propiedad" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(entity);
    await user.click(entity);
    expect(entity).toHaveAttribute("aria-pressed", "false");
  });
  it("AC-02-015.4: offers compact schema blocks with composite keys and relation declarations", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    await screen.findByRole("searchbox", { name: "Buscar entidad o atributo" });
    await user.click(screen.getByRole("button", { name: "Esquema" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByText("Entry"));
    await user.click(screen.getByText("Account"));
    expect(screen.getByText(/model Entry \{/)).toHaveTextContent("@@unique([ownerId, reviewerId])");
    expect(screen.getByText(/model Account \{/)).toHaveTextContent(
      '@relation("Propiedad", Entry, fields: [accountId], references: [ownerId]',
    );
  });
  it("AC-02-015.12: zooms with explicit controls and wheel without scrolling the document", async () => {
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    await screen.findByRole("searchbox", { name: "Buscar entidad o atributo" });
    const zoom = () =>
      Number.parseInt(screen.getByRole("button", { name: /^Zoom / }).textContent ?? "0", 10);
    const original = zoom();
    await user.click(screen.getByRole("button", { name: "Acercar" }));
    expect(zoom()).toBeGreaterThan(original);
    const afterButton = zoom();
    const canvas = screen.getByRole("application", {
      name: "Diagrama de entidades. Arrastra o usa los controles para desplazarte; el esquema textual tiene la misma información.",
    });
    expect(fireEvent.wheel(canvas, { deltaY: -100, clientX: 100, clientY: 100 })).toBe(false);
    await waitFor(() => expect(zoom()).toBeGreaterThan(afterButton));
    await user.click(screen.getByRole("button", { name: /^Zoom / }));
    expect(zoom()).toBe(original);
  });
  it("AC-02-015.6: rejected native fullscreen leaves the viewer inline and focused", async () => {
    const request = vi.fn().mockRejectedValue(new Error("Denied"));
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    const user = userEvent.setup();
    render(<DataModelViewer result={readyFixture()} />);
    const trigger = await screen.findByRole("button", { name: "Pantalla completa" });
    await user.click(trigger);
    expect(request).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
  });
  it("AC-02-015.3: phones default to schema and retain an explicit URL mode", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    window.history.replaceState({}, "", "/portfolio/test/architecture");
    const { unmount } = render(<DataModelViewer result={readyFixture()} />);
    expect(await screen.findByRole("button", { name: "Esquema" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    unmount();
    window.history.replaceState({}, "", "/portfolio/test/architecture?model=diagram");
    render(<DataModelViewer result={readyFixture()} />);
    expect(await screen.findByRole("button", { name: "Diagrama" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    Reflect.deleteProperty(window, "matchMedia");
  });
});
