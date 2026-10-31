import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
import { SidebarProjects } from "../SidebarProjects";

function project(id: string, total: number | null = 10): ProjectOverviewItem {
  return {
    id,
    name: id,
    path: `/projects/${id}`,
    phase: "implementation",
    source: {
      name: id,
      path: `/projects/${id}`,
      exists: true,
      running: false,
      status: { present: false, malformed: false, status: null },
    },
    stageIndex: 5,
    build: { kind: "idle", lastSignalAt: null, ageMinutes: null },
    nowIso: "2026-10-30T12:00:00Z",
    lastCommit: { at: "2026-10-30T10:00:00Z" },
    pathMissing: false,
    counts: {
      ordersTotal: total,
      ordersVerified: 4,
      frds: 1,
      docs: 1,
      adrs: 0,
      openChanges: 0,
      pendingDecisions: 0,
    },
    nextCommand: "/pandacorp:implement",
  };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/portfolio/Alpha/commands",
}));
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe("AC-19-005.1: sidebar project group", () => {
  it("marks only the project owning the active nested route", () => {
    render(<SidebarProjects projects={[project("Alpha"), project("Beta")]} />);
    expect(screen.getByRole("link", { name: /^Alpha:/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Beta:/ })).not.toHaveAttribute("aria-current");
  });
  it("shows the first five canonical last-commit ordered projects and the complete catalogue link", () => {
    const rows = ["Recent", "Alpha", "Beta", "Gamma", "Delta", "Older"].map((id) => project(id));
    render(<SidebarProjects projects={rows} />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      expect.stringContaining("Recent"),
      expect.stringContaining("Alpha"),
      expect.stringContaining("Beta"),
      expect.stringContaining("Gamma"),
      expect.stringContaining("Delta"),
      "Ver los 6",
    ]);
    expect(
      screen.getByRole("link", { name: "Recent: Construcción · 40% de work orders verificadas" }),
    ).toHaveAttribute("href", "/portfolio/Recent/summary");
    expect(screen.getByRole("link", { name: "Ver los 6" })).toHaveAttribute("href", "/portfolio");
  });
  it("folds with aria controls, remembers across remount and reopens", () => {
    const view = render(<SidebarProjects projects={[project("Alpha")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Proyectos (1)" }));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button")).toHaveAttribute("aria-controls", "projlist");
    expect(screen.queryByRole("link")).toBeNull();
    expect(localStorage.getItem("orbita-projects-open")).toBe("false");
    view.unmount();
    render(<SidebarProjects projects={[project("Alpha")]} />);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("link")).toBeVisible();
  });
  it("zero projects stays honest; a read failure does not fabricate a zero", () => {
    const view = render(<SidebarProjects projects={[]} />);
    expect(screen.getByRole("button", { name: "Proyectos (0)" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    view.rerender(<SidebarProjects projects={null} />);
    expect(screen.getByRole("button", { name: "Proyectos" })).toBeInTheDocument();
  });
  it("storage unavailable keeps the folding choice for the current view", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<SidebarProjects projects={[project("Alpha")]} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });
});
