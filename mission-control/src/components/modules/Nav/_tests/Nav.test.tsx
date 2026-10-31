import { render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Nav } from "../Nav";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));
const visibility = document.createElement("style");
visibility.textContent = ".mini { display: none; }";
beforeEach(() => {
  document.head.append(visibility);
  vi.mocked(usePathname).mockReturnValue("/");
});

const DESTINATIONS = [
  ["Inicio", "/"],
  ["Tablero", "/board"],
  ["Portafolio", "/portfolio"],
  ["Propuestas", "/proposals"],
  ["Logros", "/achievements"],
  ["Documentación", "/manual"],
  ["Configuración", "/configuration"],
];

describe("FRD-19 navigation", () => {
  it("AC-19-001.2/.4: exposes seven real destinations in prototype order", () => {
    render(<Nav />);
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(DESTINATIONS.map(([, path]) => path));
    for (const [label, path] of DESTINATIONS) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", path);
    }
  });

  it.each([
    ["/", "Inicio"],
    ["/board/idea/architecture", "Tablero"],
    ["/projects/mission-control/spec", "Portafolio"],
    ["/portfolio/project", "Portafolio"],
    ["/proposals/backlog", "Propuestas"],
    ["/achievements", "Logros"],
    ["/manual/reference/rules", "Documentación"],
    ["/configuration/skills", "Configuración"],
  ])("AC-19-002.1/.2: marks one destination on %s", (pathname, label) => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    render(<Nav />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(
      screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("AC-19-002.2: does not highlight near-miss prefixes or unknown routes", () => {
    vi.mocked(usePathname).mockReturnValue("/manual-other");
    render(<Nav />);
    expect(screen.getAllByRole("link").some((link) => link.hasAttribute("aria-current"))).toBe(
      false,
    );
  });
});

afterEach(() => visibility.remove());
