/**
 * ProjectRow — component tests for WO-03-002 (TDD: RED → GREEN → refactor).
 *
 * Tests the standalone ProjectRow component (CMP-03-row):
 *   - one row per active project with title + stage label
 *   - running=true → "Construyendo" indicator (text present, not color-only)
 *   - running=false → "Parado" indicator (text present, not color-only)
 *   - data-testid="project-row" on the row root
 *
 * Traceability:
 *   CMP-03-row   → REQ-03-002 (title, stage, building/stopped indicator)
 *   AC-03-001.2  — vertical panel rows
 *   AC-03-002.1  — title, stage, building/stopped indicator (not color-only)
 *   WO-03-002    — ProjectRow.tsx, data-testid="project-row"
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectRow } from "@/components/modules/ProjectRow/ProjectRow";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const _ABSENT_STATUS: StatusResult = { present: false, malformed: false, status: null };

function makePresentStatus(phase: string): StatusResult {
  return { present: true, malformed: false, status: { phase: phase as never } };
}

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    name: "proj-a",
    path: "/projects/proj-a",
    status: makePresentStatus("implementation"),
    exists: true,
    stage: "implementation",
    running: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Root element + data-testid contract (WO-03-002 DoD)
// ---------------------------------------------------------------------------

describe("ProjectRow — data-testid contract", () => {
  it("renders an element with data-testid='project-row'", () => {
    render(<ProjectRow item={makeItem()} />);
    expect(screen.getByTestId("project-row")).toBeDefined();
  });

  it("project-row is a semantic element (article, li, or section)", () => {
    render(<ProjectRow item={makeItem()} />);
    const el = screen.getByTestId("project-row");
    expect(["article", "li", "section"].includes(el.tagName.toLowerCase())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Title display (AC-03-002.1)
// ---------------------------------------------------------------------------

describe("ProjectRow — title", () => {
  it("renders the project name", () => {
    render(<ProjectRow item={makeItem({ name: "my-project" })} />);
    expect(screen.getByTestId("project-row")).toBeDefined();
    expect(screen.getByText("my-project")).toBeDefined();
  });

  it("renders the project name in a named element (project-row-name)", () => {
    render(<ProjectRow item={makeItem({ name: "alpha" })} />);
    const nameEl = screen.getByTestId("project-row-name");
    expect(nameEl.textContent).toBe("alpha");
  });
});

// ---------------------------------------------------------------------------
// 3. Stage label (AC-03-002.1)
// ---------------------------------------------------------------------------

describe("ProjectRow — stage label", () => {
  it("renders the stage chip (project-row-stage) with stage text", () => {
    render(<ProjectRow item={makeItem({ stage: "implementation" })} />);
    const chip = screen.getByTestId("project-row-stage");
    expect(chip.textContent).toMatch(/implementation/i);
  });

  it("renders architecture stage label", () => {
    render(<ProjectRow item={makeItem({ stage: "architecture", running: false })} />);
    const chip = screen.getByTestId("project-row-stage");
    expect(chip.textContent).toMatch(/architecture/i);
  });

  it("renders release stage label for a launched (stopped) project", () => {
    // DR-085: the old 'operation' phase folded into 'release' (the launched phase).
    render(
      <ProjectRow
        item={makeItem({
          stage: "release",
          running: false,
          status: makePresentStatus("release"),
        })}
      />,
    );
    const chip = screen.getByTestId("project-row-stage");
    expect(chip.textContent).toMatch(/release/i);
  });

  it("renders release stage label", () => {
    render(<ProjectRow item={makeItem({ stage: "release", running: true })} />);
    const chip = screen.getByTestId("project-row-stage");
    expect(chip.textContent).toMatch(/release/i);
  });
});

// ---------------------------------------------------------------------------
// 4. Building indicator (AC-03-002.1 — running=true → "Construyendo")
// ---------------------------------------------------------------------------

describe("ProjectRow — building indicator (running=true)", () => {
  it("renders the indicator element (project-row-indicator)", () => {
    render(<ProjectRow item={makeItem({ running: true, exists: true })} />);
    expect(screen.getByTestId("project-row-indicator")).toBeDefined();
  });

  it("indicator text contains 'Construyendo' when running=true", () => {
    render(<ProjectRow item={makeItem({ running: true, exists: true })} />);
    const indicator = screen.getByTestId("project-row-indicator");
    expect(indicator.textContent).toMatch(/Construyendo/i);
  });

  it("indicator is NOT color-only: has text label (AC-03-002.1 / architecture §7)", () => {
    render(<ProjectRow item={makeItem({ running: true, exists: true })} />);
    const indicator = screen.getByTestId("project-row-indicator");
    // Text must be present (not empty) — no state conveyed by color alone
    const text = (indicator.textContent ?? "").trim();
    expect(text.length).toBeGreaterThan(0);
  });

  it("indicator has a role attribute for accessibility", () => {
    render(<ProjectRow item={makeItem({ running: true, exists: true })} />);
    const indicator = screen.getByTestId("project-row-indicator");
    const role = indicator.getAttribute("role");
    expect(role).toBeTruthy();
  });

  it("indicator has an aria-label for accessibility", () => {
    render(<ProjectRow item={makeItem({ running: true, exists: true })} />);
    const indicator = screen.getByTestId("project-row-indicator");
    const label = indicator.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Stopped indicator (AC-03-002.1 — running=false → "Parado")
// ---------------------------------------------------------------------------

describe("ProjectRow — stopped indicator (running=false)", () => {
  it("indicator text contains 'Parado' when running=false", () => {
    render(<ProjectRow item={makeItem({ running: false, exists: true })} />);
    const indicator = screen.getByTestId("project-row-indicator");
    expect(indicator.textContent).toMatch(/Parado/i);
  });

  it("stopped indicator is also NOT color-only: has text label", () => {
    render(<ProjectRow item={makeItem({ running: false, exists: true })} />);
    const indicator = screen.getByTestId("project-row-indicator");
    const text = (indicator.textContent ?? "").trim();
    expect(text.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Path-not-found: indicator is suppressed when exists=false (REQ-03-006)
// ---------------------------------------------------------------------------

describe("ProjectRow — path-not-found state", () => {
  it("does NOT render indicator when exists=false", () => {
    render(<ProjectRow item={makeItem({ exists: false, running: undefined })} />);
    expect(screen.queryByTestId("project-row-indicator")).toBeNull();
  });

  it("renders not-found badge when exists=false", () => {
    render(<ProjectRow item={makeItem({ exists: false })} />);
    expect(screen.getByTestId("project-row-not-found-badge")).toBeDefined();
  });

  it("does NOT render not-found badge when exists=true", () => {
    render(<ProjectRow item={makeItem({ exists: true })} />);
    expect(screen.queryByTestId("project-row-not-found-badge")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Multiple rows: one row per item (AC-03-001.2 — verified at ProjectRail level
//    but also confirmed at ProjectRow level by testing distinct name renders)
// ---------------------------------------------------------------------------

describe("ProjectRow — one instance per call", () => {
  it("renders distinct names for different items", () => {
    const { rerender } = render(<ProjectRow item={makeItem({ name: "proj-alpha" })} />);
    expect(screen.getByTestId("project-row-name").textContent).toBe("proj-alpha");

    rerender(<ProjectRow item={makeItem({ name: "proj-beta" })} />);
    expect(screen.getByTestId("project-row-name").textContent).toBe("proj-beta");
  });
});

// ---------------------------------------------------------------------------
// 8. Design token invariant — zero hardcoded hex/rgb/hsl colors (FRD-13)
// ---------------------------------------------------------------------------

describe("ProjectRow — design token invariant", () => {
  it("row has no hardcoded hex colors in inline styles", () => {
    const { container } = render(<ProjectRow item={makeItem()} />);
    const styledEls = container.querySelectorAll("[style]");
    for (const el of styledEls) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\b/);
      expect(style).not.toMatch(/\bhsl\b/);
    }
  });
});
