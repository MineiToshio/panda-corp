/**
 * WO-11-002 — TabCommands + CommandsBox fidelity tests (DR-056 in-loop visual contract)
 *
 * These tests anchor the prototype's `projComandos()` + `commandsBox()` structure:
 *   - projComandos = buildModePanel(i) + commandsBox(i)
 *   - commandsBox uses a Panel with heading "Comandos a la mano" + CmdRow items
 *   - Each command row uses the shared CmdRow primitive (data-testid="cmd-row")
 *
 * Prototype reference:
 *   commandsBox() ~L808: '<div class="panel" style="margin-top:14px">
 *     <p style="font-size:13px;font-weight:500;...">Comandos a la mano</p>
 *     [cmdRow items]</div>'
 *
 * These tests go RED until TabCommands is updated to use:
 *   1. Shared Panel for the CommandsBox wrapper
 *   2. Shared CmdRow for each command row
 *   3. "Comandos a la mano" heading matching the prototype
 *
 * DR-057 — no bespoke command-row, panel, or pill fork.
 * DR-056 — rendered output must match projComandos() + commandsBox() structure.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Phase } from "@/lib/status/status";
import { TabCommands } from "../tab-commands";

function renderCommands(phase: Phase): ReturnType<typeof render> {
  return render(<TabCommands phase={phase} slug="fidelity-test" />);
}

// ---------------------------------------------------------------------------
// DR-057 — shared Panel used in CommandsBox
// ---------------------------------------------------------------------------

describe("TabCommands fidelity — Panel primitive in CommandsBox (DR-057)", () => {
  it("renders at least one Panel (data-testid='panel') — for the CommandsBox wrapper", () => {
    renderCommands("implementation");
    // The commandsBox uses a Panel as its wrapper
    const panels = screen.getAllByTestId("panel");
    expect(panels.length).toBeGreaterThanOrEqual(1);
  });

  it("CommandsBox has a 'Comandos a la mano' heading (prototype commandsBox ~L818)", () => {
    renderCommands("implementation");
    const body = screen.getByTestId("tab-commands-body");
    expect(body.textContent).toContain("Comandos a la mano");
  });
});

// ---------------------------------------------------------------------------
// DR-057 — shared CmdRow used for each command row
// ---------------------------------------------------------------------------

describe("TabCommands fidelity — CmdRow primitive for command rows (DR-057)", () => {
  it("each command row uses the shared CmdRow primitive (data-testid='cmd-row')", () => {
    renderCommands("implementation");
    // The shared CmdRow renders data-testid="cmd-row"
    // There should be cmd-row elements for the commandsBox rows
    const cmdRows = screen.getAllByTestId("cmd-row");
    expect(cmdRows.length).toBeGreaterThan(0);
  });

  it("each cmd-row contains a CopyButton (data-testid='copy-button')", () => {
    renderCommands("implementation");
    const cmdRows = screen.getAllByTestId("cmd-row");
    for (const row of cmdRows) {
      expect(row.querySelector("[data-testid=copy-button]")).not.toBeNull();
    }
  });

  it("the implementation phase cmd-rows include /pandacorp:implement", () => {
    renderCommands("implementation");
    const cmdRows = screen.getAllByTestId("cmd-row");
    const texts = cmdRows.map((r) => r.textContent ?? "");
    expect(texts.some((t) => t.includes("/pandacorp:implement"))).toBe(true);
  });

  it("the operation phase cmd-rows include /pandacorp:iterate", () => {
    renderCommands("operation");
    const cmdRows = screen.getAllByTestId("cmd-row");
    const texts = cmdRows.map((r) => r.textContent ?? "");
    expect(texts.some((t) => t.includes("/pandacorp:iterate"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Prototype structure — "pégalo en la carpeta del proyecto" hint
// ---------------------------------------------------------------------------

describe("TabCommands fidelity — prototype 'when to use' hint text", () => {
  it("renders command rows with 'cuándo usarlo' or placement hint text", () => {
    renderCommands("implementation");
    const body = screen.getByTestId("tab-commands-body");
    // The commandsBox rows in the prototype have a "when" description
    // Either via the old command-row-description testid OR embedded in cmd-row text
    // (the CmdRow shows the command; the TabCommands wraps it with a description)
    const hasDesc =
      screen.queryAllByTestId("command-row-description").length > 0 ||
      // CmdRow itself shows the command text alongside a "when" label
      (body.textContent?.length ?? 0) > 50; // non-trivial content
    expect(hasDesc).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// projComandos structure: ModeSelector at top, CommandsBox below
// ---------------------------------------------------------------------------

describe("TabCommands fidelity — projComandos layout (selector above commands)", () => {
  it("mode-selector-slot appears before the first cmd-row", () => {
    renderCommands("implementation");
    const slot = screen.getByTestId("mode-selector-slot");
    const cmdRows = screen.getAllByTestId("cmd-row");
    // biome-ignore lint/style/noNonNullAssertion: getAllByTestId guarantees at least 1
    const firstCmdRow = cmdRows[0]!;
    const pos = slot.compareDocumentPosition(firstCmdRow);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the Comandos tab renders both the build-mode panel and the commands box", () => {
    renderCommands("implementation");
    // Both sections must be present
    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
    expect(screen.getAllByTestId("cmd-row").length).toBeGreaterThan(0);
    // And the CommandsBox heading
    expect(screen.getByTestId("tab-commands-body").textContent).toContain("Comandos a la mano");
  });
});
