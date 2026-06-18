/**
 * WO-01-007 — `readEvents` (capped tail + state diffs) — RED phase.
 *
 * These tests are written BEFORE the implementation (`lib/events.ts` does not exist yet).
 * All tests will fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-01-008.1  The system SHALL read the event stream
 *                (`~/.claude/dashboard-events.ndjson`) and compute state diffs to build the
 *                dashboard digest and the live / no-signal indicators (last-event timestamp per
 *                running build) and each project's time-in-current-phase (age-in-stage).
 *                Source: FRD-01 EARS criteria, REQ-01-008; architecture §5; WO-01-007 contract.
 *
 * Contract (from WO-01-007):
 *   export function readEvents(opts?: { path?: string; cap?: number }): EventsSnapshot
 *   - One JSON object per line; malformed lines are SKIPPED, valid lines kept (never throws).
 *   - Tail is capped at `cap` (default 200) — the LAST `cap` lines after filtering valid JSON.
 *   - Field name mapping: `work_order` → `workOrder` (architecture §5).
 *   - `lastEventAt` = the maximum `at` value across all retained events (null if none).
 *   - `byProject`: per-project last `at`; events without `project` bucketed under `__global__`,
 *     NOT dropped. (Architecture §5 / CLAUDE.md: "events without a project field are
 *     treated as legacy/global".)
 *   - Missing file → `{ events: [], lastEventAt: null, byProject: {} }`.
 *   - Read-only invariant: NEVER writes, NEVER calls Claude (REQ-01-011).
 *
 * Regression anchors from .pandacorp/comms/progress.md (real bugs → regression tests):
 *   None logged specifically against readEvents, but the following past incidents
 *   inform the adversarial edge cases below:
 *   - B1' (WO-13-001, 2026-06-16): typeof NaN === "number" — guard on numeric fields must
 *     use Number.isFinite; if `cap` is NaN the function must fall back to default 200, not
 *     return no events.
 *   - The FREEZE-ON-RED note (2026-06-16): malformed input must not throw mid-batch; each
 *     valid item must survive even when a sibling is broken. Same contract applies here to
 *     per-line resilience.
 *
 * Stack: Vitest (TypeScript).
 * No mocks — the function is pure-ish (path in → typed data out), tested against
 * static fixture files in `tests/fixtures/events/`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { FIXTURE_EVENTS_EMPTY_NDJSON, FIXTURE_EVENTS_NDJSON } from "../../../tests/fixtures";

// The module under test — does NOT exist yet (RED phase).
import { readEvents } from "../events";

// ---------------------------------------------------------------------------
// Type aliases — mirror the contract in WO-01-007 and blueprint §2.
// Kept local to express what these tests assert; the module will export them.
// ---------------------------------------------------------------------------

type Event = {
  event: string;
  at: string;
  agent?: string;
  session?: string;
  tool?: string;
  status?: "ok" | "fail";
  workOrder?: string;
  task?: string;
  project?: string;
};

type EventsSnapshot = {
  events: Event[];
  lastEventAt: string | null;
  byProject: Record<string, { lastEventAt: string }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a temporary NDJSON file and return its path. Caller must clean it up. */
function writeTempNdjson(lines: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-events-test-"));
  const filePath = path.join(dir, "dashboard-events.ndjson");
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// AC-01-008.1 — happy path: fixture file with valid lines + one malformed line
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — AC-01-008.1 happy path (fixture NDJSON)", () => {
  it("frd-01: WHEN the NDJSON fixture is read THEN readEvents does NOT throw", () => {
    expect(() => readEvents({ path: FIXTURE_EVENTS_NDJSON })).not.toThrow();
  });

  it("frd-01: WHEN the NDJSON fixture is read THEN it returns an EventsSnapshot object", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect(snap).toBeDefined();
    expect(typeof snap).toBe("object");
    expect(Array.isArray(snap.events)).toBe(true);
    expect(typeof snap.byProject).toBe("object");
  });

  it("frd-01: WHEN the NDJSON has 10 valid lines and 1 malformed line THEN events array has exactly 10 entries", () => {
    // Fixture: 10 valid JSON objects + 1 "THIS IS NOT VALID JSON" line = 11 non-empty lines.
    // The malformed line must be skipped; only the 10 valid lines are returned.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect(snap.events).toHaveLength(10);
  });

  it("frd-01: WHEN the NDJSON has valid and malformed lines THEN the malformed line does NOT appear as an event", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    // No event should have an event field that includes the sentinel text from the
    // malformed line ("THIS IS NOT VALID JSON").
    for (const ev of snap.events) {
      expect(ev.event).not.toContain("THIS IS NOT VALID JSON");
    }
  });

  it("frd-01: WHEN valid events are parsed THEN every event has a string `event` field", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    for (const ev of snap.events) {
      expect(typeof ev.event).toBe("string");
    }
  });

  it("frd-01: WHEN valid events are parsed THEN every event has a string `at` field", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    for (const ev of snap.events) {
      expect(typeof ev.at).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — `lastEventAt` is the max `at` across all retained events
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — lastEventAt is the maximum `at` value", () => {
  it("frd-01: WHEN events span two dates THEN lastEventAt is the most recent ISO 8601 timestamp", () => {
    // Fixture timestamps: 2026-06-15T10:00:00Z ... 2026-06-16T08:30:00Z
    // The last valid line has at="2026-06-16T08:30:00Z" — that must be lastEventAt.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect(snap.lastEventAt).toBe("2026-06-16T08:30:00Z");
  });

  it("frd-01: WHEN the NDJSON is empty THEN lastEventAt is null", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_EMPTY_NDJSON }) as EventsSnapshot;
    expect(snap.lastEventAt).toBeNull();
  });

  it("frd-01: WHEN the file is missing THEN lastEventAt is null", () => {
    const snap = readEvents({
      path: "/nonexistent/path/dashboard-events.ndjson",
    }) as EventsSnapshot;
    expect(snap.lastEventAt).toBeNull();
  });

  it("frd-01: WHEN all lines are malformed THEN lastEventAt is null (no valid events)", () => {
    const tmpPath = writeTempNdjson(["NOT JSON AT ALL", "{ broken", "also not json"]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.lastEventAt).toBeNull();
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — `byProject` groups events by `project` key;
//               events without `project` go to `__global__`, NOT dropped
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — byProject groups by project; no-project → __global__", () => {
  it("frd-01: WHEN events have a project field THEN byProject contains that project key", () => {
    // Fixture has events with project: "proj-a".
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect("proj-a" in snap.byProject).toBe(true);
  });

  it("frd-01: WHEN events have no project field THEN byProject contains __global__ key", () => {
    // Fixture has two events without a project field (legacy/global).
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect("__global__" in snap.byProject).toBe(true);
  });

  it("frd-01: WHEN events without project field exist THEN they are NOT dropped from byProject", () => {
    // The contract: missing project → __global__ bucket, never discarded.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    // __global__ must be present (proved above), and its lastEventAt must be a non-empty string.
    const globalEntry = snap.byProject.__global__;
    expect(globalEntry).toBeDefined();
    expect(typeof globalEntry?.lastEventAt).toBe("string");
    expect(globalEntry?.lastEventAt.length).toBeGreaterThan(0);
  });

  it("frd-01: WHEN byProject is built THEN proj-a lastEventAt is the latest proj-a event timestamp", () => {
    // Fixture proj-a events have timestamps up to 2026-06-16T08:30:00Z.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect(snap.byProject["proj-a"]?.lastEventAt).toBe("2026-06-16T08:30:00Z");
  });

  it("frd-01: WHEN byProject is built THEN __global__ lastEventAt is the latest project-less event", () => {
    // Fixture project-less events: at="2026-06-15T11:00:00Z" and at="2026-06-15T11:01:00Z".
    // The latest is 2026-06-15T11:01:00Z.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect(snap.byProject.__global__?.lastEventAt).toBe("2026-06-15T11:01:00Z");
  });

  it("frd-01: WHEN no project field is on ANY event THEN only __global__ key exists in byProject", () => {
    const tmpPath = writeTempNdjson([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-15T10:00:00Z" }),
      JSON.stringify({ event: "ToolCall", at: "2026-06-15T10:01:00Z" }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      const keys = Object.keys(snap.byProject);
      expect(keys).toEqual(["__global__"]);
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN multiple projects appear THEN byProject has one entry per project plus __global__", () => {
    const tmpPath = writeTempNdjson([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-15T10:00:00Z", project: "alpha" }),
      JSON.stringify({ event: "ToolCall", at: "2026-06-15T10:01:00Z", project: "beta" }),
      JSON.stringify({ event: "AgentWorking", at: "2026-06-15T10:02:00Z", project: "alpha" }),
      JSON.stringify({ event: "ToolCall", at: "2026-06-15T10:03:00Z" }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      const keys = Object.keys(snap.byProject).sort();
      expect(keys).toEqual(["__global__", "alpha", "beta"]);
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN a project has multiple events THEN byProject.lastEventAt is the latest one for that project", () => {
    const tmpPath = writeTempNdjson([
      JSON.stringify({ event: "A", at: "2026-06-15T08:00:00Z", project: "alpha" }),
      JSON.stringify({ event: "B", at: "2026-06-15T12:00:00Z", project: "alpha" }),
      JSON.stringify({ event: "C", at: "2026-06-15T09:00:00Z", project: "alpha" }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.byProject.alpha?.lastEventAt).toBe("2026-06-15T12:00:00Z");
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — field name mapping: `work_order` → `workOrder` (architecture §5)
// The NDJSON producer uses snake_case; the TypeScript consumer uses camelCase.
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — field name mapping work_order → workOrder (architecture §5)", () => {
  it("frd-01: WHEN a line has work_order in JSON THEN the parsed event exposes it as workOrder", () => {
    const tmpPath = writeTempNdjson([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        work_order: "WO-01-007",
      }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.events).toHaveLength(1);
      const ev = snap.events[0];
      expect(ev?.workOrder).toBe("WO-01-007");
      // The snake_case key must NOT survive in the output type (it would be a type error,
      // but we assert at runtime too to catch JS mis-mapping).
      expect((ev as Record<string, unknown>).work_order).toBeUndefined();
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN an event has no work_order field THEN workOrder is undefined (not null, not '')", () => {
    const tmpPath = writeTempNdjson([
      JSON.stringify({ event: "ToolCall", at: "2026-06-15T10:00:00Z", tool: "Read" }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      const ev = snap.events[0];
      expect(ev?.workOrder).toBeUndefined();
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN a fixture event has workOrder WO-01-000 THEN it is accessible as workOrder in the snapshot", () => {
    // Fixture line: {"event":"AgentWorking","at":"...","data":{"wo":"WO-01-000"}} does not
    // carry a top-level work_order; but line 9 has "wo" inside data — not the same field.
    // This test uses a temp file to assert the mapping directly.
    const tmpPath = writeTempNdjson([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        work_order: "WO-01-000",
      }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.events[0]?.workOrder).toBe("WO-01-000");
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — tail cap: `cap` option limits the number of retained events
// Default cap = 200 (architecture §3/§5); custom cap overrides it.
// The cap takes the LAST N lines (tail semantics).
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — tail cap (default 200, custom cap)", () => {
  it("frd-01: WHEN there are fewer events than the default cap THEN all events are returned", () => {
    // Fixture has 10 valid events < 200 — all should be returned.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    expect(snap.events).toHaveLength(10);
  });

  it("frd-01: WHEN cap is set to 5 and there are 10 valid events THEN only 5 events are returned", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON, cap: 5 }) as EventsSnapshot;
    expect(snap.events).toHaveLength(5);
  });

  it("frd-01: WHEN cap is set to 3 THEN the LAST 3 valid events are returned (tail semantics)", () => {
    // The fixture's last 3 valid events (in order) by timestamp:
    // line 10: at="2026-06-15T12:00:00Z" (TaskComplete)
    // line 11: at="2026-06-16T08:30:00Z" (AgentWorking)
    // With cap=2 we expect the two most-recent events.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON, cap: 2 }) as EventsSnapshot;
    expect(snap.events).toHaveLength(2);
    // The returned events should be the chronologically last 2.
    const ats = snap.events.map((e) => e.at);
    expect(ats).toContain("2026-06-16T08:30:00Z");
    expect(ats).toContain("2026-06-15T12:00:00Z");
  });

  it("frd-01: WHEN cap is set to 1 THEN only the very last valid event is returned", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON, cap: 1 }) as EventsSnapshot;
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.at).toBe("2026-06-16T08:30:00Z");
  });

  it("frd-01: WHEN cap is larger than the total valid lines THEN all valid lines are returned (no out-of-bounds)", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON, cap: 9999 }) as EventsSnapshot;
    expect(snap.events).toHaveLength(10);
  });

  it("frd-01: WHEN cap is 0 THEN an empty events array is returned (boundary)", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON, cap: 0 }) as EventsSnapshot;
    expect(snap.events).toHaveLength(0);
  });

  it("frd-01: WHEN the file contains exactly cap-many valid events THEN all are returned (no off-by-one)", () => {
    const lines = Array.from({ length: 5 }, (_, i) =>
      JSON.stringify({ event: "E", at: `2026-06-15T10:0${i}:00Z`, project: "p" }),
    );
    const tmpPath = writeTempNdjson(lines);
    try {
      const snap = readEvents({ path: tmpPath, cap: 5 }) as EventsSnapshot;
      expect(snap.events).toHaveLength(5);
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN cap is 200 (default) and file has 200 valid events THEN all 200 are returned", () => {
    const lines = Array.from({ length: 200 }, (_, i) =>
      JSON.stringify({ event: "E", at: `2026-01-01T00:${String(i % 60).padStart(2, "0")}:00Z` }),
    );
    const tmpPath = writeTempNdjson(lines);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.events).toHaveLength(200);
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN cap is 200 (default) and file has 201 valid events THEN exactly 200 are returned", () => {
    const lines = Array.from({ length: 201 }, (_, i) =>
      JSON.stringify({ event: "E", at: `2026-01-01T00:${String(i % 60).padStart(2, "0")}:00Z` }),
    );
    const tmpPath = writeTempNdjson(lines);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.events).toHaveLength(200);
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — missing and empty file → empty snapshot (fail-soft, blueprint §3)
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — missing file → empty snapshot (AC-01-008.1 edge case)", () => {
  it("frd-01: WHEN the NDJSON path does not exist THEN readEvents returns { events: [], lastEventAt: null, byProject: {} }", () => {
    const snap = readEvents({
      path: "/nonexistent/path/dashboard-events.ndjson",
    }) as EventsSnapshot;
    expect(snap.events).toHaveLength(0);
    expect(snap.lastEventAt).toBeNull();
    expect(snap.byProject).toEqual({});
  });

  it("frd-01: WHEN the NDJSON path does not exist THEN readEvents does NOT throw", () => {
    expect(() => readEvents({ path: "/nonexistent/path/dashboard-events.ndjson" })).not.toThrow();
  });

  it("frd-01: WHEN the NDJSON file is empty (0 bytes) THEN readEvents returns the empty snapshot", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_EMPTY_NDJSON }) as EventsSnapshot;
    expect(snap.events).toHaveLength(0);
    expect(snap.lastEventAt).toBeNull();
    expect(snap.byProject).toEqual({});
  });

  it("frd-01: WHEN the NDJSON file is empty THEN readEvents does NOT throw", () => {
    expect(() => readEvents({ path: FIXTURE_EVENTS_EMPTY_NDJSON })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — malformed lines are skipped; valid lines survive (fail-soft)
// Anchors the per-line catch pattern from the gray-matter-batch-abort incident.
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — malformed lines skipped, valid lines kept (fail-soft)", () => {
  it("frd-01: WHEN the NDJSON has a malformed line mid-stream THEN readEvents does NOT throw", () => {
    expect(() => readEvents({ path: FIXTURE_EVENTS_NDJSON })).not.toThrow();
  });

  it("frd-01: WHEN a malformed line is surrounded by valid lines THEN the valid lines before it are retained", () => {
    const tmpPath = writeTempNdjson([
      JSON.stringify({ event: "Before", at: "2026-06-15T10:00:00Z" }),
      "BROKEN LINE",
      JSON.stringify({ event: "After", at: "2026-06-15T10:01:00Z" }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.events).toHaveLength(2);
      const eventTypes = snap.events.map((e) => e.event);
      expect(eventTypes).toContain("Before");
      expect(eventTypes).toContain("After");
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN the NDJSON is entirely malformed THEN readEvents returns the empty snapshot (no throw)", () => {
    const tmpPath = writeTempNdjson(["not json at all", "{ also broken", "  "]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.events).toHaveLength(0);
      expect(snap.lastEventAt).toBeNull();
      expect(snap.byProject).toEqual({});
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN a line is valid JSON but not an object (e.g. a bare string) THEN it is skipped", () => {
    // JSON.parse('"hello"') succeeds but is not an event object.
    const tmpPath = writeTempNdjson([
      JSON.stringify({ event: "Real", at: "2026-06-15T10:00:00Z" }),
      '"just a string"',
      "42",
      "null",
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      // Only the real event should survive; primitives / non-objects are skipped.
      expect(snap.events).toHaveLength(1);
      expect(snap.events[0]?.event).toBe("Real");
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN a line is a valid JSON object but lacks `event` and `at` THEN it is skipped (required fields)", () => {
    const tmpPath = writeTempNdjson([
      JSON.stringify({ event: "Good", at: "2026-06-15T10:00:00Z" }),
      JSON.stringify({ something: "else" }), // missing required event + at
      JSON.stringify({ event: "AlsoGood", at: "2026-06-15T10:01:00Z" }),
    ]);
    try {
      const snap = readEvents({ path: tmpPath }) as EventsSnapshot;
      expect(snap.events).toHaveLength(2);
    } finally {
      fs.rmSync(path.dirname(tmpPath), { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — read-only invariant (REQ-01-011)
// readEvents MUST NOT write files; the return value is the only output.
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — read-only invariant (REQ-01-011)", () => {
  it("frd-01: WHEN readEvents runs against the fixture THEN no files are written (directory mtime unchanged)", () => {
    const dir = path.dirname(FIXTURE_EVENTS_NDJSON);
    const mtimeBefore = fs.statSync(dir).mtimeMs;
    readEvents({ path: FIXTURE_EVENTS_NDJSON });
    const mtimeAfter = fs.statSync(dir).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it("frd-01: readEvents returns an EventsSnapshot (never undefined, never null)", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON });
    expect(snap).not.toBeNull();
    expect(snap).not.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — default path: when no `path` opt is given, reads from
// `~/.claude/dashboard-events.ndjson` (the real event stream location).
// We do NOT read the real file in tests (it may be absent or have live data);
// we only assert the function accepts an absent path without throwing.
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — default path falls back to ~/.claude/dashboard-events.ndjson", () => {
  it("frd-01: WHEN readEvents is called with no opts THEN it does NOT throw (file may be missing)", () => {
    // The real file may or may not exist; fail-soft means no throw either way.
    expect(() => readEvents()).not.toThrow();
  });

  it("frd-01: WHEN readEvents is called with no opts THEN it returns an EventsSnapshot (never undefined)", () => {
    const snap = readEvents();
    expect(snap).toBeDefined();
    expect(Array.isArray((snap as EventsSnapshot).events)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-01-008.1 — idempotency: calling readEvents twice returns the same result
// (proves no hidden mutable state; catches non-deterministic OS readdir order).
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — idempotency", () => {
  it("frd-01: WHEN readEvents is called twice with the same path THEN both calls return the same events", () => {
    const first = (readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot).events;
    const second = (readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot).events;
    expect(first).toEqual(second);
  });

  it("frd-01: WHEN readEvents is called twice THEN lastEventAt is the same in both calls", () => {
    const first = (readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot).lastEventAt;
    const second = (readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot).lastEventAt;
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Regression: NaN cap must not silently return 0 events (anchored on B1' / WO-13-001).
// typeof NaN === "number" — if the implementation uses `cap >= 0` without
// Number.isFinite, it could accept NaN and slice([0, NaN]) = [].
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — NaN cap regression (B1' from WO-13-001)", () => {
  it("frd-01: WHEN cap is NaN THEN readEvents falls back to default 200 and returns all 10 fixture events", () => {
    // If NaN slips through as the cap, slice(len - NaN) = slice(NaN) = [] in some JS
    // engines, silently returning no events — a critical silent failure.
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON, cap: Number.NaN }) as EventsSnapshot;
    expect(snap.events).toHaveLength(10);
  });

  it("frd-01: WHEN cap is Infinity THEN readEvents returns all valid events (no crash)", () => {
    const snap = readEvents({
      path: FIXTURE_EVENTS_NDJSON,
      cap: Number.POSITIVE_INFINITY,
    }) as EventsSnapshot;
    expect(snap.events).toHaveLength(10);
  });

  it("frd-01: WHEN cap is a negative number THEN readEvents returns 0 events (or falls back to default — must not throw)", () => {
    expect(() => readEvents({ path: FIXTURE_EVENTS_NDJSON, cap: -1 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Snapshot structure completeness: all three top-level keys present,
// with correct types, on every call — even the empty-snapshot path.
// ---------------------------------------------------------------------------

describe("frd-01: readEvents — snapshot structure completeness", () => {
  it("frd-01: EventsSnapshot always has events, lastEventAt and byProject keys", () => {
    for (const testPath of [
      FIXTURE_EVENTS_NDJSON,
      FIXTURE_EVENTS_EMPTY_NDJSON,
      "/nonexistent/path.ndjson",
    ]) {
      const snap = readEvents({ path: testPath }) as EventsSnapshot;
      expect("events" in snap).toBe(true);
      expect("lastEventAt" in snap).toBe(true);
      expect("byProject" in snap).toBe(true);
    }
  });

  it("frd-01: byProject values each have a lastEventAt string key", () => {
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON }) as EventsSnapshot;
    for (const [, entry] of Object.entries(snap.byProject)) {
      expect(typeof entry.lastEventAt).toBe("string");
      expect(entry.lastEventAt.length).toBeGreaterThan(0);
    }
  });
});
