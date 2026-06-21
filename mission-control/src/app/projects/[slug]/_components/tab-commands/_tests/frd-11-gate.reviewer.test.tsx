/**
 * FRD-11 GATE — reviewer adversarial INTEGRATION tests (Opus, DR-015).
 *
 * The implementers' suites render ModeSelector in isolation. This suite exercises
 * the FRD's work orders TOGETHER through the real integration surface — the
 * `TabCommands` Server Component that mounts `<ModeSelector>` (WO-11-002) over the
 * VERIFIED libs `BUILD_MODES`/`getRememberedMode` (WO-11-001) and
 * `workspaceCommands(phase)` (FRD-04 VERIFIED lib) — probing edges nobody asserted:
 *
 *   A. The whole Comandos tab renders the build-mode panel AND the stage rows in one
 *      tree (AC-04-005.1 + AC-11-001.x), with no double-mount or missing seam.
 *   B. The exact stage-relevant command rows for EVERY Phase are surfaced via the
 *      real `workspaceCommands` (not a snapshot of one phase) — catches a phase the
 *      mapping silently drops.
 *   C. The mode picked inside TabCommands persists to the EXACT documented storage
 *      key (`mc:build-mode:<slug>`) so a real page reload would restore it — verified
 *      end-to-end (UI write → store read), the AC-11-003 contract the unit tests fake.
 *   D. Per-project isolation holds when two different project tabs are rendered.
 *   E. derive-don't-sync risk (react.md): the selector lazy-inits from `getRememberedMode`
 *      in `useState`. We assert the contract that matters for the real app — a fresh
 *      mount for a different slug reflects THAT slug's stored mode (the app remounts on
 *      route change), so no stale selection bleeds across projects.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRememberedMode } from "@/lib/build-mode-store";
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
  "operation",
];

const keyFor = (slug: string) => `mc:build-mode:${slug}`;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("FRD-11 gate (A): the whole Comandos tab renders selector + stage rows together", () => {
  it("mounts the mode-selector slot AND the commands list in one tree", () => {
    render(<TabCommands phase="implementation" slug="mc" />);

    // The FRD-11 selector is mounted (AC-04-005.2 seam)
    expect(screen.getByTestId("mode-selector-slot")).toBeTruthy();
    // The FRD-04 stage rows are mounted (AC-04-005.1)
    expect(screen.getByTestId("commands-list")).toBeTruthy();
    // Exactly one selector slot — not double-mounted
    expect(screen.getAllByTestId("mode-selector-slot")).toHaveLength(1);
    // The four mode chips live inside the tab body, not just standalone
    const body = screen.getByTestId("tab-commands-body");
    expect(within(body).getAllByRole("radio")).toHaveLength(4);
  });
});

describe("FRD-11 gate (B): every Phase surfaces its real workspaceCommands rows", () => {
  for (const phase of ALL_PHASES) {
    it(`phase="${phase}" renders exactly the rows workspaceCommands returns`, () => {
      const expected = workspaceCommands(phase);
      render(<TabCommands phase={phase} slug="mc" />);

      const rows = screen.getAllByTestId("command-row");
      expect(rows).toHaveLength(expected.length);

      // Each expected command string is actually shown somewhere in the rows.
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

    fireEvent.click(screen.getByTestId("mode-option-powerful"));

    // End-to-end: the store the next page-load reads back returns the picked mode.
    expect(getRememberedMode("reload-proj")).toBe("powerful");
    // And it landed under the EXACT documented key (no key drift).
    expect(localStorage.getItem(keyFor("reload-proj"))).not.toBeNull();
    expect(localStorage.getItem(keyFor("reload-proj"))).toContain("powerful");
  });

  it("the command shown for the picked mode equals its catalog command (no UI/catalog drift)", () => {
    render(<TabCommands phase="implementation" slug="drift" />);
    for (const mode of BUILD_MODES) {
      fireEvent.click(screen.getByTestId(`mode-option-${mode.id}`));
      // The selector's own CmdRow is the first cmd-row in the tab (build-mode panel is on top).
      const firstCmdRow = screen.getAllByTestId("cmd-row")[0];
      expect(firstCmdRow?.textContent ?? "").toContain(mode.command);
    }
  });
});

describe("FRD-11 gate (D/E): per-project isolation across two rendered tabs", () => {
  it("a stored mode for slug A does not select for slug B (fresh mount)", () => {
    // Pre-store a mode for A only.
    render(<TabCommands phase="implementation" slug="A" />);
    fireEvent.click(screen.getByTestId("mode-option-deep"));
    cleanup();

    // B has nothing stored — must default to Balanced, not bleed A's "deep".
    render(<TabCommands phase="implementation" slug="B" />);
    const balancedInput = screen
      .getByTestId("mode-option-balanced")
      .querySelector("input[type='radio']");
    expect(balancedInput?.getAttribute("aria-checked")).toBe("true");
    expect(getRememberedMode("B")).toBe(DEFAULT_BUILD_MODE);
  });

  it("re-mounting A's tab restores A's remembered mode (route-change contract)", () => {
    render(<TabCommands phase="release" slug="A2" />);
    fireEvent.click(screen.getByTestId("mode-option-pro"));
    cleanup();

    render(<TabCommands phase="release" slug="A2" />);
    const proInput = screen.getByTestId("mode-option-pro").querySelector("input[type='radio']");
    expect(proInput?.getAttribute("aria-checked")).toBe("true");
  });
});
