import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { COPY } from "../copy.es";
import { DataModelViewer } from "../DataModelViewer";
import { readyFixture } from "./fixture";
import { waitForLayout } from "./waitForLayout";

const zoomText = () => screen.getByRole("button", { name: /^Zoom / }).textContent;
let fullscreenElement: Element | null = null;

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
afterEach(cleanup);

it("AC-02-015.11: an equal RSC payload keeps the ready diagram, its element and its zoom", async () => {
  const { rerender } = render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  const canvas = screen.getByRole("application", { name: "Diagrama del modelo de datos" });
  const before = zoomText();
  fireEvent.click(screen.getByRole("button", { name: "Acercar" }));
  await waitFor(() => expect(zoomText()).not.toBe(before));
  const zoomed = zoomText();
  rerender(<DataModelViewer result={readyFixture()} />);
  expect(screen.queryByText(COPY.loading)).toBeNull();
  await waitForLayout();
  expect(screen.getByRole("application", { name: "Diagrama del modelo de datos" })).toBe(canvas);
  expect(zoomText()).toBe(zoomed);
});

it("AC-02-015.6: an equal RSC payload keeps the expanded model on its native fullscreen host", async () => {
  const { rerender } = render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  fireEvent.click(screen.getByRole("button", { name: "Ver en pantalla completa" }));
  const host = fullscreenElement;
  expect(host).not.toBeNull();
  const dialog = screen.getByRole("dialog");
  rerender(<DataModelViewer result={readyFixture()} />);
  expect(screen.queryByText(COPY.loading)).toBeNull();
  await waitForLayout();
  expect(host?.isConnected).toBe(true);
  expect(screen.getByRole("dialog")).toBe(dialog);
});

it("control: a really changed model still lays out again", async () => {
  const first = readyFixture();
  const { rerender } = render(<DataModelViewer result={first} />);
  await waitForLayout();
  if (first.kind !== "ready") throw new Error("fixture");
  const entity = first.model.entities[0];
  if (!entity) throw new Error("fixture");
  rerender(
    <DataModelViewer
      result={{
        ...first,
        model: {
          ...first.model,
          entities: [{ ...entity, name: "Renamed" }, ...first.model.entities.slice(1)],
        },
      }}
    />,
  );
  expect(
    await screen.findByRole("button", { name: "Seleccionar entidad Renamed" }, { timeout: 21_000 }),
  ).toBeVisible();
});
