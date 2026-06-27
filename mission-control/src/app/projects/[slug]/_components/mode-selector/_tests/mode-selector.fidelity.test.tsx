/**
 * WO-11-002 — ModeSelector fidelity tests (DR-057 shared-primitive contract)
 *
 * Anchors the compact build-mode panel structure (the prototype's 4-chip radio panel
 * was replaced by the shared CmdRow inline `<select>` — owner decision, decision-log
 * 2026-06-27):
 *   - Shared Panel component (data-testid="panel") as the root surface.
 *   - Shared CmdRow component (data-testid="cmd-row") for the command + copy.
 *   - The mode picker IS the CmdRow `<select>` (combobox) — not a bespoke control.
 *   - Heading "Modo de construcción" with the ti-adjustments icon + a subtitle.
 *
 * AC covered: AC-11-001.x / AC-11-002.1 (shared CmdRow used). DR-057 (no bespoke forks).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ModeSelector } from "../mode-selector";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

function renderSelector(slug = "fidelity-test"): ReturnType<typeof render> {
  return render(<ModeSelector slug={slug} />);
}

function getSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Modo del comando" }) as HTMLSelectElement;
}

// ---------------------------------------------------------------------------
// DR-057 — shared Panel + CmdRow primitives
// ---------------------------------------------------------------------------

describe("ModeSelector fidelity — shared primitives (DR-057)", () => {
  it("renders a Panel as the root surface (data-testid='panel')", () => {
    renderSelector();
    expect(screen.getByTestId("panel")).toBeTruthy();
  });

  it("uses exactly one Panel (no nested duplicate panels)", () => {
    renderSelector();
    expect(screen.getAllByTestId("panel")).toHaveLength(1);
  });

  it("renders a CmdRow (data-testid='cmd-row') for the active mode's command", () => {
    renderSelector();
    expect(screen.getByTestId("cmd-row")).toBeTruthy();
  });

  it("CmdRow displays the bare command for the default mode (Balanced)", () => {
    renderSelector();
    expect(screen.getByTestId("cmd-row").textContent).toContain("/pandacorp:implement");
  });

  it("CmdRow command updates when a different mode is selected", () => {
    renderSelector();
    fireEvent.change(getSelect(), { target: { value: "pro" } });
    expect(screen.getByTestId("cmd-row").textContent).toContain("/pandacorp:implement pro");
  });

  it("CmdRow contains a CopyButton (data-testid='copy-button')", () => {
    renderSelector();
    expect(
      screen.getByTestId("cmd-row").querySelector("[data-testid='copy-button']"),
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Compact structure — heading, subtitle, the select picker
// ---------------------------------------------------------------------------

describe("ModeSelector fidelity — compact structure", () => {
  it("renders the heading 'Modo de construcción'", () => {
    renderSelector();
    expect(screen.getByText("Modo de construcción")).toBeTruthy();
  });

  it("renders a subtitle about potencia / proyecto / comando", () => {
    renderSelector();
    expect(screen.getByText(/potencia.*proyecto|comando que toca/i)).toBeTruthy();
  });

  it("the mode picker is a <select> (compact), not a row of chips", () => {
    renderSelector();
    const select = getSelect();
    expect(select.tagName).toBe("SELECT");
    // Balanced is the default 'no flag' option + the three explicit build modes.
    expect(select.querySelectorAll("option")).toHaveLength(4);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("selecting a different mode updates the active command", () => {
    renderSelector();
    fireEvent.change(getSelect(), { target: { value: "powerful" } });
    expect(screen.getByTestId("cmd-row").textContent).toContain("/pandacorp:implement powerful");
  });

  it("renders no hardcoded hex colors in inline styles", () => {
    const { container } = renderSelector();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}(?:[^a-fA-F0-9]|$)/);
  });
});
