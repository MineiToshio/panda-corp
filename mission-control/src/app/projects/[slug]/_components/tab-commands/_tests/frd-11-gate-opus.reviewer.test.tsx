/**
 * FRD-11 GATE — Opus reviewer adversarial INTEGRATION tests (DR-015), second pass.
 *
 * Complements `frd-11-gate.reviewer.test.tsx`. These probe edges NO implementer
 * (and the first reviewer pass) asserted, all through the REAL integration surface
 * (`TabCommands` mounting `<ModeSelector>` over the VERIFIED WO-11-001 libs +
 * the FRD-04 VERIFIED `workspaceCommands`):
 *
 *   F. AC-11-002.1 EXACTNESS — balanced's command is `/pandacorp:implement` with NO
 *      trailing argument (a `toContain("/pandacorp:implement")` passes even for
 *      `/pandacorp:implement balanced`; here we assert the precise string and that
 *      no balanced row leaks the word "balanced" as an argument). Mutation guard:
 *      if the catalog swapped balanced's command to carry an arg, this turns RED.
 *   G. AC-11-002.2 the active description is the PICKED mode's description and it
 *      CHANGES on selection — a mutation that froze the description (always shows
 *      balanced's) is caught.
 *   H. DR-061 read/copy invariant — the selector is NOT a build trigger: no submit/
 *      run/play button exists in the selector slot; the only actionable controls are
 *      the radio chips and the copy button(s).
 *   I. Corrupt persisted value flows safely through the real tree — a hostile stored
 *      string must not throw on mount and must fall back to Balanced (the documented
 *      default), never a blank panel (FDD "Error" state).
 *   J. The build-mode CmdRow is ABOVE the stage rows (projComandos order) so the
 *      copied selector command is unambiguous (the panel order the FDD freezes).
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BUILD_MODES, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { TabCommands } from "../tab-commands";

const keyFor = (slug: string) => `mc:build-mode:${slug}`;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("FRD-11 gate (F): AC-11-002.1 command exactness per mode (no arg drift)", () => {
  it("balanced's command is exactly /pandacorp:implement with NO trailing argument", () => {
    const balanced = BUILD_MODES.find((m) => m.id === "balanced");
    expect(balanced?.command).toBe("/pandacorp:implement");

    render(<TabCommands phase="architecture" slug="exact" />);
    // Default mount = Balanced. The selector's CmdRow is the first cmd-row.
    const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
    const text = (firstCmdRow?.textContent ?? "").trim();
    // It must read the bare implement command, NOT "/pandacorp:implement balanced".
    expect(text).toContain("/pandacorp:implement");
    expect(text).not.toContain("/pandacorp:implement balanced");
  });

  it("each non-balanced mode shows its EXACT `/pandacorp:implement <id>` command", () => {
    render(<TabCommands phase="architecture" slug="exact2" />);
    for (const mode of BUILD_MODES) {
      fireEvent.click(screen.getByTestId(`mode-option-${mode.id}`));
      const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
      const text = (firstCmdRow?.textContent ?? "").trim();
      if (mode.id === "balanced") {
        expect(text).toContain("/pandacorp:implement");
        expect(text).not.toContain("implement balanced");
      } else {
        expect(text).toContain(`/pandacorp:implement ${mode.id}`);
      }
      // The shown command is byte-for-byte the catalog command (no UI synthesis).
      expect(text).toContain(mode.command);
    }
  });
});

describe("FRD-11 gate (G): AC-11-002.2 active description tracks the picked mode", () => {
  it("the active description equals the picked mode's description and changes on selection", () => {
    render(<TabCommands phase="implementation" slug="desc" />);

    const desc = () => screen.getByTestId("mode-active-description").textContent ?? "";

    // Default (Balanced) description.
    const balancedDesc = desc();
    expect(balancedDesc.length).toBeGreaterThan(0);

    // Pick Deep — the active description MUST change (mutation: a frozen description fails here).
    fireEvent.click(screen.getByTestId("mode-option-deep"));
    const deepDesc = desc();
    expect(deepDesc).not.toBe(balancedDesc);
    // And it is genuinely Deep's content (mentions the adversarial review / "todos").
    expect(deepDesc.toLowerCase()).toMatch(/adversarial|profundo|mejores|todos/);

    // Pick Pro — different again.
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    expect(desc()).not.toBe(deepDesc);
  });
});

describe("FRD-11 gate (H): DR-061 read/copy surface, NOT a build trigger", () => {
  it("the selector slot exposes NO run/play/submit button — only radio chips + copy", () => {
    render(<TabCommands phase="implementation" slug="readonly" />);
    const slot = screen.getByTestId("mode-selector-slot");

    // No native submit/run button inside the selector (no <button type="submit">,
    // no form submission affordance). The only interactive controls are the radios
    // and the copy button(s).
    const buttons = within(slot).queryAllByRole("button");
    for (const btn of buttons) {
      const label = (btn.getAttribute("aria-label") ?? btn.textContent ?? "").toLowerCase();
      expect(label).not.toMatch(/ejecut|lanza|construir|run|play|build|iniciar/);
      // No type=submit (would imply a launch on submit).
      expect(btn.getAttribute("type")).not.toBe("submit");
    }
    // It is NOT a <form> that posts (read/copy, not a launcher).
    expect(slot.querySelector("form")).toBeNull();
  });
});

describe("FRD-11 gate (I): corrupt persisted value is tolerated (FDD Error state)", () => {
  it("a hostile stored value falls back to Balanced without throwing", () => {
    localStorage.setItem(keyFor("corrupt"), '{"not":"a-mode"}<script>');

    expect(() => render(<TabCommands phase="design" slug="corrupt" />)).not.toThrow();

    // Falls back to the documented default — Balanced is aria-checked, panel not blank.
    const balancedInput = screen
      .getByTestId("mode-option-balanced")
      .querySelector("input[type='radio']");
    expect(balancedInput?.getAttribute("aria-checked")).toBe("true");
    expect(DEFAULT_BUILD_MODE).toBe("balanced");
    // The command row still renders (never a blank panel).
    expect(screen.getAllByTestId("cmd-row").length).toBeGreaterThan(0);
  });

  it("an unknown-but-string stored mode also falls back to Balanced", () => {
    localStorage.setItem(keyFor("unknown"), "ultra-deep");
    render(<TabCommands phase="design" slug="unknown" />);
    const balancedInput = screen
      .getByTestId("mode-option-balanced")
      .querySelector("input[type='radio']");
    expect(balancedInput?.getAttribute("aria-checked")).toBe("true");
  });
});

describe("FRD-11 gate (J): projComandos panel order — selector command above stage rows", () => {
  it("the first cmd-row in the tab is the build-mode command, not a stage command", () => {
    render(<TabCommands phase="implementation" slug="order" />);

    const selectorSlot = screen.getByTestId("mode-selector-slot");
    const commandsList = screen.getByTestId("commands-list");

    // DOM order: the selector slot precedes the stage commands list.
    expect(
      selectorSlot.compareDocumentPosition(commandsList) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // The very first cmd-row in the tree belongs to the selector (its CmdRow),
    // carrying the /pandacorp:implement command for the active (default) mode.
    const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
    expect(within(selectorSlot).getAllByTestId("cmd-row")[0]).toBe(firstCmdRow);
  });
});
