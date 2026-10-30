import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
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
  restoreProperty(HTMLElement.prototype, "requestFullscreen", requestDescriptor);
  restoreProperty(document, "exitFullscreen", exitDescriptor);
  restoreProperty(document, "fullscreenElement", elementDescriptor);
  restoreProperty(HTMLDialogElement.prototype, "showModal", showDescriptor);
  restoreProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
});

function mockNativeFullscreen() {
  const request = vi.fn(function (this: HTMLElement) {
    fullscreenElement = this;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  });
  const exit = vi.fn(() => {
    fullscreenElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value: request,
  });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  return { request, exit };
}

async function renderReadyModel() {
  render(<DataModelViewer result={readyFixture()} />);
  await waitForLayout();
  await screen.findByRole("application", { name: "Diagrama del modelo de datos" });
  return screen.getByRole("button", { name: "Ver en pantalla completa" });
}

describe("model viewer parity with Architecture graph controls", () => {
  it("requests native fullscreen synchronously from the expand gesture on a model-only host", async () => {
    const { request } = mockNativeFullscreen();
    const trigger = await renderReadyModel();

    fireEvent.click(trigger);

    expect(request).toHaveBeenCalledTimes(1);
    const host = fullscreenElement;
    expect(host).toBeInstanceOf(HTMLElement);
    if (!host) throw new Error("The browser fullscreen target is missing");
    expect(host).not.toBeInstanceOf(HTMLDialogElement);
    const graph = within(host);
    expect(graph.getByRole("application", { name: "Diagrama del modelo de datos" })).toBeVisible();
    expect(graph.queryByRole("tab")).not.toBeInTheDocument();
    expect(graph.queryByText("docs/product/data-model.json")).not.toBeInTheDocument();
    expect(graph.queryByRole("complementary")).not.toBeInTheDocument();
    expect(graph.getByRole("button", { name: "Salir de pantalla completa" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(graph.getByRole("button", { name: "Ajustar el grafo a la vista" })).toBeVisible();
    expect(graph.getByRole("button", { name: /Zoom .*restablecer/i })).toBeVisible();
    expect(
      screen.getAllByRole("application", { name: "Diagrama del modelo de datos" }),
    ).toHaveLength(1);
    expect(screen.getAllByRole("searchbox", { name: "Buscar tabla o atributo" })).toHaveLength(1);
  });

  it("closes the expanded presentation when native Escape produces fullscreenchange and returns focus", async () => {
    mockNativeFullscreen();
    const trigger = await renderReadyModel();
    fireEvent.click(trigger);
    expect(fullscreenElement).not.toBeNull();

    act(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ver en pantalla completa" })).toHaveFocus();
    expect(
      screen.getAllByRole("application", { name: "Diagrama del modelo de datos" }),
    ).toHaveLength(1);
  });

  it("exits the native API from the minimize control and preserves a single inline diagram", async () => {
    const { exit } = mockNativeFullscreen();
    fireEvent.click(await renderReadyModel());
    fireEvent.click(screen.getByRole("button", { name: "Salir de pantalla completa" }));

    expect(exit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(
      screen.getAllByRole("application", { name: "Diagrama del modelo de datos" }),
    ).toHaveLength(1);
  });

  it.each([
    "missing",
    "rejected",
    "throws",
  ] as const)("keeps a keyboard-dismissable diagram-only fallback when native fullscreen is %s", async (failure) => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value:
        failure === "missing"
          ? undefined
          : vi.fn(() => {
              if (failure === "throws") throw new Error("Fullscreen blocked");
              return Promise.reject(new Error("Fullscreen blocked"));
            }),
    });
    const user = userEvent.setup();
    fireEvent.click(await renderReadyModel());
    const dialog = await screen.findByRole("dialog", { name: "Modelo de datos" });

    expect(
      within(dialog).getByRole("application", { name: "Diagrama del modelo de datos" }),
    ).toBeVisible();
    expect(within(dialog).queryByRole("tab")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("complementary")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("application", { name: "Diagrama del modelo de datos" }),
    ).toHaveLength(1);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver en pantalla completa" })).toHaveFocus();
  });
});
