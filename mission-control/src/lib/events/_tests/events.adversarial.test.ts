/**
 * WO-01-007 — `readEvents` ADVERSARIAL tests (reviewer, DR-015).
 *
 * Written by the reviewer (Opus 4.8, different model from the implementer) to probe
 * edge cases, abuse and boundaries the implementer's own suite did NOT cover.
 * Derived from the WO-01-007 contract + architecture §5 + the FREEZE-ON-RED / B1'
 * incidents in .pandacorp/comms/progress.md — NOT copied from lib/events.test.ts.
 *
 * Traceability: AC-01-008.1 (REQ-01-008), read-only invariant (REQ-01-011).
 *
 * Stack: Vitest (TypeScript). Tested against temp NDJSON files, no mocks.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Event, type EventsSnapshot, readEvents } from "../events";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-events-adv-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Write NDJSON to the per-test temp dir; `raw` is written verbatim (no auto newline). */
function writeRaw(raw: string): string {
  const filePath = path.join(tmpDir, "dashboard-events.ndjson");
  fs.writeFileSync(filePath, raw, "utf-8");
  return filePath;
}

/** Convenience: join lines with "\n" + trailing newline (the common producer shape). */
function writeLines(lines: string[]): string {
  return writeRaw(`${lines.join("\n")}\n`);
}

// ---------------------------------------------------------------------------
// CRLF line endings — a Windows producer (or copy/paste) writes "\r\n".
// split("\n") leaves a trailing "\r"; JSON.parse tolerates leading/trailing WS
// only via trim(). If the impl does NOT trim, every line is malformed.
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — CRLF line endings", () => {
  it("WHEN lines end with \\r\\n THEN valid events are still parsed (trailing CR tolerated)", () => {
    const p = writeRaw(
      `${JSON.stringify({ event: "A", at: "2026-06-15T10:00:00Z", project: "x" })}\r\n${JSON.stringify(
        { event: "B", at: "2026-06-15T10:01:00Z", project: "x" },
      )}\r\n`,
    );
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(2);
    expect(snap.byProject.x?.lastEventAt).toBe("2026-06-15T10:01:00Z");
  });
});

// ---------------------------------------------------------------------------
// `status` field validation — contract restricts it to "ok" | "fail".
// An out-of-enum status must NOT be carried through onto the typed event.
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — status enum is fenced", () => {
  it("WHEN status is an out-of-enum string ('pending') THEN it is dropped, not carried through", () => {
    const p = writeLines([
      JSON.stringify({ event: "X", at: "2026-06-15T10:00:00Z", status: "pending" }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.status).toBeUndefined();
  });

  it("WHEN status is a non-string (number) THEN it is dropped", () => {
    const p = writeLines([JSON.stringify({ event: "X", at: "2026-06-15T10:00:00Z", status: 1 })]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.status).toBeUndefined();
  });

  it("WHEN status is exactly 'fail' THEN it survives", () => {
    const p = writeLines([
      JSON.stringify({ event: "X", at: "2026-06-15T10:00:00Z", status: "fail" }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events[0]?.status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// Wrong-type required fields. The impl requires `event` AND `at` to be strings.
// A numeric `at` or numeric `event` must skip the line (not coerce).
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — required fields must be strings, not coerced", () => {
  it("WHEN `at` is a number THEN the line is skipped (no coercion to string)", () => {
    const p = writeLines([
      JSON.stringify({ event: "Good", at: "2026-06-15T10:00:00Z" }),
      JSON.stringify({ event: "BadAt", at: 1718445600000 }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.event).toBe("Good");
  });

  it("WHEN `event` is a number THEN the line is skipped", () => {
    const p = writeLines([JSON.stringify({ event: 42, at: "2026-06-15T10:00:00Z" })]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(0);
  });

  it("WHEN `project` is a non-string (number) THEN the event survives but lands in __global__", () => {
    // project is optional; a wrong-typed project must not be honored as a bucket key.
    const p = writeLines([
      JSON.stringify({ event: "X", at: "2026-06-15T10:00:00Z", project: 123 }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(1);
    expect(Object.keys(snap.byProject)).toEqual(["__global__"]);
  });
});

// ---------------------------------------------------------------------------
// Cap as a float — the contract says "Maximum number of events". A float cap
// must be truncated (Math.trunc), not used raw into slice (which would coerce).
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — float cap truncation", () => {
  it("WHEN cap is 2.9 THEN exactly 2 events are returned (trunc, not round)", () => {
    const p = writeLines(
      Array.from({ length: 5 }, (_, i) =>
        JSON.stringify({ event: "E", at: `2026-06-15T10:0${i}:00Z` }),
      ),
    );
    const snap = readEvents({ path: p, cap: 2.9 });
    expect(snap.events).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CAP ↔ byProject interaction. This is the subtlest contract point: the cap is
// applied FIRST (tail), and lastEventAt / byProject are derived from the
// RETAINED slice only. A project whose only events were dropped by the cap must
// NOT appear in byProject. (Pins the documented behavior; a regression that
// derived byProject over ALL lines would break this.)
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — cap is applied before byProject derivation", () => {
  it("WHEN cap=1 drops an older project's only event THEN that project is absent from byProject", () => {
    const p = writeLines([
      JSON.stringify({ event: "Old", at: "2026-06-15T08:00:00Z", project: "dropped" }),
      JSON.stringify({ event: "New", at: "2026-06-15T09:00:00Z", project: "kept" }),
    ]);
    const snap = readEvents({ path: p, cap: 1 });
    expect(snap.events).toHaveLength(1);
    expect(Object.keys(snap.byProject)).toEqual(["kept"]);
    expect(snap.byProject.dropped).toBeUndefined();
  });

  it("WHEN cap drops the globally-latest event THEN lastEventAt reflects only retained events", () => {
    // Tail = last `cap` lines by FILE ORDER, not by timestamp. If the file is
    // out of chronological order, the retained slice may exclude the max `at`.
    const p = writeLines([
      JSON.stringify({ event: "LateTimestampEarlyLine", at: "2026-06-20T00:00:00Z" }),
      JSON.stringify({ event: "EarlyTimestampLateLine", at: "2026-06-15T00:00:00Z" }),
    ]);
    const snap = readEvents({ path: p, cap: 1 });
    // Only the LAST line is retained; its `at` is the only candidate for max.
    expect(snap.events).toHaveLength(1);
    expect(snap.lastEventAt).toBe("2026-06-15T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// `__global__` key collision. If a real event legitimately carries
// project: "__global__", it must merge with the project-less bucket (the impl
// uses the literal string as the sentinel). Pin the behavior so a future change
// of sentinel is a conscious decision, not silent data loss.
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — __global__ sentinel collision", () => {
  it("WHEN an event has project='__global__' AND project-less events exist THEN they share the bucket (latest wins)", () => {
    const p = writeLines([
      JSON.stringify({ event: "NoProject", at: "2026-06-15T10:00:00Z" }),
      JSON.stringify({ event: "LiteralGlobal", at: "2026-06-15T11:00:00Z", project: "__global__" }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.byProject.__global__?.lastEventAt).toBe("2026-06-15T11:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// Duplicate / tied `at`. The byProject and lastEventAt reducers use strict `>`,
// so the FIRST occurrence wins ties — but the value is identical, so the
// observable result must still be that exact timestamp (no null, no throw).
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — tied timestamps", () => {
  it("WHEN two events share the same `at` THEN lastEventAt is that timestamp (ties resolved deterministically)", () => {
    const p = writeLines([
      JSON.stringify({ event: "A", at: "2026-06-15T10:00:00Z", project: "p" }),
      JSON.stringify({ event: "B", at: "2026-06-15T10:00:00Z", project: "p" }),
    ]);
    const snap = readEvents({ path: p });
    expect(snap.lastEventAt).toBe("2026-06-15T10:00:00Z");
    expect(snap.byProject.p?.lastEventAt).toBe("2026-06-15T10:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// Blank lines interleaved (common when a producer appends with extra "\n").
// Empty / whitespace-only lines must be skipped without affecting the count.
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — interleaved blank lines", () => {
  it("WHEN blank and whitespace-only lines separate valid events THEN only real events are counted", () => {
    const p = writeRaw(
      `${JSON.stringify({ event: "A", at: "2026-06-15T10:00:00Z" })}\n\n   \n\t\n${JSON.stringify({
        event: "B",
        at: "2026-06-15T10:01:00Z",
      })}\n`,
    );
    const snap = readEvents({ path: p });
    expect(snap.events).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant — stronger than the mtime check: assert the file CONTENT
// is byte-identical after readEvents (catches a truncate/rewrite that preserves
// dir mtime). REQ-01-011.
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — content is never mutated (REQ-01-011)", () => {
  it("WHEN readEvents runs THEN the source file bytes are unchanged", () => {
    const raw = `${JSON.stringify({ event: "A", at: "2026-06-15T10:00:00Z" })}\n`;
    const p = writeRaw(raw);
    readEvents({ path: p });
    readEvents({ path: p, cap: 1 });
    expect(fs.readFileSync(p, "utf-8")).toBe(raw);
  });
});

// ---------------------------------------------------------------------------
// Type-shape guard: events array entries must not leak unexpected snake_case
// keys, and the returned object must be a fresh value (not a shared frozen
// EMPTY_SNAPSHOT that callers could accidentally mutate across calls).
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — empty snapshots are independent objects", () => {
  it("WHEN two missing-file calls return empty snapshots THEN their byProject objects are NOT the same reference", () => {
    const a = readEvents({ path: "/no/such/a.ndjson" });
    const b = readEvents({ path: "/no/such/b.ndjson" });
    // Mutating one must not affect the other (no shared module-level object).
    (a.byProject as Record<string, { lastEventAt: string }>).x = { lastEventAt: "z" };
    expect(b.byProject).toEqual({});
  });

  it("WHEN a valid event carries extra unknown keys THEN they do not appear on the typed event", () => {
    const p = writeLines([
      JSON.stringify({
        event: "A",
        at: "2026-06-15T10:00:00Z",
        unexpected_field: "leak",
        data: { nested: true },
      }),
    ]);
    const snap = readEvents({ path: p });
    const ev = snap.events[0] as Event & Record<string, unknown>;
    expect(ev.unexpected_field).toBeUndefined();
    expect(ev.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sanity: the exported types are usable at the boundary (compile-time proof that
// the contract surface in WO-01-007 is exported, not just structurally present).
// ---------------------------------------------------------------------------

describe("adversarial: readEvents — exported contract surface", () => {
  it("WHEN typed as EventsSnapshot THEN events/lastEventAt/byProject are assignable", () => {
    const snap: EventsSnapshot = readEvents({ path: "/no/such/file.ndjson" });
    const events: Event[] = snap.events;
    const last: string | null = snap.lastEventAt;
    expect(events).toEqual([]);
    expect(last).toBeNull();
  });
});
