/**
 * FRD-14 gate — reviewer adversarial tests (DR-015/DR-016).
 *
 * Written by the FRD-gate reviewer (a different model from the WO implementers)
 * to probe edges the WO-14-005 author tests do NOT cover, exercising the helper
 * (WO-14-001, VERIFIED) and the panel (WO-14-005) TOGETHER:
 *
 *   1. Mutation guard: the staleness Notice must be GATED on the git probe's
 *      `gap.stale`, never rendered unconditionally. A naive impl that always
 *      renders the amber Notice (or never gates it) dies here.
 *   2. Anti-conflation (AC-14-001.3): the "building now" warning and the "last
 *      green commit" claim must NOT share text — the dangerous bug is a panel
 *      that says "safe to test" inside the same line as "don't test this yet".
 *   3. Stale-but-stopped: a stale commit with NO running build still renders the
 *      green section + Notice, and omits building-now (the three signals are
 *      independently gated, and a stopped build is never presented as building).
 *   4. Canonical-copy guard (AC-14-001.2): the panel must NOT use the banned
 *      "punto verde" jargon nor frame green as a local-vs-remote git matter.
 *
 * These are NOT decorative: each fails against a plausible naive implementation.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildSnapshot, type SnapshotInfo } from "@/lib/snapshot/snapshot";
import type { ProjectStatus } from "@/lib/status/status";
import { SnapshotPanel } from "../snapshot-panel";

/**
 * The git probe's `gap` prop. Spread into the panel so this suite also type-checks while the
 * panel in the tree does not declare the prop yet.
 */
function probe(commitsBehind: number, hoursBehind: number, stale: boolean) {
  return { gap: { status: "ok", commitsBehind, hoursBehind, stale } } as const;
}

function status(overrides: Partial<ProjectStatus> = {}): Partial<ProjectStatus> {
  return { project: "p", running: false, lastGreenSha: "abc1234", safeToTest: true, ...overrides };
}

describe("FRD-14 gate — staleness Notice is gated, never unconditional (DR-016 mutation guard)", () => {
  it("a fresh, NON-running snapshot renders NO Notice (would catch an always-on warning)", () => {
    const snap = buildSnapshot("proj", status({ running: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a running-but-fresh snapshot renders building-now but still NO Notice", () => {
    const snap = buildSnapshot(
      "proj",
      status({ running: true, supervisorHeartbeat: new Date().toISOString() }),
    );
    render(<SnapshotPanel slug="proj" snapshot={snap} {...probe(9, 23, false)} />);
    expect(screen.getByTestId("snapshot-panel-building-now")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("an unavailable probe never fabricates the verdict, whatever snapshot.stale says", () => {
    const base = buildSnapshot("proj", status()) as SnapshotInfo;
    render(
      <SnapshotPanel
        slug="proj"
        snapshot={{ ...base, stale: true }}
        {...({ gap: { status: "unavailable", reason: "unknown sha" } } as const)}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("snapshot-panel-green-section").textContent).toContain(
      "pasó todos los gates",
    );
  });
});

describe("FRD-14 gate — anti-conflation: green claim ≠ building-now warning (AC-14-001.3)", () => {
  it("'safe to test' green claim and 'don't test yet' warning are in DISTINCT subtrees", () => {
    const snap = buildSnapshot(
      "proj",
      status({ running: true, supervisorHeartbeat: new Date().toISOString() }),
    );
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    const green = screen.getByTestId("snapshot-panel-green-section");
    const building = screen.getByTestId("snapshot-panel-building-now");
    // The green "seguro para probar" claim must NOT live inside the building-now block.
    expect(building.textContent).not.toMatch(/segur[ao] para probar/i);
    // And the building-now "no lo pruebes" warning must NOT bleed into the commit row.
    expect(within(green).queryByTestId("snapshot-panel-building-now")).toBeNull();
    expect(green.textContent).not.toMatch(/no lo pruebes/i);
    // building-now carries the don't-test wording; the header pill carries the safe wording.
    expect(building.textContent).toMatch(/no lo pruebes/i);
    expect(screen.getByRole("heading", { level: 2 }).parentElement?.textContent).toMatch(
      /seguro para probar/i,
    );
  });
});

describe("FRD-14 gate — independent gating of the three signals", () => {
  it("stale + NOT running → green section + Notice shown, building-now omitted", () => {
    const snap = buildSnapshot("proj", status({ running: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} {...probe(14, 26, true)} />);
    expect(screen.getByTestId("snapshot-panel-green-section")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
  });
});

describe("FRD-14 gate — canonical-copy guard (AC-14-001.2): no banned jargon", () => {
  it("panel copy never uses 'punto verde' nor a local-vs-remote framing", () => {
    const snap = buildSnapshot(
      "proj",
      status({ running: true, supervisorHeartbeat: new Date().toISOString() }),
    );
    render(<SnapshotPanel slug="proj" snapshot={snap} {...probe(14, 26, true)} />);
    const text = (screen.getByTestId("snapshot-panel").textContent ?? "").toLowerCase();
    expect(text).not.toContain("punto verde");
    expect(text).not.toContain("local");
    expect(text).not.toContain("remoto");
    expect(text).not.toContain("remote");
    // and DOES carry the canonical "worktree aparte" framing
    expect(text).toContain("worktree aparte");
  });
});
