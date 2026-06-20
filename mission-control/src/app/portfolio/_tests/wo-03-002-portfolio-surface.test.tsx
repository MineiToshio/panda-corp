/**
 * WO-03-002 — Portfolio surface acceptance tests (RED → GREEN → refactor)
 *
 * Tests verify the portfolio page's full surface matches the FDD / prototype:
 *
 *   AC (PageTitle / H1):
 *     - Page renders H1 "Portfolio" via PageTitle (the one light title block)
 *     - PageTitle has subtitle
 *
 *   AC (Layout / structure):
 *     - Left rail column present at portfolio-page-rail
 *     - Right workspace pane at portfolio-page-workspace
 *     - "PROYECTOS" rail label visible above rail items
 *
 *   AC (Rail items — matches prototype `.rail` style):
 *     - Status icon (ti-player-play / ti-player-pause) in the DOM per row
 *     - Stage label shown as second line below the title
 *     - Count badges (decisions, bugs) when > 0
 *
 *   AC (Selection and workspace slot):
 *     - Default selects first project
 *     - workspace-slot carries the selected slug
 *
 *   AC (Path-not-found recovery on the page):
 *     - Broken row shows ⚠ badge + git clone recovery
 *
 * Anchored in: FRD-03 EARS, FDD-03 §1–3, WO-03-002 acceptance criteria.
 *
 * Traceability:
 *   CMP-03-rail, CMP-03-workspace-slot, CMP-13-pagetitle
 *   REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005, REQ-03-006
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function status(phase: string, running?: boolean): StatusResult {
  return {
    present: true,
    malformed: false,
    status: { phase: phase as never, ...(running !== undefined ? { running } : {}) },
  };
}

const absentStatus: StatusResult = { present: false, malformed: false, status: null };

const BUILDING: ProjectListItem = {
  name: "mission-control",
  path: "/projects/mission-control",
  status: status("implementation", true),
  exists: true,
  stage: "implementation",
  running: true,
};

const SHIPPED: ProjectListItem = {
  name: "widget-pro",
  path: "/projects/widget-pro",
  status: status("operation", false),
  exists: true,
  stage: "operation",
  running: false,
  snapshot: { users: "1234", returnMetric: "$900 MRR", verdict: "double-down" },
};

const BROKEN: ProjectListItem = {
  name: "lost-app",
  path: "/projects/lost-app",
  repo: "https://github.com/acme/lost-app.git",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
};

const WITH_DECISIONS: ProjectListItem = {
  name: "needs-attention",
  path: "/projects/needs-attention",
  status: {
    present: true,
    malformed: false,
    status: {
      phase: "implementation" as never,
      running: true,
      pendingDecisions: 3,
      pendingBugs: 1,
    },
  },
  exists: true,
  stage: "implementation",
  running: true,
};

// ---------------------------------------------------------------------------
// Mock activeProjects() for page-level tests
// The mock must be declared before the page import (hoisting).
// ---------------------------------------------------------------------------

const mockItems: ProjectListItem[] = [BUILDING, SHIPPED, BROKEN];

vi.mock("@/lib/portfolio/portfolio", () => ({
  activeProjects: () => mockItems,
}));

// Import AFTER the mock is registered (hoisting ensures mock is set first).
import PortfolioPage from "../page";

function makeSearchParams(
  params: Record<string, string | string[] | undefined> = {},
): Promise<Record<string, string | string[] | undefined>> {
  return Promise.resolve(params);
}

async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
): Promise<void> {
  const ui = await PortfolioPage({ searchParams: makeSearchParams(params) });
  render(ui);
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. PageTitle — H1 "Portfolio" (AC: page renders with H1 "Portfolio" via PageTitle)
// ---------------------------------------------------------------------------

describe("WO-03-002 — PageTitle (H1 Portfolio)", () => {
  it("renders H1 with text 'Portfolio'", async () => {
    await renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Portfolio");
  });

  it("renders the page-title testid (PageTitle component)", async () => {
    await renderPage();
    expect(screen.getByTestId("page-title")).toBeDefined();
  });

  it("PageTitle has a subtitle (the portfolio description)", async () => {
    await renderPage();
    const subtitle = screen.getByTestId("page-title-subtitle");
    expect(subtitle).toBeDefined();
    expect(subtitle.textContent?.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// 2. Layout — two-column structure (rail + workspace)
// ---------------------------------------------------------------------------

describe("WO-03-002 — Two-column layout", () => {
  it("renders the portfolio page root", async () => {
    await renderPage();
    expect(screen.getByTestId("portfolio-page")).toBeDefined();
  });

  it("renders the rail column (portfolio-page-rail)", async () => {
    await renderPage();
    expect(screen.getByTestId("portfolio-page-rail")).toBeDefined();
  });

  it("renders the workspace column (portfolio-page-workspace)", async () => {
    await renderPage();
    expect(screen.getByTestId("portfolio-page-workspace")).toBeDefined();
  });

  it("the rail column contains the selectable-project-rail nav", async () => {
    await renderPage();
    const rail = screen.getByTestId("portfolio-page-rail");
    expect(within(rail).getByTestId("selectable-project-rail")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Rail label "PROYECTOS"
// ---------------------------------------------------------------------------

describe("WO-03-002 — PROYECTOS rail label", () => {
  it("renders the portfolio-rail-label above the rail items", async () => {
    await renderPage();
    const railCol = screen.getByTestId("portfolio-page-rail");
    expect(within(railCol).getByTestId("portfolio-rail-label")).toBeDefined();
  });

  it("portfolio-rail-label has 'PROYECTOS' text", async () => {
    await renderPage();
    const label = screen.getByTestId("portfolio-rail-label");
    expect(label.textContent).toContain("PROYECTOS");
  });
});

// ---------------------------------------------------------------------------
// 4. Rail items — prototype style (status icon + title + stage line)
// These tests render SelectableProjectRail directly to avoid page-level mock
// complexity while still verifying the component used by the live page.
// ---------------------------------------------------------------------------

describe("WO-03-002 — Rail items (status icon + title + stage line)", () => {
  it("renders one row per item", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(
      <SelectableProjectRail items={[BUILDING, SHIPPED, BROKEN]} selectedSlug="mission-control" />,
    );
    const rows = screen.getAllByTestId("selectable-project-row");
    expect(rows).toHaveLength(3);
  });

  it("each row shows the project name", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[BUILDING, SHIPPED]} selectedSlug="mission-control" />);
    expect(screen.getByText("mission-control")).toBeDefined();
    expect(screen.getByText("widget-pro")).toBeDefined();
  });

  it("a running project row has a play status icon (ti-player-play)", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[BUILDING]} selectedSlug="mission-control" />);
    const row = screen.getByRole("article", { name: /mission-control/i });
    const icon = within(row).getByTestId("rail-item-status-icon");
    expect(icon.className).toContain("ti-player-play");
  });

  it("a stopped project row has a pause status icon (ti-player-pause)", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[SHIPPED]} selectedSlug="widget-pro" />);
    const row = screen.getByRole("article", { name: /widget-pro/i });
    const icon = within(row).getByTestId("rail-item-status-icon");
    expect(icon.className).toContain("ti-player-pause");
  });

  it("stage label is shown for each row (stage line)", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[BUILDING]} selectedSlug="mission-control" />);
    const row = screen.getByRole("article", { name: /mission-control/i });
    const stageLine = within(row).getByTestId("selectable-row-stage");
    expect(stageLine).toBeDefined();
  });

  it("a missing-path project row has no running status icon (path is gone)", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[BROKEN]} selectedSlug="lost-app" />);
    const row = screen.getByRole("article", { name: /lost-app/i });
    // path-not-found: no running/stopped indicator shown (item.running is undefined)
    expect(within(row).queryByTestId("selectable-row-indicator")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Count badges in rail items
// ---------------------------------------------------------------------------

describe("WO-03-002 — Count badges (decisions/bugs in rail items)", () => {
  it("shows decisions badge when pendingDecisions > 0", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[WITH_DECISIONS]} selectedSlug="needs-attention" />);
    expect(screen.getByTestId("status-chip-decisions")).toBeDefined();
    expect(screen.getByTestId("status-chip-decisions").textContent).toContain("3");
  });

  it("shows bugs badge when pendingBugs > 0", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[WITH_DECISIONS]} selectedSlug="needs-attention" />);
    expect(screen.getByTestId("status-chip-bugs")).toBeDefined();
    expect(screen.getByTestId("status-chip-bugs").textContent).toContain("1");
  });

  it("shows NO count badges when counts are 0 / absent", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[BUILDING]} selectedSlug="mission-control" />);
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Selection + workspace slot (page-level smoke)
// ---------------------------------------------------------------------------

describe("WO-03-002 — Selection + workspace slot integration", () => {
  it("default selects first project; workspace slot carries its slug", async () => {
    await renderPage();
    const slot = screen.getByTestId("workspace-slot");
    expect(slot.getAttribute("data-slug")).toBe("mission-control");
  });

  it("?project= param selects that project", async () => {
    await renderPage({ project: "widget-pro" });
    const slot = screen.getByTestId("workspace-slot");
    expect(slot.getAttribute("data-slug")).toBe("widget-pro");
  });
});

// ---------------------------------------------------------------------------
// 7. Empty state (rail-level)
// ---------------------------------------------------------------------------

describe("WO-03-002 — Empty state", () => {
  it("shows empty state when no projects", async () => {
    const { SelectableProjectRail } = await import("../SelectableProjectRail");
    render(<SelectableProjectRail items={[]} selectedSlug={undefined} />);
    expect(screen.getByTestId("selectable-project-rail-empty")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Path-not-found recovery on the page surface (via page render)
// ---------------------------------------------------------------------------

describe("WO-03-002 — Path-not-found badge + recovery on LIVE page", () => {
  it("broken path row shows ⚠ ruta no encontrada badge", async () => {
    await renderPage();
    const brokenRow = screen.getByRole("article", { name: /lost-app/i });
    expect(within(brokenRow).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
  });

  it("broken path row shows git clone recovery command", async () => {
    await renderPage();
    const brokenRow = screen.getByRole("article", { name: /lost-app/i });
    expect(within(brokenRow).queryByText(/git clone/i)).not.toBeNull();
    expect(within(brokenRow).queryByText(/sync-portfolio/i)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. Design token invariant — no hardcoded colors
// ---------------------------------------------------------------------------

describe("WO-03-002 — Design token invariant (no hardcoded colors)", () => {
  it("page root has no hardcoded hex/rgb/hsl colors", async () => {
    await renderPage();
    const all = document.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\(/);
      expect(style).not.toMatch(/\bhsl\(/);
    }
  });
});
