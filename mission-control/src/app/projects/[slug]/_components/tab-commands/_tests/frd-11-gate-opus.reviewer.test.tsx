/**
 * FRD-11 GATE — Opus reviewer adversarial INTEGRATION tests (DR-015), second pass.
 *
 * Complements `frd-11-gate.reviewer.test.tsx`. Probes edges through the REAL integration
 * surface (`TabCommands` mounting `<ModeSelector>`, now the compact CmdRow `<select>`):
 *
 *   F. AC-11-002.1 EXACTNESS — balanced's command is `/pandacorp:implement` with NO arg.
 *   G. AC-11-002.2 the active description (the select hint) is the PICKED mode's and CHANGES.
 *   H. DR-061 read/copy invariant — the selector is NOT a build trigger (no run/submit/form).
 *   I. Corrupt persisted value flows safely — falls back to Balanced, never a blank panel.
 *   J. The build-mode CmdRow is ABOVE the stage rows (projComandos order).
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildModeFlag } from "@/lib/command-modes";
import { BUILD_MODES, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { TabCommands } from "../tab-commands";

const keyFor = (slug: string) => `mc:build-mode:${slug}`;

function getModeSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Modo del comando" }) as HTMLSelectElement;
}

function pickMode(id: (typeof BUILD_MODES)[number]["id"]): void {
  fireEvent.change(getModeSelect(), { target: { value: buildModeFlag(id) } });
}

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
    const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
    const text = (firstCmdRow?.textContent ?? "").trim();
    expect(text).toContain("/pandacorp:implement");
    expect(text).not.toContain("/pandacorp:implement balanced");
  });

  it("each non-balanced mode shows its EXACT `/pandacorp:implement <id>` command", () => {
    render(<TabCommands phase="architecture" slug="exact2" />);
    for (const mode of BUILD_MODES) {
      pickMode(mode.id);
      const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
      const text = (firstCmdRow?.textContent ?? "").trim();
      if (mode.id === "balanced") {
        expect(text).toContain("/pandacorp:implement");
        expect(text).not.toContain("implement balanced");
      } else {
        expect(text).toContain(`/pandacorp:implement ${mode.id}`);
      }
      expect(text).toContain(mode.command);
    }
  });
});

describe("FRD-11 gate (G): AC-11-002.2 active description tracks the picked mode", () => {
  it("the active description equals the picked mode's description and changes on selection", () => {
    render(<TabCommands phase="implementation" slug="desc" />);

    const desc = () => screen.getByTestId("cmd-row-hint").textContent ?? "";

    const balancedDesc = desc();
    expect(balancedDesc.length).toBeGreaterThan(0);

    pickMode("deep");
    const deepDesc = desc();
    expect(deepDesc).not.toBe(balancedDesc);
    expect(deepDesc.toLowerCase()).toMatch(/adversarial|profundo|mejores|todos/);

    pickMode("pro");
    expect(desc()).not.toBe(deepDesc);
  });
});

describe("FRD-11 gate (H): DR-061 read/copy surface, NOT a build trigger", () => {
  it("the selector slot exposes NO run/play/submit button — only the select + copy", () => {
    render(<TabCommands phase="implementation" slug="readonly" />);
    const slot = screen.getByTestId("mode-selector-slot");

    const buttons = within(slot).queryAllByRole("button");
    for (const btn of buttons) {
      const label = (btn.getAttribute("aria-label") ?? btn.textContent ?? "").toLowerCase();
      expect(label).not.toMatch(/ejecut|lanza|construir|run|play|build|iniciar/);
      expect(btn.getAttribute("type")).not.toBe("submit");
    }
    expect(slot.querySelector("form")).toBeNull();
  });
});

describe("FRD-11 gate (I): corrupt persisted value is tolerated (FDD Error state)", () => {
  it("a hostile stored value falls back to Balanced without throwing", () => {
    localStorage.setItem(keyFor("corrupt"), '{"not":"a-mode"}<script>');

    expect(() => render(<TabCommands phase="design" slug="corrupt" />)).not.toThrow();

    expect(getModeSelect().value).toBe(""); // Balanced (no flag)
    expect(DEFAULT_BUILD_MODE).toBe("balanced");
    expect(screen.getAllByTestId("cmd-row").length).toBeGreaterThan(0);
  });

  it("an unknown-but-string stored mode also falls back to Balanced", () => {
    localStorage.setItem(keyFor("unknown"), "ultra-deep");
    render(<TabCommands phase="design" slug="unknown" />);
    expect(getModeSelect().value).toBe("");
  });
});

describe("FRD-11 gate (J): projComandos panel order — selector command above stage rows", () => {
  it("the first cmd-row in the tab is the build-mode command, not a stage command", () => {
    render(<TabCommands phase="implementation" slug="order" />);

    const selectorSlot = screen.getByTestId("mode-selector-slot");
    const commandsList = screen.getByTestId("commands-list");

    expect(
      selectorSlot.compareDocumentPosition(commandsList) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
    expect(within(selectorSlot).getAllByTestId("cmd-row")[0]).toBe(firstCmdRow);
  });
});
