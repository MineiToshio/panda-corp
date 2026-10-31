import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../AppShell";
import { ThemeToggle } from "../ThemeToggle";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
let desktop = true;
let resize: (event: { matches: boolean }) => void;
beforeEach(() => {
  desktop = true;
  localStorage.clear();
  document.documentElement.removeAttribute("data-sidebar-pref");
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(min-width: 1180px)" ? desktop : query === "(hover: hover)",
      addEventListener: (_: string, fn: typeof resize) => {
        if (query === "(min-width: 1180px)") resize = fn;
      },
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("AC-19-005.3: persistent rail and float", () => {
  it("collapses, floats with pointer/focus, clears on leaving and pins open", () => {
    render(<AppShell footer={<ThemeToggle />}>Page</AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "Colapsar la barra lateral" }));
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-sidebar", "collapsed");
    const pin = screen.getByRole("button", { name: "Fijar abierta la barra lateral" });
    expect(pin).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("orbita-sidebar")).toBe("collapsed");
    const sidebar = screen.getByRole("complementary");
    fireEvent.pointerEnter(sidebar);
    expect(sidebar).toHaveAttribute("data-float", "true");
    fireEvent.pointerLeave(sidebar);
    expect(sidebar).toHaveAttribute("data-float", "false");
    act(() => pin.focus());
    expect(sidebar).toHaveAttribute("data-float", "true");
    fireEvent.blur(pin, { relatedTarget: document.body });
    expect(sidebar).toHaveAttribute("data-float", "false");
    fireEvent.click(pin);
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-sidebar", "expanded");
  });
  it("hydrates from the boot attribute and hides the collapse button below desktop", () => {
    document.documentElement.dataset.sidebarPref = "collapsed";
    render(<AppShell footer={<ThemeToggle />}>Page</AppShell>);
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-sidebar", "collapsed");
    act(() => resize({ matches: false }));
    expect(screen.queryByRole("button", { name: /la barra lateral/ })).toBeNull();
  });
});
