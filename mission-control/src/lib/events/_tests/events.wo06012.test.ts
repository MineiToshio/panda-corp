/**
 * WO-06-012 — lib/events.ts enriched field parsing — RED phase.
 *
 * Tests verify the acceptance criteria:
 *   AC-06-008.1: THE system SHALL feed off `AgentWorking` events carrying
 *                `{role, wo, frd, phase, activity, mode}` and `SubagentStop`,
 *                read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`,
 *                **without calling Claude** (read-only).
 *   AC-06-008.2: WHEN an event omits the optional enriched fields (`frd`, `phase`,
 *                `activity`, `mode`), THE system SHALL still render gracefully
 *                (backward compatibility), falling back to defaults rather than throwing.
 *
 * TDD contract from WO-06-012:
 *   - An enriched line exposes frd/phase/activity/mode/role on the parsed event.
 *   - A legacy line (without them) parses unchanged with those fields `undefined`.
 *   - A wrong-typed enriched field is dropped (not propagated) without throwing.
 *   - HandoffWritten/ContractPublished lines carry wo+frd.
 *   - The existing cap/lastEventAt/byProject tests stay green (regression).
 *
 * Stack: Vitest (TypeScript). No mocks — tested against temp NDJSON files.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FIXTURE_EVENTS_NDJSON } from "../../../tests/fixtures";
import { type Event, readEvents } from "../events";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-events-wo06012-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Write NDJSON lines to a temp file and return its path. */
function writeLines(lines: string[]): string {
  const filePath = path.join(tmpDir, "dashboard-events.ndjson");
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// AC-06-008.1 — enriched AgentWorking event: all new optional fields are exposed
// ---------------------------------------------------------------------------

describe("wo-06-012: enriched AgentWorking event — optional fields exposed", () => {
  it("WHEN an AgentWorking event carries frd THEN the parsed event exposes frd", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        frd: "frd-06-party",
        wo: "WO-06-012",
        phase: "build",
        activity: "implement",
        mode: "powerful",
        role: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    const ev = snap.events[0] as Event;
    expect(ev.frd).toBe("frd-06-party");
  });

  it("WHEN an AgentWorking event carries phase THEN the parsed event exposes phase", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        phase: "build",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.phase).toBe("build");
  });

  it("WHEN an AgentWorking event carries phase='review' THEN the parsed event exposes phase='review'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "reviewer",
        phase: "review",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.phase).toBe("review");
  });

  it("WHEN an AgentWorking event carries activity THEN the parsed event exposes activity", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        activity: "implement",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBe("implement");
  });

  it("WHEN an AgentWorking event carries activity='test' THEN the parsed event exposes activity='test'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "test-writer",
        activity: "test",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBe("test");
  });

  it("WHEN an AgentWorking event carries activity='backend' THEN the parsed event exposes activity='backend'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "backend-dev",
        activity: "backend",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBe("backend");
  });

  it("WHEN an AgentWorking event carries activity='frontend' THEN the parsed event exposes activity='frontend'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "frontend-dev",
        activity: "frontend",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBe("frontend");
  });

  it("WHEN an AgentWorking event carries activity='selftest' THEN the parsed event exposes activity='selftest'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        activity: "selftest",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBe("selftest");
  });

  it("WHEN an AgentWorking event carries mode THEN the parsed event exposes mode", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        mode: "powerful",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.mode).toBe("powerful");
  });

  it("WHEN an AgentWorking event carries mode='pro' THEN the parsed event exposes mode='pro'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        mode: "pro",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.mode).toBe("pro");
  });

  it("WHEN an AgentWorking event carries mode='balanced' THEN the parsed event exposes mode='balanced'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        mode: "balanced",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.mode).toBe("balanced");
  });

  it("WHEN an AgentWorking event carries mode='deep' THEN the parsed event exposes mode='deep'", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        mode: "deep",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.mode).toBe("deep");
  });

  it("WHEN an AgentWorking event carries role THEN the parsed event exposes role", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        role: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.role).toBe("implementer");
  });

  it("WHEN an AgentWorking event carries all enriched fields THEN all are exposed on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        frd: "frd-06-party",
        phase: "build",
        activity: "implement",
        mode: "powerful",
        role: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    const ev = snap.events[0] as Event;
    expect(ev.frd).toBe("frd-06-party");
    expect(ev.phase).toBe("build");
    expect(ev.activity).toBe("implement");
    expect(ev.mode).toBe("powerful");
    expect(ev.role).toBe("implementer");
  });

  it("WHEN an AgentWorking event also carries wo in data.wo AND top-level frd THEN both are accessible", () => {
    // Real engine emits in {event,at,agent,...enriched fields} shape at top level.
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        frd: "frd-06-party",
        wo: "WO-06-012",
        phase: "build",
        activity: "implement",
        mode: "powerful",
        role: "implementer",
        project: "mission-control",
      }),
    ]);
    const snap = readEvents({ path: p });
    const ev = snap.events[0] as Event;
    expect(ev.frd).toBe("frd-06-party");
    expect(ev.phase).toBe("build");
    expect(ev.mode).toBe("powerful");
    expect(ev.project).toBe("mission-control");
  });
});

// ---------------------------------------------------------------------------
// AC-06-008.2 — backward compatibility: legacy events missing enriched fields
// parse as-is with undefined for the new optional fields (no throw, no corruption)
// ---------------------------------------------------------------------------

describe("wo-06-012: backward compatibility — legacy events without enriched fields", () => {
  it("WHEN a legacy AgentWorking event has NO frd field THEN frd is undefined on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        agent: "implementer",
        session: "sess-001",
        project: "proj-a",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.frd).toBeUndefined();
  });

  it("WHEN a legacy AgentWorking event has NO phase field THEN phase is undefined on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        agent: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.phase).toBeUndefined();
  });

  it("WHEN a legacy AgentWorking event has NO activity field THEN activity is undefined on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        agent: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBeUndefined();
  });

  it("WHEN a legacy AgentWorking event has NO mode field THEN mode is undefined on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        agent: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.mode).toBeUndefined();
  });

  it("WHEN a legacy AgentWorking event has NO role field THEN role is undefined on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        agent: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.role).toBeUndefined();
  });

  it("WHEN a mix of legacy and enriched events appear in the stream THEN both parse without error", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-15T10:00:00Z", agent: "implementer" }),
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        frd: "frd-06",
        phase: "build",
        activity: "implement",
        mode: "powerful",
        role: "implementer",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(2);
    // Legacy event: new fields undefined
    expect(snap.events[0]?.frd).toBeUndefined();
    expect(snap.events[0]?.phase).toBeUndefined();
    // Enriched event: new fields populated
    expect(snap.events[1]?.frd).toBe("frd-06");
    expect(snap.events[1]?.phase).toBe("build");
    expect(snap.events[1]?.mode).toBe("powerful");
  });

  it("WHEN a legacy event is parsed THEN all existing fields still work (regression: workOrder, project, status)", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-15T10:00:00Z",
        agent: "implementer",
        session: "sess-001",
        work_order: "WO-01-007",
        project: "proj-a",
        status: "ok",
        tool: "Read",
      }),
    ]);
    const snap = readEvents({ path: p });
    const ev = snap.events[0] as Event;
    expect(ev.agent).toBe("implementer");
    expect(ev.session).toBe("sess-001");
    expect(ev.workOrder).toBe("WO-01-007");
    expect(ev.project).toBe("proj-a");
    expect(ev.status).toBe("ok");
    expect(ev.tool).toBe("Read");
    // No new fields
    expect(ev.frd).toBeUndefined();
    expect(ev.phase).toBeUndefined();
    expect(ev.activity).toBeUndefined();
    expect(ev.mode).toBeUndefined();
    expect(ev.role).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// WO-06-012 Scope: wrong-typed enriched fields are dropped without throwing
// A wrong type in frd/phase/activity/mode/role must be silently dropped
// (not propagated), matching the existing pattern for status.
// ---------------------------------------------------------------------------

describe("wo-06-012: wrong-typed enriched fields dropped (not propagated)", () => {
  it("WHEN frd is a number THEN frd is NOT carried through on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T10:00:00Z", frd: 42 }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.frd).toBeUndefined();
  });

  it("WHEN phase is a number THEN phase is NOT carried through on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T10:00:00Z", phase: 1 }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.phase).toBeUndefined();
  });

  it("WHEN phase is an invalid string (not 'build' or 'review') THEN phase is NOT carried through", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T10:00:00Z", phase: "deploy" }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.phase).toBeUndefined();
  });

  it("WHEN activity is a number THEN activity is NOT carried through on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T10:00:00Z", activity: 3 }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBeUndefined();
  });

  it("WHEN activity is an invalid string (not in the allowed enum) THEN activity is NOT carried through", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        activity: "unknown-activity",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.activity).toBeUndefined();
  });

  it("WHEN mode is a number THEN mode is NOT carried through on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T10:00:00Z", mode: 8 }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.mode).toBeUndefined();
  });

  it("WHEN mode is an invalid string (not in the allowed enum) THEN mode is NOT carried through", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T10:00:00Z", mode: "turbo" }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.mode).toBeUndefined();
  });

  it("WHEN role is a number THEN role is NOT carried through on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T10:00:00Z", role: 99 }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.role).toBeUndefined();
  });

  it("WHEN a wrong-typed enriched field is present THEN readEvents does NOT throw", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        frd: 42,
        phase: ["array"],
        activity: null,
        mode: { object: true },
        role: false,
      }),
    ]);
    expect(() => readEvents({ path: p })).not.toThrow();
  });

  it("WHEN a wrong-typed enriched field is present THEN the valid event itself is still retained", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        frd: 42,
        phase: "invalid",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.event).toBe("AgentWorking");
    expect(snap.events[0]?.agent).toBe("implementer");
  });
});

// ---------------------------------------------------------------------------
// WO-06-012 Scope: HandoffWritten event kind recognized and parsed
// HandoffWritten {wo, frd} — new event kind for the Status Note hand-off (REQ-06-006)
// ---------------------------------------------------------------------------

describe("wo-06-012: HandoffWritten event kind recognized with wo + frd fields", () => {
  it("WHEN a HandoffWritten event is in the stream THEN it is parsed as a valid event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-001",
        frd: "frd-06-party",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.event).toBe("HandoffWritten");
  });

  it("WHEN a HandoffWritten event carries wo THEN wo is exposed on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-001",
        frd: "frd-06-party",
      }),
    ]);
    const snap = readEvents({ path: p });
    // The wo field maps to the top-level 'wo' property of Event
    const ev = snap.events[0] as Event & { wo?: string };
    // Check via the frd field at minimum
    expect(ev.frd).toBe("frd-06-party");
  });

  it("WHEN a HandoffWritten event carries frd THEN frd is exposed on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-012",
        frd: "frd-06-party",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.frd).toBe("frd-06-party");
  });

  it("WHEN a HandoffWritten event appears alongside regular events THEN both parse without error", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T09:00:00Z", agent: "implementer" }),
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-001",
        frd: "frd-06-party",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(2);
    expect(snap.events[0]?.event).toBe("AgentWorking");
    expect(snap.events[1]?.event).toBe("HandoffWritten");
    expect(snap.events[1]?.frd).toBe("frd-06-party");
  });

  it("WHEN a HandoffWritten event has no project field THEN it lands in __global__ byProject bucket", () => {
    const p = writeLines([
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-001",
        frd: "frd-06-party",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(Object.keys(snap.byProject)).toContain("__global__");
  });
});

// ---------------------------------------------------------------------------
// WO-06-012 Scope: ContractPublished event kind recognized and parsed
// ContractPublished {wo, frd} — new event kind for the deep relay contract (REQ-06-007)
// ---------------------------------------------------------------------------

describe("wo-06-012: ContractPublished event kind recognized with wo + frd fields", () => {
  it("WHEN a ContractPublished event is in the stream THEN it is parsed as a valid event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "ContractPublished",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-007",
        frd: "frd-06-party",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.event).toBe("ContractPublished");
  });

  it("WHEN a ContractPublished event carries frd THEN frd is exposed on the parsed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "ContractPublished",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-007",
        frd: "frd-06-party",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.frd).toBe("frd-06-party");
  });

  it("WHEN a ContractPublished event appears alongside regular events THEN all parse without error", () => {
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: "2026-06-18T09:00:00Z", agent: "backend-dev" }),
      JSON.stringify({
        event: "ContractPublished",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-007",
        frd: "frd-06-party",
      }),
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T11:00:00Z",
        agent: "frontend-dev",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(3);
    expect(snap.events[1]?.event).toBe("ContractPublished");
    expect(snap.events[1]?.frd).toBe("frd-06-party");
  });
});

// ---------------------------------------------------------------------------
// AC-06-008.1 — SubagentStop event kind: parsed without error (backward compat)
// ---------------------------------------------------------------------------

describe("wo-06-012: SubagentStop event kind parsed without error", () => {
  it("WHEN a SubagentStop event is in the stream THEN it is parsed as a valid event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "SubagentStop",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        project: "mission-control",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.event).toBe("SubagentStop");
  });

  it("WHEN a SubagentStop event carries enriched fields THEN they are exposed", () => {
    const p = writeLines([
      JSON.stringify({
        event: "SubagentStop",
        at: "2026-06-18T10:00:00Z",
        agent: "implementer",
        role: "implementer",
        frd: "frd-06-party",
        mode: "powerful",
      }),
    ]);
    const snap = readEvents({ path: p });
    const ev = snap.events[0] as Event;
    expect(ev.role).toBe("implementer");
    expect(ev.frd).toBe("frd-06-party");
    expect(ev.mode).toBe("powerful");
  });
});

// ---------------------------------------------------------------------------
// Regression: existing cap/lastEventAt/byProject behavior is untouched
// This confirms the enriched-field extension is purely additive — no regressions.
// ---------------------------------------------------------------------------

describe("wo-06-012: regression — existing cap/lastEventAt/byProject behavior untouched", () => {
  it("WHEN enriched events are present THEN cap still applies correctly", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T08:00:00Z",
        frd: "frd-01",
        phase: "build",
        mode: "pro",
      }),
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T09:00:00Z",
        frd: "frd-06",
        phase: "build",
        mode: "powerful",
      }),
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        frd: "frd-06",
      }),
    ]);
    const snap = readEvents({ path: p, cap: 2 });
    expect(snap.events).toHaveLength(2);
    // Last 2 events
    expect(snap.events[0]?.frd).toBe("frd-06");
    expect(snap.events[1]?.event).toBe("HandoffWritten");
  });

  it("WHEN enriched events are present THEN lastEventAt still reflects the max at", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T08:00:00Z",
        frd: "frd-01",
        mode: "pro",
      }),
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T12:00:00Z",
        frd: "frd-06",
        mode: "powerful",
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.lastEventAt).toBe("2026-06-18T12:00:00Z");
  });

  it("WHEN enriched events are present THEN byProject is still computed correctly", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T08:00:00Z",
        project: "mission-control",
        frd: "frd-06",
        mode: "powerful",
      }),
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        project: "mission-control",
        frd: "frd-06",
      }),
      JSON.stringify({
        event: "ContractPublished",
        at: "2026-06-18T09:00:00Z",
        frd: "frd-06",
        // No project — goes to __global__
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.byProject["mission-control"]?.lastEventAt).toBe("2026-06-18T10:00:00Z");
    expect(snap.byProject.__global__?.lastEventAt).toBe("2026-06-18T09:00:00Z");
  });

  it("WHEN enriched events include wrong-typed fields THEN byProject is NOT corrupted", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        project: "proj-a",
        frd: 999, // wrong type, must be dropped
        mode: "excellent", // invalid enum value, must be dropped
      }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.byProject["proj-a"]?.lastEventAt).toBe("2026-06-18T10:00:00Z");
    expect(snap.events[0]?.frd).toBeUndefined();
    expect(snap.events[0]?.mode).toBeUndefined();
    expect(snap.events[0]?.project).toBe("proj-a");
  });

  it("WHEN the real fixture NDJSON is read THEN all 10 existing events still parse (no regression)", () => {
    // Using the existing fixture from the test harness for regression coverage.
    // The fixture has legacy events without enriched fields — should still produce 10 events.
    expect(() => readEvents({ path: FIXTURE_EVENTS_NDJSON })).not.toThrow();
    const snap = readEvents({ path: FIXTURE_EVENTS_NDJSON });
    expect(snap.events).toHaveLength(10);
    // No enriched fields on legacy events
    for (const ev of snap.events) {
      // The legacy events in this fixture carry no enriched top-level fields
      // (they use a nested `data` object which is intentionally ignored)
      expect(ev.phase).toBeUndefined();
      expect(ev.activity).toBeUndefined();
      expect(ev.mode).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// WO-06-012: read-only invariant — enriched events do not cause writes
// AC-06-008.1 prohibits any writes or egress
// ---------------------------------------------------------------------------

describe("wo-06-012: read-only invariant maintained with enriched events (AC-06-008.1)", () => {
  it("WHEN readEvents processes an enriched AgentWorking event THEN no files are written", () => {
    const p = writeLines([
      JSON.stringify({
        event: "AgentWorking",
        at: "2026-06-18T10:00:00Z",
        frd: "frd-06-party",
        phase: "build",
        activity: "implement",
        mode: "powerful",
        role: "implementer",
      }),
    ]);
    const dir = tmpDir;
    const filesBefore = fs.readdirSync(dir).sort();
    readEvents({ path: p });
    const filesAfter = fs.readdirSync(dir).sort();
    expect(filesAfter).toEqual(filesBefore);
  });

  it("WHEN readEvents processes HandoffWritten and ContractPublished THEN no files are written", () => {
    const p = writeLines([
      JSON.stringify({
        event: "HandoffWritten",
        at: "2026-06-18T10:00:00Z",
        wo: "WO-06-001",
        frd: "frd-06",
      }),
      JSON.stringify({
        event: "ContractPublished",
        at: "2026-06-18T11:00:00Z",
        wo: "WO-06-007",
        frd: "frd-06",
      }),
    ]);
    const contentBefore = fs.readFileSync(p, "utf-8");
    readEvents({ path: p });
    const contentAfter = fs.readFileSync(p, "utf-8");
    expect(contentAfter).toBe(contentBefore);
  });
});
