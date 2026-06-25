/**
 * FRD-14 gate — opus reviewer adversarial tests (DR-015/DR-016).
 *
 * Written by the FRD-gate reviewer (Opus — a different model from the sonnet/haiku
 * WO implementers AND from the prior reviewer passes). These probe edges that the
 * author tests, the .adversarial suite and the .gate.reviewer suite do NOT yet pin,
 * exercising WO-14-001 (buildSnapshot, VERIFIED helper) and WO-14-002 (SnapshotPanel)
 * TOGETHER through the SAME shape the FRD-04 workspace page derives — real integration,
 * not the panel in isolation.
 *
 * Anchored in EARS + the real MC state (status.yaml today: safeToTest=false while
 * running — the exact condition the WO was REOPENED to fix). Each test fails against a
 * plausible naive/regressed implementation (mutation guard, DR-016):
 *
 *   1. SAFETY-SIGNAL LOCUS — when safeToTest=false the safety signal moves to the Chip
 *      (tone≠ok), NOT to the circle-check icon. A regression that flips the icon or drops
 *      the chip distinction dies here.
 *   2. NO DOUBLE-DERIVE — the command shown is EXACTLY snapshot.worktreeCommand (the panel
 *      must not re-build the command from slug+sha and risk drift from the helper).
 *   3. CONTEXTUAL a11y — the <section> aria-label tracks safeToTest (safe vs HEAD-moved),
 *      so a screen-reader is not told "segura para probar" when it is not.
 *   4. CURRENT-MC INTEGRATION — safeToTest=false + running (today's real state): the panel
 *      shows the building-now don't-test warning AND never claims "segura para probar"
 *      anywhere in its subtree — the two-fault conflation the reopen targeted.
 *   5. GREEN-DETAIL INTEGRITY — the muted detail line carries "pasó todos los gates" and
 *      the SHA verbatim, even when not safe (the info is still useful, only the claim drops).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildSnapshot, type SnapshotInfo } from "@/lib/snapshot/snapshot";
import type { ProjectStatus } from "@/lib/status/status";
import { SnapshotPanel } from "../snapshot-panel";

/** Build the same Partial<ProjectStatus> shape the FRD-04 page hands to buildSnapshot. */
function status(overrides: Partial<ProjectStatus> = {}): Partial<ProjectStatus> {
  return {
    project: "mission-control",
    running: false,
    lastGreenSha: "d37fa48",
    safeToTest: true,
    ...overrides,
  };
}

describe("FRD-14 opus gate — safety signal locus (AC-14-001.1, DR-016)", () => {
  it("safeToTest=false → the green-section Chip is NOT tone=ok (signal lives on the chip, not the icon)", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: false }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const green = screen.getByTestId("snapshot-panel-green-section");
    const chip = within(green).getByTestId("chip");
    // A regression that left tone="ok" (always-green) would falsely signal "safe".
    expect(chip.getAttribute("data-tone")).not.toBe("ok");
    // The chip MUST carry a textual signal (state by text, not color alone).
    expect((chip.textContent ?? "").trim().length).toBeGreaterThan(0);
  });

  it("safeToTest=true → the green-section Chip IS tone=ok (the green signal)", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: true }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const green = screen.getByTestId("snapshot-panel-green-section");
    expect(within(green).getByTestId("chip").getAttribute("data-tone")).toBe("ok");
  });
});

describe("FRD-14 opus gate — command shown is EXACTLY the helper output (no double-derive)", () => {
  it("the CmdRow text equals snapshot.worktreeCommand verbatim (no panel-side re-derivation)", () => {
    const snap = buildSnapshot("mission-control", status({ lastGreenSha: "d37fa48" }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const cmdRow = screen.getByTestId("cmd-row");
    // If the panel re-derived from slug+sha it could drift from the helper; pin equality.
    expect(cmdRow.textContent).toContain((snap as SnapshotInfo).worktreeCommand);
    expect((snap as SnapshotInfo).worktreeCommand).toBe(
      "git worktree add /Users/Shared/review-worktrees/mission-control d37fa48",
    );
  });
});

describe("FRD-14 opus gate — contextual a11y label tracks safety (AC-14-001.2)", () => {
  it("aria-label does NOT claim 'segura para probar' when safeToTest=false", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: false }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const label = screen.getByTestId("snapshot-panel").getAttribute("aria-label") ?? "";
    expect(label.toLowerCase()).not.toContain("segura para probar");
  });

  it("aria-label DOES claim 'segura para probar' when safeToTest=true", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: true }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const label = screen.getByTestId("snapshot-panel").getAttribute("aria-label") ?? "";
    expect(label.toLowerCase()).toContain("segura para probar");
  });
});

describe("FRD-14 opus gate — current-MC integration: safeToTest=false + running (the reopen target)", () => {
  it("today's real state (HEAD moved past green, build running) shows the don't-test warning and NEVER 'segura para probar'", () => {
    // This is exactly the live status.yaml shape that caused the reopen.
    const snap = buildSnapshot(
      "mission-control",
      status({ safeToTest: false, running: true, progress: 88 }),
    );
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const panel = screen.getByTestId("snapshot-panel");
    // The dangerous conflation: claiming safe while a build is mid-flight.
    expect((panel.textContent ?? "").toLowerCase()).not.toContain("segura para probar");
    // The building-now warning IS present and carries the don't-test wording.
    const building = screen.getByTestId("snapshot-panel-building-now");
    expect(building.textContent).toMatch(/no lo pruebes/i);
    expect(building.textContent).toContain("88");
    // The green section's chip warns rather than greenlights.
    const chip = within(screen.getByTestId("snapshot-panel-green-section")).getByTestId("chip");
    expect(chip.getAttribute("data-tone")).not.toBe("ok");
  });
});

describe("FRD-14 opus gate — green-detail integrity even when not safe", () => {
  it("the detail line keeps 'pasó todos los gates' + the SHA verbatim regardless of safeToTest", () => {
    const snap = buildSnapshot(
      "mission-control",
      status({ safeToTest: false, lastGreenSha: "cafe123" }),
    );
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.textContent).toContain("pasó todos los gates");
    expect(screen.getByTestId("snapshot-panel-sha").textContent).toBe("cafe123");
  });
});
