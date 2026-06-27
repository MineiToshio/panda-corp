/**
 * FRD-11 GATE — reviewer adversarial INTEGRATION tests (Opus, DR-015).
 *
 * Exercises the FRD's work orders TOGETHER through the real integration surface — the
 * `TabCommands` Server Component that mounts `<ModeSelector>` (WO-11-002, now the compact
 * CmdRow `<select>`) over the VERIFIED libs `BUILD_MODES`/`getRememberedMode` (WO-11-001)
 * and `workspaceCommands(phase)` (FRD-04 VERIFIED lib):
 *
 *   A. The whole Comandos tab renders the build-mode panel AND the stage rows in one tree.
 *   B. The exact stage rows for EVERY Phase are surfaced via the real `workspaceCommands`.
 *   C. A pick inside TabCommands persists to the documented key (`mc:build-mode:<slug>`).
 *   D/E. Per-project isolation holds across two rendered tabs (no stale bleed on remount).
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRememberedMode } from "@/lib/build-mode-store";
import { buildModeFlag } from "@/lib/command-modes";
import { BUILD_MODES, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { workspaceCommands } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";
import { TabCommands } from "../tab-commands";

const ALL_PHASES: readonly Phase[] = [
  "product",
  "design",
  "architecture",
  "implementation",
  "release",
];

const keyFor = (slug: string) => `mc:build-mode:${slug}`;

/** The build-mode select inside the tab. */
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

describe("FRD-11 gate (A): the whole Comandos tab renders selector + stage rows together", () => {
  it("mounts the mode-selector slot AND the commands list in one tree", () => {
    render(<TabCommands phase="implementation" slug="mc" />);

    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
    expect(screen.getByTestId("commands-list")).toBeTruthy();
    expect(screen.getAllByTestId("mode-selector-slot")).toHaveLength(1);
    // The build-mode picker (a select) lives inside the tab body, with its 4 options.
    const body = screen.getByTestId("tab-commands-body");
    const select = within(body).getByRole("combobox", { name: "Modo del comando" });
    expect(select.querySelectorAll("option")).toHaveLength(4);
  });
});

describe("FRD-11 gate (B): every Phase surfaces its real workspaceCommands rows", () => {
  for (const phase of ALL_PHASES) {
    it(`phase="${phase}" renders exactly the rows workspaceCommands returns`, () => {
      const expected = workspaceCommands(phase);
      render(<TabCommands phase={phase} slug="mc" />);

      const rows = screen.getAllByTestId("command-row");
      expect(rows).toHaveLength(expected.length);

      const shown = rows.map((r) => r.textContent ?? "");
      for (const cmd of expected) {
        expect(shown.some((t) => t.includes(cmd.command))).toBe(true);
      }
    });
  }
});

describe("FRD-11 gate (C): a pick inside the tab persists to the documented key (reload-safe)", () => {
  it("selecting Powerful writes the canonical mode to mc:build-mode:<slug>", () => {
    render(<TabCommands phase="implementation" slug="reload-proj" />);

    pickMode("powerful");

    expect(getRememberedMode("reload-proj")).toBe("powerful");
    expect(localStorage.getItem(keyFor("reload-proj"))).not.toBeNull();
    expect(localStorage.getItem(keyFor("reload-proj"))).toContain("powerful");
  });

  it("the command shown for the picked mode equals its catalog command (no UI/catalog drift)", () => {
    render(<TabCommands phase="implementation" slug="drift" />);
    for (const mode of BUILD_MODES) {
      pickMode(mode.id);
      // The selector's own CmdRow is the first cmd-row in the tab (build-mode panel is on top).
      const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
      expect(firstCmdRow?.textContent ?? "").toContain(mode.command);
    }
  });
});

describe("FRD-11 gate (D/E): per-project isolation across two rendered tabs", () => {
  it("a stored mode for slug A does not select for slug B (fresh mount)", () => {
    render(<TabCommands phase="implementation" slug="A" />);
    pickMode("deep");
    cleanup();

    render(<TabCommands phase="implementation" slug="B" />);
    expect(getModeSelect().value).toBe(""); // B fresh → Balanced (no flag)
    expect(getRememberedMode("B")).toBe(DEFAULT_BUILD_MODE);
  });

  it("re-mounting A's tab restores A's remembered mode (route-change contract)", () => {
    render(<TabCommands phase="release" slug="A2" />);
    pickMode("pro");
    cleanup();

    render(<TabCommands phase="release" slug="A2" />);
    expect(getModeSelect().value).toBe("pro");
  });
});
