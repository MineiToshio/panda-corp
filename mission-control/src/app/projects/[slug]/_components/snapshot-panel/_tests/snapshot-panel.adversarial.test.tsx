/**
 * FRD-14 gate — adversarial / integration tests (DR-015).
 *
 * Written by the reviewer (a different model from the implementers) to exercise
 * the work orders TOGETHER: WO-14-001 helpers feed WO-14-002 panel feed the same
 * shapes the FRD-04 page derives. These probe edges the implementer tests did not:
 *   - buildSnapshot → SnapshotPanel end-to-end (not the panel in isolation).
 *   - staleness wiring: isSnapshotStale verdict actually drives the Banner warning.
 *   - buildingNow copy stays the plain "building now" string (the old `progress`
 *     status.yaml field had no writer anywhere and was removed, DR-092/DR-115).
 *   - safeToTest=false while the panel still shows the green Chip.
 *   - whitespace-only sha, slug with shell metacharacters in the shown command.
 *
 * Primitive reuse (DR-057) — queried via the shared primitives' testids:
 *   - Command row  → data-testid="cmd-row"   (CmdRow, not a bespoke element)
 *   - Stale warn   → data-testid="banner"    (Banner, not a bespoke element)
 *   - Stale icon   → data-testid="banner-icon" (from Banner's ToneIcon)
 *   - Green signal → data-testid="chip"      (Chip tone="ok", not a bespoke badge)
 *
 * These tests are NOT decorative: each would fail against a plausible naive
 * implementation (e.g. one that fires the warning unconditionally).
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

  it("derived command from buildSnapshot is the exact string shown in CmdRow (DR-057)", () => {
    const snap = buildSnapshot("mission-control", status({ lastGreenSha: "d150223" }));
    render(<SnapshotPanel slug="mission-control" snapshot={snap} />);
    // Command is shown inside the shared CmdRow (data-testid="cmd-row")
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain(
      "git worktree add /Users/Shared/review-worktrees/mission-control d150223",
    );
  });

  it("running build → buildingNow set by helper → panel shows the don't-test-yet block", () => {
    const snap = buildSnapshot(
      "proj",
      status({ running: true, supervisorHeartbeat: new Date().toISOString() }),
    );
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    const block = screen.getByTestId("snapshot-panel-building-now");
    expect(block.textContent).toContain("building now");
  });

  it("stopped build → no buildingNow → panel omits the building-now block", () => {
    const snap = buildSnapshot("proj", status({ running: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.queryByTestId("snapshot-panel-building-now")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-003.1 — the staleness verdict must actually drive the Banner warning.
// This is the seam blueprint §5 deferred: prove the panel reacts to the
// isSnapshotStale verdict so wiring the git probe later is a one-line change.
// ---------------------------------------------------------------------------

describe("FRD-14 staleness — isSnapshotStale verdict drives the Banner warning (AC-14-003.1)", () => {
  it("verdict TRUE (>= commit threshold) → Banner shown (DR-057, tone=warn)", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD, 0);
    expect(stale).toBe(true);
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale }} />);
    // Staleness warning is the shared Banner (data-testid="banner")
    const banner = screen.getByTestId("banner");
    expect(banner).toBeTruthy();
    expect(banner.getAttribute("data-tone")).toBe("warn");
  });

  it("verdict TRUE (>= hour threshold) → Banner shown even with 0 commits behind", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(0, SNAPSHOT_STALE_HOURS_THRESHOLD);
    expect(stale).toBe(true);
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale }} />);
    expect(screen.getByTestId("banner")).toBeTruthy();
  });

  it("verdict FALSE (fresh, just below both thresholds) → NO Banner", () => {
    const snap = buildSnapshot("proj", status());
    const stale = isSnapshotStale(
      SNAPSHOT_STALE_COMMITS_THRESHOLD - 1,
      SNAPSHOT_STALE_HOURS_THRESHOLD - 1,
    );
    expect(stale).toBe(false);
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale }} />);
    expect(screen.queryByTestId("banner")).toBeNull();
  });

  it("Banner carries text + icon (not color alone) — a11y; role=alert", () => {
    const snap = buildSnapshot("proj", status());
    render(<SnapshotPanel slug="proj" snapshot={{ ...(snap as SnapshotInfo), stale: true }} />);
    const banner = screen.getByTestId("banner");
    // Banner has role="alert" (DR-057 Banner contract)
    expect(banner.getAttribute("role")).toBe("alert");
    // Banner text is non-empty (state conveyed by text, not color alone)
    expect(banner.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    // Banner renders ToneIcon (data-testid="banner-icon") — icon + text, not color alone
    expect(screen.getByTestId("banner-icon")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// buildingNow copy stays sane — status.yaml's `progress` field had no writer
// anywhere and was removed (DR-092/DR-115 dead-field cleanup); buildingNow is
// always the plain "building now" string now, regardless of what other numeric
// noise might appear on the status object.
// ---------------------------------------------------------------------------

describe("FRD-14 buildingNow — always the plain 'building now' string (no fabricated percentage)", () => {
  it("running with a fresh heartbeat → buildingNow is exactly 'building now'", () => {
    const snap = buildSnapshot(
      "proj",
      status({ running: true, supervisorHeartbeat: new Date().toISOString() }),
    );
    expect(snap?.buildingNow).toBe("building now");
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    expect(screen.getByTestId("snapshot-panel-building-now")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// safeToTest semantics — AC-14-001.1 reads BOTH last_green_sha AND safe_to_test.
// When safeToTest=false the panel MUST NOT claim "segura para probar".
// The previous version of this test was decorative (it pinned broken behavior).
// These tests are the CORRECT behavior per AC-14-001.1 and the gate review.
// ---------------------------------------------------------------------------

describe("FRD-14 safeToTest — panel MUST consult safe_to_test (AC-14-001.1)", () => {
  it("safeToTest=false: panel still renders (snapshot non-null) but does NOT say 'segura para probar'", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: false }));
    expect(snap).not.toBeNull();
    expect((snap as SnapshotInfo).safeToTest).toBe(false);
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    // The panel must NOT claim "segura para probar" when safeToTest=false
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.textContent?.toLowerCase()).not.toContain("segura para probar");
  });

  it("safeToTest=false: panel shows the sha + worktree command (the info is still useful)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    // SHA is still shown
    expect(screen.getByTestId("snapshot-panel-sha")).toBeTruthy();
    // Command row is still shown
    expect(screen.getByTestId("cmd-row")).toBeTruthy();
  });

  it("safeToTest=false: Chip does NOT have tone='ok' (not a green signal when not safe)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: false }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    const chip = screen.getByTestId("chip");
    // Must not be "ok" tone (would imply safe/green when it's not)
    expect(chip.getAttribute("data-tone")).not.toBe("ok");
  });

  it("safeToTest=true: panel shows 'segura para probar' (normal green state)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: true }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    const panel = screen.getByTestId("snapshot-panel");
    expect(panel.textContent?.toLowerCase()).toContain("segura para probar");
  });

  it("safeToTest=true: Chip has tone='ok' (green signal)", () => {
    const snap = buildSnapshot("proj", status({ safeToTest: true }));
    render(<SnapshotPanel slug="proj" snapshot={snap} />);
    const chip = screen.getByTestId("chip");
    expect(chip.getAttribute("data-tone")).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// sha / slug robustness in the command shown to the operator.
// ---------------------------------------------------------------------------

describe("FRD-14 robustness — sha/slug edges in the shown command", () => {
  it("whitespace-only sha is treated as absent → null (no broken command)", () => {
    expect(buildSnapshot("proj", status({ lastGreenSha: "   " }))).toBeNull();
  });

  it("slug is embedded verbatim in CmdRow — read-only display only (not executed)", () => {
    // FRD-14 non-goal: MC shows the command, never executes it. Verify the
    // panel only renders text; a weird slug appears as-is, harmless on screen.
    const snap = buildSnapshot("a b;rm", status({ lastGreenSha: "deadbee" }));
    render(<SnapshotPanel slug="a b;rm" snapshot={snap} />);
    // Command is in the shared CmdRow (data-testid="cmd-row")
    const cmdRow = screen.getByTestId("cmd-row");
    expect(cmdRow.textContent).toContain(
      "git worktree add /Users/Shared/review-worktrees/a b;rm deadbee",
    );
    // The cmd-row is a plain div (not an executed action)
    expect(cmdRow.tagName.toLowerCase()).toBe("div");
  });
});
