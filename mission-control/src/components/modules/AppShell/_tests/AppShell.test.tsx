/**
 * FRD-19 — AppShell (CMP-19-app-shell) tests.
 *
 * The persistent topbar on top-level surfaces; absent on the exempt drill-ins. Covers the landmark,
 * the hosted slots, the skip link, the mobile toggle, the #main-content wrapper, and the scope rule.
 *
 * AC-19-001.1/.3/.5, AC-19-003.2, AC-19-004.1.
 */

import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../AppShell";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));
const mockUsePathname = vi.mocked(usePathname);

const LEVEL = <div data-testid="level-slot">level</div>;
const BADGE = (
  <a href="/proposals" data-testid="badge-slot">
    Propuestas
  </a>
);

function renderShell() {
  return render(
    <AppShell levelBar={LEVEL} proposalsBadge={BADGE}>
      <main data-testid="page">page</main>
    </AppShell>,
  );
}

beforeEach(() => {
  mockUsePathname.mockReturnValue("/");
});

describe("FRD-19 AppShell — persistent global shell", () => {
  it("renders the shell landmark on a top-level surface", () => {
    renderShell();
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("hosts the level slot, the nav, and the proposals slot", () => {
    renderShell();
    expect(screen.getByTestId("level-slot")).toBeInTheDocument();
    expect(screen.getByTestId("app-nav")).toBeInTheDocument();
    expect(screen.getByTestId("badge-slot")).toBeInTheDocument();
  });

  it("wraps page content in #main-content and adds no second <main>", () => {
    const { container } = renderShell();
    expect(container.querySelector("#main-content")).not.toBeNull();
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("provides a skip link to #main-content as the first focusable element", () => {
    const { container } = renderShell();
    const skip = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(container.firstElementChild).toBe(skip);
  });

  it("exposes the mobile nav toggle with aria-expanded + aria-controls", () => {
    renderShell();
    const toggle = screen.getByTestId("app-nav-toggle");
    expect(toggle).toHaveAttribute("data-nav-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "app-nav-region");
  });

  it("does NOT render the topbar on the exempt Configuration route", () => {
    mockUsePathname.mockReturnValue("/configuration");
    renderShell();
    expect(screen.queryByTestId("app-shell")).toBeNull();
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });

  it("does NOT render the topbar on the project workspace (/projects/**)", () => {
    mockUsePathname.mockReturnValue("/projects/mission-control");
    renderShell();
    expect(screen.queryByTestId("app-shell")).toBeNull();
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });
});
