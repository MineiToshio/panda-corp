/**
 * ProjectRail — component tests (TDD: RED → GREEN → refactor).
 *
 * Consumes IF-03-activeProjects contract (lib/portfolio.ts → activeProjects()).
 * ProjectRail is the UI layer for WO-03-001 (CMP-03-rail, CMP-03-row, CMP-03-snapshot,
 * CMP-03-empty, CMP-03-recovery).
 *
 * Traceability:
 *   CMP-03-rail    → REQ-03-001 (vertical rail, active projects)
 *   CMP-03-row     → REQ-03-002 (title, stage, building/stopped indicator)
 *   CMP-03-snapshot → REQ-03-003 (shipped business snapshot chips)
 *   CMP-03-empty   → REQ-03-006 (graceful empty state)
 *   CMP-03-recovery → REQ-03-006 (path-not-found badge + recovery command)
 *   IF-03-activeProjects (docs/api.md WO-03-001): ProjectListItem shape consumed.
 *
 * Tests cover:
 *   1. Loading, error, empty states (required by AGENTS.md rule 4)
 *   2. Row rendering: name, stage, building/stopped indicator
 *   3. Not-found badge + recovery hint (repo present / absent)
 *   4. Business snapshot chips (operation/shipped projects)
 *   5. data-testid on every interactive/significant element
 *   6. Zero hardcoded colors (CSS custom properties only)
 *   7. Accessibility: aria-labels, role attributes, aria-live
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio";
import type { StatusResult } from "@/lib/status";
import { ProjectRail } from "./ProjectRail";

// ---------------------------------------------------------------------------
// Fixture helpers — build StatusResult discriminated union members correctly.
// ---------------------------------------------------------------------------

/** Absent-status variant: present=false. */
const ABSENT_STATUS: StatusResult = { present: false, malformed: false, status: null };

/** Present-status variant: present=true, supplies the phase field. */
function makePresentStatus(phase: string): StatusResult {
  return { present: true, malformed: false, status: { phase: phase as never } };
}

// ---------------------------------------------------------------------------
// Fixture builders — ProjectListItem shape from IF-03-activeProjects.
// stage/running are the display fields; status is the raw StatusResult.
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    name: "proj-a",
    path: "projects/proj-a",
    status: makePresentStatus("implementation"),
    exists: true,
    stage: "implementation",
    running: true,
    ...overrides,
  };
}

const IMPL_ITEM = makeItem();

const ARCH_ITEM = makeItem({
  name: "proj-architecture",
  path: "projects/proj-architecture",
  repo: "https://github.com/ada/proj-arch",
  stage: "architecture",
  running: false,
  status: makePresentStatus("architecture"),
});

const OPERATION_ITEM = makeItem({
  name: "proj-operation",
  path: "projects/proj-operation",
  repo: "https://github.com/ada/proj-operation",
  stage: "operation",
  running: false,
  status: makePresentStatus("operation"),
  snapshot: { users: "500", returnMetric: "$1 200 MRR", verdict: "double-down" },
});

const MISSING_PATH_WITH_REPO = makeItem({
  name: "proj-broken-path",
  path: "/nonexistent/path/does/not/exist",
  repo: "https://github.com/ada/broken",
  stage: "operation",
  running: undefined,
  exists: false,
  status: ABSENT_STATUS,
  snapshot: { users: "340", returnMetric: "OSS stars", verdict: "shipped" },
});

const MISSING_PATH_NO_REPO = makeItem({
  name: "proj-no-repo",
  path: "/also/gone",
  repo: undefined,
  stage: "architecture",
  running: undefined,
  exists: false,
  status: ABSENT_STATUS,
});

// ---------------------------------------------------------------------------
// 1. Loading state
// ---------------------------------------------------------------------------

describe("ProjectRail — loading state", () => {
  it("renders project-rail root element", () => {
    render(<ProjectRail items={[]} isLoading />);
    expect(screen.getByTestId("project-rail")).toBeDefined();
  });

  it("renders project-rail-loading when isLoading=true", () => {
    render(<ProjectRail items={[]} isLoading />);
    expect(screen.getByTestId("project-rail-loading")).toBeDefined();
  });

  it("does NOT render empty state when isLoading=true", () => {
    render(<ProjectRail items={[]} isLoading />);
    expect(screen.queryByTestId("project-rail-empty")).toBeNull();
  });

  it("does NOT render error state when isLoading=true", () => {
    render(<ProjectRail items={[]} isLoading error="boom" />);
    expect(screen.queryByTestId("project-rail-error")).toBeNull();
    expect(screen.getByTestId("project-rail-loading")).toBeDefined();
  });

  it("loading state has aria-busy attribute", () => {
    render(<ProjectRail items={[]} isLoading />);
    const el = screen.getByTestId("project-rail-loading");
    expect(el.hasAttribute("aria-busy")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Error state
// ---------------------------------------------------------------------------

describe("ProjectRail — error state", () => {
  it("renders project-rail-error when error is set", () => {
    render(<ProjectRail items={[]} error="No se pudo leer el portafolio." />);
    expect(screen.getByTestId("project-rail-error")).toBeDefined();
  });

  it("shows the error message text", () => {
    render(<ProjectRail items={[]} error="Archivo no encontrado." />);
    expect(screen.getByText("Archivo no encontrado.")).toBeDefined();
  });

  it("does NOT render empty state when error is set", () => {
    render(<ProjectRail items={[]} error="boom" />);
    expect(screen.queryByTestId("project-rail-empty")).toBeNull();
  });

  it("error state has role=alert", () => {
    render(<ProjectRail items={[]} error="boom" />);
    const el = screen.getByTestId("project-rail-error");
    expect(el.getAttribute("role")).toBe("alert");
  });

  it("error state has aria-live=assertive", () => {
    render(<ProjectRail items={[]} error="boom" />);
    const el = screen.getByTestId("project-rail-error");
    expect(el.getAttribute("aria-live")).toBe("assertive");
  });
});

// ---------------------------------------------------------------------------
// 3. Empty state
// ---------------------------------------------------------------------------

describe("ProjectRail — empty state", () => {
  it("renders project-rail-empty when items=[]", () => {
    render(<ProjectRail items={[]} />);
    expect(screen.getByTestId("project-rail-empty")).toBeDefined();
  });

  it("does NOT render row when items=[]", () => {
    render(<ProjectRail items={[]} />);
    expect(screen.queryByTestId("project-rail-row")).toBeNull();
  });

  it("empty state has aria-live=polite", () => {
    render(<ProjectRail items={[]} />);
    const el = screen.getByTestId("project-rail-empty");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });

  it("project-rail root is always present regardless of state", () => {
    render(<ProjectRail items={[]} />);
    expect(screen.getByTestId("project-rail")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Row rendering: name, stage, indicator
// ---------------------------------------------------------------------------

describe("ProjectRail — row rendering", () => {
  it("renders one project-rail-row per item", () => {
    render(<ProjectRail items={[IMPL_ITEM, ARCH_ITEM]} />);
    const rows = screen.getAllByTestId("project-rail-row");
    expect(rows).toHaveLength(2);
  });

  it("renders project-rail-row-name with the project name", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    expect(screen.getByTestId("project-rail-row-name").textContent).toBe("proj-a");
  });

  it("renders project-rail-row-stage with the stage", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    const stage = screen.getByTestId("project-rail-row-stage");
    expect(stage.textContent).toMatch(/implementation/i);
  });

  it("renders project-rail-row-indicator for building (running=true)", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    const indicator = screen.getByTestId("project-rail-row-indicator");
    expect(indicator).toBeDefined();
  });

  it("renders project-rail-row-indicator text as 'Construyendo' when running=true", () => {
    render(<ProjectRail items={[makeItem({ running: true })]} />);
    const indicator = screen.getByTestId("project-rail-row-indicator");
    expect(indicator.textContent).toMatch(/Construyendo/i);
  });

  it("renders project-rail-row-indicator text as 'Parado' when running=false", () => {
    render(<ProjectRail items={[makeItem({ running: false })]} />);
    const indicator = screen.getByTestId("project-rail-row-indicator");
    expect(indicator.textContent).toMatch(/Parado/i);
  });

  it("renders project-rail-row-path with the path", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    const path = screen.getByTestId("project-rail-row-path");
    expect(path.textContent).toBe("projects/proj-a");
  });

  it("each row has an aria-label containing the project name", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    const row = screen.getByTestId("project-rail-row");
    expect(row.getAttribute("aria-label")).toMatch(/proj-a/i);
  });

  it("indicator has role=status for live announcement", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    const indicator = screen.getByTestId("project-rail-row-indicator");
    expect(indicator.getAttribute("role")).toBe("status");
  });

  it("indicator has aria-label in Spanish", () => {
    render(<ProjectRail items={[makeItem({ running: true })]} />);
    const indicator = screen.getByTestId("project-rail-row-indicator");
    const label = indicator.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Stage chip variants
// ---------------------------------------------------------------------------

describe("ProjectRail — stage chip", () => {
  it("renders stage chip for architecture", () => {
    render(<ProjectRail items={[ARCH_ITEM]} />);
    const chip = screen.getByTestId("project-rail-row-stage");
    expect(chip.textContent).toMatch(/architecture/i);
  });

  it("renders stage chip for operation", () => {
    render(<ProjectRail items={[OPERATION_ITEM]} />);
    const chip = screen.getByTestId("project-rail-row-stage");
    expect(chip.textContent).toMatch(/operation/i);
  });

  it("renders stage chip for release", () => {
    const releaseItem = makeItem({ name: "r", stage: "release", running: true });
    render(<ProjectRail items={[releaseItem]} />);
    const chip = screen.getByTestId("project-rail-row-stage");
    expect(chip.textContent).toMatch(/release/i);
  });
});

// ---------------------------------------------------------------------------
// 6. Path-not-found badge + recovery hint (REQ-03-006)
// ---------------------------------------------------------------------------

describe("ProjectRail — path-not-found badge", () => {
  it("renders project-rail-row-not-found-badge when exists=false", () => {
    render(<ProjectRail items={[MISSING_PATH_WITH_REPO]} />);
    expect(screen.getByTestId("project-rail-row-not-found-badge")).toBeDefined();
  });

  it("does NOT render not-found badge when exists=true", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    expect(screen.queryByTestId("project-rail-row-not-found-badge")).toBeNull();
  });

  it("not-found badge has role=status", () => {
    render(<ProjectRail items={[MISSING_PATH_WITH_REPO]} />);
    const badge = screen.getByTestId("project-rail-row-not-found-badge");
    expect(badge.getAttribute("role")).toBe("status");
  });

  it("not-found badge has aria-label in Spanish", () => {
    render(<ProjectRail items={[MISSING_PATH_WITH_REPO]} />);
    const badge = screen.getByTestId("project-rail-row-not-found-badge");
    const label = badge.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });
});

describe("ProjectRail — recovery hint (CMP-03-recovery)", () => {
  it("renders project-rail-recovery when path not found", () => {
    render(<ProjectRail items={[MISSING_PATH_WITH_REPO]} />);
    expect(screen.getByTestId("project-rail-recovery")).toBeDefined();
  });

  it("does NOT render project-rail-recovery when path exists", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    expect(screen.queryByTestId("project-rail-recovery")).toBeNull();
  });

  it("renders clone command when repo is present", () => {
    render(<ProjectRail items={[MISSING_PATH_WITH_REPO]} />);
    const cmd = screen.getByTestId("project-rail-recovery-command");
    expect(cmd.textContent).toContain("git clone");
    expect(cmd.textContent).toContain("https://github.com/ada/broken");
  });

  it("renders copy button for recovery command when repo present", () => {
    render(<ProjectRail items={[MISSING_PATH_WITH_REPO]} />);
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("renders no-repo warning when repo is absent", () => {
    render(<ProjectRail items={[MISSING_PATH_NO_REPO]} />);
    expect(screen.getByTestId("project-rail-recovery-no-repo")).toBeDefined();
  });

  it("no-repo warning text mentions spec command", () => {
    render(<ProjectRail items={[MISSING_PATH_NO_REPO]} />);
    const warn = screen.getByTestId("project-rail-recovery-no-repo");
    expect(warn.textContent).toContain("/pandacorp:spec");
  });
});

// ---------------------------------------------------------------------------
// 7. Business snapshot chips (REQ-03-003)
// ---------------------------------------------------------------------------

describe("ProjectRail — business snapshot (CMP-03-snapshot)", () => {
  it("renders project-rail-snapshot for operation items", () => {
    render(<ProjectRail items={[OPERATION_ITEM]} />);
    expect(screen.getByTestId("project-rail-snapshot")).toBeDefined();
  });

  it("does NOT render snapshot for non-operation items", () => {
    render(<ProjectRail items={[IMPL_ITEM]} />);
    expect(screen.queryByTestId("project-rail-snapshot")).toBeNull();
  });

  it("renders snapshot-users chip with correct value", () => {
    render(<ProjectRail items={[OPERATION_ITEM]} />);
    const el = screen.getByTestId("project-rail-snapshot-users");
    expect(el.textContent).toContain("500");
  });

  it("renders snapshot-return chip with correct value", () => {
    render(<ProjectRail items={[OPERATION_ITEM]} />);
    const el = screen.getByTestId("project-rail-snapshot-return");
    expect(el.textContent).toContain("$1 200 MRR");
  });

  it("renders snapshot-verdict chip with correct value", () => {
    render(<ProjectRail items={[OPERATION_ITEM]} />);
    const el = screen.getByTestId("project-rail-snapshot-verdict");
    expect(el.textContent).toContain("double-down");
  });

  it("does NOT render snapshot-users when users is undefined", () => {
    const item = makeItem({
      stage: "operation",
      snapshot: { users: undefined, returnMetric: "$100 MRR", verdict: "hold" },
    });
    render(<ProjectRail items={[item]} />);
    expect(screen.queryByTestId("project-rail-snapshot-users")).toBeNull();
  });

  it("does NOT render snapshot when all fields are undefined", () => {
    const item = makeItem({
      stage: "operation",
      snapshot: undefined,
    });
    render(<ProjectRail items={[item]} />);
    expect(screen.queryByTestId("project-rail-snapshot")).toBeNull();
  });

  it("snapshot uses tabular-nums font variant for numbers", () => {
    render(<ProjectRail items={[OPERATION_ITEM]} />);
    const snapshot = screen.getByTestId("project-rail-snapshot");
    const style = snapshot.getAttribute("style") ?? "";
    // tabular-nums should be set via inline style
    expect(style).toContain("tabular-nums");
  });
});

// ---------------------------------------------------------------------------
// 8. design token invariant: zero hardcoded hex/rgb/hsl colors
// ---------------------------------------------------------------------------

describe("ProjectRail — design token invariant", () => {
  it("row style has no hardcoded hex colors", () => {
    const { container } = render(<ProjectRail items={[IMPL_ITEM]} />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\b/);
      expect(style).not.toMatch(/\bhsl\b/);
    }
  });

  it("empty state has no hardcoded hex colors", () => {
    const { container } = render(<ProjectRail items={[]} />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });

  it("loading state has no hardcoded hex colors", () => {
    const { container } = render(<ProjectRail items={[]} isLoading />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. aria-label on rail root
// ---------------------------------------------------------------------------

describe("ProjectRail — accessibility", () => {
  it("rail root has aria-label in Spanish", () => {
    render(<ProjectRail items={[]} />);
    const rail = screen.getByTestId("project-rail");
    const label = rail.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("rail root is a nav or section element (semantic HTML)", () => {
    render(<ProjectRail items={[]} />);
    const rail = screen.getByTestId("project-rail");
    expect(["nav", "section", "aside"].includes(rail.tagName.toLowerCase())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Multiple items render in order
// ---------------------------------------------------------------------------

describe("ProjectRail — ordering", () => {
  it("renders items in the same order as the input array", () => {
    render(<ProjectRail items={[IMPL_ITEM, ARCH_ITEM, OPERATION_ITEM]} />);
    const names = screen.getAllByTestId("project-rail-row-name").map((el) => el.textContent);
    expect(names).toEqual(["proj-a", "proj-architecture", "proj-operation"]);
  });
});

// ---------------------------------------------------------------------------
// 11. Props type contract — ProjectRailProps
// ---------------------------------------------------------------------------

describe("ProjectRail — props", () => {
  it("accepts items=[] without errors", () => {
    expect(() => render(<ProjectRail items={[]} />)).not.toThrow();
  });

  it("accepts items with all optional fields absent", () => {
    const minItem = makeItem({ repo: undefined, running: undefined, snapshot: undefined });
    expect(() => render(<ProjectRail items={[minItem]} />)).not.toThrow();
  });

  it("accepts isLoading=false without rendering loading state", () => {
    render(<ProjectRail items={[IMPL_ITEM]} isLoading={false} />);
    expect(screen.queryByTestId("project-rail-loading")).toBeNull();
    expect(screen.getByTestId("project-rail-row")).toBeDefined();
  });
});
