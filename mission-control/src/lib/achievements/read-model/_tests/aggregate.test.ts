/**
 * RED → GREEN tests for the aggregate index join (FRD-23, WO-23-004, REQ-23-003).
 *
 * Covers:
 *   AC-23-003.1 — `sync-portfolio` joins every project's portada into ONE aggregate file MC reads
 *                 in O(1); the Informe cost is independent of N (the join is a single file read,
 *                 not N git shell-outs).
 *   AC-23-003.2 — the aggregate reader is fail-loud: a malformed aggregate throws / an explicit
 *                 error, never a silent empty (already anchored in statsReader; re-asserted here at
 *                 the join boundary so the writer's output round-trips through the fail-loud reader).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildStatsAggregate,
  type PortadaJoinEntry,
  syncStatsAggregate,
  writeStatsAggregate,
} from "../aggregate";
import { readStatsAggregate } from "../statsReader";
import { parseStatsAggregate } from "../statsSchema";
import { makePortada } from "./fixtures";

describe("buildStatsAggregate — pure join of N portadas (AC-23-003.1)", () => {
  it("joins every project's portada into one { projects } record keyed by project path", () => {
    const entries: PortadaJoinEntry[] = [
      { projectKey: "mission-control", portada: makePortada({ seal: "a".repeat(40) }) },
      { projectKey: "jobleap", portada: makePortada({ seal: "b".repeat(40) }) },
    ];
    const aggregate = buildStatsAggregate(entries);

    expect(Object.keys(aggregate.projects).sort()).toEqual(["jobleap", "mission-control"]);
    expect(aggregate.projects["mission-control"]?.seal).toBe("a".repeat(40));
    expect(aggregate.projects.jobleap?.seal).toBe("b".repeat(40));
  });

  it("produces an aggregate the fail-loud parser accepts (round-trips)", () => {
    const aggregate = buildStatsAggregate([{ projectKey: "p1", portada: makePortada() }]);
    const round = parseStatsAggregate(JSON.parse(JSON.stringify(aggregate)));
    expect(round).not.toBeNull();
    expect(round).toEqual(aggregate);
  });

  it("is O(1)-shaped: an empty portfolio yields an explicit empty projects record, not an error", () => {
    const aggregate = buildStatsAggregate([]);
    expect(aggregate.projects).toEqual({});
  });

  it("last write wins on a duplicate project key (never silently drops or throws)", () => {
    const aggregate = buildStatsAggregate([
      { projectKey: "dup", portada: makePortada({ seal: "1".repeat(40) }) },
      { projectKey: "dup", portada: makePortada({ seal: "2".repeat(40) }) },
    ]);
    expect(Object.keys(aggregate.projects)).toEqual(["dup"]);
    expect(aggregate.projects.dup?.seal).toBe("2".repeat(40));
  });
});

describe("writeStatsAggregate — atomic write of the O(1) index (AC-23-003.1)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agg-write-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes a single aggregate file the fail-loud reader reads in ONE fs read (O(1))", () => {
    const target = path.join(dir, "stats-aggregate.json");
    const aggregate = buildStatsAggregate([
      { projectKey: "p1", portada: makePortada({ seal: "a".repeat(40) }) },
      { projectKey: "p2", portada: makePortada({ seal: "b".repeat(40) }) },
    ]);
    writeStatsAggregate(target, aggregate);

    // O(1): the entire aggregate is one file read — no per-project git shell-out.
    const result = readStatsAggregate(target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value.projects).sort()).toEqual(["p1", "p2"]);
    }
  });

  it("writes atomically (tmp + rename): a malformed aggregate is never left readable", () => {
    const target = path.join(dir, "stats-aggregate.json");
    const aggregate = buildStatsAggregate([{ projectKey: "p1", portada: makePortada() }]);
    writeStatsAggregate(target, aggregate);
    // No temp litter left behind.
    const leftovers = fs.readdirSync(dir).filter((f) => f.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });
});

describe("readStatsAggregate — fail-loud at the join boundary (AC-23-003.2)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agg-read-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fails loud on a malformed aggregate — never a silent empty (DR-078)", () => {
    const target = path.join(dir, "stats-aggregate.json");
    // A well-formed JSON of the WRONG shape (a project with a corrupt portada).
    fs.writeFileSync(target, JSON.stringify({ projects: { bad: { seal: 123 } } }), "utf-8");
    const result = readStatsAggregate(target);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unparseable");
    }
  });

  it("distinguishes a missing aggregate from a corrupt one (explicit reasons)", () => {
    const result = readStatsAggregate(path.join(dir, "never-written.json"));
    expect(result).toEqual({ ok: false, reason: "missing" });
  });
});

describe("syncStatsAggregate — reads each project's portada and joins to O(1) (AC-23-003.1)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agg-sync-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Write a real production-shape portada into <projectPath>/.pandacorp/stats.json. */
  function seedPortada(projectPath: string, seal: string): void {
    const pandacorp = path.join(projectPath, ".pandacorp");
    fs.mkdirSync(pandacorp, { recursive: true });
    fs.writeFileSync(
      path.join(pandacorp, "stats.json"),
      `${JSON.stringify(makePortada({ seal }), null, 2)}\n`,
      "utf-8",
    );
  }

  it("joins the N on-disk portadas into one aggregate file MC reads in O(1)", () => {
    const p1 = path.join(dir, "proj-one");
    const p2 = path.join(dir, "proj-two");
    seedPortada(p1, "1".repeat(40));
    seedPortada(p2, "2".repeat(40));
    const aggregatePath = path.join(dir, "stats-aggregate.json");

    const summary = syncStatsAggregate(
      [
        { projectKey: "proj-one", projectPath: p1 },
        { projectKey: "proj-two", projectPath: p2 },
      ],
      aggregatePath,
    );

    expect(summary.joined).toBe(2);
    expect(summary.skipped).toEqual([]);

    // O(1) MC read: one file, both projects present.
    const result = readStatsAggregate(aggregatePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value.projects).sort()).toEqual(["proj-one", "proj-two"]);
      expect(result.value.projects["proj-one"]?.seal).toBe("1".repeat(40));
    }
  });

  it("skips a project with no portada yet (missing) rather than fabricating one", () => {
    const p1 = path.join(dir, "has-portada");
    const p2 = path.join(dir, "no-portada-yet");
    seedPortada(p1, "1".repeat(40));
    fs.mkdirSync(p2, { recursive: true });
    const aggregatePath = path.join(dir, "stats-aggregate.json");

    const summary = syncStatsAggregate(
      [
        { projectKey: "has-portada", projectPath: p1 },
        { projectKey: "no-portada-yet", projectPath: p2 },
      ],
      aggregatePath,
    );

    expect(summary.joined).toBe(1);
    expect(summary.skipped).toEqual([{ projectKey: "no-portada-yet", reason: "missing" }]);

    const result = readStatsAggregate(aggregatePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value.projects)).toEqual(["has-portada"]);
    }
  });

  it("skips a project whose portada is corrupt (fail-loud per entry, never poisons the join)", () => {
    const p1 = path.join(dir, "good");
    const p2 = path.join(dir, "corrupt");
    seedPortada(p1, "1".repeat(40));
    const badPandacorp = path.join(p2, ".pandacorp");
    fs.mkdirSync(badPandacorp, { recursive: true });
    fs.writeFileSync(path.join(badPandacorp, "stats.json"), "{ not valid json", "utf-8");
    const aggregatePath = path.join(dir, "stats-aggregate.json");

    const summary = syncStatsAggregate(
      [
        { projectKey: "good", projectPath: p1 },
        { projectKey: "corrupt", projectPath: p2 },
      ],
      aggregatePath,
    );

    expect(summary.joined).toBe(1);
    expect(summary.skipped).toEqual([{ projectKey: "corrupt", reason: "unparseable" }]);
  });
});
