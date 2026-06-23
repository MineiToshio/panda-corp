/**
 * WO-01-005 — `readStatus` ADVERSARIAL review tests (DR-015).
 *
 * Author: reviewer (Opus 4.8), a DIFFERENT model from the implementer (sonnet/haiku),
 * to break the shared-bias blind spot. These tests target edge cases, abuse and errors
 * the implementer did NOT write tests for — derived from AC-01-005.1 (which explicitly
 * lists `progress` among the fields to read, yet status.test.ts never exercises it),
 * from the StatusResult tolerance contract, and from OWASP-style input-abuse thinking
 * (prototype pollution, YAML alias bombs, top-level non-map shapes, duplicate keys).
 *
 * If any of these pass too easily that is good — it confirms the code already covers the
 * edge. If one fails, the code has a real hole. All are run against the real reader with
 * real fs reads in temp dirs; no mocks, no writes to the factory.
 *
 * Traceability:
 *   AC-01-005.1  read phase, version, running, PROGRESS, work order count,
 *                pending_decisions, pending_bugs, last_green_sha, safe_to_test.
 *   (Edge)       absent / malformed / partial → render partial, never throw.
 *   REQ-01-011   read-only invariant (never writes, never calls Claude).
 *   B1'/I2/I3    regression anchors from .pandacorp/comms/progress.md (WO-13-001 incident).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readStatus } from "../status";

type Phase = "product" | "design" | "architecture" | "implementation" | "release";
type ProjectStatus = {
  project: string;
  phase: Phase;
  version: string;
  running: boolean;
  progress?: number;
  workOrdersTotal: number;
  workOrdersDone: number;
  pendingDecisions: number;
  pendingBugs: number;
  rethinkPending: boolean;
  advancePending: boolean;
  lastGreenSha: string;
  safeToTest: boolean;
  overlayVersion?: string;
  createdWith?: string;
  updatedAt?: string;
  repo?: string;
};
type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };

function makeTempProject(yamlContent: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-adv-"));
  const pandacorpDir = path.join(dir, ".pandacorp");
  fs.mkdirSync(pandacorpDir, { recursive: true });
  fs.writeFileSync(path.join(pandacorpDir, "status.yaml"), yamlContent, "utf-8");
  return dir;
}

// ---------------------------------------------------------------------------
// GAP 1 — `progress` is named in AC-01-005.1 but status.test.ts never tests it.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: progress field (named in AC-01-005.1, untested by implementer)", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN progress is a finite integer THEN it is read into status.progress", () => {
    tempProject = makeTempProject("phase: implementation\nprogress: 42\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.progress).toBe(42);
  });

  it("frd-01: WHEN progress is a finite float THEN it is read faithfully (not floored)", () => {
    tempProject = makeTempProject("phase: implementation\nprogress: 33.5\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.progress).toBe(33.5);
  });

  it("frd-01: WHEN progress is the string 'NaN' (.NaN yaml float) THEN progress is undefined (B1')", () => {
    tempProject = makeTempProject("phase: implementation\nprogress: .NaN\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    const v = result.status.progress;
    if (v !== undefined) expect(Number.isFinite(v)).toBe(true);
    expect(result.status.progress).toBeUndefined();
  });

  it("frd-01: WHEN progress is a YAML infinity (.inf) THEN progress is undefined (non-finite rejected)", () => {
    tempProject = makeTempProject("phase: implementation\nprogress: .inf\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.progress).toBeUndefined();
  });

  it("frd-01: WHEN progress is a string THEN progress is undefined (no coercion)", () => {
    tempProject = makeTempProject('phase: design\nprogress: "50%"\n');
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.progress).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GAP 2 — top-level non-map shapes the proj-b fixture does not cover.
// proj-b is one flavour of broken; a scalar / array / quoted-string top level
// must also be classified correctly (malformed, never throw, status {}).
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: top-level non-map YAML shapes", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN status.yaml is a bare scalar string THEN malformed:true, status:{}, no throw", () => {
    // Parses to "just a string" — a valid YAML scalar but NOT a status map.
    tempProject = makeTempProject("just a string\n");
    let result!: StatusResult;
    expect(() => {
      result = readStatus(tempProject) as StatusResult;
    }).not.toThrow();
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.malformed).toBe(true);
    expect(result.status).toEqual({});
  });

  it("frd-01: WHEN status.yaml is a top-level YAML sequence THEN malformed:true, status:{}", () => {
    tempProject = makeTempProject("- phase: design\n- running: true\n");
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.malformed).toBe(true);
    expect(result.status).toEqual({});
  });

  it("frd-01: WHEN status.yaml is a bare number THEN malformed:true, status:{}", () => {
    tempProject = makeTempProject("42\n");
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.malformed).toBe(true);
    expect(result.status).toEqual({});
  });

  it("frd-01: WHEN status.yaml is the literal 'null' THEN it is valid-but-empty (malformed:false, status:{})", () => {
    // `null` is a legitimately empty document, not a broken one.
    tempProject = makeTempProject("null\n");
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.malformed).toBe(false);
    expect(result.status).toEqual({});
  });

  it("frd-01: WHEN status.yaml is the literal 'false' (a scalar) THEN malformed:true, status:{}", () => {
    // `false` is a scalar top-level, not a map — must be rejected, not silently empty.
    tempProject = makeTempProject("false\n");
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.malformed).toBe(true);
    expect(result.status).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// GAP 3 — duplicate keys. The `yaml` lib throws on duplicate map keys in strict
// mode; readStatus must classify that as malformed, never let it bubble.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: duplicate keys", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN status.yaml has duplicate map keys THEN readStatus does NOT throw", () => {
    tempProject = makeTempProject("phase: design\nphase: release\n");
    expect(() => readStatus(tempProject)).not.toThrow();
  });

  it("frd-01: WHEN status.yaml has duplicate map keys THEN it is treated as malformed", () => {
    const result = readStatus(makeTempProject("phase: design\nphase: release\n")) as StatusResult;
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.malformed).toBe(true);
    expect(result.status).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// GAP 4 — phase literal hardening: case-sensitivity, whitespace, near-misses,
// and snake/legacy aliases. AC-01-006.1 makes `phase` the single source of
// truth for the column; a wrongly-accepted phase would misplace a project.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: phase literal hardening (single source of truth, AC-01-006.1)", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN phase is 'Implementation' (wrong case) THEN phase is undefined (strict literal)", () => {
    tempProject = makeTempProject("phase: Implementation\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBeUndefined();
  });

  it("frd-01: WHEN phase has surrounding whitespace ' design ' THEN phase is undefined (no trim-coercion)", () => {
    tempProject = makeTempProject('phase: " design "\n');
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // The reader must not silently trim a malformed value into a valid one.
    expect(result.status.phase).toBeUndefined();
  });

  it("frd-01: WHEN phase is a near-miss 'build' (a legacy column word, not a Phase) THEN phase is undefined", () => {
    tempProject = makeTempProject("phase: build\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBeUndefined();
  });

  it("frd-01: WHEN phase is null THEN phase is undefined and the rest still reads", () => {
    tempProject = makeTempProject("phase: null\nversion: v9\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBeUndefined();
    expect(result.status.version).toBe("v9");
  });

  it("frd-01: WHEN phase is a nested object THEN phase is undefined (not [object Object])", () => {
    tempProject = makeTempProject("phase:\n  nested: implementation\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GAP 5 — boolean & numeric hardening beyond the implementer's NaN test.
// YAML has many truthy spellings (yes/on/"true"); coercion would corrupt state.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: boolean/number coercion hardening", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN running is the string 'true' THEN running is not the string (undefined or boolean)", () => {
    tempProject = makeTempProject('running: "true"\n');
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    if (result.status.running !== undefined) {
      expect(typeof result.status.running).toBe("boolean");
    } else {
      expect(result.status.running).toBeUndefined();
    }
    // critically, never the literal string "true"
    expect(result.status.running as unknown).not.toBe("true");
  });

  it("frd-01: WHEN safe_to_test is the string 'yes' THEN safeToTest is never the string", () => {
    tempProject = makeTempProject('safe_to_test: "yes"\n');
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.safeToTest as unknown).not.toBe("yes");
    if (result.status.safeToTest !== undefined) {
      expect(typeof result.status.safeToTest).toBe("boolean");
    }
  });

  it("frd-01: WHEN work_orders_total is a negative number THEN it is read as-is (validation is a downstream concern, but it must stay a number)", () => {
    // readStatus is a tolerant reader, not a validator; negatives are not its job
    // to clamp, but they must never become NaN or a string.
    tempProject = makeTempProject("work_orders_total: -5\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    if (result.status.workOrdersTotal !== undefined) {
      expect(typeof result.status.workOrdersTotal).toBe("number");
      expect(Number.isFinite(result.status.workOrdersTotal)).toBe(true);
    }
  });

  it("frd-01: WHEN work_orders_total is an empty object {} THEN it is undefined (I2 vacuous-truth)", () => {
    tempProject = makeTempProject("work_orders_total: {}\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.workOrdersTotal).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GAP 6 — SECURITY: prototype pollution via crafted YAML keys (OWASP-style).
// A status.yaml is read from a sibling project folder; a poisoned file must not
// pollute Object.prototype nor leak a __proto__ field onto the result.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial security: prototype pollution via crafted YAML keys", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN status.yaml has a __proto__ key THEN Object.prototype is NOT polluted", () => {
    tempProject = makeTempProject("__proto__:\n  polluted: true\nphase: design\n");
    readStatus(tempProject);
    // No global pollution.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("frd-01: WHEN status.yaml has a __proto__ key THEN the real (allow-listed) fields still read", () => {
    tempProject = makeTempProject("__proto__:\n  polluted: true\nphase: design\nversion: v1\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBe("design");
    expect(result.status.version).toBe("v1");
  });

  it("frd-01: WHEN status.yaml has a constructor.prototype payload THEN no pollution and no leak", () => {
    tempProject = makeTempProject(
      'constructor:\n  prototype:\n    hacked: "yes"\nphase: release\n',
    );
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // Allow-list means only known fields survive; the malicious key is dropped.
    expect((result.status as Record<string, unknown>).constructor).toBeTypeOf("function");
    expect(({} as Record<string, unknown>).hacked).toBeUndefined();
    expect(result.status.phase).toBe("release");
  });

  it("frd-01: WHEN status.yaml has unknown extra keys THEN they are NOT copied onto the result (allow-list, anti scope-creep)", () => {
    tempProject = makeTempProject("phase: design\nattacker_field: gotcha\nrandom: 99\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    const raw = result.status as Record<string, unknown>;
    expect(raw.attacker_field).toBeUndefined();
    expect(raw.random).toBeUndefined();
    // Only allow-listed camelCase keys are present.
    expect(Object.keys(raw)).toEqual(["phase"]);
  });
});

// ---------------------------------------------------------------------------
// GAP 7 — ABUSE/DoS: YAML alias bomb ("billion laughs"). The reader must not
// hang or crash the dashboard when a project folder contains a hostile file.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial abuse: YAML alias expansion bomb", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN status.yaml is a billion-laughs alias bomb THEN readStatus returns within a sane time and does not throw", () => {
    const bomb = [
      "a: &a [x, x, x, x, x, x, x, x, x]",
      "b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]",
      "c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]",
      "d: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c]",
      "phase: design",
      "",
    ].join("\n");
    tempProject = makeTempProject(bomb);
    const start = Date.now();
    let result!: StatusResult;
    expect(() => {
      result = readStatus(tempProject) as StatusResult;
    }).not.toThrow();
    const elapsed = Date.now() - start;
    // Must be effectively instant; a runaway expansion would blow this.
    expect(elapsed).toBeLessThan(2000);
    // The top level is still a map, so phase should read (or be tolerated).
    expect(result.present).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GAP 8 — path / fs edge cases the implementer's tests skipped.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: path & directory-as-file edge cases", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN .pandacorp/status.yaml is a DIRECTORY (not a file) THEN readStatus does NOT throw", () => {
    // pathExists sees it, but readFileSync on a directory throws EISDIR — must be caught.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-dir-"));
    fs.mkdirSync(path.join(dir, ".pandacorp", "status.yaml"), { recursive: true });
    tempProject = dir;
    expect(() => readStatus(tempProject)).not.toThrow();
  });

  it("frd-01: WHEN .pandacorp/status.yaml is a directory THEN it is classified present+malformed (detected but unreadable)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-dir2-"));
    fs.mkdirSync(path.join(dir, ".pandacorp", "status.yaml"), { recursive: true });
    tempProject = dir;
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.malformed).toBe(true);
    expect(result.status).toEqual({});
  });

  it("frd-01: WHEN projectPath contains a NUL byte THEN readStatus returns present:false and does NOT throw", () => {
    // pathExists wraps existsSync, which throws EINVAL on null bytes — must be swallowed.
    const result = readStatus("/tmp/evil\0path") as StatusResult;
    expect(result.present).toBe(false);
  });

  it("frd-01: WHEN projectPath is only whitespace THEN readStatus returns present:false", () => {
    const result = readStatus("   ") as StatusResult;
    expect(result.present).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GAP 9 — serialization safety: the result must be JSON-serializable (it crosses
// the Server Component → client boundary in FRD-03). No Date objects, no functions.
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: result is JSON-serializable (RSC boundary safety)", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN updated_at is an unquoted YAML date THEN updatedAt is a string, not a Date (serializable)", () => {
    // Unquoted ISO dates are parsed as Date by some YAML configs; a Date would break
    // RSC serialization / equality. The reader must keep it a string or drop it.
    tempProject = makeTempProject("phase: design\nupdated_at: 2026-06-16\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    if (result.status.updatedAt !== undefined) {
      expect(typeof result.status.updatedAt).toBe("string");
    }
    // The whole result must round-trip through JSON unchanged in shape.
    expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
  });

  it("frd-01: WHEN proj fields are all set THEN JSON.stringify(result) loses no allow-listed field", () => {
    tempProject = makeTempProject(
      [
        "phase: implementation",
        "version: v2",
        "running: true",
        "work_orders_total: 10",
        "work_orders_done: 4",
        "pending_decisions: 1",
        "pending_bugs: 0",
        "last_green_sha: abc123",
        "safe_to_test: false",
        "",
      ].join("\n"),
    );
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    const round = JSON.parse(JSON.stringify(result)) as StatusResult;
    if (!round.present) throw new Error("Expected present after round-trip");
    expect(round.status.workOrdersTotal).toBe(10);
    expect(round.status.workOrdersDone).toBe(4);
    expect(round.status.safeToTest).toBe(false);
    expect(round.status.pendingBugs).toBe(0);
  });
});
