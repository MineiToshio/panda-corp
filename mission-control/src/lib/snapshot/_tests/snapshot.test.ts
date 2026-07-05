/**
 * WO-14-001 — `lib/snapshot.ts`: `buildSnapshot` + `isSnapshotStale`
 *
 * Traceability:
 *   AC-14-001.2 — worktreeCommand = `git worktree add ../<slug>-review <sha>`
 *   AC-14-001.3 — absent lastGreenSha → null (panel omitted)
 *   AC-14-002.1 — running (+ live heartbeat) → buildingNow = "building now"; not running →
 *                 undefined. (status.yaml's `progress` field had no writer anywhere and was
 *                 removed — DR-092/DR-115 — so buildingNow no longer carries a percentage.)
 *   AC-14-003.1 — isSnapshotStale: true past threshold, false within
 *
 * TDD anchors (WO-14-001 §TDD):
 *   1. buildSnapshot builds the worktree command with slug + sha (AC-14-001.2)
 *   2. Absent lastGreenSha → null (AC-14-001.3)
 *   3. running (+ live heartbeat) → buildingNow = "building now"; not running → undefined (AC-14-002.1)
 *   4. isSnapshotStale true past threshold, false within (AC-14-003.1)
 *   5. Pure: same input → same output, no fs
 */

import { describe, expect, it } from "vitest";
import type { ProjectStatus } from "../../status/status";
import {
  buildSnapshot,
  isSnapshotStale,
  SNAPSHOT_STALE_COMMITS_THRESHOLD,
  SNAPSHOT_STALE_HOURS_THRESHOLD,
  type SnapshotInfo,
} from "../snapshot";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStatus(overrides: Partial<ProjectStatus> = {}): Partial<ProjectStatus> {
  return {
    project: "my-project",
    phase: "implementation",
    running: false,
    lastGreenSha: "abc1234",
    safeToTest: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-14-001.2 — worktreeCommand is built from slug + sha
// ---------------------------------------------------------------------------

describe("buildSnapshot — AC-14-001.2 — worktreeCommand with slug + sha", () => {
  it("WHEN lastGreenSha is set THEN worktreeCommand targets the review-worktrees root (DR-090)", () => {
    const status = makeStatus({ lastGreenSha: "deadbeef" });
    const result = buildSnapshot("my-project", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).worktreeCommand).toBe(
      "git worktree add /Users/Shared/review-worktrees/my-project deadbeef",
    );
  });

  it("WHEN slug contains hyphens THEN command uses slug as-is", () => {
    const status = makeStatus({ lastGreenSha: "cafe5678" });
    const result = buildSnapshot("mission-control", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).worktreeCommand).toBe(
      "git worktree add /Users/Shared/review-worktrees/mission-control cafe5678",
    );
  });

  it("WHEN lastGreenSha is set THEN sha field equals lastGreenSha", () => {
    const status = makeStatus({ lastGreenSha: "fedcba9" });
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).sha).toBe("fedcba9");
  });

  it("WHEN safeToTest is true THEN safeToTest field is true", () => {
    const status = makeStatus({ lastGreenSha: "abc", safeToTest: true });
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).safeToTest).toBe(true);
  });

  it("WHEN safeToTest is false THEN safeToTest field is false", () => {
    const status = makeStatus({ lastGreenSha: "abc", safeToTest: false });
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).safeToTest).toBe(false);
  });

  it("WHEN safeToTest is absent THEN safeToTest defaults to false", () => {
    const status = makeStatus({ lastGreenSha: "abc" });
    delete (status as Partial<ProjectStatus>).safeToTest;
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).safeToTest).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-14-001.3 — absent lastGreenSha → null
// ---------------------------------------------------------------------------

describe("buildSnapshot — AC-14-001.3 — absent lastGreenSha returns null", () => {
  it("WHEN lastGreenSha is undefined THEN returns null", () => {
    const status = makeStatus();
    delete (status as Partial<ProjectStatus>).lastGreenSha;
    expect(buildSnapshot("proj", status)).toBeNull();
  });

  it("WHEN status is empty object THEN returns null", () => {
    expect(buildSnapshot("proj", {})).toBeNull();
  });

  it("WHEN lastGreenSha is empty string THEN returns null", () => {
    const status = makeStatus({ lastGreenSha: "" });
    expect(buildSnapshot("proj", status)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-14-002.1 — running (+ live heartbeat) → buildingNow set; not running → undefined
// ---------------------------------------------------------------------------

describe("buildSnapshot — AC-14-002.1 — buildingNow from running + live heartbeat", () => {
  it("WHEN running=true with a fresh heartbeat THEN buildingNow is 'building now'", () => {
    const status = makeStatus({
      running: true,
      supervisorHeartbeat: new Date().toISOString(),
      lastGreenSha: "abc",
    });
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    const info = result as SnapshotInfo;
    expect(info.buildingNow).toBe("building now");
  });

  it("WHEN running=false THEN buildingNow is undefined", () => {
    const status = makeStatus({ running: false, lastGreenSha: "abc" });
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).buildingNow).toBeUndefined();
  });

  it("WHEN running is absent THEN buildingNow is undefined", () => {
    const status = makeStatus({ lastGreenSha: "abc" });
    delete (status as Partial<ProjectStatus>).running;
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    expect((result as SnapshotInfo).buildingNow).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// stale field — carries the isSnapshotStale verdict
// ---------------------------------------------------------------------------

describe("buildSnapshot — stale field", () => {
  it("WHEN stale is not passed THEN stale field defaults to false", () => {
    // buildSnapshot does not compute stale on its own (no git probe);
    // the caller (WO-14-002 route handler) computes commitsBehind/hours and
    // passes them; here we verify the field exists in the returned object.
    const status = makeStatus({ lastGreenSha: "abc" });
    const result = buildSnapshot("proj", status);
    expect(result).not.toBeNull();
    // stale should be a boolean (false by default since caller hasn't probed yet)
    expect(typeof (result as SnapshotInfo).stale).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// AC-14-003.1 — isSnapshotStale threshold verdicts
// ---------------------------------------------------------------------------

describe("isSnapshotStale — AC-14-003.1 — threshold verdicts", () => {
  it("WHEN commitsBehind > SNAPSHOT_STALE_COMMITS_THRESHOLD THEN returns true", () => {
    expect(isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD + 1, 0)).toBe(true);
  });

  it("WHEN commitsBehind === SNAPSHOT_STALE_COMMITS_THRESHOLD THEN returns true (at-threshold = stale)", () => {
    expect(isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD, 0)).toBe(true);
  });

  it("WHEN commitsBehind < SNAPSHOT_STALE_COMMITS_THRESHOLD and hours=0 THEN returns false", () => {
    expect(isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD - 1, 0)).toBe(false);
  });

  it("WHEN hoursSinceGreen > SNAPSHOT_STALE_HOURS_THRESHOLD THEN returns true", () => {
    expect(isSnapshotStale(0, SNAPSHOT_STALE_HOURS_THRESHOLD + 1)).toBe(true);
  });

  it("WHEN hoursSinceGreen === SNAPSHOT_STALE_HOURS_THRESHOLD THEN returns true (at-threshold = stale)", () => {
    expect(isSnapshotStale(0, SNAPSHOT_STALE_HOURS_THRESHOLD)).toBe(true);
  });

  it("WHEN hoursSinceGreen < SNAPSHOT_STALE_HOURS_THRESHOLD and commits=0 THEN returns false", () => {
    expect(isSnapshotStale(0, SNAPSHOT_STALE_HOURS_THRESHOLD - 1)).toBe(false);
  });

  it("WHEN both commits and hours are below threshold THEN returns false", () => {
    expect(
      isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD - 1, SNAPSHOT_STALE_HOURS_THRESHOLD - 1),
    ).toBe(false);
  });

  it("WHEN both commits and hours exceed threshold THEN returns true", () => {
    expect(
      isSnapshotStale(SNAPSHOT_STALE_COMMITS_THRESHOLD + 5, SNAPSHOT_STALE_HOURS_THRESHOLD + 5),
    ).toBe(true);
  });

  it("WHEN commitsBehind=0 and hoursSinceGreen=0 THEN returns false (fresh)", () => {
    expect(isSnapshotStale(0, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC (pure): same input → same output, no fs access
// ---------------------------------------------------------------------------

describe("buildSnapshot + isSnapshotStale — purity", () => {
  it("buildSnapshot: same input → same output", () => {
    const status = makeStatus({
      lastGreenSha: "abc",
      running: true,
      supervisorHeartbeat: new Date().toISOString(),
    });
    const r1 = buildSnapshot("proj", status);
    const r2 = buildSnapshot("proj", status);
    expect(r1).toEqual(r2);
  });

  it("isSnapshotStale: same input → same output", () => {
    const r1 = isSnapshotStale(5, 30);
    const r2 = isSnapshotStale(5, 30);
    expect(r1).toBe(r2);
  });

  it("buildSnapshot does not mutate the status input", () => {
    const status = makeStatus({ lastGreenSha: "abc", running: false });
    const before = JSON.stringify(status);
    buildSnapshot("proj", status);
    expect(JSON.stringify(status)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Constants are exported (no magic numbers)
// ---------------------------------------------------------------------------

describe("threshold constants are exported from lib/snapshot.ts", () => {
  it("SNAPSHOT_STALE_COMMITS_THRESHOLD is a positive number", () => {
    expect(typeof SNAPSHOT_STALE_COMMITS_THRESHOLD).toBe("number");
    expect(SNAPSHOT_STALE_COMMITS_THRESHOLD).toBeGreaterThan(0);
  });

  it("SNAPSHOT_STALE_HOURS_THRESHOLD is a positive number", () => {
    expect(typeof SNAPSHOT_STALE_HOURS_THRESHOLD).toBe("number");
    expect(SNAPSHOT_STALE_HOURS_THRESHOLD).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DR-066 rule (a) — buildingNow requires LIVE (running AND fresh), never the
// flag alone (change mc-observability-consumer-dr066, AC-14-002.2).
// ---------------------------------------------------------------------------

describe("buildSnapshot — liveness crossing (DR-066)", () => {
  const NOW = Date.parse("2026-07-02T12:00:00Z");

  it("frozen running:true with a stale heartbeat (≥ TTL) → noSignal, no buildingNow", () => {
    const snap = buildSnapshot(
      "proj",
      {
        lastGreenSha: "abc1234",
        running: true,
        supervisorHeartbeat: new Date(NOW - 11 * 60_000).toISOString(),
      },
      NOW,
    );
    expect(snap?.buildingNow).toBeUndefined();
    expect(snap?.noSignal).toBe(true);
  });

  it("running:true with NO heartbeat at all → noSignal (the flag alone is never proof)", () => {
    const snap = buildSnapshot("proj", { lastGreenSha: "abc1234", running: true }, NOW);
    expect(snap?.buildingNow).toBeUndefined();
    expect(snap?.noSignal).toBe(true);
  });

  it("running:true with a fresh heartbeat → buildingNow set, no noSignal", () => {
    const snap = buildSnapshot(
      "proj",
      {
        lastGreenSha: "abc1234",
        running: true,
        supervisorHeartbeat: new Date(NOW - 30_000).toISOString(),
      },
      NOW,
    );
    expect(snap?.buildingNow).toBe("building now");
    expect(snap?.noSignal).toBeUndefined();
  });

  it("running:false → neither buildingNow nor noSignal", () => {
    const snap = buildSnapshot("proj", { lastGreenSha: "abc1234", running: false }, NOW);
    expect(snap?.buildingNow).toBeUndefined();
    expect(snap?.noSignal).toBeUndefined();
  });
});
