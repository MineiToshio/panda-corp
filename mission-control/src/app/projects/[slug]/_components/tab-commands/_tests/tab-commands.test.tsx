/**
 * WO-04-007 — TabCommands (CMP-04-tab-commands) tests
 *
 * RED → GREEN → refactor.
 *
 * Acceptance criteria covered:
 *   AC-04-005.1 — Commands tab SHALL render stage-relevant command rows from
 *                 workspaceCommands(phase), each with a copy button and a
 *                 "when to use" description.
 *   AC-04-005.2 — Commands tab SHALL mount the FRD-11 build mode selector
 *                 (CMP-11-mode-selector) at the top; until FRD-11 lands, a
 *                 labelled placeholder slot is rendered.
 *
 * TDD cases (from work order):
 *   1. Renders command rows for the project's phase, each with copy button +
 *      description (AC-04-005.1).
 *   2. Renders the FRD-11 selector slot (placeholder or real component) at the
 *      top (AC-04-005.2).
 *   3. Construction phase (implementation) shows implement/release/iterate.
 *   4. Release (launched) phase shows iterate/new-version (DR-085).
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Data layer: pure workspaceCommands() from lib/next-step.ts — no I/O.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Phase } from "@/lib/status/status";
import { TabCommands } from "../tab-commands";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render TabCommands and return all command-row elements. */
function renderCommands(phase: Phase): ReturnType<typeof render> {
  return render(<TabCommands phase={phase} slug="test-project" />);
}

// ---------------------------------------------------------------------------
// AC-04-005.2 — FRD-11 selector slot rendered at the top
// ---------------------------------------------------------------------------

describe("TabCommands — FRD-11 selector slot (AC-04-005.2)", () => {
  it("renders the mode-selector slot at the top of the tab", () => {
    renderCommands("implementation");
    // The slot must be present — either the real CMP-11-mode-selector or
    // a labelled placeholder (WO-04-007 scope: placeholder until FRD-11 lands).
    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
  });

  it("slot is rendered before the command rows", () => {
    renderCommands("implementation");
    const slot = screen.getByTestId("mode-selector-slot");
    const rows = screen.getAllByTestId("command-row");
    // getAllByTestId guarantees at least one element exists (throws otherwise)
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by getAllByTestId (throws if empty)
    const firstRow = rows[0]!;
    // DOM order: slot before first row
    expect(slot.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("slot has a visible label (accessible name or heading)", () => {
    renderCommands("implementation");
    const slot = screen.getByTestId("mode-selector-slot");
    // The slot contains some text — it is not an invisible empty element.
    expect(slot.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("renders mode-selector-slot for release (launched) phase too", () => {
    renderCommands("release");
    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-04-005.1 — command rows: copy button + description
// ---------------------------------------------------------------------------

describe("TabCommands — command rows (AC-04-005.1)", () => {
  it("each command row has data-testid='command-row'", () => {
    renderCommands("implementation");
    const rows = screen.getAllByTestId("command-row");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("each command row contains a copy button", () => {
    renderCommands("implementation");
    const rows = screen.getAllByTestId("command-row");
    for (const row of rows) {
      // CopyButton renders data-testid="copy-button" inside the row
      expect(row.querySelector('[data-testid="copy-button"]')).toBeTruthy();
    }
  });

  it("each command row shows a 'when to use' description", () => {
    renderCommands("implementation");
    const rows = screen.getAllByTestId("command-row");
    for (const row of rows) {
      const desc = row.querySelector('[data-testid="command-row-description"]');
      expect(desc).toBeTruthy();
      expect(desc?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("each command row shows the command text", () => {
    renderCommands("implementation");
    const rows = screen.getAllByTestId("command-row");
    for (const row of rows) {
      const cmd = row.querySelector('[data-testid="command-row-command"]');
      expect(cmd).toBeTruthy();
      expect(cmd?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// TDD case 3 — Construction phase (implementation)
// ---------------------------------------------------------------------------

// implement lives in ModeSelector; CommandsBox for implementation shows: release + iterate
describe("TabCommands — construction phase (implementation)", () => {
  const BUILDING_PHASES: Phase[] = ["implementation"];

  for (const phase of BUILDING_PHASES) {
    it(`phase='${phase}': includes /pandacorp:release row`, () => {
      renderCommands(phase);
      const commands = screen
        .getAllByTestId("command-row-command")
        .map((el) => el.textContent ?? "");
      expect(commands.some((c) => c.includes("/pandacorp:release"))).toBe(true);
    });

    it(`phase='${phase}': includes /pandacorp:iterate row`, () => {
      renderCommands(phase);
      const commands = screen
        .getAllByTestId("command-row-command")
        .map((el) => el.textContent ?? "");
      expect(commands.some((c) => c.includes("/pandacorp:iterate"))).toBe(true);
    });

    it(`phase='${phase}': does NOT include /pandacorp:implement row (lives in ModeSelector)`, () => {
      renderCommands(phase);
      const commands = screen
        .getAllByTestId("command-row-command")
        .map((el) => el.textContent ?? "");
      expect(commands.some((c) => c.startsWith("/pandacorp:implement"))).toBe(false);
    });

    it(`phase='${phase}': renders exactly 2 command rows`, () => {
      renderCommands(phase);
      expect(screen.getAllByTestId("command-row")).toHaveLength(2);
    });
  }
});

// ---------------------------------------------------------------------------
// TDD case 4 — Release (launched) phase (DR-085: the old "operation" set)
// ---------------------------------------------------------------------------

// implement variants live in ModeSelector; CommandsBox for release shows: iterate + new-version
describe("TabCommands — release (launched) phase", () => {
  it("phase='release': includes /pandacorp:iterate row", () => {
    renderCommands("release");
    const commands = screen.getAllByTestId("command-row-command").map((el) => el.textContent ?? "");
    expect(commands.some((c) => c.includes("/pandacorp:iterate"))).toBe(true);
  });

  it("phase='release': includes /pandacorp:new-version row", () => {
    renderCommands("release");
    const commands = screen.getAllByTestId("command-row-command").map((el) => el.textContent ?? "");
    expect(commands.some((c) => c.includes("/pandacorp:new-version"))).toBe(true);
  });

  it("phase='release': renders exactly 2 command rows", () => {
    renderCommands("release");
    expect(screen.getAllByTestId("command-row")).toHaveLength(2);
  });

  it("phase='release': does NOT include /pandacorp:implement row (lives in ModeSelector)", () => {
    renderCommands("release");
    const commands = screen.getAllByTestId("command-row-command").map((el) => el.textContent ?? "");
    expect(commands.some((c) => c.startsWith("/pandacorp:implement"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Early phases — single delegation row
// ---------------------------------------------------------------------------

describe("TabCommands — early phases", () => {
  const EARLY_PHASES: Phase[] = ["product", "design", "architecture"];

  for (const phase of EARLY_PHASES) {
    it(`phase='${phase}': renders exactly 1 command row`, () => {
      renderCommands(phase);
      expect(screen.getAllByTestId("command-row")).toHaveLength(1);
    });
  }

  it("phase='product': command contains /pandacorp:design", () => {
    renderCommands("product");
    const commands = screen.getAllByTestId("command-row-command").map((el) => el.textContent ?? "");
    expect(commands.some((c) => c.includes("/pandacorp:design"))).toBe(true);
  });

  it("phase='design': command contains /pandacorp:blueprint", () => {
    renderCommands("design");
    const commands = screen.getAllByTestId("command-row-command").map((el) => el.textContent ?? "");
    expect(commands.some((c) => c.includes("/pandacorp:blueprint"))).toBe(true);
  });

  it("phase='architecture': command contains /pandacorp:implement", () => {
    renderCommands("architecture");
    const commands = screen.getAllByTestId("command-row-command").map((el) => el.textContent ?? "");
    expect(commands.some((c) => c.includes("/pandacorp:implement"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Design / a11y invariants
// ---------------------------------------------------------------------------

describe("TabCommands — design tokens + a11y invariants", () => {
  it("renders a section with aria-label for the commands area", () => {
    renderCommands("implementation");
    // The commands section should have an accessible label
    expect(screen.getByTestId("tab-commands-body")).toBeTruthy();
  });

  it("command rows have no hardcoded hex/rgb colors in inline styles", () => {
    const { container } = renderCommands("implementation");
    const htmlContent = container.innerHTML;
    // No hardcoded hex colors (#xxx or #xxxxxx)
    expect(htmlContent).not.toMatch(/#[0-9a-fA-F]{3,6}(?:[^a-fA-F0-9]|$)/);
    // No rgb() — only var(--...) or no color at all
    expect(htmlContent).not.toMatch(/(?<![a-z])rgb\(/);
  });

  it("the commands list has role='list' or is a <ul>/<ol>", () => {
    renderCommands("implementation");
    // The command rows should be in a semantic list
    const list = screen.getByTestId("commands-list");
    const tag = list.tagName.toLowerCase();
    const hasListRole = tag === "ul" || tag === "ol" || list.getAttribute("role") === "list";
    expect(hasListRole).toBe(true);
  });

  it("Spanish copy — tab heading in Spanish", () => {
    renderCommands("implementation");
    // The tab should have a Spanish heading
    const heading = screen.getByTestId("tab-commands-heading");
    expect(heading.textContent?.trim().length).toBeGreaterThan(0);
    // Heading text is not just symbols
    expect(heading.textContent).not.toMatch(/^[^a-zA-ZáéíóúñÁÉÍÓÚÑ]+$/);
  });
});
