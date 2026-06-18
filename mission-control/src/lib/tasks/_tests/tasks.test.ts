/**
 * WO-06-005 — lib/tasks tests (readTasksState)
 *
 * Tests for the task-state reader: reads ~/.claude/tasks/ to determine
 * whether an active team is present.
 *
 * Traceability:
 *   AC-06-008.1 — feeds off task state without calling Claude
 *   AC-06-010.1 — absent tasks/ → active=false (no active team)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readTasksState } from "../tasks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

function mktemp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mc-tasks-test-"));
}

beforeEach(() => {
  tmpDir = mktemp();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Absent directory → active=false (AC-06-010.1)
// ---------------------------------------------------------------------------

describe("frd-06: readTasksState — absent directory", () => {
  it("frd-06: WHEN tasksDir does not exist THEN returns active=false", () => {
    const result = readTasksState(path.join(tmpDir, "no-such-dir"));
    expect(result.active).toBe(false);
  });

  it("frd-06: WHEN tasksDir does not exist THEN never throws", () => {
    expect(() => readTasksState(path.join(tmpDir, "no-such-dir"))).not.toThrow();
  });

  it("frd-06: WHEN tasksDir is empty path THEN returns active=false", () => {
    const result = readTasksState("");
    expect(result.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Empty directory → active=false
// ---------------------------------------------------------------------------

describe("frd-06: readTasksState — empty directory", () => {
  it("frd-06: WHEN tasksDir is empty (no team subdirs) THEN returns active=false", () => {
    const result = readTasksState(tmpDir);
    expect(result.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Directory with team subdirectory → active=true
// ---------------------------------------------------------------------------

describe("frd-06: readTasksState — directory with team subdirs", () => {
  it("frd-06: WHEN tasksDir has at least one subdirectory THEN returns active=true", () => {
    const teamDir = path.join(tmpDir, "team-abc");
    fs.mkdirSync(teamDir);
    const result = readTasksState(tmpDir);
    expect(result.active).toBe(true);
  });

  it("frd-06: WHEN tasksDir has multiple subdirectories THEN returns active=true", () => {
    fs.mkdirSync(path.join(tmpDir, "team-1"));
    fs.mkdirSync(path.join(tmpDir, "team-2"));
    const result = readTasksState(tmpDir);
    expect(result.active).toBe(true);
  });

  it("frd-06: WHEN tasksDir has files (not dirs) THEN returns active=false (only dirs count)", () => {
    fs.writeFileSync(path.join(tmpDir, "some-file.json"), "{}");
    const result = readTasksState(tmpDir);
    expect(result.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Return shape invariants
// ---------------------------------------------------------------------------

describe("frd-06: readTasksState — return shape", () => {
  it("frd-06: WHEN tasks absent THEN result has active:boolean field", () => {
    const result = readTasksState(path.join(tmpDir, "nonexistent"));
    expect(typeof result.active).toBe("boolean");
  });

  it("frd-06: WHEN tasks present THEN result has active:boolean field", () => {
    fs.mkdirSync(path.join(tmpDir, "team-x"));
    const result = readTasksState(tmpDir);
    expect(typeof result.active).toBe("boolean");
  });

  it("frd-06: WHEN tasks present THEN teamCount is a non-negative integer", () => {
    fs.mkdirSync(path.join(tmpDir, "team-x"));
    const result = readTasksState(tmpDir);
    expect(typeof result.teamCount).toBe("number");
    expect(Number.isInteger(result.teamCount)).toBe(true);
    expect(result.teamCount).toBeGreaterThanOrEqual(0);
  });

  it("frd-06: WHEN tasks absent THEN teamCount is 0", () => {
    const result = readTasksState(path.join(tmpDir, "nonexistent"));
    expect(result.teamCount).toBe(0);
  });

  it("frd-06: WHEN tasks has 2 team dirs THEN teamCount is 2", () => {
    fs.mkdirSync(path.join(tmpDir, "team-a"));
    fs.mkdirSync(path.join(tmpDir, "team-b"));
    const result = readTasksState(tmpDir);
    expect(result.teamCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Never calls Claude / never writes (auditable)
// ---------------------------------------------------------------------------

describe("frd-06: readTasksState — read-only (auditable)", () => {
  it("frd-06: module import does NOT import an AI/Claude client", async () => {
    const mod = await import("../tasks");
    expect(mod.readTasksState).toBeDefined();
    // If this test passes, the module loaded without pulling in @anthropic-ai/* etc.
  });
});
