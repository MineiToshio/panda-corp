/**
 * FRD-14 gate — opus reviewer adversarial tests (DR-015/DR-016).
 *
 * Written by the FRD-gate reviewer (Opus — a different model from the sonnet/haiku
 * WO implementers AND from the prior reviewer passes). These probe edges that the
 * author tests, the .adversarial suite and the .gate.reviewer suite do NOT yet pin,
 * exercising WO-14-001 (buildSnapshot, VERIFIED helper) and WO-14-005 (SnapshotPanel Órbita)
 * TOGETHER through the SAME shape the FRD-04 workspace page derives — real integration,
 * not the panel in isolation.
 *
 * Anchored in EARS + the real MC state (status.yaml today: safeToTest=false while
 * running — the exact condition the WO was REOPENED to fix). Each test fails against a
 * plausible naive/regressed implementation (mutation guard, DR-016):
 *
 *   1. SAFETY-SIGNAL LOCUS — the safety verdict lives on the CardHeader pill: green
 *      «Seguro para probar», amber «Aún no es seguro» when safeToTest=false (fdd.md
 *      Screens + data cases). The header icon tile never changes. A regression that
 *      leaves the green pill on an unsafe commit dies here.
 *   2. NO DOUBLE-DERIVE — the command shown is EXACTLY snapshot.worktreeCommand (the panel
 *      must not re-build the command from slug+sha and risk drift from the helper).
 *   3. CONTEXTUAL a11y — nothing the panel exposes (text or an aria-label) says
 *      "seguro para probar" when it is not, so a screen-reader is not told otherwise.
 *   4. CURRENT-MC INTEGRATION — safeToTest=false + running (today's real state): the panel
 *      shows the building-now don't-test warning AND never claims "seguro para probar"
 *      anywhere in its subtree — the two-fault conflation the reopen targeted.
 *   5. GREEN-DETAIL INTEGRITY — the commit row carries "pasó todos los gates" and the SHA
 *      verbatim, even when not safe (the info is still useful, only the claim drops).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildSnapshot, type SnapshotInfo } from "@/lib/snapshot/snapshot";
import type { ProjectStatus } from "@/lib/status/status";
import { SnapshotPanel } from "../snapshot-panel";

const SAFE_CLAIM = /segur[ao] para probar/i;

/**
 * The git probe's `gap` prop. Spread into the panel so this suite also type-checks while the
 * panel in the tree does not declare the prop yet.
 */
function probe(commitsBehind: number, hoursBehind: number, stale: boolean) {
  return { gap: { status: "ok", commitsBehind, hoursBehind, stale } } as const;
}

/** The verdict pill of the card header: the one chip beside the h2 title. */
function verdictPill(): HTMLElement {
  const header = screen.getByRole("heading", { level: 2 }).parentElement as HTMLElement;
  return within(header).getByTestId("chip");
}

/** Everything the panel exposes to a reader or a screen reader. */
function exposedText(): string {
  const panel = screen.getByTestId("snapshot-panel");
  return `${panel.getAttribute("aria-label") ?? ""} ${panel.textContent ?? ""}`;
}

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
  it("safeToTest=false → the header pill is amber «Aún no es seguro» (signal lives on the pill, not the icon)", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: false }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const pill = verdictPill();
    // A regression that left tone="green" (always-green) would falsely signal "safe".
    expect(pill.getAttribute("data-tone")).toBe("amber");
    // The pill MUST carry a textual signal (state by text, not color alone).
    expect(pill.textContent).toContain("Aún no es seguro");
  });

  it("safeToTest=true → the header pill is green «Seguro para probar» (the green signal)", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: true }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const pill = verdictPill();
    expect(pill.getAttribute("data-tone")).toBe("green");
    expect(pill.textContent).toContain("Seguro para probar");
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

describe("FRD-14 opus gate — exposed safety claim tracks safety (AC-14-001.2)", () => {
  it("nothing the panel exposes claims 'seguro para probar' when safeToTest=false", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: false }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    expect(exposedText()).not.toMatch(SAFE_CLAIM);
  });

  it("the panel DOES claim 'seguro para probar' when safeToTest=true", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: true }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    expect(exposedText()).toMatch(SAFE_CLAIM);
  });

  it("a commit behind the build drops the claim even when safeToTest=true", () => {
    const snap = buildSnapshot("mission-control", status({ safeToTest: true }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} {...probe(14, 26, true)} />);
    expect(exposedText()).not.toMatch(SAFE_CLAIM);
    const pill = verdictPill();
    expect(pill.getAttribute("data-tone")).toBe("amber");
    expect(pill.textContent).toContain("Quedó atrás del build");
  });
});

describe("FRD-14 opus gate — current-MC integration: safeToTest=false + running (the reopen target)", () => {
  it("today's real state (HEAD moved past green, build running) shows the don't-test warning and NEVER 'seguro para probar'", () => {
    // This is exactly the live status.yaml shape that caused the reopen.
    // (status.yaml's `progress` field had no writer anywhere and was removed —
    // DR-092/DR-115 — so buildingNow is now the plain "building now", no percentage.)
    const snap = buildSnapshot(
      "mission-control",
      status({
        safeToTest: false,
        running: true,
        supervisorHeartbeat: new Date().toISOString(),
      }),
    );
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    // The dangerous conflation: claiming safe while a build is mid-flight.
    expect(exposedText()).not.toMatch(SAFE_CLAIM);
    // The building-now warning IS present and carries the don't-test wording.
    const building = screen.getByTestId("snapshot-panel-building-now");
    expect(building.textContent).toMatch(/no lo pruebes/i);
    // The header pill warns rather than greenlights.
    expect(verdictPill().getAttribute("data-tone")).toBe("amber");
  });
});

describe("FRD-14 opus gate — green-detail integrity even when not safe", () => {
  it("the commit row keeps 'pasó todos los gates' + the SHA verbatim regardless of safeToTest", () => {
    const snap = buildSnapshot(
      "mission-control",
      status({ safeToTest: false, lastGreenSha: "cafe123" }),
    );
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    // The commit row, not the panel: the intro line also says "pasó todos los gates".
    const row = screen.getByTestId("snapshot-panel-green-section");
    expect(row.textContent).toContain("pasó todos los gates");
    expect(screen.getByTestId("snapshot-panel-sha").textContent).toBe("cafe123");
  });
});
