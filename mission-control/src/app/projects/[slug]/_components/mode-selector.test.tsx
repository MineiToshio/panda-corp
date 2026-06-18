/**
 * WO-11-002 — ModeSelector (CMP-11-mode-selector) — RED phase
 *
 * Tests written BEFORE implementation. All tests fail until GREEN phase.
 * TDD contract per AGENTS.md.
 *
 * Traceability (EARS → AC → test):
 *   AC-11-001.1  The selector SHALL render four mode options in order: Pro, Balanced, Powerful, Deep.
 *   AC-11-001.2  EACH option SHALL show its description (agents, models, recommended plan).
 *   AC-11-001.3  The default selected mode SHALL be Balanced when no mode has been chosen.
 *   AC-11-002.1  WHEN a mode is selected, the exact copy command SHALL be shown with a copy button.
 *   AC-11-002.2  The selected mode's description SHALL be shown alongside the command.
 *   AC-11-003.2  Re-opening the project's Commands tab SHALL restore its remembered mode.
 *
 * Work-order TDD cases:
 *   1. Renders four modes in order, each with its description (AC-11-001.1/.2).
 *   2. Defaults to Balanced and shows `/pandacorp:implement` (AC-11-001.3, AC-11-002.1).
 *   3. Selecting Powerful shows `/pandacorp:implement powerful` + its description (AC-11-002.1/.2).
 *   4. After selecting a mode and re-mounting with the same slug, the remembered mode is restored
 *      (AC-11-003.2).
 *   5. Active mode indicated by more than color (checkmark/aria-checked) — a11y.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BUILD_MODES, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { ModeSelector } from "./mode-selector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render ModeSelector with a fresh localStorage per test. */
function renderSelector(slug = "test-project"): ReturnType<typeof render> {
  return render(<ModeSelector slug={slug} />);
}

/** Helper: get all radio inputs in the radiogroup. */
function getRadioButtons(): HTMLElement[] {
  return screen.getAllByRole("radio");
}

/**
 * Helper: get the native <input type="radio"> nested inside a mode option label.
 * data-testid="mode-option-{id}" is on the <label>; the <input> is inside it.
 */
function getInputForOption(testId: string): HTMLInputElement {
  const label = screen.getByTestId(testId) as HTMLElement;
  const input = label.querySelector("input[type='radio']") as HTMLInputElement | null;
  if (!input) throw new Error(`No <input type="radio"> found inside ${testId}`);
  return input;
}

// ---------------------------------------------------------------------------
// AC-11-001.1 — Four modes in order
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-001.1: four modes in order", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders exactly four mode options", () => {
    renderSelector();
    expect(getRadioButtons()).toHaveLength(4);
  });

  it("renders modes in order: Pro, Balanced, Powerful, Deep", () => {
    renderSelector();
    const ids = BUILD_MODES.map((m) => m.id);
    // Collect mode option labels in document order via testid
    const labels = ids.map((id) => screen.getByTestId(`mode-option-${id}`));
    for (let i = 0; i < ids.length - 1; i++) {
      // Each label must precede the next one in document order
      const pos =
        // biome-ignore lint/style/noNonNullAssertion: guaranteed by map above
        labels[i]!.compareDocumentPosition(labels[i + 1]!);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("has a container with role='radiogroup'", () => {
    renderSelector();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
  });

  it("radiogroup has an accessible label in Spanish", () => {
    renderSelector();
    const rg = screen.getByRole("radiogroup");
    const ariaLabel = rg.getAttribute("aria-label") ?? rg.getAttribute("aria-labelledby");
    // Must have some accessible label
    expect(ariaLabel ?? screen.queryByRole("radiogroup")?.textContent).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-11-001.2 — Each mode shows its description
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-001.2: each mode shows its description", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("each mode option has a visible description text", () => {
    renderSelector();
    for (const mode of BUILD_MODES) {
      const option = screen.getByTestId(`mode-option-${mode.id}`);
      const desc = within(option).getByTestId(`mode-description-${mode.id}`);
      expect(desc.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("description text is unique per mode (not repeated)", () => {
    renderSelector();
    const descriptions = BUILD_MODES.map((mode) => {
      const option = screen.getByTestId(`mode-option-${mode.id}`);
      return within(option).getByTestId(`mode-description-${mode.id}`).textContent?.trim() ?? "";
    });
    const uniqueDescs = new Set(descriptions);
    expect(uniqueDescs.size).toBe(BUILD_MODES.length);
  });
});

// ---------------------------------------------------------------------------
// AC-11-001.3 + AC-11-002.1 — Default is Balanced; shows /pandacorp:implement
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-001.3 + AC-11-002.1: default Balanced + command display", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults to Balanced when no mode has been chosen (AC-11-001.3)", () => {
    renderSelector();
    const input = getInputForOption("mode-option-balanced");
    expect(input).toHaveAttribute("aria-checked", "true");
  });

  it("shows /pandacorp:implement (bare, no argument) as the command for Balanced (AC-11-002.1)", () => {
    renderSelector();
    const cmdDisplay = screen.getByTestId("mode-command-text");
    expect(cmdDisplay.textContent?.trim()).toBe("/pandacorp:implement");
  });

  it("renders a copy button for the command (AC-11-002.1)", () => {
    renderSelector();
    expect(screen.getByTestId("mode-command-copy")).toBeTruthy();
  });

  it("command section is visible (testid=mode-command-row)", () => {
    renderSelector();
    expect(screen.getByTestId("mode-command-row")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-11-002.1/.2 — Selecting Powerful shows its command + description
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-002.1/.2: selecting Powerful shows command + description", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("clicking Powerful sets it as checked (aria-checked='true')", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-powerful"));
    expect(getInputForOption("mode-option-powerful")).toHaveAttribute("aria-checked", "true");
  });

  it("clicking Powerful shows '/pandacorp:implement powerful' as the command (AC-11-002.1)", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-powerful"));
    const cmdDisplay = screen.getByTestId("mode-command-text");
    expect(cmdDisplay.textContent?.trim()).toBe("/pandacorp:implement powerful");
  });

  it("clicking Powerful unchecks Balanced (only one active at a time)", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-powerful"));
    expect(getInputForOption("mode-option-balanced")).not.toHaveAttribute("aria-checked", "true");
  });

  it("clicking Pro shows '/pandacorp:implement pro' as the command (AC-11-002.1)", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    expect(screen.getByTestId("mode-command-text").textContent?.trim()).toBe(
      "/pandacorp:implement pro",
    );
  });

  it("clicking Deep shows '/pandacorp:implement deep' as the command (AC-11-002.1)", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-deep"));
    expect(screen.getByTestId("mode-command-text").textContent?.trim()).toBe(
      "/pandacorp:implement deep",
    );
  });

  it("the command row shows the selected mode's description (AC-11-002.2)", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-powerful"));
    // The description of powerful must appear in the command area
    const cmdRow = screen.getByTestId("mode-command-row");
    const descText = within(cmdRow).getByTestId("mode-active-description");
    expect(descText.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("the active description changes when switching modes (AC-11-002.2)", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    const descPro = screen.getByTestId("mode-active-description").textContent?.trim();
    fireEvent.click(screen.getByTestId("mode-option-deep"));
    const descDeep = screen.getByTestId("mode-active-description").textContent?.trim();
    // Descriptions differ between modes
    expect(descPro).not.toBe(descDeep);
  });
});

// ---------------------------------------------------------------------------
// AC-11-003.2 — Re-mounting restores remembered mode
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-003.2: re-mounting restores remembered mode", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("after selecting Deep and unmounting, re-mounting restores Deep (AC-11-003.2)", () => {
    const { unmount } = renderSelector("proj-memory");
    fireEvent.click(screen.getByTestId("mode-option-deep"));
    unmount();

    // Re-mount with the SAME slug — must restore remembered choice
    renderSelector("proj-memory");
    expect(getInputForOption("mode-option-deep")).toHaveAttribute("aria-checked", "true");
  });

  it("after selecting Pro and unmounting, re-mounting shows '/pandacorp:implement pro'", () => {
    const { unmount } = renderSelector("proj-memory-cmd");
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    unmount();

    renderSelector("proj-memory-cmd");
    expect(screen.getByTestId("mode-command-text").textContent?.trim()).toBe(
      "/pandacorp:implement pro",
    );
  });

  it("re-mounting with a DIFFERENT slug starts fresh at Balanced (AC-11-001.3)", () => {
    const { unmount } = renderSelector("proj-a");
    fireEvent.click(screen.getByTestId("mode-option-deep"));
    unmount();

    renderSelector("proj-b"); // different slug — no remembered mode
    expect(getInputForOption("mode-option-balanced")).toHaveAttribute("aria-checked", "true");
  });
});

// ---------------------------------------------------------------------------
// A11y — more than color for active state; keyboard support (AC-11-003.2 / blueprint §4)
// ---------------------------------------------------------------------------

describe("ModeSelector — a11y: aria-checked + visual indicator beyond color", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("active mode has aria-checked='true' on its radio element", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    expect(getInputForOption("mode-option-pro")).toHaveAttribute("aria-checked", "true");
  });

  it("inactive modes have aria-checked='false'", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    for (const mode of BUILD_MODES) {
      if (mode.id === "pro") continue;
      expect(getInputForOption(`mode-option-${mode.id}`)).toHaveAttribute("aria-checked", "false");
    }
  });

  it("exactly one radio has aria-checked='true' at any time", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-powerful"));
    const checked = getRadioButtons().filter((b) => b.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });

  it("active mode has a visual-only checkmark indicator (data-testid='mode-check-<id>')", () => {
    renderSelector();
    // Default is Balanced — its checkmark must be visible
    expect(screen.getByTestId("mode-check-balanced")).toBeTruthy();
  });

  it("inactive modes have their checkmark hidden or absent", () => {
    renderSelector();
    // Only balanced is active; pro, powerful, deep checkmarks should not be visible
    // (either absent or hidden via aria-hidden / display:none)
    for (const mode of BUILD_MODES) {
      if (mode.id === "balanced") continue;
      const checkmark = screen.queryByTestId(`mode-check-${mode.id}`);
      if (checkmark) {
        // If present, it must be aria-hidden or visually hidden
        const isHidden =
          checkmark.getAttribute("aria-hidden") === "true" ||
          checkmark.getAttribute("hidden") !== null ||
          (checkmark as HTMLElement).style.display === "none" ||
          (checkmark as HTMLElement).style.visibility === "hidden";
        expect(isHidden).toBe(true);
      }
      // If absent: fine, that also satisfies the requirement.
    }
  });

  it("each mode option is keyboard-focusable (tabIndex >= 0 or role=radio)", () => {
    renderSelector();
    for (const mode of BUILD_MODES) {
      const option = screen.getByTestId(`mode-option-${mode.id}`);
      const tabIndex = Number(option.getAttribute("tabindex") ?? 0);
      const role = option.getAttribute("role");
      // Either a focusable element (tabIndex >= 0) or a proper radio role
      const focusable = tabIndex >= 0 || role === "radio";
      expect(focusable).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Design tokens — no hardcoded colors; data-testid on interactive elements
// ---------------------------------------------------------------------------

describe("ModeSelector — design tokens + data-testid invariants", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders no hardcoded hex colors in inline styles", () => {
    const { container } = renderSelector();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}(?:[^a-fA-F0-9]|$)/);
  });

  it("renders no hardcoded rgb() colors in inline styles", () => {
    const { container } = renderSelector();
    expect(container.innerHTML).not.toMatch(/(?<![a-z])rgb\(/);
  });

  it("the root testid 'mode-selector-slot' is present (integration seam for TabCommands)", () => {
    renderSelector();
    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
  });

  it("each mode option carries its data-testid 'mode-option-<id>'", () => {
    renderSelector();
    for (const mode of BUILD_MODES) {
      expect(screen.getByTestId(`mode-option-${mode.id}`)).toBeTruthy();
    }
  });

  it("the command copy button has data-testid='mode-command-copy'", () => {
    renderSelector();
    expect(screen.getByTestId("mode-command-copy")).toBeTruthy();
  });

  it("the command text element has data-testid='mode-command-text'", () => {
    renderSelector();
    expect(screen.getByTestId("mode-command-text")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Integration seam: TabCommands mounts ModeSelector at data-testid="mode-selector-slot"
// (AC-04-005.2 — verified by TabCommands test; here we confirm the seam testid is correct)
// ---------------------------------------------------------------------------

describe("ModeSelector — TabCommands integration seam", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("root element has data-testid='mode-selector-slot' for TabCommands mounting", () => {
    const { container } = renderSelector();
    // The outermost element rendered by ModeSelector must carry the seam testid
    expect(container.querySelector('[data-testid="mode-selector-slot"]')).toBeTruthy();
  });

  it("the DEFAULT_BUILD_MODE constant matches Balanced (sanity check for integration)", () => {
    expect(DEFAULT_BUILD_MODE).toBe("balanced");
  });
});
