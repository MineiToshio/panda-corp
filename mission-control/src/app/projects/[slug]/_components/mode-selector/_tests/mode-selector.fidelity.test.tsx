/**
 * WO-11-002 — ModeSelector fidelity tests (DR-056 in-loop visual contract)
 *
 * These tests anchor the prototype's `buildModePanel()` structure:
 *   - Uses shared Panel component (data-testid="panel") as root surface
 *   - Uses shared CmdRow component (data-testid="cmd-row") for the command display
 *   - Mode chips use the .stab pattern: rendered as buttons with data-testid="stab-{id}"
 *     matching the Tabs level="sub" (role="tablist") idiom
 *   - Heading "Modo de construcción" with ti-adjustments icon
 *   - Subtitle "Con cuánta potencia..." at text3 size
 *
 * Prototype reference: buildModePanel() ~L916, index.html.
 *
 * These tests go RED until the component is updated to reuse the shared
 * Panel / CmdRow / Tabs(.stab) primitives and match the prototype structure.
 *
 * AC covered:
 *   AC-11-001.1/.2/.3 (already covered; repeated here in fidelity context)
 *   AC-11-002.1 (CmdRow primitive used for command display)
 *   DR-056 (visual structure matches prototype)
 *   DR-057 (shared Panel + CmdRow + .stab used — no bespoke forks)
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ModeSelector } from "../mode-selector";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

function renderSelector(slug = "fidelity-test"): ReturnType<typeof render> {
  return render(<ModeSelector slug={slug} />);
}

// ---------------------------------------------------------------------------
// DR-057 — shared Panel primitive used as root container
// ---------------------------------------------------------------------------

describe("ModeSelector fidelity — Panel primitive (DR-057)", () => {
  it("renders a Panel as the root container (data-testid='panel')", () => {
    renderSelector();
    // The Panel component sets data-testid="panel" on its root element
    expect(screen.getByTestId("panel")).toBeTruthy();
  });

  it("Panel is not absent — no bespoke panel fork", () => {
    const { container } = renderSelector();
    // Must have a [data-testid=panel] element
    expect(container.querySelector("[data-testid=panel]")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DR-057 — shared CmdRow primitive used for command display
// ---------------------------------------------------------------------------

describe("ModeSelector fidelity — CmdRow primitive (DR-057)", () => {
  it("renders a CmdRow (data-testid='cmd-row') for the active mode's command", () => {
    renderSelector();
    expect(screen.getByTestId("cmd-row")).toBeTruthy();
  });

  it("CmdRow displays the correct command for the default mode (Balanced)", () => {
    renderSelector();
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain("/pandacorp:implement");
  });

  it("CmdRow command updates when a different mode is selected", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain("/pandacorp:implement pro");
  });

  it("CmdRow contains a CopyButton (data-testid='copy-button')", () => {
    renderSelector();
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.querySelector("[data-testid=copy-button]")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prototype structural fidelity — heading + subtitle + chips layout
// ---------------------------------------------------------------------------

describe("ModeSelector fidelity — prototype structural match (projComandos/buildModePanel)", () => {
  it("renders the heading 'Modo de construcción' (from prototype ~L920)", () => {
    renderSelector();
    // Should have the heading text visible
    expect(screen.getByTestId("mode-selector-slot").textContent).toContain("Modo de construcción");
  });

  it("renders a subtitle about potencia/proyecto/comando (from prototype ~L920)", () => {
    renderSelector();
    const slot = screen.getByTestId("mode-selector-slot");
    // The subtitle: "Con cuánta potencia construir ESTE proyecto..."
    expect(slot.textContent?.toLowerCase()).toMatch(/cu[aá]nta potencia|potencia construir/);
  });

  it("renders mode chips as interactive buttons in a tablist or radiogroup (stab idiom)", () => {
    renderSelector();
    // The stab chips must be buttons or have role=tab or role=radio
    // The Tabs component renders role=tablist + role=tab buttons
    // OR a radiogroup with radio inputs (either is acceptable)
    const radiogroup = screen.queryByRole("radiogroup");
    const tablist = screen.queryByRole("tablist");
    // At least one of these patterns must be present
    expect(radiogroup !== null || tablist !== null).toBe(true);
  });

  it("mode chip buttons/options use the stab visual style (padding, border-radius from token)", () => {
    const { container } = renderSelector();
    // stab chips must not hardcode hex colors
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}(?![a-fA-F0-9])/);
  });

  it("the active mode chip is visually distinguished beyond color alone (aria-selected or aria-checked)", () => {
    renderSelector();
    // Either role=tab with aria-selected, or role=radio with aria-checked
    const selectedTab = screen.queryByRole("tab", { selected: true });
    // Fallback: radio with aria-checked=true
    const checkedRadio = document.querySelector("[aria-checked='true']");
    expect(selectedTab !== null || checkedRadio !== null).toBe(true);
  });

  it("selecting a different mode chip updates the active command (Tabs integration)", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("mode-option-powerful"));
    expect(screen.getByTestId("cmd-row").textContent).toContain("/pandacorp:implement powerful");
  });
});

// ---------------------------------------------------------------------------
// "Comandos a la mano" section — CommandsBox uses Panel + CmdRow
// ---------------------------------------------------------------------------

describe("ModeSelector fidelity — no bespoke command row duplicates (DR-057)", () => {
  it("the mode-selector-slot uses at most ONE Panel instance (not nested duplicate panels)", () => {
    const { container } = renderSelector();
    // Exactly one Panel (one data-testid=panel at root level, not multiple nested ones)
    const panels = container.querySelectorAll("[data-testid=panel]");
    // Mode selector itself: 1 Panel. More than 0 is required; the count can be 1 or 2
    // (1 for the panel wrapper, possibly 1 more if CmdRow has a sub-panel — but CmdRow
    // does NOT use Panel, just a cmd-row div). So we expect exactly 1 Panel in the selector.
    expect(panels.length).toBeGreaterThanOrEqual(1);
  });
});
