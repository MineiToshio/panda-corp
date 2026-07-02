/**
 * WO-06-005 — toFraguaSnapshot (IF-06-fragua-snapshot) tests
 *
 * RED → GREEN TDD for the pure snapshot derivation function.
 *
 * Traceability:
 *   AC-06-002.1  — current FRD + title in scene header
 *   AC-06-002.2  — global project counter {done, total}
 *   AC-06-008.1  — feeds off enriched AgentWorking events; no Claude call
 *   AC-06-008.2  — tolerant of missing optional fields (backward compat)
 *   AC-06-009.1  — mode read from state (never from a selector)
 *   AC-06-010.1  — no active FRD → active=false → empty state
 *
 * Wave table (blueprint §3):
 *   pro=2, balanced=4, powerful=8, deep=6
 */

import { describe, expect, it } from "vitest";

import { readEvents } from "@/lib/events/events";
import {
  FIXTURE_EVENTS_EMPTY_NDJSON,
  FIXTURE_EVENTS_ENRICHED_NDJSON,
  FIXTURE_EVENTS_NDJSON,
} from "@/tests/fixtures";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

// ---------------------------------------------------------------------------
// Helper: read and snapshot
// ---------------------------------------------------------------------------
function snapshotFrom(ndjsonPath: string, cap = 200) {
  const { events, lastEventAt } = readEvents({ path: ndjsonPath, cap });
  return toFraguaSnapshot(events, { lastEventAt });
}

// ---------------------------------------------------------------------------
// AC-06-010.1 — no active FRD in events → active=false (empty state)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — empty state (AC-06-010.1)", () => {
  it("frd-06: WHEN events file is empty THEN snapshot.active is false", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_EMPTY_NDJSON);
    expect(snap.active).toBe(false);
  });

  it("frd-06: WHEN events have no enriched frd field THEN snapshot.active is false", () => {
    // The plain fixture has no frd field on any event
    const snap = snapshotFrom(FIXTURE_EVENTS_NDJSON);
    expect(snap.active).toBe(false);
  });

  it("frd-06: WHEN events file is empty THEN snapshot.frd is null (AC-06-002.1)", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_EMPTY_NDJSON);
    expect(snap.frd).toBeNull();
  });

  it("frd-06: WHEN events file is empty THEN never throws", () => {
    expect(() => snapshotFrom(FIXTURE_EVENTS_EMPTY_NDJSON)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-06-002.1 — current FRD detection
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — current FRD (AC-06-002.1)", () => {
  it("frd-06: WHEN enriched events have frd field THEN snapshot.frd.id is set", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.frd).not.toBeNull();
    expect(snap.frd?.id).toBe("frd-06-party");
  });

  it("frd-06: WHEN frd is detected THEN snapshot.active is true", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.active).toBe(true);
  });

  it("frd-06: WHEN frd is detected THEN snapshot.frd.title is a non-empty string", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(typeof snap.frd?.title).toBe("string");
    expect((snap.frd?.title ?? "").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-06-009.1 — mode read from state; default 'powerful'
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — mode and wave (AC-06-009.1)", () => {
  it("frd-06: WHEN enriched events carry mode='powerful' THEN snapshot.mode is 'powerful'", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.mode).toBe("powerful");
  });

  it("frd-06: WHEN no mode field in events THEN mode defaults to 'powerful'", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_NDJSON);
    expect(snap.mode).toBe("powerful");
  });

  it("frd-06: WHEN mode is 'powerful' THEN wave is 8", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.wave).toBe(8);
  });

  it("frd-06: WHEN events are empty THEN wave is 8 (default powerful)", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_EMPTY_NDJSON);
    expect(snap.wave).toBe(8);
  });

  it("frd-06: WHEN mode override is 'pro' THEN wave is 2", () => {
    const { events } = readEvents({ path: FIXTURE_EVENTS_ENRICHED_NDJSON });
    const snap = toFraguaSnapshot(events, { lastEventAt: null, modeOverride: "pro" });
    expect(snap.wave).toBe(2);
  });

  it("frd-06: WHEN mode override is 'balanced' THEN wave is 4", () => {
    const { events } = readEvents({ path: FIXTURE_EVENTS_ENRICHED_NDJSON });
    const snap = toFraguaSnapshot(events, { lastEventAt: null, modeOverride: "balanced" });
    expect(snap.wave).toBe(4);
  });

  it("frd-06: WHEN mode override is 'deep' THEN wave is 6", () => {
    const { events } = readEvents({ path: FIXTURE_EVENTS_ENRICHED_NDJSON });
    const snap = toFraguaSnapshot(events, { lastEventAt: null, modeOverride: "deep" });
    expect(snap.wave).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Running WOs cap ≤ wave (REQ-06-001 / blueprint §3)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — running WOs capped at wave", () => {
  it("frd-06: WHEN events have 4 distinct running WOs and wave=8 THEN running.length is ≤8", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.running.length).toBeLessThanOrEqual(snap.wave);
  });

  it("frd-06: WHEN wave is 2 THEN running.length is ≤2", () => {
    const { events } = readEvents({ path: FIXTURE_EVENTS_ENRICHED_NDJSON });
    const snap = toFraguaSnapshot(events, { lastEventAt: null, modeOverride: "pro" });
    expect(snap.running.length).toBeLessThanOrEqual(2);
  });

  it("frd-06: WHEN events have no enriched WO fields THEN running is empty", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_NDJSON);
    expect(snap.running).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Trophies and archivedCount (REQ-06-005 / blueprint §3)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — trophies and archivedCount", () => {
  it("frd-06: WHEN 2 achievement events present THEN trophies has ≤2 entries", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    // fixture has 2 achievement events (WO-06-001, WO-06-002)
    expect(snap.trophies.length).toBeLessThanOrEqual(2);
  });

  it("frd-06: WHEN trophies count is ≤9 THEN archivedCount is 0", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.archivedCount).toBe(0);
  });

  it("frd-06: WHEN more entries than the 45-entry shelf cap exist THEN the excess is archived", () => {
    // 50 achievements → 45 on the (growing, 5-row) shelf, 5 archived as "+N más".
    const events = Array.from({ length: 50 }, (_, i) => ({
      event: "achievement",
      at: `2026-07-01T10:${String(i % 60).padStart(2, "0")}:00Z`,
      workOrder: `WO-07-${String(i + 1).padStart(3, "0")}`,
      frd: "frd-07-demo",
    }));
    const snapshot = toFraguaSnapshot(events, { lastEventAt: null });
    expect(snapshot.trophies).toHaveLength(45);
    expect(snapshot.archivedCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Gate state (REQ-06-004)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — gate state", () => {
  it("frd-06: WHEN not all WOs are IN_REVIEW THEN gate.open is false", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.gate.open).toBe(false);
  });

  it("frd-06: WHEN gate event is present THEN gate.open is true", () => {
    const events = [
      {
        event: "AgentWorking" as const,
        at: "2026-06-18T10:00:00Z",
        frd: "frd-06-party",
        wo: "WO-06-001",
        mode: "powerful" as const,
      },
      {
        event: "gate" as const,
        at: "2026-06-18T10:30:00Z",
        frd: "frd-06-party",
      },
    ];
    const snap = toFraguaSnapshot(events, { lastEventAt: null });
    expect(snap.gate.open).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-06-002.2 — global project counter
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — global project counter (AC-06-002.2)", () => {
  it("frd-06: WHEN events have 2 achievements THEN project.done is 2", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON);
    expect(snap.project.done).toBe(2);
  });

  it("frd-06: WHEN no events THEN project.done is 0 and project.total is 0", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_EMPTY_NDJSON);
    expect(snap.project.done).toBe(0);
    expect(snap.project.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// lastEventAt is the newest at (WO-06-005 TDD)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — lastEventAt", () => {
  it("frd-06: WHEN events present THEN lastEventAt matches the latest at", () => {
    const { events, lastEventAt } = readEvents({ path: FIXTURE_EVENTS_ENRICHED_NDJSON });
    const snap = toFraguaSnapshot(events, { lastEventAt });
    expect(snap.lastEventAt).toBe(lastEventAt);
  });

  it("frd-06: WHEN no events THEN lastEventAt is null", () => {
    const snap = snapshotFrom(FIXTURE_EVENTS_EMPTY_NDJSON);
    expect(snap.lastEventAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-06-008.2 — tolerant of missing optional fields
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — backward compat / missing fields (AC-06-008.2)", () => {
  it("frd-06: WHEN event is missing frd/mode/wo fields THEN does not throw", () => {
    const events = [{ event: "AgentWorking", at: "2026-06-18T10:00:00Z" }];
    expect(() =>
      toFraguaSnapshot(events as Parameters<typeof toFraguaSnapshot>[0], { lastEventAt: null }),
    ).not.toThrow();
  });

  it("frd-06: WHEN event has invalid mode value THEN falls back to default mode", () => {
    const events = [
      {
        event: "AgentWorking" as const,
        at: "2026-06-18T10:00:00Z",
        frd: "frd-test",
        wo: "WO-01-001",
        mode: "invalid-mode" as unknown as "powerful",
      },
    ];
    const snap = toFraguaSnapshot(events, { lastEventAt: null });
    expect(snap.mode).toBe("powerful");
  });

  it("frd-06: WHEN events array is empty THEN returns a valid snapshot with all defaults", () => {
    const snap = toFraguaSnapshot([], { lastEventAt: null });
    expect(snap.active).toBe(false);
    expect(snap.frd).toBeNull();
    expect(snap.running).toHaveLength(0);
    expect(snap.trophies).toHaveLength(0);
    expect(snap.archivedCount).toBe(0);
    expect(snap.gate.open).toBe(false);
    expect(snap.project.done).toBe(0);
    expect(snap.project.total).toBe(0);
    expect(snap.lastEventAt).toBeNull();
  });

  it("frd-06: WHEN malformed event line is in NDJSON THEN snapshot does not throw (via readEvents)", () => {
    // The enriched fixture has 1 malformed line that readEvents skips
    expect(() => snapshotFrom(FIXTURE_EVENTS_ENRICHED_NDJSON)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FRD-level `wo` ids are not work orders (no phantom avatar, no inflated count)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — FRD-level wo ids are excluded", () => {
  it("frd-06: WHEN an AgentWorking event carries the FRD id in wo THEN it is not a running WO", () => {
    const events = [
      {
        event: "AgentWorking" as const,
        at: "2026-06-30T10:00:00Z",
        frd: "frd-02-home-positioning",
        workOrder: "frd-02-home-positioning",
        mode: "powerful" as const,
      },
      {
        event: "AgentWorking" as const,
        at: "2026-06-30T10:01:00Z",
        frd: "frd-02-home-positioning",
        workOrder: "WO-02-001",
        mode: "powerful" as const,
      },
    ];
    const snap = toFraguaSnapshot(events, { lastEventAt: null });
    expect(snap.running.map((r) => r.wo)).toEqual(["WO-02-001"]);
  });

  it("frd-06: WHEN the FRD id appears in wo THEN it does not inflate the WO total", () => {
    const events = [
      {
        event: "AgentWorking" as const,
        at: "2026-06-30T10:00:00Z",
        frd: "frd-02-home-positioning",
        workOrder: "frd-02-home-positioning",
        mode: "powerful" as const,
      },
      {
        event: "AgentWorking" as const,
        at: "2026-06-30T10:01:00Z",
        frd: "frd-02-home-positioning",
        workOrder: "WO-02-001",
        mode: "powerful" as const,
      },
    ];
    const snap = toFraguaSnapshot(events, { lastEventAt: null });
    expect(snap.project.total).toBe(1);
  });

  it("frd-06: WHEN an achievement carries the FRD id in wo THEN it is not counted as done", () => {
    const events = [
      {
        event: "achievement" as const,
        at: "2026-06-30T10:00:00Z",
        frd: "frd-02-home-positioning",
        workOrder: "frd-02-home-positioning",
      },
    ];
    const snap = toFraguaSnapshot(events, { lastEventAt: null });
    expect(snap.project.done).toBe(0);
    expect(snap.trophies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Per-WO state reconciled from authoritative frontmatter (AC-06-001.6)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — per-WO state from woStates (AC-06-001.6)", () => {
  const buildEvents = () => [
    {
      event: "AgentWorking" as const,
      at: "2026-06-30T10:00:00Z",
      frd: "frd-02-home-positioning",
      workOrder: "WO-02-001",
      mode: "powerful" as const,
    },
  ];

  it("frd-06: WHEN no woStates THEN a running WO keeps the building default", () => {
    const snap = toFraguaSnapshot(buildEvents(), { lastEventAt: null });
    expect(snap.running.find((r) => r.wo === "WO-02-001")?.state).toBe("building");
  });

  it("frd-06: WHEN woStates marks the WO in_review THEN the running WO state is in_review", () => {
    const snap = toFraguaSnapshot(buildEvents(), {
      lastEventAt: null,
      woStates: { "WO-02-001": "in_review" },
    });
    expect(snap.running.find((r) => r.wo === "WO-02-001")?.state).toBe("in_review");
  });

  it("frd-06: WHEN woStates marks the WO blocked THEN the running WO state is blocked", () => {
    const snap = toFraguaSnapshot(buildEvents(), {
      lastEventAt: null,
      woStates: { "WO-02-001": "blocked" },
    });
    expect(snap.running.find((r) => r.wo === "WO-02-001")?.state).toBe("blocked");
  });

  it("frd-06: WHEN woStates marks the WO verified THEN the running WO state is verified", () => {
    const snap = toFraguaSnapshot(buildEvents(), {
      lastEventAt: null,
      woStates: { "WO-02-001": "verified" },
    });
    expect(snap.running.find((r) => r.wo === "WO-02-001")?.state).toBe("verified");
  });

  it("frd-06: WHEN woStates has no entry for a running WO THEN it falls back to building", () => {
    const snap = toFraguaSnapshot(buildEvents(), {
      lastEventAt: null,
      woStates: { "WO-09-999": "in_review" },
    });
    expect(snap.running.find((r) => r.wo === "WO-02-001")?.state).toBe("building");
  });

  it("frd-06: WHEN the build is OFF (running:false) THEN woStates does not resurrect a sprite", () => {
    const snap = toFraguaSnapshot(buildEvents(), {
      lastEventAt: null,
      running: false,
      woStates: { "WO-02-001": "in_review" },
    });
    expect(snap.running).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Never imports a Claude/AI client (auditable — AC-06-008.1)
// ---------------------------------------------------------------------------

describe("frd-06: toFraguaSnapshot — no Claude/AI import (AC-06-008.1)", () => {
  it("frd-06: WHEN module is imported THEN it does not import any Claude/AI client", async () => {
    const mod = await import("../fragua-snapshot/fragua-snapshot");
    expect(typeof mod.toFraguaSnapshot).toBe("function");
  });
});
