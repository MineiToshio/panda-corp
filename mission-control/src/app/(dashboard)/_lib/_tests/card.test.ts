/**
 * WO-18-004 — IF-18-card pure derivation tests (RED phase)
 *
 * Tests are written BEFORE the implementation. `deriveCard` does not exist yet —
 * all tests will fail (RED) until the GREEN phase. That is the intent.
 *
 * Traceability (FRD-18 EARS → AC → test):
 *   AC-18-004.1 (REQ-18-015)  card shows phase+version, WO progress, age-in-stage, next command
 *   AC-18-004.2 (REQ-18-016)  stale build → "sin señal" + last-event time; fresh → "en vivo"
 *   AC-18-004.3 (REQ-18-017)  phase beyond staleness threshold → "estancado" + age
 *   AC-18-004.4 (REQ-18-018)  failing/blocked WO → inline blocker reason
 *   AC-18-004.5 (REQ-18-019)  shipped project → "estable · en operación" + /pandacorp:review-launch
 *   AC-18-004.7               thresholds from lib/constants.ts; no magic numbers
 *
 * Progress note bugs addressed:
 *   IF-18-card per-project derivation + Cartera cards (live/stale/blocker/first-action)
 *
 * Stack: Vitest (TS), Node env, no fs — all inputs are fixture objects.
 */

import { describe, expect, it } from "vitest";
import { FRESHNESS_THRESHOLD_MS, STALENESS_THRESHOLD_DAYS } from "@/lib/constants";
import { type CardInput, deriveCard } from "../card";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** ISO timestamp `offsetMs` milliseconds before `nowMs`. */
function ago(offsetMs: number, nowMs: number): string {
  return new Date(nowMs - offsetMs).toISOString();
}

/** ISO timestamp `offsetDays` days before `nowMs`. */
function daysAgo(days: number, nowMs: number): string {
  return ago(days * 24 * 60 * 60 * 1000, nowMs);
}

// ---------------------------------------------------------------------------
// Fixture helpers (sensible defaults, override only what the test cares about)
// ---------------------------------------------------------------------------

const NOW_MS = new Date("2026-06-18T12:00:00.000Z").getTime();

function makeInput(overrides: Partial<CardInput> = {}): CardInput {
  return {
    name: "Test Project",
    phase: "implementation",
    version: "v1",
    running: true,
    workOrdersDone: 5,
    workOrdersTotal: 10,
    phaseStartedAt: daysAgo(3, NOW_MS),
    lastEventAt: ago(30_000, NOW_MS), // 30 seconds ago — fresh
    failedWoReason: undefined,
    nowMs: NOW_MS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-18-004.1 — phase+version, WO progress, age-in-stage, next command
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.1 — phase+version, WO progress, age-in-stage, next command", () => {
  it("wo-18-004: GIVEN an active implementation project WHEN derived THEN phase and version are present", () => {
    const result = deriveCard(makeInput());
    expect(result.phase).toBe("implementation");
    expect(result.version).toBe("v1");
  });

  it("wo-18-004: GIVEN 5 of 10 WOs done WHEN derived THEN progress shows done/total and percent", () => {
    const result = deriveCard(makeInput({ workOrdersDone: 5, workOrdersTotal: 10 }));
    expect(result.woProgress.done).toBe(5);
    expect(result.woProgress.total).toBe(10);
    expect(result.woProgress.pct).toBe(50);
  });

  it("wo-18-004: GIVEN 0 total WOs WHEN derived THEN pct is 0 (no divide-by-zero)", () => {
    const result = deriveCard(makeInput({ workOrdersDone: 0, workOrdersTotal: 0 }));
    expect(result.woProgress.pct).toBe(0);
  });

  it("wo-18-004: GIVEN phase started 3 days ago WHEN derived THEN ageInStageDays is 3", () => {
    const result = deriveCard(makeInput({ phaseStartedAt: daysAgo(3, NOW_MS) }));
    expect(result.ageInStageDays).toBe(3);
  });

  it("wo-18-004: GIVEN no phaseStartedAt WHEN derived THEN ageInStageDays is undefined", () => {
    const result = deriveCard(makeInput({ phaseStartedAt: undefined }));
    expect(result.ageInStageDays).toBeUndefined();
  });

  it("wo-18-004: GIVEN architecture phase WHEN derived THEN nextCommand is /pandacorp:implement", () => {
    const result = deriveCard(makeInput({ phase: "architecture" }));
    expect(result.nextCommand).toBe("/pandacorp:implement");
  });

  it("wo-18-004: GIVEN implementation phase WHEN derived THEN nextCommand is /pandacorp:release", () => {
    const result = deriveCard(makeInput({ phase: "implementation" }));
    expect(result.nextCommand).toBe("/pandacorp:release");
  });

  it("wo-18-004: GIVEN release (launched) phase WHEN derived THEN nextCommand is /pandacorp:review-launch", () => {
    // DR-085: release is the launched phase (what "operation" used to mean); its
    // next command is the post-launch review.
    const result = deriveCard(makeInput({ phase: "release", running: false }));
    expect(result.nextCommand).toBe("/pandacorp:review-launch");
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.2 — freshness: "en vivo" vs "sin señal"
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.2 — freshness flag (en vivo / sin señal)", () => {
  it("wo-18-004: GIVEN running build with last event 30s ago WHEN derived THEN isLive is true", () => {
    const result = deriveCard(
      makeInput({
        running: true,
        lastEventAt: ago(30_000, NOW_MS),
      }),
    );
    expect(result.isLive).toBe(true);
    expect(result.isNoSignal).toBe(false);
  });

  it("wo-18-004: GIVEN running build with last event older than threshold WHEN derived THEN isNoSignal is true", () => {
    // FRESHNESS_THRESHOLD_MS is the threshold; older than that = no-signal
    const result = deriveCard(
      makeInput({
        running: true,
        lastEventAt: ago(FRESHNESS_THRESHOLD_MS + 60_000, NOW_MS),
      }),
    );
    expect(result.isNoSignal).toBe(true);
    expect(result.isLive).toBe(false);
  });

  it("wo-18-004: GIVEN no-signal build WHEN derived THEN lastEventAt is preserved for display", () => {
    const lastEvent = ago(FRESHNESS_THRESHOLD_MS + 60_000, NOW_MS);
    const result = deriveCard(
      makeInput({
        running: true,
        lastEventAt: lastEvent,
      }),
    );
    expect(result.lastEventAt).toBe(lastEvent);
  });

  it("wo-18-004: GIVEN non-running project WHEN derived THEN neither isLive nor isNoSignal", () => {
    const result = deriveCard(makeInput({ running: false }));
    expect(result.isLive).toBe(false);
    expect(result.isNoSignal).toBe(false);
  });

  it("wo-18-004: GIVEN running build with null lastEventAt WHEN derived THEN isNoSignal is true (no event = stale)", () => {
    const result = deriveCard(makeInput({ running: true, lastEventAt: null }));
    expect(result.isNoSignal).toBe(true);
    expect(result.isLive).toBe(false);
  });

  it("wo-18-004: GIVEN running build with last event exactly at threshold WHEN derived THEN isNoSignal (boundary inclusive)", () => {
    const result = deriveCard(
      makeInput({
        running: true,
        lastEventAt: ago(FRESHNESS_THRESHOLD_MS, NOW_MS),
      }),
    );
    expect(result.isNoSignal).toBe(true);
  });

  it("wo-18-004: GIVEN running build with last event one ms before threshold WHEN derived THEN isLive (fresh)", () => {
    const result = deriveCard(
      makeInput({
        running: true,
        lastEventAt: ago(FRESHNESS_THRESHOLD_MS - 1, NOW_MS),
      }),
    );
    expect(result.isLive).toBe(true);
    expect(result.isNoSignal).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.3 — phase staleness: "estancado" flag
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.3 — phase staleness (estancado)", () => {
  it("wo-18-004: GIVEN phase started within threshold WHEN derived THEN isStalled is false", () => {
    const result = deriveCard(
      makeInput({ phaseStartedAt: daysAgo(STALENESS_THRESHOLD_DAYS - 1, NOW_MS) }),
    );
    expect(result.isStalled).toBe(false);
  });

  it("wo-18-004: GIVEN phase started beyond threshold WHEN derived THEN isStalled is true", () => {
    const result = deriveCard(
      makeInput({ phaseStartedAt: daysAgo(STALENESS_THRESHOLD_DAYS + 1, NOW_MS) }),
    );
    expect(result.isStalled).toBe(true);
  });

  it("wo-18-004: GIVEN isStalled WHEN derived THEN ageInStageDays is >= threshold", () => {
    const result = deriveCard(
      makeInput({ phaseStartedAt: daysAgo(STALENESS_THRESHOLD_DAYS + 5, NOW_MS) }),
    );
    expect(result.isStalled).toBe(true);
    expect(result.ageInStageDays).toBeGreaterThanOrEqual(STALENESS_THRESHOLD_DAYS);
  });

  it("wo-18-004: GIVEN no phaseStartedAt WHEN derived THEN isStalled is false (cannot determine)", () => {
    const result = deriveCard(makeInput({ phaseStartedAt: undefined }));
    expect(result.isStalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.4 — failing/blocked WO → inline blocker reason
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.4 — blocker reason from failing WO", () => {
  it("wo-18-004: GIVEN a failing WO reason WHEN derived THEN blockerReason is present", () => {
    const result = deriveCard(makeInput({ failedWoReason: "tsc type error in auth module" }));
    expect(result.blockerReason).toBe("tsc type error in auth module");
  });

  it("wo-18-004: GIVEN no failing WO WHEN derived THEN blockerReason is undefined", () => {
    const result = deriveCard(makeInput({ failedWoReason: undefined }));
    expect(result.blockerReason).toBeUndefined();
  });

  it("wo-18-004: GIVEN empty string failedWoReason WHEN derived THEN blockerReason is undefined (no empty strings)", () => {
    const result = deriveCard(makeInput({ failedWoReason: "" }));
    expect(result.blockerReason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.5 — shipped project: "estable · en operación" + review-launch
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.5 — shipped project (release/launched phase)", () => {
  it("wo-18-004: GIVEN release phase WHEN derived THEN isShipped is true", () => {
    const result = deriveCard(makeInput({ phase: "release", running: false }));
    expect(result.isShipped).toBe(true);
  });

  it("wo-18-004: GIVEN release phase WHEN derived THEN nextCommand is /pandacorp:review-launch", () => {
    const result = deriveCard(makeInput({ phase: "release", running: false }));
    expect(result.nextCommand).toBe("/pandacorp:review-launch");
  });

  it("wo-18-004: GIVEN non-release phase WHEN derived THEN isShipped is false", () => {
    const result = deriveCard(makeInput({ phase: "implementation" }));
    expect(result.isShipped).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-18-004.7 — thresholds from constants, no magic numbers
// ---------------------------------------------------------------------------

describe("wo-18-004: AC-18-004.7 — constants exported from lib/constants.ts", () => {
  it("wo-18-004: FRESHNESS_THRESHOLD_MS is a finite positive number", () => {
    expect(Number.isFinite(FRESHNESS_THRESHOLD_MS)).toBe(true);
    expect(FRESHNESS_THRESHOLD_MS).toBeGreaterThan(0);
  });

  it("wo-18-004: STALENESS_THRESHOLD_DAYS is a finite positive number", () => {
    expect(Number.isFinite(STALENESS_THRESHOLD_DAYS)).toBe(true);
    expect(STALENESS_THRESHOLD_DAYS).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Pure-function invariants
// ---------------------------------------------------------------------------

describe("wo-18-004: pure-function invariants", () => {
  it("wo-18-004: same inputs always yield same output (deterministic)", () => {
    const input = makeInput();
    const r1 = deriveCard(input);
    const r2 = deriveCard(input);
    expect(r1).toEqual(r2);
  });

  it("wo-18-004: never throws on any combination of inputs", () => {
    const extremeInputs: CardInput[] = [
      makeInput({ workOrdersDone: 0, workOrdersTotal: 0 }),
      makeInput({ phaseStartedAt: undefined, lastEventAt: null }),
      makeInput({ running: false, lastEventAt: null }),
      makeInput({ failedWoReason: "", phase: "architecture" }),
    ];
    for (const input of extremeInputs) {
      expect(() => deriveCard(input)).not.toThrow();
    }
  });
});
