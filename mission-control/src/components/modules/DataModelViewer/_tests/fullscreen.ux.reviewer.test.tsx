import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataModelViewer } from "../DataModelViewer";
import { readyFixture } from "./fixture";
import { waitForLayout } from "./waitForLayout";

const requestDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "requestFullscreen",
);
const exitDescriptor = Object.getOwnPropertyDescriptor(document, "exitFullscreen");
const elementDescriptor = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
let fullscreenElement: HTMLElement | null = null;

function restoreProperty(target: object, name: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, name, descriptor);
  else Reflect.deleteProperty(target, name);
}

beforeEach(() => {
  fullscreenElement = null;
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value: vi.fn(function (this: HTMLElement) {
      fullscreenElement = this;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    }),
  });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: vi.fn(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  restoreProperty(HTMLElement.prototype, "requestFullscreen", requestDescriptor);
  restoreProperty(document, "exitFullscreen", exitDescriptor);
  restoreProperty(document, "fullscreenElement", elementDescriptor);
});

async function renderReady() {
  render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  await screen.findByRole("button", { name: "Seleccionar entidad Entry" });
}

function expandedHost(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" }));
  if (!fullscreenElement) throw new Error("The browser fullscreen target is missing");
  return fullscreenElement;
}

describe("diagram-only fullscreen UX independent acceptance", () => {
  it("removes the lower relationship inspector and keeps one relationship list of plain rows", async () => {
    await renderReady();
    expect(screen.queryByRole("complementary", { name: "Relaciones" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/^Relaciones/));
    const relations = screen.getAllByRole("button", { name: /^Ver relación / });
    expect(relations).toHaveLength(3);
    for (const relation of relations)
      expect(relation.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
  });

  it("expands only one diagram while keeping source, view switch and schema out of the host", async () => {
    await renderReady();
    const host = expandedHost();
    const expanded = within(host);
    expect(expanded.queryByRole("button", { name: "Esquema" })).not.toBeInTheDocument();
    expect(expanded.queryByText("docs/product/data-model.json")).not.toBeInTheDocument();
    expect(
      expanded.queryByText("Modelo diseñado, no verificado contra una base viva"),
    ).not.toBeInTheDocument();
    expect(expanded.queryByText(/^Relaciones/)).not.toBeInTheDocument();
    expect(expanded.queryByRole("complementary")).not.toBeInTheDocument();
    expect(expanded.getByRole("application")).toBeVisible();
    expect(document.querySelectorAll('[data-testid="model-viewport"]')).toHaveLength(1);
    expect(expanded.getAllByRole("table")).toHaveLength(3);
  });

  it("keeps connectors non-interactive with both endpoint cardinalities, selecting through the row", async () => {
    await renderReady();
    const stage = screen.getByTestId("model-stage");
    expect(stage.querySelectorAll("svg [tabindex], svg [role='button']")).toHaveLength(0);
    fireEvent.click(screen.getByText(/^Relaciones/));
    const row = screen.getByRole("button", { name: "Ver relación Referencia propia" });
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(row).toHaveTextContent("0..1 → Entry 0..*");
    expect(screen.getByRole("button", { name: "Ver relación Propiedad" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const active = stage.querySelector("[data-active='true']");
    expect(
      [...(active?.querySelectorAll("[data-cardinality]") ?? [])].map((marker) =>
        marker.getAttribute("data-cardinality"),
      ),
    ).toEqual(["0..1", "0..many"]);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("keeps no-match search feedback inside the active fullscreen host", async () => {
    await renderReady();
    const expanded = within(expandedHost());
    fireEvent.change(expanded.getByRole("searchbox"), { target: { value: "missing-field-987" } });
    expect(
      expanded
        .getAllByRole("status")
        .some((status) => status.textContent?.includes("Ninguna entidad coincide")),
    ).toBe(true);
  });

  it("traps both focus directions and restores the persistent trigger after repeated close/reopen", async () => {
    const user = userEvent.setup();
    await renderReady();
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const trigger = screen.getByRole("button", { name: "Pantalla completa" });
      trigger.focus();
      await user.click(trigger);
      const host = fullscreenElement;
      if (!host) throw new Error("The browser fullscreen target is missing");
      await waitFor(() => expect(host.contains(document.activeElement)).toBe(true));
      const focusable = [
        ...host.querySelectorAll<HTMLElement>('button:not([disabled]),input,[tabindex="0"]'),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) throw new Error("Expanded graph needs focusable controls");
      first.focus();
      fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
      fireEvent.keyDown(last, { key: "Tab" });
      expect(first).toHaveFocus();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(fullscreenElement).toBeNull());
      expect(screen.getByRole("button", { name: "Pantalla completa" })).toHaveFocus();
      expect(screen.getByRole("button", { name: "Seleccionar entidad Entry" })).toBeVisible();
    }
  });
});
