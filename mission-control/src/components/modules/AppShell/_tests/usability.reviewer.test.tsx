import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../AppShell";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));

beforeEach(() => vi.mocked(usePathname).mockReturnValue("/"));
afterEach(cleanup);

function shell() {
  return (
    <AppShell
      levelBar={<span>Guild level</span>}
      proposalsBadge={
        <a href="/proposals" onClick={(event) => event.preventDefault()}>
          Propuestas
        </a>
      }
    >
      <main>
        <button type="button">Outside action</button>
      </main>
    </AppShell>
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Abrir menú de navegación" }));
  return screen.getByRole("button", { name: "Cerrar menú de navegación" });
}

describe("integrated responsive shell independent acceptance", () => {
  it.each([
    "Inicio",
    "Propuestas",
  ])("keeps one complete destination area in the header and closes after choosing %s", (destination) => {
    render(shell());
    const toggle = openMenu();
    const header = screen.getByRole("banner");
    const nav = within(header).getByRole("navigation", { name: "Navegación principal" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Inicio", "Tablero", "Portfolio", "Propuestas", "Logros", "Documentación"]);
    fireEvent.click(within(nav).getByRole("link", { name: destination }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("dismisses on Escape and returns focus to the menu toggle", () => {
    render(shell());
    const toggle = openMenu();
    const destination = screen.getByRole("link", { name: "Portfolio" });
    destination.focus();
    fireEvent.keyDown(destination, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("dismisses on outside pointer interaction but leaves inside-menu interactions intact", () => {
    render(shell());
    const toggle = openMenu();
    fireEvent.pointerDown(screen.getByRole("link", { name: "Portfolio" }));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside action" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when navigation changes without relying on a destination click", () => {
    const { rerender } = render(shell());
    openMenu();
    vi.mocked(usePathname).mockReturnValue("/portfolio");
    rerender(shell());
    expect(screen.getByRole("button", { name: "Abrir menú de navegación" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("link", { name: "Portfolio" })).toHaveAttribute("aria-current", "page");
  });
});
