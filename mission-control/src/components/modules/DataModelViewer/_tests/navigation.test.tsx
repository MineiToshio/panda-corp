import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  it("restores the expanded fallback without requesting native fullscreen", async () => {
    const request = vi.fn(async () => {});
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    visit("/portfolio/registered/architecture?expanded=1&entity=entry");
    render(<DataModelViewer result={readyFixture()} />);
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(request).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.search).not.toContain("expanded");
  });
});

it("shows a bounded unavailable state for an unknown model entity", async () => {
  visit("/portfolio/registered/architecture?entity=not-published");
  render(<DataModelViewer result={readyFixture()} />);
  expect(await screen.findByText("La selección del modelo no está disponible.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Seleccionar entidad Account" })).not.toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
