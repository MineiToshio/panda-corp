/**
 * WO-03-004 — Selection + default + workspace slot (RED → GREEN → refactor)
 *
 * Tests verify:
 *   AC-03-004.1 — WHEN the owner selects a project in the list, the system SHALL
 *                 show its workspace (FRD-04) in the right-hand panel.
 *   AC-03-005.1 — WHEN no project is selected, the system SHALL select the first
 *                 one by default.
 *
 * Design (blueprint §3):
 *   - Selection is URL-driven: ?project=<slug>
 *   - Default: if no ?project param, render the first active project's workspace.
 *   - Right panel: placeholder slot (data-testid="workspace-slot") carrying
 *     data-slug="<selected-slug>" — testable in isolation before FRD-04 lands.
 *   - Clicking a row navigates to that project's ?project= URL (Link-based).
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 *
 * Traceability:
 *   CMP-03-workspace-slot → REQ-03-004, REQ-03-005
 *   WO-03-004
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";
import { SelectableProjectRail } from "../SelectableProjectRail";
import { WorkspaceSlot } from "../WorkspaceSlot";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const _ABSENT_STATUS: StatusResult = { present: false, malformed: false, status: null };

function makeStatus(phase: string): StatusResult {
  return { present: true, malformed: false, status: { phase: phase as never } };
}

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    name: "proj-alpha",
    path: "/projects/proj-alpha",
    status: makeStatus("implementation"),
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
  status: makeStatus("architecture"),
  stage: "architecture",
  running: false,
});
const ITEM_GAMMA = makeItem({
  name: "proj-gamma",
  path: "/projects/proj-gamma",
  status: makeStatus("operation"),
  stage: "operation",
  running: false,
});

// ---------------------------------------------------------------------------
// WorkspaceSlot — the right-panel placeholder (CMP-03-workspace-slot)
// ---------------------------------------------------------------------------

describe("WorkspaceSlot — placeholder slot (AC-03-004.1, AC-03-005.1)", () => {
  it("renders the workspace-slot element", () => {
    render(<WorkspaceSlot selectedSlug="proj-alpha" />);
    expect(screen.getByTestId("workspace-slot")).toBeDefined();
  });

  it("carries data-slug with the selected project slug", () => {
    render(<WorkspaceSlot selectedSlug="proj-alpha" />);
    const slot = screen.getByTestId("workspace-slot");
    expect(slot.getAttribute("data-slug")).toBe("proj-alpha");
  });

  it("updates data-slug when a different slug is provided", () => {
    render(<WorkspaceSlot selectedSlug="proj-beta" />);
    const slot = screen.getByTestId("workspace-slot");
    expect(slot.getAttribute("data-slug")).toBe("proj-beta");
  });

  it("renders workspace-slot-placeholder when no FRD-04 workspace is injected", () => {
    render(<WorkspaceSlot selectedSlug="proj-alpha" />);
    expect(screen.getByTestId("workspace-slot-placeholder")).toBeDefined();
  });

  it("placeholder text mentions the selected project slug", () => {
    render(<WorkspaceSlot selectedSlug="proj-alpha" />);
    const placeholder = screen.getByTestId("workspace-slot-placeholder");
    expect(placeholder.textContent).toContain("proj-alpha");
  });

  it("renders workspace-slot when selectedSlug is undefined (no project selected)", () => {
    render(<WorkspaceSlot selectedSlug={undefined} />);
    expect(screen.getByTestId("workspace-slot")).toBeDefined();
  });

  it("renders workspace-slot-empty when no slug (AC-03-005.1: should not happen after default-select)", () => {
    render(<WorkspaceSlot selectedSlug={undefined} />);
    expect(screen.getByTestId("workspace-slot-empty")).toBeDefined();
  });

  it("does NOT render workspace-slot-empty when slug is present", () => {
    render(<WorkspaceSlot selectedSlug="proj-alpha" />);
    expect(screen.queryByTestId("workspace-slot-empty")).toBeNull();
  });

  it("does NOT render workspace-slot-placeholder when slug is absent", () => {
    render(<WorkspaceSlot selectedSlug={undefined} />);
    expect(screen.queryByTestId("workspace-slot-placeholder")).toBeNull();
  });

  it("has no hardcoded hex/rgb/hsl colors (design token invariant)", () => {
    const { container } = render(<WorkspaceSlot selectedSlug="proj-alpha" />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\b/);
      expect(style).not.toMatch(/\bhsl\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// SelectableProjectRail — rail with clickable rows that set ?project= URL
// ---------------------------------------------------------------------------

describe("SelectableProjectRail — clickable rows (AC-03-004.1)", () => {
  it("renders the selectable-project-rail root", () => {
    render(<SelectableProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    expect(screen.getByTestId("selectable-project-rail")).toBeDefined();
  });

  it("renders one row per item", () => {
    render(<SelectableProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    const rows = screen.getAllByTestId("selectable-project-row");
    expect(rows).toHaveLength(2);
  });

  it("each row has an href with ?project=<name>", () => {
    render(<SelectableProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes("project=proj-alpha"))).toBe(true);
    expect(hrefs.some((h) => h.includes("project=proj-beta"))).toBe(true);
  });

  it("selected row has data-selected='true'", () => {
    render(<SelectableProjectRail items={[ITEM_ALPHA, ITEM_BETA]} selectedSlug="proj-alpha" />);
    const rows = screen.getAllByTestId("selectable-project-row");
    // First row (proj-alpha) is selected
    expect(rows[0]?.getAttribute("data-selected")).toBe("true");
    // Second row (proj-beta) is not selected
    expect(rows[1]?.getAttribute("data-selected")).toBe("false");
  });

  it("row shows project name", () => {
    render(<SelectableProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    expect(screen.getByText("proj-alpha")).toBeDefined();
  });

  it("row shows stage chip", () => {
    render(<SelectableProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const chip = screen.getByTestId("selectable-row-stage");
    expect(chip.textContent).toMatch(/implementation/i);
  });

  it("row shows building indicator when running=true", () => {
    render(<SelectableProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />);
    const indicator = screen.getByTestId("selectable-row-indicator");
    expect(indicator.textContent).toMatch(/Construyendo/i);
  });

  it("row shows stopped indicator when running=false", () => {
    render(<SelectableProjectRail items={[ITEM_BETA]} selectedSlug="proj-beta" />);
    const indicator = screen.getByTestId("selectable-row-indicator");
    expect(indicator.textContent).toMatch(/Parado/i);
  });

  it("renders empty state when items=[]", () => {
    render(<SelectableProjectRail items={[]} selectedSlug={undefined} />);
    expect(screen.getByTestId("selectable-project-rail-empty")).toBeDefined();
  });

  it("has no hardcoded hex/rgb/hsl colors (design token invariant)", () => {
    const { container } = render(
      <SelectableProjectRail items={[ITEM_ALPHA]} selectedSlug="proj-alpha" />,
    );
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/\brgb\b/);
      expect(style).not.toMatch(/\bhsl\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// Default selection logic (AC-03-005.1)
// Tests for the deriveSelectedSlug pure helper
// ---------------------------------------------------------------------------

import { deriveSelectedSlug } from "../selection";

describe("deriveSelectedSlug — default-select first project (AC-03-005.1)", () => {
  it("returns the param slug when ?project= matches an item name", () => {
    const items = [ITEM_ALPHA, ITEM_BETA];
    expect(deriveSelectedSlug(items, "proj-beta")).toBe("proj-beta");
  });

  it("returns the first item name when param is undefined", () => {
    const items = [ITEM_ALPHA, ITEM_BETA];
    expect(deriveSelectedSlug(items, undefined)).toBe("proj-alpha");
  });

  it("returns the first item name when param does not match any item", () => {
    const items = [ITEM_ALPHA, ITEM_BETA];
    expect(deriveSelectedSlug(items, "no-such-project")).toBe("proj-alpha");
  });

  it("returns undefined when items=[] and param is undefined", () => {
    expect(deriveSelectedSlug([], undefined)).toBeUndefined();
  });

  it("returns undefined when items=[] even if param is set", () => {
    expect(deriveSelectedSlug([], "proj-alpha")).toBeUndefined();
  });

  it("handles a single item: always returns that item's name regardless of param", () => {
    expect(deriveSelectedSlug([ITEM_GAMMA], undefined)).toBe("proj-gamma");
    expect(deriveSelectedSlug([ITEM_GAMMA], "different")).toBe("proj-gamma");
    expect(deriveSelectedSlug([ITEM_GAMMA], "proj-gamma")).toBe("proj-gamma");
  });

  it("param match is exact (case-sensitive)", () => {
    const items = [ITEM_ALPHA, ITEM_BETA];
    // "Proj-Alpha" does not match "proj-alpha" — falls back to first
    expect(deriveSelectedSlug(items, "Proj-Alpha")).toBe("proj-alpha");
  });
});
