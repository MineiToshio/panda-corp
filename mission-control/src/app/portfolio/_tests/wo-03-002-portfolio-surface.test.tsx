/**
 * WO-03-002 — Portfolio surface tests (RED → GREEN → refactor)
 *
 * Tests verify the acceptance criteria of the portfolio surface re-paint:
 *   AC-03-001 — Rail lists only building/shipped projects; proper "PROYECTOS" label.
 *   AC-03-002 — Each row shows title, stage, building/stopped indicator (icon + label).
 *   AC-03-004 — Selecting a project shows its workspace in the right panel.
 *   AC-03-005 — No selection → select first by default.
 *   AC-03-006 — Empty state; path-not-found badge + recovery via Banner.
 *   DR-062   — PageTitle with H1 "Portfolio" and ti-stack-2 icon.
 *   FDD-03   — Two-column grid layout (240px rail + workspace), PROYECTOS label,
 *              ti-player-play/pause icons on rail items.
 *   DR-057   — RecoveryHint reuses Banner (not a forked component).
 *
 * Traceability:
 *   CMP-03-rail → REQ-03-001, REQ-03-002
 *   CMP-03-workspace-slot → REQ-03-004, REQ-03-005
 *   CMP-03-empty → REQ-03-006
 *   CMP-03-recovery → AC-03-006.2, AC-03-006.3, AC-03-006.4
 *   WO-03-002
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStatus(phase: string, running?: boolean): StatusResult {
  return {
    present: true,
    malformed: false,
    status: { phase: phase as never, ...(running !== undefined ? { running } : {}) },
  };
}

const absentStatus: StatusResult = { present: false, malformed: false, status: null };

const BUILDING: ProjectListItem = {
  name: "mission-control",
  path: "/p/mission-control",
  status: makeStatus("implementation", true),
  exists: true,
  stage: "implementation",
  running: true,
};

const SHIPPED: ProjectListItem = {
  name: "funko-tracker",
  path: "/p/funko-tracker",
  status: makeStatus("operation", false),
  exists: true,
  stage: "operation",
  running: false,
};

const BROKEN_WITH_REPO: ProjectListItem = {
  name: "lost-project",
  path: "/p/lost-project",
  repo: "https://github.com/acme/lost.git",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

const BROKEN_NO_REPO: ProjectListItem = {
  name: "orphan-project",
  path: "/p/orphan-project",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

// ---------------------------------------------------------------------------
// Mock setup — vi.fn() so we can override per test
// ---------------------------------------------------------------------------

const activeProjectsMock = vi.fn(() => [BUILDING, SHIPPED] as ProjectListItem[]);

vi.mock("@/lib/portfolio/portfolio", () => ({
  activeProjects: () => activeProjectsMock(),
}));

// Import AFTER mock registration.
import PortfolioPage from "../page";

function makeSearchParams(
  params: Record<string, string | string[] | undefined>,
): Promise<Record<string, string | string[] | undefined>> {
  return Promise.resolve(params);
}

async function renderPage(
  items: ProjectListItem[],
  params: Record<string, string | string[] | undefined> = {},
): Promise<void> {
  activeProjectsMock.mockReturnValue(items);
  const ui = await PortfolioPage({ searchParams: makeSearchParams(params) });
  render(ui);
}

afterEach(() => {
  vi.clearAllMocks();
  activeProjectsMock.mockReset();
  activeProjectsMock.mockImplementation(() => [BUILDING, SHIPPED]);
});

// ---------------------------------------------------------------------------
// DR-062 — PageTitle with H1 "Portfolio"
// ---------------------------------------------------------------------------

describe("DR-062 — PageTitle with H1 Portfolio", () => {
  it("renders an H1 with text 'Portfolio'", async () => {
    await renderPage([BUILDING, SHIPPED]);
    const h1 = screen.getByRole("heading", { level: 1, name: /Portfolio/i });
    expect(h1).toBeDefined();
  });

  it("renders the page-title component (data-testid='page-title')", async () => {
    await renderPage([BUILDING, SHIPPED]);
    expect(screen.getByTestId("page-title")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FDD-03 — Layout and PROYECTOS label
// ---------------------------------------------------------------------------

describe("FDD-03 — Portfolio layout structure", () => {
  it("renders the portfolio rail section", async () => {
    await renderPage([BUILDING, SHIPPED]);
    expect(screen.getByTestId("portfolio-rail")).toBeDefined();
  });

  it("renders the workspace pane section", async () => {
    await renderPage([BUILDING, SHIPPED]);
    expect(screen.getByTestId("workspace-slot")).toBeDefined();
  });

  it("renders a 'PROYECTOS' uppercase label above the rail items", async () => {
    await renderPage([BUILDING, SHIPPED]);
    const label = screen.getByTestId("portfolio-rail-label");
    expect(label.textContent).toMatch(/PROYECTOS/);
  });
});

// ---------------------------------------------------------------------------
// AC-03-002 — Status icons on rail items (FDD-03: ti-player-play / ti-player-pause)
// ---------------------------------------------------------------------------

describe("AC-03-002 — Status icons and indicator text on rail items", () => {
  it("a running project row shows the play icon (ti-player-play)", async () => {
    await renderPage([BUILDING, SHIPPED]);
    const row = screen.getByRole("article", { name: /mission-control/i });
    const icon = within(row).getByTestId("rail-status-icon");
    expect(icon.className).toContain("ti-player-play");
  });

  it("a stopped project row shows the pause icon (ti-player-pause)", async () => {
    await renderPage([BUILDING, SHIPPED], { project: "funko-tracker" });
    const row = screen.getByRole("article", { name: /funko-tracker/i });
    const icon = within(row).getByTestId("rail-status-icon");
    expect(icon.className).toContain("ti-player-pause");
  });

  it("the stage label appears on each rail item", async () => {
    await renderPage([BUILDING, SHIPPED]);
    const row = screen.getByRole("article", { name: /mission-control/i });
    expect(within(row).queryByTestId("selectable-row-stage")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selected state — .rail.on equivalent (accent-bg + accent border)
// ---------------------------------------------------------------------------

describe("Selected rail item styling (.rail.on equivalent)", () => {
  it("selected row has data-selected='true'", async () => {
    await renderPage([BUILDING, SHIPPED], { project: "mission-control" });
    const row = screen.getByRole("article", { name: /mission-control/i });
    expect(row.getAttribute("data-selected")).toBe("true");
  });

  it("selected row has accent background via CSS variable", async () => {
    await renderPage([BUILDING, SHIPPED], { project: "mission-control" });
    const row = screen.getByRole("article", { name: /mission-control/i });
    const style = row.getAttribute("style") ?? "";
    expect(style).toMatch(/accent-bg|accent/i);
  });

  it("unselected row does NOT have accent-bg (only selected uses it)", async () => {
    await renderPage([BUILDING, SHIPPED], { project: "mission-control" });
    const row = screen.getByRole("article", { name: /funko-tracker/i });
    expect(row.getAttribute("data-selected")).toBe("false");
    // Unselected row style should NOT reference accent-bg
    const style = row.getAttribute("style") ?? "";
    expect(style).not.toContain("accent-bg");
  });
});

// ---------------------------------------------------------------------------
// AC-03-006 — Empty state
// ---------------------------------------------------------------------------

describe("AC-03-006 — Empty state when no active projects", () => {
  it("shows 'Sin proyectos aún.' in the rail when no projects", async () => {
    await renderPage([]);
    expect(screen.getByText(/Sin proyectos aún\./i)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-03-006 — Path-not-found recovery via Banner (DR-057)
// ---------------------------------------------------------------------------

describe("AC-03-006 — Path-not-found recovery (Banner reuse, DR-057)", () => {
  it("a missing-path project with repo shows the Banner (data-testid='banner')", async () => {
    await renderPage([BROKEN_WITH_REPO]);
    const row = screen.getByRole("article", { name: /lost-project/i });
    expect(within(row).queryByTestId("banner")).not.toBeNull();
  });

  it("a missing-path project with repo shows ⚠ path-not-found heading in the Banner", async () => {
    await renderPage([BROKEN_WITH_REPO]);
    const row = screen.getByRole("article", { name: /lost-project/i });
    expect(within(row).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
  });

  it("a missing-path project with repo shows git clone recovery command", async () => {
    await renderPage([BROKEN_WITH_REPO]);
    const row = screen.getByRole("article", { name: /lost-project/i });
    expect(within(row).queryByText(/git clone/i)).not.toBeNull();
  });

  it("a missing-path project with NO repo shows no-remote warning (no clone command)", async () => {
    await renderPage([BROKEN_NO_REPO]);
    const row = screen.getByRole("article", { name: /orphan-project/i });
    expect(within(row).queryByText(/git clone/i)).toBeNull();
    expect(within(row).queryByText(/pandacorp:spec/i)).not.toBeNull();
  });

  it("RecoveryHint uses ONE shared Banner per broken-path row (DR-057: no forked banner)", async () => {
    await renderPage([BROKEN_WITH_REPO]);
    const row = screen.getByRole("article", { name: /lost-project/i });
    const banners = within(row).queryAllByTestId("banner");
    // Exactly one Banner rendered — the shared component, not a fork
    expect(banners.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// WorkspaceSlot placeholder copy (FDD-03)
// ---------------------------------------------------------------------------

describe("WorkspaceSlot placeholder", () => {
  it("shows workspace-slot-placeholder when a project is selected (FRD-04 stub)", async () => {
    await renderPage([BUILDING, SHIPPED], { project: "mission-control" });
    expect(screen.getByTestId("workspace-slot-placeholder")).toBeDefined();
  });

  it("no hardcoded hex/rgb/hsl in the page layout (token invariant)", async () => {
    await renderPage([BUILDING, SHIPPED]);
    const pageEl = screen.getByTestId("portfolio-page");
    const all = pageEl.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\(/);
      expect(style).not.toMatch(/\bhsl\(/);
    }
  });
});
