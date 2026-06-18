/**
 * FRD-06 — Party · La Fragua — REVIEWER adversarial integration test.
 *
 * Reviewer (Opus, different model from the implementers) — exercises the work
 * orders TOGETHER against the REAL event-stream shape the plugin actually emits,
 * which the implementers did NOT test (they built against a flat fixture).
 *
 * THE REAL SHAPE (verified on ~/.claude/dashboard-events.ndjson and in the
 * plugin emitter `plugin/templates/shared/.claude/workflows/pandacorp-build.js`):
 *
 *   {"event":"AgentWorking","at":"...","project":"mission-control",
 *    "data":{"role":"implementer","wo":"WO-06-011","frd":"frd-06-party",
 *            "phase":"build","activity":"implement","mode":"powerful"}}
 *
 * The enriched fields (role, wo, frd, phase, activity, mode) live NESTED under
 * `data`, NOT at the top level. REQ-06-008 / AC-06-008.1 requires the system to
 * "feed off AgentWorking events carrying {role, wo, frd, phase, activity, mode}".
 *
 * These tests run the full read→derive path (lib/events.readEvents →
 * toFraguaSnapshot) the same way the RSC PartyTab does, against the real shape.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEvents } from "@/lib/events/events";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd06-reviewer-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeLines(lines: string[]): string {
  const filePath = path.join(tmpDir, "dashboard-events.ndjson");
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
  return filePath;
}

/** A line in the EXACT shape the real plugin/emitter writes (nested `data`). */
function realAgentWorking(wo: string, at: string, mode = "powerful"): string {
  return JSON.stringify({
    event: "AgentWorking",
    at,
    project: "mission-control",
    data: {
      role: "implementer",
      wo,
      frd: "frd-06-party",
      phase: "build",
      activity: "implement",
      mode,
    },
  });
}

describe("frd-06 [reviewer]: real nested-data event shape (AC-06-008.1)", () => {
  it("parses the FRD id from the real `data.frd` field so the scene activates", () => {
    const p = writeLines([
      realAgentWorking("WO-06-001", "2026-06-18T10:00:00Z"),
      realAgentWorking("WO-06-002", "2026-06-18T10:05:00Z"),
    ]);

    const { events, lastEventAt } = readEvents({ path: p });
    const snap = toFraguaSnapshot(events, { lastEventAt });

    // REQ-06-008/REQ-06-010: with a live FRD in build, the scene must be active —
    // not the empty state. This is the end-to-end contract PartyTab relies on.
    expect(snap.active).toBe(true);
    expect(snap.frd?.id).toBe("frd-06-party");
  });

  it("registers running WOs from the real `data.wo` field (AC-06-001.1)", () => {
    const p = writeLines([
      realAgentWorking("WO-06-001", "2026-06-18T10:00:00Z"),
      realAgentWorking("WO-06-002", "2026-06-18T10:05:00Z"),
    ]);

    const { events, lastEventAt } = readEvents({ path: p });
    const snap = toFraguaSnapshot(events, { lastEventAt });

    const runningIds = snap.running.map((r) => r.wo).sort();
    expect(runningIds).toEqual(["WO-06-001", "WO-06-002"]);
  });

  it("reads the run mode from the real `data.mode` field (AC-06-009.1)", () => {
    const p = writeLines([realAgentWorking("WO-06-001", "2026-06-18T10:00:00Z", "deep")]);

    const { events, lastEventAt } = readEvents({ path: p });
    const snap = toFraguaSnapshot(events, { lastEventAt });

    expect(snap.mode).toBe("deep");
    expect(snap.wave).toBe(6);
  });
});
