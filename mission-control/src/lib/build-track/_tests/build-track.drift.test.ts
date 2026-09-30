/**
 * readBuildTimeline attaches each FRD's `drift:` frontmatter result (FRD-12 AC-12-003.3, DR-115):
 * the timeline derives it from the ONE reader (`readFrdDrift`), in every timeline source mode.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { readBuildTimeline } from "../build-track";

let project: string;

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), "mc-build-track-drift-"));
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

function writeFrd(frd: string, frontmatterExtra: string): void {
  const dir = path.join(project, "docs", "frds", frd);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "frd.md"),
    `---\nid: ${frd}\nimplementation_status: VERIFIED\n${frontmatterExtra}---\n# ${frd}\n`,
  );
}

function order(frd: string, id: string): WorkOrder {
  return {
    id,
    title: id,
    frd,
    state: "done",
    relPath: `docs/frds/${frd}/work-orders/${id.toLowerCase()}.md`,
  };
}

describe("readBuildTimeline: per-FRD drift from the FRD frontmatter", () => {
  it("structural mode: a FRD with drift carries its ids, one without carries an empty list", () => {
    writeFrd("frd-02-ideas-board", "drift: [AC-02-010.4, REQ-03-001]\n");
    writeFrd("frd-03-portfolio", "");
    const tl = readBuildTimeline(project, [
      order("frd-02-ideas-board", "WO-02-001"),
      order("frd-03-portfolio", "WO-03-001"),
    ]);
    expect(tl.source).toBe("structural");
    const byId = new Map(tl.frds.map((f) => [f.id, f.drift]));
    expect(byId.get("frd-02-ideas-board")).toEqual({
      ok: true,
      ids: ["AC-02-010.4", "REQ-03-001"],
    });
    expect(byId.get("frd-03-portfolio")).toEqual({ ok: true, ids: [] });
  });

  it("track mode: the drift result rides along with the real-duration timeline", () => {
    writeFrd("frd-02-ideas-board", "drift: [AC-02-010.4]\n");
    const dir = path.join(project, ".pandacorp");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "track.jsonl"),
      `${JSON.stringify({
        kind: "wo_start",
        frd: "frd-02-ideas-board",
        wo: "WO-02-001",
        at: "2026-09-30T10:00:00Z",
      })}\n${JSON.stringify({
        kind: "wo_end",
        frd: "frd-02-ideas-board",
        wo: "WO-02-001",
        state: "verified",
        at: "2026-09-30T10:10:00Z",
      })}\n`,
    );
    const tl = readBuildTimeline(project, [order("frd-02-ideas-board", "WO-02-001")]);
    expect(tl.source).toBe("track");
    expect(tl.frds[0]?.drift).toEqual({ ok: true, ids: ["AC-02-010.4"] });
  });

  it("a malformed drift value surfaces as an explicit failure on that FRD, never an empty list", () => {
    writeFrd("frd-02-ideas-board", "drift: nope\n");
    const tl = readBuildTimeline(project, [order("frd-02-ideas-board", "WO-02-001")]);
    expect(tl.frds[0]?.drift).toMatchObject({ ok: false, reason: "malformed" });
  });

  it("a FRD folder without frd.md is 'missing', not 'no drift'", () => {
    const tl = readBuildTimeline(project, [order("frd-05-work-orders", "WO-05-001")]);
    expect(tl.frds[0]?.drift).toEqual({ ok: false, reason: "missing" });
  });
});
