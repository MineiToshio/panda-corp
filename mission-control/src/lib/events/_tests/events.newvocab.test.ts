/**
 * events — new engine vocabulary field parsing (2026-07-07) + bounded tail read.
 *
 * Pins:
 *   - the new top-level fields (stage/outcome/pass/routes/failed/attempt + the
 *     wo_reopen reopen_count → reopenCount) parse from BOTH the nested `data`
 *     object and the top level, with per-field type tolerance;
 *   - readEvents tails only the last window of a large file (stream hygiene) and
 *     drops the leading partial line instead of feeding truncated JSON in.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEvents } from "../events";

// ---------------------------------------------------------------------------
// New field parsing (top-level + nested `data`)
// ---------------------------------------------------------------------------

describe("readEvents — new engine vocabulary fields", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-events-vocab-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNdjson(lines: object[]): string {
    const file = path.join(tmpDir, "events.ndjson");
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
    return file;
  }

  it("parses wo_reopen top-level fields (wo→workOrder, reason, reopen_count→reopenCount, frd)", () => {
    const file = writeNdjson([
      {
        event: "wo_reopen",
        at: "2026-07-07T10:00:00Z",
        frd: "frd-03-x",
        wo: "WO-03-001",
        reason: "gate-reopen",
        reopen_count: 2,
      },
    ]);
    const [ev] = readEvents({ path: file }).events;
    expect(ev?.event).toBe("wo_reopen");
    expect(ev?.workOrder).toBe("WO-03-001");
    expect(ev?.frd).toBe("frd-03-x");
    expect(ev?.reason).toBe("gate-reopen");
    expect(ev?.reopenCount).toBe(2);
  });

  it("parses PreviewSmoke top-level fields (pass boolean + routes/failed numbers)", () => {
    const file = writeNdjson([
      {
        event: "PreviewSmoke",
        at: "2026-07-07T10:00:01Z",
        frd: "frd-04-y",
        pass: false,
        routes: 5,
        failed: 2,
      },
    ]);
    const [ev] = readEvents({ path: file }).events;
    expect(ev?.pass).toBe(false);
    expect(ev?.routes).toBe(5);
    expect(ev?.failed).toBe(2);
  });

  it("parses Hardening (stage) + PatchResult (outcome) + gate (attempt)", () => {
    const file = writeNdjson([
      { event: "Hardening", at: "2026-07-07T10:00:02Z", stage: "security", status: "ok" },
      {
        event: "PatchResult",
        at: "2026-07-07T10:00:03Z",
        frd: "frd-05-z",
        outcome: "gate-test-defective",
      },
      { event: "gate", at: "2026-07-07T10:00:04Z", frd: "frd-05-z", wos: "3/3", attempt: 2 },
    ]);
    const { events } = readEvents({ path: file });
    expect(events[0]?.stage).toBe("security");
    expect(events[0]?.status).toBe("ok");
    expect(events[1]?.outcome).toBe("gate-test-defective");
    expect(events[2]?.attempt).toBe(2);
  });

  it("still reads the new fields when nested under `data` (real emitter shape)", () => {
    const file = writeNdjson([
      { event: "PreviewSmoke", at: "2026-07-07T10:00:05Z", data: { pass: true, routes: 8 } },
    ]);
    const [ev] = readEvents({ path: file }).events;
    expect(ev?.pass).toBe(true);
    expect(ev?.routes).toBe(8);
  });

  it("drops a wrong-typed new field without dropping the event", () => {
    const file = writeNdjson([
      { event: "PreviewSmoke", at: "2026-07-07T10:00:06Z", pass: "yes", routes: "many" },
    ]);
    const [ev] = readEvents({ path: file }).events;
    expect(ev?.event).toBe("PreviewSmoke");
    expect(ev?.pass).toBeUndefined();
    expect(ev?.routes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Bounded tail read (stream hygiene)
// ---------------------------------------------------------------------------

describe("readEvents — bounded tail read (256 KB window)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-events-tail-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("tails only the last window of a >256 KB file, dropping the oldest events", () => {
    const file = path.join(tmpDir, "big.ndjson");
    // Pad each line past ~300 bytes so a few thousand lines exceed 256 KB.
    const pad = "x".repeat(300);
    const lines: string[] = [];
    const total = 4000;
    for (let i = 0; i < total; i++) {
      lines.push(
        JSON.stringify({ event: "AgentWorking", at: `2026-07-07T10:00:${i}Z`, task: `#${i}`, pad }),
      );
    }
    fs.writeFileSync(file, lines.join("\n"));
    expect(fs.statSync(file).size).toBeGreaterThan(256 * 1024);

    const snap = readEvents({ path: file, cap: 100000 });
    // Not empty, and the OLDEST event (task #0) fell outside the 256 KB window.
    expect(snap.events.length).toBeGreaterThan(0);
    expect(snap.events.some((e) => e.task === "#0")).toBe(false);
    // The freshest event is retained and drives lastEventAt.
    const last = snap.events[snap.events.length - 1];
    expect(last?.task).toBe(`#${total - 1}`);
    // Every retained line parsed cleanly (the leading partial line was dropped).
    for (const e of snap.events) {
      expect(e.event).toBe("AgentWorking");
    }
  });

  it("reads a small file whole (under the window)", () => {
    const file = path.join(tmpDir, "small.ndjson");
    fs.writeFileSync(
      file,
      [
        JSON.stringify({ event: "BuildLaunch", at: "2026-07-07T10:00:00Z", task: "#0" }),
        JSON.stringify({ event: "BuildComplete", at: "2026-07-07T10:00:01Z", task: "#1" }),
      ].join("\n"),
    );
    const snap = readEvents({ path: file });
    expect(snap.events).toHaveLength(2);
    expect(snap.events[0]?.task).toBe("#0");
  });
});
