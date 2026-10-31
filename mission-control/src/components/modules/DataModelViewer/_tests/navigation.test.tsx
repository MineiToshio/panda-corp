import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
function visit(href: string) {
  act(() => {
    window.history.replaceState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("persistent logical model location", () => {
  it("restores schema, search, selected table and browser history selection", async () => {
    visit(
      "/portfolio/registered/architecture?model=schema&modelQuery=reviewer&entity=entry&schemaTable=entry",
    );
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    expect(await screen.findByRole("searchbox")).toHaveValue("reviewer");
    expect(screen.getByRole("button", { name: "Esquema" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Entry")).toHaveAttribute("open");
    visit("/portfolio/registered/architecture?model=diagram&entity=account");
    expect(
      await screen.findByRole("button", { name: "Seleccionar entidad Account", pressed: true }),
    ).toHaveAttribute("aria-pressed", "true");
    visit("/portfolio/registered/architecture?relationship=ownership");
    fireEvent.click(screen.getByText("Relaciones 3"));
    expect(
      await screen.findByRole("button", { name: "Ver relación Propiedad", pressed: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("AC-25-011.1: restores expanded URLs inline across history without a dialog or native fullscreen", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
    const request = vi.fn(async () => {});
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    try {
      visit("/portfolio/registered/architecture?expanded=1&entity=entry");
      const viewer = render(<DataModelViewer result={readyFixture()} />);
      try {
        await waitForLayout();
        await screen.findByRole("button", { name: "Diagrama" });
        for (const search of [
          "expanded=1&entity=entry",
          "entity=entry",
          "expanded=1&entity=entry",
        ]) {
          visit(`/portfolio/registered/architecture?${search}`);
          expect.soft(screen.queryByRole("dialog")).not.toBeInTheDocument();
          expect
            .soft(
              await screen.findByRole("button", {
                name: "Seleccionar entidad Entry",
                pressed: true,
              }),
            )
            .toHaveAttribute("aria-pressed", "true");
          expect.soft(request).not.toHaveBeenCalled();
        }
      } finally {
        viewer.unmount();
      }
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, "requestFullscreen", descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
    }
  });
});

it("shows a bounded unavailable state for an unknown model entity", async () => {
  visit("/portfolio/registered/architecture?entity=not-published");
  render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  expect(await screen.findByText("La selección del modelo no está disponible.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Seleccionar entidad Account" })).not.toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("opens overview entities at readable detail scale without losing URL selection", async () => {
  visit("/portfolio/registered/architecture?model=diagram");
  render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  const level = screen.getByRole("button", { name: /100%/ });
  fireEvent.click(screen.getByRole("button", { name: "Alejar" }));
  expect(level).not.toHaveTextContent("100%");
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar entidad Entry" }));
  expect(level).toHaveTextContent("100%");
  expect(window.location.search).toContain("entity=entry");
});

it("undoes native focus scrolling and focuses an entity at readable scale", async () => {
  visit("/portfolio/registered/architecture?model=diagram");
  render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  const canvas = screen.getByRole("application");
  canvas.scrollLeft = 1033;
  canvas.scrollTop = 240;
  fireEvent.scroll(canvas);
  expect(canvas.scrollLeft).toBe(0);
  expect(canvas.scrollTop).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Alejar" }));
  act(() => screen.getByRole("button", { name: "Seleccionar entidad Audit" }).focus());
  expect(screen.getByRole("button", { name: /Zoom 100%/ })).toBeInTheDocument();
});
