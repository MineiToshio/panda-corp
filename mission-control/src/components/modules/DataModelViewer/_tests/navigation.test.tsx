import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it.each([
    "entity=entry",
    "expanded=1&entity=entry",
  ])("AC-25-001.1: an expand gesture writes expanded and Escape removes it from %s", async (search) => {
    visit(`/portfolio/registered/architecture?${search}`);
    render(<DataModelViewer result={readyFixture()} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Ampliar modelo" }, { timeout: 5000 }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(new URLSearchParams(window.location.search).get("expanded")).toBe("1");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(new URLSearchParams(window.location.search).get("expanded")).toBeNull();
  });
  it("restores schema, search, selected table and browser history selection", async () => {
    visit(
      "/portfolio/registered/architecture?model=schema&modelQuery=reviewer&entity=entry&schemaTable=entry",
    );
    render(<DataModelViewer result={readyFixture()} />);
    await waitForLayout();
    expect(await screen.findByRole("searchbox")).toHaveValue("reviewer");
    expect(screen.getByRole("tab", { name: "Esquema" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Entry")).toHaveAttribute("open");
    visit("/portfolio/registered/architecture?model=diagram&entity=account");
    expect(screen.getByRole("button", { name: "Seleccionar entidad Account" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    visit("/portfolio/registered/architecture?relationship=ownership");
    expect(screen.getByRole("button", { name: "Ver relación Propiedad" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
        await screen.findByRole("tab", { name: "Diagrama" });
        for (const search of [
          "expanded=1&entity=entry",
          "entity=entry",
          "expanded=1&entity=entry",
        ]) {
          visit(`/portfolio/registered/architecture?${search}`);
          expect.soft(screen.queryByRole("dialog")).not.toBeInTheDocument();
          expect
            .soft(
              within(screen.getByRole("tabpanel")).queryByRole("button", {
                name: "Seleccionar entidad Entry",
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
