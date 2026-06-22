/**
 * FRD-19 — Nav (CMP-19-nav) tests.
 *
 * The six top-level destinations as real links styled `.tab`, active by `usePathname()`. The sixth
 * (Propuestas) is the injected slot, here a stub — its own behaviour lives in ProposalsBadge tests.
 *
 * AC-19-001.2 (six correct hrefs), AC-19-001.4 (real links), AC-19-002.1/.2 (exactly one active; `/`
 * exact; none on exempt/unknown).
 */

import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Nav } from "../Nav";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));
const mockUsePathname = vi.mocked(usePathname);

const SLOT = (
  <a href="/proposals" data-testid="proposals-slot">
    Propuestas
  </a>
);

function currentLinks(): HTMLElement[] {
  return screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
}

beforeEach(() => {
  mockUsePathname.mockReturnValue("/");
});

describe("FRD-19 Nav — six top-level destinations", () => {
  it("renders the five plain destinations as links with their correct hrefs", () => {
    render(<Nav proposalsBadge={SLOT} />);
    expect(screen.getByTestId("app-nav-inicio")).toHaveAttribute("href", "/");
    expect(screen.getByTestId("app-nav-tablero")).toHaveAttribute("href", "/board");
    expect(screen.getByTestId("app-nav-portfolio")).toHaveAttribute("href", "/portfolio");
    expect(screen.getByTestId("app-nav-logros")).toHaveAttribute("href", "/achievements");
    expect(screen.getByTestId("app-nav-documentacion")).toHaveAttribute("href", "/manual");
  });

  it("places the Propuestas slot between Portfolio and Logros (prototype order)", () => {
    render(<Nav proposalsBadge={SLOT} />);
    const order = Array.from(screen.getByTestId("app-nav").querySelectorAll("[data-testid]")).map(
      (el) => el.getAttribute("data-testid"),
    );
    expect(order.indexOf("app-nav-portfolio")).toBeLessThan(order.indexOf("proposals-slot"));
    expect(order.indexOf("proposals-slot")).toBeLessThan(order.indexOf("app-nav-logros"));
  });

  it("marks exactly the active destination with aria-current='page'", () => {
    mockUsePathname.mockReturnValue("/board");
    render(<Nav proposalsBadge={SLOT} />);
    expect(screen.getByTestId("app-nav-tablero")).toHaveAttribute("aria-current", "page");
    expect(currentLinks()).toHaveLength(1);
  });

  it("marks Inicio active only on exact '/' (never on a subpath)", () => {
    mockUsePathname.mockReturnValue("/board");
    render(<Nav proposalsBadge={SLOT} />);
    expect(screen.getByTestId("app-nav-inicio")).not.toHaveAttribute("aria-current");
  });

  it("marks no destination active on an exempt/unknown route", () => {
    mockUsePathname.mockReturnValue("/configuration");
    render(<Nav proposalsBadge={SLOT} />);
    expect(currentLinks()).toHaveLength(0);
  });

  it("exposes a <nav> landmark with a Spanish accessible label", () => {
    render(<Nav proposalsBadge={SLOT} />);
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
  });
});
