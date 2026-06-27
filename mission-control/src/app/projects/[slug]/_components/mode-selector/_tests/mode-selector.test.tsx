/**
 * WO-11-002 — ModeSelector (CMP-11-mode-selector)
 *
 * The build-mode picker is the shared CmdRow inline `<select>` (the prototype's 4-chip
 * radio panel was replaced by the compact select — owner decision, decision-log 2026-06-27).
 *
 * Traceability (EARS → AC → test):
 *   AC-11-001.1  The selector SHALL offer the build modes in order (Pro, Powerful, Deep;
 *                Balanced is the "no flag" default option).
 *   AC-11-001.2  EACH mode SHALL show its description (as the select's hint while active).
 *   AC-11-001.3  The default selected mode SHALL be Balanced (the bare command, no flag).
 *   AC-11-002.1  WHEN a mode is selected, the exact copy command SHALL show with a copy button.
 *   AC-11-002.2  The selected mode's description SHALL show alongside the command.
 *   AC-11-003.2  Re-opening the project's Commands tab SHALL restore its remembered mode.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_BUILD_MODE } from "@/lib/constants";
import { ModeSelector } from "../mode-selector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSelector(slug = "test-project"): ReturnType<typeof render> {
  return render(<ModeSelector slug={slug} />);
}

/** The build-mode select (the CmdRow combobox). */
function getSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Modo del comando" }) as HTMLSelectElement;
}

function getCommand(): string {
  return screen.getByTestId("cmd-row").textContent?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// AC-11-001.1 — the build modes, in order
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-001.1: build modes offered in order", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("offers Balanced (default) + Pro / Potente / Profundo, in order", () => {
    renderSelector();
    const options = [...getSelect().querySelectorAll("option")].map((o) => o.textContent);
    expect(options).toEqual(["default", "Pro", "Potente", "Profundo"]);
  });

  it("the select has an accessible label in Spanish", () => {
    renderSelector();
    expect(getSelect().getAttribute("aria-label")).toBe("Modo del comando");
  });
});

// ---------------------------------------------------------------------------
// AC-11-001.2 — each mode shows its description (the select hint)
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-001.2: each mode shows its description", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("shows a description for the default mode, and a different one once a mode is chosen", () => {
    renderSelector();
    const defaultHint = screen.getByTestId("cmd-row-hint").textContent?.trim();
    expect(defaultHint?.length).toBeGreaterThan(0);
    fireEvent.change(getSelect(), { target: { value: "deep" } });
    const deepHint = screen.getByTestId("cmd-row-hint").textContent?.trim();
    expect(deepHint?.length).toBeGreaterThan(0);
    expect(deepHint).not.toBe(defaultHint);
  });
});

// ---------------------------------------------------------------------------
// AC-11-001.3 + AC-11-002.1 — default Balanced; command display
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-001.3 + AC-11-002.1: default Balanced + command", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults to Balanced — the select sits on the 'no flag' option", () => {
    renderSelector();
    expect(getSelect().value).toBe("");
  });

  it("shows /pandacorp:implement (bare, no argument) for Balanced", () => {
    renderSelector();
    expect(getCommand()).toContain("/pandacorp:implement");
    expect(getCommand()).not.toContain("powerful");
  });

  it("renders a copy button + the mode-command-row seam", () => {
    renderSelector();
    expect(screen.getByTestId("copy-button")).toBeTruthy();
    expect(screen.getByTestId("mode-command-row")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-11-002.1/.2 — selecting a mode folds the flag + shows its description
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-002.1/.2: selecting a mode", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("Powerful → /pandacorp:implement powerful", () => {
    renderSelector();
    fireEvent.change(getSelect(), { target: { value: "powerful" } });
    expect(getCommand()).toContain("/pandacorp:implement powerful");
  });

  it("Pro → /pandacorp:implement pro", () => {
    renderSelector();
    fireEvent.change(getSelect(), { target: { value: "pro" } });
    expect(getCommand()).toContain("/pandacorp:implement pro");
  });

  it("Deep → /pandacorp:implement deep", () => {
    renderSelector();
    fireEvent.change(getSelect(), { target: { value: "deep" } });
    expect(getCommand()).toContain("/pandacorp:implement deep");
  });

  it("back to the default option clears the flag (bare command again)", () => {
    renderSelector();
    fireEvent.change(getSelect(), { target: { value: "powerful" } });
    expect(getCommand()).toContain("powerful");
    fireEvent.change(getSelect(), { target: { value: "" } });
    expect(getCommand()).not.toContain("powerful");
  });
});

// ---------------------------------------------------------------------------
// AC-11-003.2 — re-mounting restores remembered mode
// ---------------------------------------------------------------------------

describe("ModeSelector — AC-11-003.2: remembered per project", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("after selecting Deep and unmounting, re-mounting restores Deep", () => {
    const { unmount } = renderSelector("proj-memory");
    fireEvent.change(getSelect(), { target: { value: "deep" } });
    unmount();

    renderSelector("proj-memory");
    expect(getSelect().value).toBe("deep");
    expect(getCommand()).toContain("/pandacorp:implement deep");
  });

  it("re-mounting with a DIFFERENT slug starts fresh at Balanced", () => {
    const { unmount } = renderSelector("proj-a");
    fireEvent.change(getSelect(), { target: { value: "deep" } });
    unmount();

    renderSelector("proj-b");
    expect(getSelect().value).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Design tokens + integration seam
// ---------------------------------------------------------------------------

describe("ModeSelector — tokens + seam invariants", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders no hardcoded hex colors in inline styles", () => {
    const { container } = renderSelector();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}(?:[^a-fA-F0-9]|$)/);
  });

  it("the root testid 'mode-selector-slot' is present (integration seam for TabCommands)", () => {
    renderSelector();
    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
  });

  it("the command + copy live inside the shared CmdRow primitive (DR-057)", () => {
    renderSelector();
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.querySelector("[data-testid='copy-button']")).not.toBeNull();
    expect(cmdRow.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("the DEFAULT_BUILD_MODE constant matches Balanced (sanity check for integration)", () => {
    expect(DEFAULT_BUILD_MODE).toBe("balanced");
  });
});
