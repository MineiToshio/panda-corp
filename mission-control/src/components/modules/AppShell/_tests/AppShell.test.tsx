import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { AppShell } from "../AppShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: vi.fn(() => "/"),
}));
let resize: (event: { matches: boolean }) => void;
const visibility = document.createElement("style");
visibility.textContent = ".mini { display: none; }";
beforeEach(() => {
  document.head.append(visibility);
  vi.mocked(usePathname).mockReturnValue("/");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: (_type: string, handler: typeof resize) => {
        resize = handler;
      },
      removeEventListener: vi.fn(),
    })),
  );
});

function shell() {
  return (
    <AppShell>
      <div>
        <PageHead title="Inicio" />
        <button type="button">Page action</button>
      </div>
    </AppShell>
  );
}
function menu() {
  return screen.getByRole("button", { name: "Abrir menú" });
}
function sidebar() {
  return screen.getByRole("complementary", { name: "Navegación principal" });
}

describe("FRD-19 persistent frame", () => {
  it("AC-19-001.5, R16: skip link is first and focuses the single shell main in place", () => {
    render(shell());
    const skip = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(document.body.firstElementChild?.firstElementChild).toBe(skip);
    expect(skip).toHaveAttribute("href", "#content");
    fireEvent.click(skip);
    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.getByRole("main")).toHaveAttribute("id", "content");
    expect(window.location.pathname).toBe("/");
  });

  it("AC-19-003.3/.4: phone drawer is inert, opens to first link, Escape returns to either opener", () => {
    render(shell());
    expect(sidebar()).toHaveAttribute("inert");
    for (const opener of [menu(), screen.getByRole("button", { name: "Más" })]) {
      fireEvent.click(opener);
      expect(sidebar()).not.toHaveAttribute("inert");
      expect(menu()).toHaveAttribute("aria-expanded", "true");
      expect(
        within(sidebar()).getByRole("link", { name: "Pandacorp Mission Control: ir a Inicio" }),
      ).toHaveFocus();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(sidebar()).toHaveAttribute("data-open", "false");
      expect(opener).toHaveFocus();
    }
  });

  it("AC-19-003.4: outside press and current destination activation dismiss the drawer", () => {
    render(shell());
    fireEvent.click(menu());
    fireEvent.pointerDown(screen.getByTestId("drawer-scrim"));
    expect(menu()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu());
    fireEvent.click(within(sidebar()).getByRole("link", { name: "Inicio" }));
    expect(menu()).toHaveAttribute("aria-expanded", "false");
  });

  it("AC-19-003.4: pathname changes close the drawer without replacing page content", () => {
    const view = render(shell());
    fireEvent.click(menu());
    vi.mocked(usePathname).mockReturnValue("/projects/mission-control");
    view.rerender(shell());
    expect(menu()).toHaveAttribute("aria-expanded", "false");
    expect(within(sidebar()).getByRole("link", { name: "Portafolio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Page action" })).toBeInTheDocument();
  });

  it("AC-19-003.2/.3: desktop/tablet is never inert and crossing the breakpoint closes the drawer", () => {
    render(shell());
    fireEvent.click(menu());
    act(() => resize({ matches: false }));
    expect(sidebar()).not.toHaveAttribute("inert");
    expect(menu()).toHaveAttribute("aria-expanded", "false");
    act(() => resize({ matches: true }));
    expect(sidebar()).toHaveAttribute("inert");
  });

  it("AC-19-003.4: phone keyboard navigation stays inside the drawer", () => {
    render(shell());
    fireEvent.click(menu());
    const first = within(sidebar()).getByRole("link", {
      name: "Pandacorp Mission Control: ir a Inicio",
    });
    const last = within(sidebar()).getByRole("link", { name: "Configuración" });
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("AC-19-003.1/.2: desktop keeps navigation interactive without trapping focus", () => {
    render(shell());
    act(() => resize({ matches: false }));
    const last = within(sidebar()).getByRole("link", { name: "Configuración" });
    last.focus();
    expect(fireEvent.keyDown(document, { key: "Tab", cancelable: true })).toBe(true);
    expect(sidebar()).not.toHaveAttribute("inert");
  });

  it("AC-19-001.3: hosts sidebar slots in order around the navigation", () => {
    render(
      <AppShell pills="Pills" projects="Projects" guild="Guild" footer="Footer">
        Page
      </AppShell>,
    );
    expect(sidebar().textContent).toMatch(/Pills.*Inicio.*Projects.*Guild.*Footer/);
  });
});

afterEach(() => {
  visibility.remove();
  vi.unstubAllGlobals();
});
