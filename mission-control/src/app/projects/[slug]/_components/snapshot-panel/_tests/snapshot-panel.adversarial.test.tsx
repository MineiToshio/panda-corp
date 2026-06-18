/**
 * FRD-14 gate — adversarial / integration tests (DR-015).
 *
 * Written by the reviewer (a different model from the implementers) to exercise
 * the work orders TOGETHER: WO-14-001 helpers feed WO-14-002 panel feed the same
 * shapes the FRD-04 page derives. These probe edges the implementer tests did not:
 *   - buildSnapshot → SnapshotPanel end-to-end (not the panel in isolation).
 *   - staleness wiring: isSnapshotStale verdict actually drives the panel warning.
 *   - progress edges (negative / NaN / >100 / fractional) that reach the UI copy.
 *   - safeToTest=false while the panel still claims "Verde" (the green-badge gap).
 *   - whitespace-only sha, slug with shell metacharacters in the shown command.
 *
 * These tests are NOT decorative: each would fail against a plausible naive
 * implementation (e.g. one that fires the warning unconditionally, or that
 * crashes on NaN progress).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  isSnapshotStale,
  SNAPSHOT_STALE_COMMITS_THRESHOLD,
  SNAPSHOT_STALE_HOURS_THRESHOLD,
  type SnapshotInfo,
} from "@/lib/snapshot/snapshot";
import type { ProjectStatus } from "@/lib/status/status";
import { SnapshotPanel } from "../snapshot-panel";

function status(overrides: Partial<ProjectStatus> = {}): Partial<ProjectStatus> {
  return {
    project: "p",
    running: false,
    lastGreenSha: "abc1234",
    safeToTest: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration: buildSnapshot output drives the panel (the real page seam).
// ---------------------------------------------------------------------------

describe("FRD-14 integration — buildSnapshot feeds SnapshotPanel (the page.tsx seam)", () => {
  it("absent last_green_sha → buildSnapshot null → panel renders nothing", () => {
    const snap = buildSnapshot("proj", status({ lastGreenSha: undefined }));
    expect(snap).toBeNull();
    const { container } = render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("snapshot-panel")).toBeNull();
  });

  it("derived command from buildSnapshot is the exact string the panel shows + copies", () => {
    const snap = buildSnapshot("mission-control", status({ lastGreenSha: "d150223" }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    const cmd = screen.getByTestId("snapshot-panel-worktree-cmd");
    expect(cmd.textContent).toBe("git worktree add ../mission-control-review d150223");
  });

  it("running build → buildingNow set by helper → panel shows the don't-test-yet block", () => {
    const snap = buildSnapshot("proj", status({ running: true, progress: 73 }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    expect(block.textContent).toContain("73");
  });

  it("stopped build → no buildingNow → panel omits the building-now block", () => {
    const snap = buildSnapshot("proj", status({ running: false, progress: 73 }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-003.1 — the staleness verdict must actually drive the warning.
// This is the seam blueprint §5 deferred: prove the panel reacts to the
// isSnapshotStale verdict so wiring the git probe later is a one-line change.
// ---------------------------------------------------------------------------

describe("FRD-14 staleness — isSnapshotStale verdict drives the panel warning (AC-14-003.1)", () => {
  it("verdict TRUE (>= commit threshold) → warning shown", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD, 0);
    expect(stale).toBe(true);
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale }} />);
    expect(screen.getByTestId("snapshot-panel-stale-warning")).toBeTruthy();
  });

  it("verdict TRUE (>= hour threshold) → warning shown even with 0 commits behind", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(0, SNAPSHOT_STALE_HOURS_THRESHOLD);
    expect(stale).toBe(true);
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale }} />);
    expect(screen.getByTestId("snapshot-panel-stale-warning")).toBeTruthy();
  });

  it("verdict FALSE (fresh, just below both thresholds) → NO warning", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(
      SNAPSHOT_STALE_COMMITS_THRESHOLD - 1,
      SNAPSHOT_STALE_HOURS_THRESHOLD - 1,
    );
    expect(stale).toBe(false);
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale }} />);
    expect(screen.queryByTestId("snapshot-panel-stale-warning")).toBeNull();
  });

  it("the warning carries text + icon (not color alone) — a11y", () => {
    const snap = buildSnapshot("proj", status());
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale: true }} />);
    const warn = screen.getByTestId("snapshot-panel-stale-warning");
    expect(warn.getAttribute("role")).toBe("alert");
    expect(warn.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    expect(screen.getByTestId("snapshot-panel-stale-icon")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// progress edges that reach the UI copy via buildingNow.
// ---------------------------------------------------------------------------

describe("FRD-14 progress edges — buildingNow copy stays sane", () => {
  it.each([
    [-5, "-5"],
    [150, "150"],
    [0, "0"],
  ])("running with progress=%s renders it verbatim in the block", (progress, shown) => {
    const snap = buildSnapshot("proj", status({ running: true, progress }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.getByTestId("snapshot-panel-building-now").textContent).toContain(shown);
  });

  it("running with NaN progress → no crash, building-now still rendered (running alone)", () => {
    const snap = buildSnapshot("proj", status({ running: true, progress: Number.NaN }));
    // NaN is not Number.isFinite → falls back to plain 'building now'
    expect(snap?.buildingNow).toBeDefined();
    expect(snap?.buildingNow).not.toContain("NaN");
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.getByTestId("snapshot-panel-building-now")).toBeTruthy();
  });

  it("running with fractional progress is preserved (no rounding surprise)", () => {
    const snap = buildSnapshot("proj", status({ running: true, progress: 33.3 }));
    expect(snap?.buildingNow).toContain("33.3");
  });
});

// ---------------------------------------------------------------------------
// safeToTest semantics vs the green badge — documents the actual behavior.
// The panel shows "Verde / seguro para probar" purely from a non-null snapshot;
// safeToTest is NOT consulted by the panel. Pin that so a future change is
// a conscious one (the badge currently does not reflect safe_to_test=false).
// ---------------------------------------------------------------------------

describe("FRD-14 safeToTest — green badge is independent of safe_to_test (documented gap)", () => {
  it("safeToTest=false still produces a non-null snapshot with the green badge shown", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: false }));
    expect(snap).not.toBeNull();
    expect((snap as SnapshotInfo).safeToTest).toBe(false);
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    // The panel renders the green badge regardless of safeToTest.
    expect(screen.getByTestId("snapshot-panel-green-badge")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// sha / slug robustness in the command shown to the operator.
// ---------------------------------------------------------------------------

describe("FRD-14 robustness — sha/slug edges in the shown command", () => {
  it("whitespace-only sha is treated as absent → null (no broken command)", () => {
    expect(buildSnapshot("proj", status({ lastGreenSha: "   " }))).toBeNull();
  });

  it("slug is embedded verbatim — the panel never silently runs it (read-only display)", () => {
    // FRD-14 non-goal: MC shows the command, never executes it. Verify the
    // panel only renders text; a weird slug appears as-is, harmless on screen.
    const snap = buildSnapshot("a b;rm", status({ lastGreenSha: "deadbee" }));
    render(<SnapshotPanel slug="a b;rm" snapshot={snap} />);
    const cmd = screen.getByTestId("snapshot-panel-worktree-cmd");
    expect(cmd.textContent).toBe("git worktree add ../a b;rm-review deadbee");
    // It is plain text content, not an executed action.
    expect(cmd.tagName.toLowerCase()).toBe("code");
  });
});
