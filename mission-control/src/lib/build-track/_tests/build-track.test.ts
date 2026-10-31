/**
 * Observability Timeline v2 — build-track reader tests.
 *
 * Drives readBuildTimeline against a real temp project dir with a fixture
 * `.pandacorp/track.jsonl`, asserting:
 *   (a) track present → durations + FRD grouping + review + keep-last-attempt
 *   (b) a WO with wo_start and no wo_end → in_progress
 *   (c) no track + orders → source "structural", hasDurations false
 *   (d) nothing → source "empty"
 *   (e) malformed lines are skipped, never throw
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listWorkOrders, type WorkOrder } from "@/lib/work-orders/work-orders";
import { deriveGitTimeline, readBuildTimeline } from "../build-track";

// ---------------------------------------------------------------------------
// Temp-dir fixture helpers
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-build-track-"));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

/** Write a `.pandacorp/track.jsonl` under tmpRoot from raw line strings. */
function writeTrack(lines: readonly string[]): string {
  const dir = path.join(tmpRoot, ".pandacorp");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "track.jsonl"), `${lines.join("\n")}\n`, "utf-8");
  return tmpRoot;
}

/** Serialize a track line object to JSON. */
function line(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

/** Build a WorkOrder with sensible defaults. */
function makeOrder(over: Partial<WorkOrder> & Pick<WorkOrder, "id" | "frd">): WorkOrder {
  return {
    id: over.id,
    title: over.title ?? over.id,
    frd: over.frd,
    state: over.state ?? "todo",
    relPath: over.relPath ?? `docs/frds/${over.frd}/work-orders/${over.id.toLowerCase()}.md`,
  };
}

// ---------------------------------------------------------------------------
// (a) Track present → durations + grouping + review + keep-last-attempt
// ---------------------------------------------------------------------------

describe("readBuildTimeline — track present", () => {
  it("derives real durations, groups by FRD, reads the review, keeps the last attempt", () => {
    const projectPath = writeTrack([
      // WO-01-001 — first attempt fails, then reopened and verified (keep the 2nd, attempts=2)
      line({
        kind: "wo_start",
        frd: "frd-01-data-reading",
        wo: "WO-01-001",
        at: "2026-06-23T10:00:00Z",
      }),
      line({
        kind: "wo_end",
        frd: "frd-01-data-reading",
        wo: "WO-01-001",
        state: "failed",
        at: "2026-06-23T10:05:00Z",
      }),
      line({
        kind: "wo_start",
        frd: "frd-01-data-reading",
        wo: "WO-01-001",
        at: "2026-06-23T10:10:00Z",
      }),
      line({
        kind: "wo_end",
        frd: "frd-01-data-reading",
        wo: "WO-01-001",
        state: "verified",
        at: "2026-06-23T10:22:00Z",
      }),
      // Review for the FRD
      line({ kind: "review_start", frd: "frd-01-data-reading", at: "2026-06-23T10:30:00Z" }),
      line({
        kind: "review_end",
        frd: "frd-01-data-reading",
        verdict: "pass",
        at: "2026-06-23T10:40:00Z",
      }),
      line({ kind: "frd_end", frd: "frd-01-data-reading", at: "2026-06-23T10:40:05Z" }),
      // A second FRD with one verified WO (starts later)
      line({ kind: "wo_start", frd: "frd-02-debts", wo: "WO-02-001", at: "2026-06-23T11:00:00Z" }),
      line({
        kind: "wo_end",
        frd: "frd-02-debts",
        wo: "WO-02-001",
        state: "verified",
        at: "2026-06-23T11:08:00Z",
      }),
    ]);

    const orders: WorkOrder[] = [
      makeOrder({
        id: "WO-01-001",
        frd: "frd-01-data-reading",
        title: "Esquema de datos",
        state: "done",
      }),
      makeOrder({
        id: "WO-02-001",
        frd: "frd-02-debts",
        title: "Cálculo de deudas",
        state: "done",
      }),
    ];

    const tl = readBuildTimeline(projectPath, orders);

    expect(tl.source).toBe("track");
    expect(tl.hasDurations).toBe(true);
    // buildStartMs derives from the KEPT (last) attempt's start (10:10), not the
    // discarded first attempt (10:00) — keep-last-attempt governs the WO's start.
    expect(tl.buildStartMs).toBe(Date.parse("2026-06-23T10:10:00Z"));

    // FRDs ordered by start: frd-01 first.
    expect(tl.frds.map((f) => f.id)).toEqual(["frd-01-data-reading", "frd-02-debts"]);

    const frd1 = tl.frds[0];
    expect(frd1?.label).toBe("FRD-01");
    expect(frd1?.state).toBe("done");

    const wo = frd1?.workOrders[0];
    expect(wo?.id).toBe("WO-01-001");
    expect(wo?.title).toBe("Esquema de datos");
    // keep-last-attempt: start = 10:10, end = 10:22 → 12 min; attempts = 2
    expect(wo?.attempts).toBe(2);
    expect(wo?.startMs).toBe(Date.parse("2026-06-23T10:10:00Z"));
    expect(wo?.endMs).toBe(Date.parse("2026-06-23T10:22:00Z"));
    expect(wo?.durationMin).toBe(12);
    expect(wo?.state).toBe("done");

    // Review parsed.
    expect(frd1?.review?.verdict).toBe("pass");
    expect(frd1?.review?.durationMin).toBe(10);

    // FRD end is the frd_end timestamp.
    expect(frd1?.endMs).toBe(Date.parse("2026-06-23T10:40:05Z"));
  });

  it("keeps the FRD-level start at the earliest WO across attempts", () => {
    const projectPath = writeTrack([
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-002", at: "2026-06-23T09:00:00Z" }),
      line({
        kind: "wo_end",
        frd: "frd-01-x",
        wo: "WO-01-002",
        state: "verified",
        at: "2026-06-23T09:06:00Z",
      }),
    ]);
    const tl = readBuildTimeline(projectPath, []);
    expect(tl.frds[0]?.startMs).toBe(Date.parse("2026-06-23T09:00:00Z"));
    // No matching order → title falls back to the id.
    expect(tl.frds[0]?.workOrders[0]?.title).toBe("WO-01-002");
  });
});

// ---------------------------------------------------------------------------
// (b) wo_start with no wo_end → in_progress
// ---------------------------------------------------------------------------

describe("readBuildTimeline — open work order", () => {
  it("marks a WO with a start but no end as in_progress, duration null", () => {
    const projectPath = writeTrack([
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-001", at: "2026-06-23T10:00:00Z" }),
    ]);
    const tl = readBuildTimeline(projectPath, []);
    const wo = tl.frds[0]?.workOrders[0];
    expect(wo?.state).toBe("in_progress");
    expect(wo?.startMs).toBe(Date.parse("2026-06-23T10:00:00Z"));
    expect(wo?.endMs).toBeNull();
    expect(wo?.durationMin).toBeNull();
    expect(tl.frds[0]?.state).toBe("in_progress");
  });

  it("a reopened WO whose latest attempt has no end is in_progress (last attempt wins)", () => {
    const projectPath = writeTrack([
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-001", at: "2026-06-23T10:00:00Z" }),
      line({
        kind: "wo_end",
        frd: "frd-01-x",
        wo: "WO-01-001",
        state: "verified",
        at: "2026-06-23T10:05:00Z",
      }),
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-001", at: "2026-06-23T10:10:00Z" }),
    ]);
    const tl = readBuildTimeline(projectPath, []);
    const wo = tl.frds[0]?.workOrders[0];
    expect(wo?.attempts).toBe(2);
    expect(wo?.state).toBe("in_progress");
    expect(wo?.endMs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (c) No track + orders → structural
// ---------------------------------------------------------------------------

describe("readBuildTimeline — structural fallback", () => {
  it("falls back to the work-order list with no durations", () => {
    const orders: WorkOrder[] = [
      makeOrder({ id: "WO-02-001", frd: "frd-02-debts", state: "todo" }),
      makeOrder({ id: "WO-01-001", frd: "frd-01-data-reading", state: "done" }),
      makeOrder({ id: "WO-01-002", frd: "frd-01-data-reading", state: "fail" }),
    ];
    // tmpRoot exists but has no track file.
    const tl = readBuildTimeline(tmpRoot, orders);

    expect(tl.source).toBe("structural");
    expect(tl.hasDurations).toBe(false);
    expect(tl.buildStartMs).toBeNull();

    // FRDs ordered by id.
    expect(tl.frds.map((f) => f.id)).toEqual(["frd-01-data-reading", "frd-02-debts"]);
    const frd1 = tl.frds[0];
    expect(frd1?.workOrders.map((w) => w.id)).toEqual(["WO-01-001", "WO-01-002"]);
    expect(frd1?.state).toBe("fail"); // a fail among done → fail
    for (const wo of frd1?.workOrders ?? []) {
      expect(wo.startMs).toBeNull();
      expect(wo.durationMin).toBeNull();
      expect(wo.attempts).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// (d) Nothing → empty
// ---------------------------------------------------------------------------

describe("readBuildTimeline — empty", () => {
  it("returns the empty timeline when there is no track and no orders", () => {
    const tl = readBuildTimeline(tmpRoot, []);
    expect(tl).toEqual({
      frds: [],
      hasDurations: false,
      source: "empty",
      buildStartMs: null,
    });
  });

  it("returns empty for a blank project path with no orders", () => {
    const tl = readBuildTimeline("", []);
    expect(tl.source).toBe("empty");
  });
});

// ---------------------------------------------------------------------------
// (e) Malformed lines are skipped, never throw
// ---------------------------------------------------------------------------

describe("readBuildTimeline — malformed input is fail-soft", () => {
  it("skips malformed/blank/unknown lines and parses the rest, never throws", () => {
    const projectPath = writeTrack([
      "not json at all",
      "",
      "{ broken json",
      line({ kind: "unknown_kind", frd: "frd-01-x", at: "2026-06-23T10:00:00Z" }),
      line({ kind: "wo_start", frd: "frd-01-x", at: "2026-06-23T10:00:00Z" }), // missing wo
      line({ kind: "wo_start", at: "2026-06-23T10:00:00Z" }), // missing frd
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-001", at: "not-a-date" }), // bad date
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-001", at: "2026-06-23T10:00:00Z" }),
      line({
        kind: "wo_end",
        frd: "frd-01-x",
        wo: "WO-01-001",
        state: "verified",
        at: "2026-06-23T10:09:00Z",
      }),
      "[1, 2, 3]", // array at top level
    ]);

    let tl: ReturnType<typeof readBuildTimeline> | undefined;
    expect(() => {
      tl = readBuildTimeline(projectPath, []);
    }).not.toThrow();

    expect(tl?.source).toBe("track");
    // Only the one valid WO survived (the missing-wo wo_start does not create a WO).
    expect(tl?.frds).toHaveLength(1);
    const wo = tl?.frds[0]?.workOrders[0];
    expect(wo?.id).toBe("WO-01-001");
    expect(wo?.durationMin).toBe(9);
    expect(wo?.state).toBe("done");
  });

  it("a track file with only malformed lines falls back to structural when orders exist", () => {
    const projectPath = writeTrack(["garbage", "{ nope", "still not json"]);
    const orders: WorkOrder[] = [makeOrder({ id: "WO-01-001", frd: "frd-01-x", state: "todo" })];
    const tl = readBuildTimeline(projectPath, orders);
    expect(tl.source).toBe("structural");
  });
});

// ---------------------------------------------------------------------------
// (g) Partial track — cumulative supplement for missing FRDs and WOs
// ---------------------------------------------------------------------------

describe("readBuildTimeline — partial track supplements with structural data", () => {
  it("shows all FRDs when only some are tracked (the pre-track FRDs come from orders)", () => {
    // Track only covers frd-09; frd-01 through frd-08 were built before track.jsonl existed.
    const projectPath = writeTrack([
      line({
        kind: "wo_start",
        frd: "frd-09-gamification",
        wo: "WO-09-006",
        at: "2026-06-30T00:05:00Z",
      }),
      line({
        kind: "wo_end",
        frd: "frd-09-gamification",
        wo: "WO-09-006",
        state: "in_review",
        at: "2026-06-30T00:20:00Z",
      }),
    ]);
    const orders: WorkOrder[] = [
      makeOrder({ id: "WO-01-001", frd: "frd-01-data-reading", state: "done" }),
      makeOrder({ id: "WO-09-006", frd: "frd-09-gamification", state: "done" }),
    ];

    const tl = readBuildTimeline(projectPath, orders);

    expect(tl.source).toBe("track");
    const ids = tl.frds.map((f) => f.id);
    expect(ids).toContain("frd-01-data-reading");
    expect(ids).toContain("frd-09-gamification");
    // FRDs ordered by id (frd-01 < frd-09)
    expect(ids.indexOf("frd-01-data-reading")).toBeLessThan(ids.indexOf("frd-09-gamification"));

    // Structural supplement: no timing
    const frd01 = tl.frds.find((f) => f.id === "frd-01-data-reading");
    expect(frd01?.state).toBe("done");
    expect(frd01?.startMs).toBeNull();
  });

  it("defers to frontmatter 'done' when the track has a stale intermediate state", () => {
    // Track records wo_end with in_review, but the WO is now VERIFIED (done) in frontmatter.
    const projectPath = writeTrack([
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-001", at: "2026-06-30T00:00:00Z" }),
      line({
        kind: "wo_end",
        frd: "frd-01-x",
        wo: "WO-01-001",
        state: "in_review",
        at: "2026-06-30T00:10:00Z",
      }),
    ]);
    const orders: WorkOrder[] = [makeOrder({ id: "WO-01-001", frd: "frd-01-x", state: "done" })];

    const tl = readBuildTimeline(projectPath, orders);

    expect(tl.source).toBe("track");
    expect(tl.frds[0]?.workOrders[0]?.state).toBe("done");
    expect(tl.frds[0]?.state).toBe("done");
    // Timing from the track is still preserved
    expect(tl.frds[0]?.workOrders[0]?.startMs).not.toBeNull();
    expect(tl.frds[0]?.workOrders[0]?.durationMin).toBe(10);
  });

  it("adds WOs not in the track but in orders for the same tracked FRD", () => {
    // Track only saw WO-01-002; WO-01-001 and WO-01-003 were built earlier.
    const projectPath = writeTrack([
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-002", at: "2026-06-30T00:00:00Z" }),
      line({
        kind: "wo_end",
        frd: "frd-01-x",
        wo: "WO-01-002",
        state: "verified",
        at: "2026-06-30T00:10:00Z",
      }),
    ]);
    const orders: WorkOrder[] = [
      makeOrder({ id: "WO-01-001", frd: "frd-01-x", title: "First", state: "done" }),
      makeOrder({ id: "WO-01-002", frd: "frd-01-x", title: "Second", state: "done" }),
      makeOrder({ id: "WO-01-003", frd: "frd-01-x", title: "Third", state: "done" }),
    ];

    const tl = readBuildTimeline(projectPath, orders);

    expect(tl.frds).toHaveLength(1);
    const woIds = tl.frds[0]?.workOrders.map((w) => w.id).sort();
    expect(woIds).toEqual(["WO-01-001", "WO-01-002", "WO-01-003"]);

    // WO-01-001 has no track data → structural state from frontmatter
    const wo01 = tl.frds[0]?.workOrders.find((w) => w.id === "WO-01-001");
    expect(wo01?.state).toBe("done");
    expect(wo01?.startMs).toBeNull();
    expect(wo01?.attempts).toBe(0);

    // WO-01-002 has real track timing
    const wo02 = tl.frds[0]?.workOrders.find((w) => w.id === "WO-01-002");
    expect(wo02?.startMs).not.toBeNull();
    expect(wo02?.durationMin).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// (e2) DR-092/DR-115 guard — timeline WO-id set ⊇ listWorkOrders(), and
// frontmatter is authoritative over a stale track state. Exercised against the
// REAL listWorkOrders() reader (real wo-*.md files on disk), not a hand-built
// WorkOrder[] fixture — this is the single-source-of-truth invariant the
// display surfaces (Work Orders tab, ObjectivesBar, Observability DAG) depend
// on: whatever listWorkOrders() reports MUST all be present in the timeline.
// ---------------------------------------------------------------------------

/** Write a real work-order markdown file with DR-050 frontmatter under tmpRoot. */
function writeWorkOrderFile(
  frd: string,
  woId: string,
  implementationStatus: string,
  title = woId,
): void {
  const dir = path.join(tmpRoot, "docs", "frds", frd, "work-orders");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${woId.toLowerCase()}-${title.toLowerCase().replace(/\s+/g, "-")}.md`;
  fs.writeFileSync(
    path.join(dir, filename),
    `---\nimplementation_status: ${implementationStatus}\n---\n\n# ${woId} ${title}\n`,
    "utf-8",
  );
}

describe("readBuildTimeline — DR-092/DR-115: timeline id set ⊇ listWorkOrders(), frontmatter authoritative", () => {
  it("with a track present + real WO files on disk, the timeline includes EVERY id listWorkOrders() reports", () => {
    // Track only saw WO-01-002; WO-01-001 and WO-01-003 exist on disk but never hit the track.
    writeWorkOrderFile("frd-01-x", "WO-01-001", "verified", "first");
    writeWorkOrderFile("frd-01-x", "WO-01-002", "verified", "second");
    writeWorkOrderFile("frd-01-x", "WO-01-003", "in_progress", "third");

    writeTrack([
      line({ kind: "wo_start", frd: "frd-01-x", wo: "WO-01-002", at: "2026-06-30T00:00:00Z" }),
      line({
        kind: "wo_end",
        frd: "frd-01-x",
        wo: "WO-01-002",
        state: "verified",
        at: "2026-06-30T00:10:00Z",
      }),
    ]);

    const orders = listWorkOrders(tmpRoot);
    expect(orders.map((o) => o.id).sort()).toEqual(["WO-01-001", "WO-01-002", "WO-01-003"]);

    const tl = readBuildTimeline(tmpRoot, orders);
    const timelineIds = tl.frds.flatMap((f) => f.workOrders.map((w) => w.id));

    // Every id listWorkOrders() reports MUST appear somewhere in the timeline
    // (supplementMissingWos fills in the untracked ones structurally).
    for (const order of orders) {
      expect(timelineIds).toContain(order.id);
    }
  });

  it("a WO with frontmatter 'done' (VERIFIED) shows done in the timeline even when the track's last event says otherwise", () => {
    writeWorkOrderFile("frd-02-y", "WO-02-001", "verified", "done-one");

    writeTrack([
      line({ kind: "wo_start", frd: "frd-02-y", wo: "WO-02-001", at: "2026-06-30T00:00:00Z" }),
      // The track's last recorded event is a stale "in_review" — an interrupted run before
      // the final wo_end was appended — but the frontmatter has since moved to VERIFIED.
      line({
        kind: "wo_end",
        frd: "frd-02-y",
        wo: "WO-02-001",
        state: "in_review",
        at: "2026-06-30T00:05:00Z",
      }),
    ]);

    const orders = listWorkOrders(tmpRoot);
    expect(orders[0]?.state).toBe("done"); // frontmatter parsed as VERIFIED → "done"

    const tl = readBuildTimeline(tmpRoot, orders);
    const wo = tl.frds.flatMap((f) => f.workOrders).find((w) => w.id === "WO-02-001");
    // resolveWoState: frontmatter "done" wins over the track's stale "review" state.
    expect(wo?.state).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// (f) Git fallback — estimated reconstruction from commit history (pure)
// ---------------------------------------------------------------------------

describe("deriveGitTimeline — estimated reconstruction from git history", () => {
  const ms = (iso: string): number => Date.parse(iso);

  it("returns null when no commit mentions a WO id", () => {
    const tl = deriveGitTimeline(
      [{ atMs: ms("2026-06-01T10:00:00Z"), subject: "chore: tidy" }],
      [],
    );
    expect(tl).toBeNull();
  });

  it("reconstructs FRD▸WO in real order with estimated durations, flagged estimated", () => {
    const commits = [
      { atMs: ms("2026-06-01T10:00:00Z"), subject: "feat(x): WO-01-001 reader" },
      { atMs: ms("2026-06-01T10:12:00Z"), subject: "feat(x): WO-01-002 view" },
      { atMs: ms("2026-06-01T11:00:00Z"), subject: "feat(y): WO-02-001 wire" },
    ];
    const orders: WorkOrder[] = [
      makeOrder({ id: "WO-01-001", frd: "frd-01-x", state: "done" }),
      makeOrder({ id: "WO-01-002", frd: "frd-01-x", state: "done" }),
      makeOrder({ id: "WO-02-001", frd: "frd-02-y", state: "fail" }),
    ];
    const tl = deriveGitTimeline(commits, orders);
    expect(tl).not.toBeNull();
    if (tl === null) return;
    expect(tl.source).toBe("git");
    expect(tl.estimated).toBe(true);
    expect(tl.hasDurations).toBe(true);
    expect(tl.frds.map((f) => f.id)).toEqual(["frd-01-x", "frd-02-y"]);
    expect(tl.frds[0]?.workOrders.map((w) => w.id)).toEqual(["WO-01-001", "WO-01-002"]);
    // WO-01-002 duration = the 12-min gap to the previous commit.
    expect(tl.frds[0]?.workOrders[1]?.durationMin).toBe(12);
    // Final state comes from the orders, not git.
    expect(tl.frds[1]?.state).toBe("fail");
  });

  it("clamps an overnight gap to the 60-min cap (no absurd multi-hour bars)", () => {
    const commits = [
      { atMs: ms("2026-06-01T10:00:00Z"), subject: "WO-01-001" },
      { atMs: ms("2026-06-02T10:00:00Z"), subject: "WO-01-002" }, // +24h
    ];
    const orders: WorkOrder[] = [
      makeOrder({ id: "WO-01-001", frd: "frd-01-x", state: "done" }),
      makeOrder({ id: "WO-01-002", frd: "frd-01-x", state: "done" }),
    ];
    const tl = deriveGitTimeline(commits, orders);
    expect(tl?.frds[0]?.workOrders[1]?.durationMin).toBe(60);
  });

  it("counts the commits mentioning a WO as its attempts (reopens)", () => {
    const commits = [
      { atMs: ms("2026-06-01T10:00:00Z"), subject: "WO-01-001 build" },
      { atMs: ms("2026-06-01T10:30:00Z"), subject: "reopen WO-01-001" },
      { atMs: ms("2026-06-01T11:00:00Z"), subject: "WO-01-001 fixed" },
    ];
    const orders: WorkOrder[] = [makeOrder({ id: "WO-01-001", frd: "frd-01-x", state: "done" })];
    const tl = deriveGitTimeline(commits, orders);
    expect(tl?.frds[0]?.workOrders[0]?.attempts).toBe(3);
  });

  it("orders WOs by their real finish time even when commits arrive unsorted", () => {
    const commits = [
      { atMs: ms("2026-06-01T11:00:00Z"), subject: "WO-02-001" },
      { atMs: ms("2026-06-01T10:00:00Z"), subject: "WO-01-001" },
    ];
    const orders: WorkOrder[] = [
      makeOrder({ id: "WO-01-001", frd: "frd-01-x", state: "done" }),
      makeOrder({ id: "WO-02-001", frd: "frd-02-y", state: "done" }),
    ];
    const tl = deriveGitTimeline(commits, orders);
    expect(tl?.frds.map((f) => f.id)).toEqual(["frd-01-x", "frd-02-y"]);
  });

  it("falls back to a frd-NN slug for a WO id absent from the orders list", () => {
    const commits = [{ atMs: ms("2026-06-01T10:00:00Z"), subject: "WO-07-003 orphan" }];
    const tl = deriveGitTimeline(commits, []);
    expect(tl?.frds[0]?.id).toBe("frd-07");
    expect(tl?.frds[0]?.label).toBe("FRD-07");
    // No order ⇒ assume the commit landing means it shipped.
    expect(tl?.frds[0]?.workOrders[0]?.state).toBe("done");
  });
});
