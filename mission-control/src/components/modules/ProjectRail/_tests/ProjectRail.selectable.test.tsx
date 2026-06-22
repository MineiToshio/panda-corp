/**
 * ProjectRail — selectedSlug extension tests (RED → GREEN → refactor).
 *
 * When ProjectRail receives `selectedSlug`, it activates "selectable mode":
 *   - Rail root: data-testid="selectable-project-rail" (nav element)
 *   - Each row: data-testid="selectable-project-row" (article element)
 *   - Each row has a Link to ?project=<name>
 *   - Selected row: data-selected="true"; others: data-selected="false"
 *   - Status icon (ti-player-play / ti-player-pause) inside the link
 *   - Stage line below icon+title row (data-testid="selectable-row-stage")
 *   - Running indicator (data-testid="selectable-row-indicator", sr-only)
 *   - Empty state: data-testid="selectable-project-rail-empty"
 *   - StatusChips, BusinessSnapshot, RecoveryHint rendered as siblings of the link
 *     (NOT nested inside the link — no button-inside-anchor)
 *
 * These tests replace the integration seam previously provided by
 * app/portfolio/SelectableProjectRail.tsx. After this, page.tsx imports
 * ProjectRail directly (satisfying the DR-057 gate).
 *
 * Traceability:
 *   CMP-03-rail → REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005
 *   DR-057 (reuse-before-create): ONE rail, not two
 *   AC-03-004.1, AC-03-005.1
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
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

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    name: "proj-alpha",
    path: "/projects/proj-alpha",
    status: makeStatus("implementation", true),
    exists: true,
    stage: "implementation",
    running: true,
    ...overrides,
  };
}

const ITEM_ALPHA = makeItem();

const ITEM_BETA = makeItem({
  name: "proj-beta",
  path: "/projects/proj-beta",
  status: makeStatus("architecture", false),
  stage: "architecture",
  running: false,
});

const ITEM_WITH_BADGES = makeItem({
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
  running: true,
});

const ITEM_BROKEN_WITH_REPO = makeItem({
  name: "proj-gone",
  path: "/projects/proj-gone",
  repo: "https://github.com/acme/proj-gone.git",
  status: absentStatus,
  exists: false,
  stage: "implementation",
  running: undefined,
});

const ITEM_SHIPPED = makeItem({
  name: "proj-shipped",
  path: "/projects/proj-shipped",
  status: makeStatus("operation", false),
  exists: true,
  stage: "operation",
  running: false,
  snapshot: { users: "1234", returnMetric: "$900 MRR", verdict: "double-down" },
});

// ---------------------------------------------------------------------------
// 1. Selectable mode: root testid
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — root element", () => {
  it("renders selectable-project-rail when selectedSlug is provided", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    expect(screen.getByTestId("selectable-project-rail")).toBeDefined();
  });

  it("does NOT render project-rail testid in selectable mode", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    expect(screen.queryByTestId("project-rail")).toBeNull();
  });

  it("renders selectable-project-rail-empty when items=[] in selectable mode", () => {
    render(<ProjectRail items={[]} selectedSlug={undefined} />);
    // When selectedSlug is passed (even undefined makes it selectable) — handled:
    // pass selectedSlug="" to trigger selectable mode with empty items
    render(<ProjectRail items={[]} selectedSlug="any" />);
    expect(screen.getByTestId("selectable-project-rail-empty")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Selectable mode: row testid + data-selected
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — rows", () => {
  it("renders selectable-project-row for each item", () => {
    render(<ProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    const rows = screen.getAllByTestId("selectable-project-row");
    expect(rows).toHaveLength(2);
  });

  it("selected row has data-selected='true'", () => {
    render(<ProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    const rows = screen.getAllByTestId("selectable-project-row");
    expect(rows[0]?.getAttribute("data-selected")).toBe("true");
    expect(rows[1]?.getAttribute("data-selected")).toBe("false");
  });

  it("shows project name in each row", () => {
    render(<ProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    expect(screen.getByText("proj-alpha")).toBeDefined();
    expect(screen.getByText("proj-beta")).toBeDefined();
  });

  it("each row has aria-label with project name", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const row = screen.getByTestId("selectable-project-row");
    expect(row.getAttribute("aria-label")).toMatch(/proj-alpha/i);
  });
});

// ---------------------------------------------------------------------------
// 3. Link navigation: each row links to ?project=<name>
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — Link navigation", () => {
  it("each row has a link with href containing ?project=<name>", () => {
    render(<ProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes("project=proj-alpha"))).toBe(true);
    expect(hrefs.some((h) => h.includes("project=proj-beta"))).toBe(true);
  });

  it("selected row's link has aria-current='page'", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const link = screen.getByRole("link", { name: /proj-alpha/i });
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("non-selected row's link does NOT have aria-current", () => {
    render(<ProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    const links = screen.getAllByRole("link");
    const betaLink = links.find((l) => l.getAttribute("href")?.includes("proj-beta"));
    expect(betaLink?.getAttribute("aria-current")).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// 4. Status icons in selectable mode
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — status icons", () => {
  it("a running project has play icon (ti-player-play)", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const row = screen.getByRole("article", { name: /proj-alpha/i });
    const icon = within(row).getByTestId("rail-item-status-icon");
    expect(icon.className).toContain("ti-player-play");
  });

  it("a stopped project has pause icon (ti-player-pause)", () => {
    render(<ProjectRail items={[ITEM_BETA]} selectedSlug="proj-beta" />);
    const row = screen.getByRole("article", { name: /proj-beta/i });
    const icon = within(row).getByTestId("rail-item-status-icon");
    expect(icon.className).toContain("ti-player-pause");
  });

  it("a missing-path project has no status icon (running is undefined)", () => {
    render(<ProjectRail items={[ITEM_BROKEN_WITH_REPO]} selectedSlug="proj-gone" />);
    const row = screen.getByRole("article", { name: /proj-gone/i });
    expect(within(row).queryByTestId("rail-item-status-icon")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Stage line in selectable mode
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — stage line", () => {
  it("shows stage line (selectable-row-stage) for each row", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const row = screen.getByRole("article", { name: /proj-alpha/i });
    const stageLine = within(row).getByTestId("selectable-row-stage");
    expect(stageLine).toBeDefined();
    // UI copy is Spanish (architecture §7): implementation → "En construcción".
    expect(stageLine.textContent).toMatch(/construcción/i);
  });
});

// ---------------------------------------------------------------------------
// 6. Running indicator (sr-only) in selectable mode
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — running indicator", () => {
  it("shows selectable-row-indicator for running project", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const indicator = screen.getByTestId("selectable-row-indicator");
    expect(indicator.textContent).toMatch(/Construyendo/i);
  });

  it("shows selectable-row-indicator for stopped project", () => {
    render(<ProjectRail items={[ITEM_BETA]} selectedSlug="proj-beta" />);
    const indicator = screen.getByTestId("selectable-row-indicator");
    expect(indicator.textContent).toMatch(/Parado/i);
  });

  it("does NOT show selectable-row-indicator for missing-path project (running undefined)", () => {
    render(<ProjectRail items={[ITEM_BROKEN_WITH_REPO]} selectedSlug="proj-gone" />);
    const row = screen.getByRole("article", { name: /proj-gone/i });
    expect(within(row).queryByTestId("selectable-row-indicator")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. StatusChips in selectable mode (count badges)
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — StatusChips (count badges)", () => {
  it("shows decisions badge when pendingDecisions > 0", () => {
    render(<ProjectRail items={[ITEM_WITH_BADGES]} selectedSlug="needs-attention" />);
    expect(screen.getByTestId("status-chip-decisions")).toBeDefined();
    expect(screen.getByTestId("status-chip-decisions").textContent).toContain("3");
  });

  it("shows bugs badge when pendingBugs > 0", () => {
    render(<ProjectRail items={[ITEM_WITH_BADGES]} selectedSlug="needs-attention" />);
    expect(screen.getByTestId("status-chip-bugs")).toBeDefined();
    expect(screen.getByTestId("status-chip-bugs").textContent).toContain("1");
  });

  it("shows NO count badges when counts are 0 / absent", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    expect(screen.queryByTestId("status-chip-decisions")).toBeNull();
    expect(screen.queryByTestId("status-chip-bugs")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. BusinessSnapshot in selectable mode (shipped projects)
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — BusinessSnapshot", () => {
  it("shows business snapshot for a shipped project", () => {
    render(<ProjectRail items={[ITEM_SHIPPED]} selectedSlug="proj-shipped" />);
    const row = screen.getByRole("article", { name: /proj-shipped/i });
    expect(within(row).queryByText("1234")).not.toBeNull();
    expect(within(row).queryByText("$900 MRR")).not.toBeNull();
    expect(within(row).queryByText("double-down")).not.toBeNull();
  });

  it("does NOT show business snapshot for a building project", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const row = screen.getByRole("article", { name: /proj-alpha/i });
    expect(within(row).queryByTestId("business-snapshot")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. RecoveryHint in selectable mode (path not found)
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — RecoveryHint (path not found)", () => {
  it("shows recovery hint (Banner) for a missing-path project", () => {
    render(<ProjectRail items={[ITEM_BROKEN_WITH_REPO]} selectedSlug="proj-gone" />);
    const row = screen.getByRole("article", { name: /proj-gone/i });
    expect(within(row).queryByText(/ruta no encontrada|path not found/i)).not.toBeNull();
  });

  it("shows git clone recovery command when repo is present", () => {
    render(<ProjectRail items={[ITEM_BROKEN_WITH_REPO]} selectedSlug="proj-gone" />);
    const row = screen.getByRole("article", { name: /proj-gone/i });
    expect(within(row).queryByText(/git clone/i)).not.toBeNull();
    expect(within(row).queryByText(/sync-portfolio/i)).not.toBeNull();
  });

  it("does NOT show recovery for a present-path project", () => {
    render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const row = screen.getByRole("article", { name: /proj-alpha/i });
    expect(within(row).queryByText(/ruta no encontrada|path not found/i)).toBeNull();
  });

  it("copy button is NOT nested inside the navigation link (no button-in-anchor)", () => {
    render(<ProjectRail items={[ITEM_BROKEN_WITH_REPO]} selectedSlug="proj-gone" />);
    const row = screen.getByRole("article", { name: /proj-gone/i });
    const copyButton = within(row).queryByTestId("copy-button");
    expect(copyButton).not.toBeNull();

    // Walk up from the copy button: must NOT have an ancestor <a> element.
    let ancestor: HTMLElement | null = copyButton?.parentElement ?? null;
    let nestedInsideAnchor = false;
    while (ancestor !== null) {
      if (ancestor.tagName === "A") {
        nestedInsideAnchor = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    expect(nestedInsideAnchor).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Design token invariant — no hardcoded colors
// ---------------------------------------------------------------------------

describe("ProjectRail selectable mode — design token invariant", () => {
  it("has no hardcoded hex/rgb/hsl colors in selectable mode", () => {
    const { container } = render(<ProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\(/);
      expect(style).not.toMatch(/\bhsl\(/);
    }
  });
});
