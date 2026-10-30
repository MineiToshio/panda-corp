import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BuildModePicker } from "../BuildModePicker";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("AC-11-005.1: ordered mode cards expose icons, tags, power, hints and keyboard selection", async () => {
  const onModeChange = vi.fn();
  const user = userEvent.setup();
  render(<BuildModePicker project="alpha" onModeChange={onModeChange} />);
  const cards = within(screen.getByRole("group", { name: "Modo de construcción" })).getAllByRole(
    "button",
  );
  const labels = ["Equilibrado", "Pro", "Potente", "Profundo"];
  const powers = [2, 1, 3, 4];
  cards.forEach((card, index) => {
    expect(card).toHaveTextContent(labels[index] ?? "missing label");
    expect(card.querySelector("svg")).toBeTruthy();
    expect(card.querySelector("small")?.textContent).toBeTruthy();
    expect(
      within(card).getByRole("img", { name: `Potencia ${powers[index]} de 4` }),
    ).toBeInTheDocument();
  });
  for (const tag of ["por defecto", "pro", "powerful", "deep"])
    expect(screen.getByText(tag, { exact: true })).toBeInTheDocument();
  expect(cards[0]).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("/pandacorp:implement", { exact: true })).toBeInTheDocument();
  await user.tab();
  await user.tab();
  await user.tab();
  expect(cards[2]).toHaveFocus();
  await user.keyboard(" ");
  expect(cards[2]).toHaveAttribute("aria-pressed", "true");
  expect(cards[0]).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("/pandacorp:implement powerful")).toBeInTheDocument();
  expect(localStorage.getItem("mc:build-mode:alpha")).toBe("powerful");
  expect(onModeChange).toHaveBeenCalledWith("powerful");
  await user.click(screen.getByRole("button", { name: "Copiar /pandacorp:implement powerful" }));
  expect(await navigator.clipboard.readText()).toBe("/pandacorp:implement powerful");
  await user.click(screen.getByRole("button", { name: /^Equilibrado/ }));
  expect(screen.getByText("/pandacorp:implement", { exact: true })).toBeInTheDocument();
});

it("restores only the current project's mode and follows external storage updates", () => {
  localStorage.setItem("mc:build-mode:alpha", "deep");
  const view = render(<BuildModePicker project="alpha" />);
  expect(screen.getByRole("button", { name: /^Profundo/ })).toHaveAttribute("aria-pressed", "true");
  view.rerender(<BuildModePicker project="beta" />);
  expect(screen.getByRole("button", { name: /^Equilibrado/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  act(() => {
    localStorage.setItem("mc:build-mode:beta", "pro");
    window.dispatchEvent(new StorageEvent("storage"));
  });
  expect(screen.getByRole("button", { name: /^Pro pro/ })).toHaveAttribute("aria-pressed", "true");
});

it("falls back for corrupt and inaccessible storage, including failed writes", async () => {
  localStorage.setItem("mc:build-mode:alpha", '{"mode":"deep"}');
  render(<BuildModePicker project="alpha" />);
  expect(screen.getByRole("button", { name: /^Equilibrado/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  await userEvent.click(screen.getByRole("button", { name: /^Potente/ }));
  expect(screen.getByRole("button", { name: /^Equilibrado/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("hydrates the default server snapshot without a mismatch then restores the preference", async () => {
  localStorage.setItem("mc:build-mode:alpha", "powerful");
  const element = <BuildModePicker project="alpha" />;
  const host = document.createElement("div");
  host.innerHTML = renderToString(element);
  expect(host.textContent).not.toContain("/pandacorp:implement powerful");
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(host, element, { onRecoverableError });
  });
  expect(host.textContent).toContain("/pandacorp:implement powerful");
  expect(onRecoverableError).not.toHaveBeenCalled();
  await act(async () => root?.unmount());
});
