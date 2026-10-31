import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";
import { ThemeToggle } from "../ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("AC-19-005.5: shell theme", () => {
  it("boots from system, switches two themes and persists the target", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    new Function(THEME_BOOT_SCRIPT)();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Tema oscuro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("orbita-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Tema claro" })).toHaveAttribute(
      "title",
      "Cambiar a tema claro",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tema claro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
  it("saved choice wins over system on reload; unavailable storage still switches", () => {
    localStorage.setItem("orbita-theme", "dark");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    new Function(THEME_BOOT_SCRIPT)();
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Tema claro" })).toBeInTheDocument();
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    fireEvent.click(screen.getByRole("button", { name: "Tema claro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
  it("defaults to dark when the system is not light", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    new Function(THEME_BOOT_SCRIPT)();
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Tema claro" })).toBeInTheDocument();
  });
});
