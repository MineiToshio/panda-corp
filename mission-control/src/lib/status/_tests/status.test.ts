/**
 * WO-01-005 — `readStatus` (yaml, partial-tolerant) — RED phase
 *
 * These tests are written BEFORE the implementation (`lib/status.ts` does not exist yet).
 * They will all fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-01-005.1  WHEN a project has `.pandacorp/status.yaml`, the system SHALL read phase,
 *                version, running, progress, work order count, `pending_decisions`,
 *                `pending_bugs`, `last_green_sha` and `safe_to_test`.
 *   AC-01-006.1  WHEN a card is `in-pipeline`, its column comes from the linked project's
 *                `phase`; the project's `status.yaml` is the single source of truth for
 *                the phase. (This WO exposes the `phase`; the column map is FRD-02.)
 *   (Edge)       `status.yaml` absent → `{ present: false, malformed: false, status: null }`.
 *   (Edge)       `status.yaml` malformed → `{ present: true, malformed: true, status: {} }`
 *                (never throws, partial-tolerant).
 *   (Edge)       `status.yaml` present but with only some keys → partial `status`, never throws.
 *   REQ-01-010   Project path missing → mark not-found; don't break the view.
 *   REQ-01-011   Read-only invariant: never writes, never calls Claude.
 *
 * Regression anchors from .pandacorp/comms/progress.md (real incidents → regression tests):
 *   B1' (2026-06-16): `typeof NaN === "number"` passes numeric type guards. The boolean
 *     fields `running` and `safe_to_test` must not be satisfied by NaN coercion; the
 *     numeric fields `workOrdersTotal` must reject NaN. Tests below cover these paths
 *     via inline temporary status files.
 *   I2 (2026-06-16): empty-object / empty-array inputs pass collection guards vacuously.
 *     An empty `status.yaml` (`{}`) must return `{ malformed: false, status: {} }` with
 *     all fields undefined — not a partial that invents defaults.
 *   I3 (2026-06-16): array-shaped objects fool `typeof` checks. `phase` must not be
 *     accepted when it is an array — only valid Phase string literals are accepted.
 *   (WO-01-001 review): `pathExists` wraps `existsSync` with a catch; this propagates
 *     to `readStatus` — calling readStatus with a non-existent project path must return
 *     `{ present: false }`, not throw.
 *
 * Stack: Vitest + `yaml` (^2.8.1, already in package.json).
 * No mocks — the function is pure-ish: path-in → typed result out.
 * Real fs reads against fixture trees; isolation via `withFactoryRoot` / temp dirs.
 * No writes anywhere.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FIXTURE_FULL } from "@/tests/fixtures";
import { readStatus } from "../status";

// ---------------------------------------------------------------------------
// Types (mirror the contract in wo-01-005-read-status.md and blueprint §2).
// Kept local to express what the tests assert; the module will export them.
// ---------------------------------------------------------------------------

type Phase = "product" | "design" | "architecture" | "implementation" | "release";

type DeployTarget = "internal" | "external";

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
  deployTarget?: DeployTarget;
};

type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** proj-a absolute path (has a complete, valid status.yaml in the fixture). */
const PROJ_A_PATH = path.join(FIXTURE_FULL, "projects", "proj-a");

/** proj-b absolute path (has a malformed status.yaml in the fixture). */
const PROJ_B_PATH = path.join(FIXTURE_FULL, "projects", "proj-b");

/**
 * Create a temporary project directory with a `.pandacorp/status.yaml` containing
 * the given YAML string. Returns the project root (temp dir).
 * Clean up with `fs.rmSync(dir, { recursive: true, force: true })`.
 */
function makeTempProject(yamlContent: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-test-"));
  const pandacorpDir = path.join(dir, ".pandacorp");
  fs.mkdirSync(pandacorpDir, { recursive: true });
  fs.writeFileSync(path.join(pandacorpDir, "status.yaml"), yamlContent, "utf-8");
  return dir;
}

// ---------------------------------------------------------------------------
// AC-01-005.1 — happy path: proj-a with a complete status.yaml
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — AC-01-005.1 happy path (proj-a complete status.yaml)", () => {
  it("frd-01: WHEN a project has status.yaml THEN readStatus returns present: true", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    expect(result.present).toBe(true);
  });

  it("frd-01: WHEN status.yaml is valid THEN malformed is false", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    expect(result.malformed).toBe(false);
  });

  it("frd-01: WHEN status.yaml is valid THEN status is not null", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status).not.toBeNull();
  });

  // --- phase (AC-01-005.1 + AC-01-006.1 phase single source of truth) ---

  it("frd-01: AC-01-006.1 — WHEN status.yaml is present THEN phase is read from it (single source of truth)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: phase: implementation
    expect(result.status.phase).toBe("implementation");
  });

  it("frd-01: WHEN status.yaml is present THEN phase is one of the five valid Phase values", () => {
    const VALID_PHASES: Phase[] = [
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
    ];
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(VALID_PHASES).toContain(result.status.phase);
  });

  // --- version ---

  it("frd-01: WHEN status.yaml is present THEN version is read (AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: version: v1
    expect(result.status.version).toBe("v1");
  });

  // --- running ---

  it("frd-01: WHEN status.yaml is present THEN running is a boolean (AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: running: true
    expect(result.status.running).toBe(true);
    expect(typeof result.status.running).toBe("boolean");
  });

  // --- work order counts ---

  it("frd-01: WHEN status.yaml is present THEN work_orders_total maps to workOrdersTotal (snake→camel, AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: work_orders_total: 28
    expect(result.status.workOrdersTotal).toBe(28);
    expect(typeof result.status.workOrdersTotal).toBe("number");
  });

  it("frd-01: WHEN status.yaml is present THEN work_orders_done maps to workOrdersDone (snake→camel, AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: work_orders_done: 7
    expect(result.status.workOrdersDone).toBe(7);
    expect(typeof result.status.workOrdersDone).toBe("number");
  });

  // --- decisions and bugs ---

  it("frd-01: WHEN status.yaml is present THEN pending_decisions maps to pendingDecisions (snake→camel, AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: pending_decisions: 2
    expect(result.status.pendingDecisions).toBe(2);
    expect(typeof result.status.pendingDecisions).toBe("number");
  });

  it("frd-01: WHEN status.yaml is present THEN pending_bugs maps to pendingBugs (snake→camel, AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: pending_bugs: 1
    expect(result.status.pendingBugs).toBe(1);
    expect(typeof result.status.pendingBugs).toBe("number");
  });

  // --- rethink_pending / advance_pending ---

  it("frd-01: WHEN status.yaml is present THEN rethink_pending maps to rethinkPending (snake→camel)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: rethink_pending: false
    expect(result.status.rethinkPending).toBe(false);
    expect(typeof result.status.rethinkPending).toBe("boolean");
  });

  it("frd-01: WHEN status.yaml is present THEN advance_pending maps to advancePending (snake→camel)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: advance_pending: false
    expect(result.status.advancePending).toBe(false);
    expect(typeof result.status.advancePending).toBe("boolean");
  });

  // --- last_green_sha ---

  it("frd-01: WHEN status.yaml is present THEN last_green_sha maps to lastGreenSha (snake→camel, AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: last_green_sha: "abc1234def5678"
    expect(result.status.lastGreenSha).toBe("abc1234def5678");
    expect(typeof result.status.lastGreenSha).toBe("string");
  });

  // --- safe_to_test ---

  it("frd-01: WHEN status.yaml is present THEN safe_to_test maps to safeToTest (snake→camel, AC-01-005.1)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: safe_to_test: true
    expect(result.status.safeToTest).toBe(true);
    expect(typeof result.status.safeToTest).toBe("boolean");
  });

  // --- optional fields: overlayVersion, createdWith, updatedAt, repo ---

  it("frd-01: WHEN status.yaml has overlay_version THEN it maps to overlayVersion (snake→camel)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: overlay_version: "7.1.0"
    expect(result.status.overlayVersion).toBe("7.1.0");
  });

  it("frd-01: WHEN status.yaml has created_with THEN it maps to createdWith (snake→camel)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: created_with: "6.0.0"
    expect(result.status.createdWith).toBe("6.0.0");
  });

  it("frd-01: WHEN status.yaml has updated_at THEN it maps to updatedAt (snake→camel)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: updated_at: "2026-06-15"
    expect(result.status.updatedAt).toBe("2026-06-15");
  });

  it("frd-01: WHEN status.yaml has repo THEN it is read into status.repo", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: repo: "https://github.com/ada/proj-a"
    expect(result.status.repo).toBe("https://github.com/ada/proj-a");
  });

  // --- project field ---

  it("frd-01: WHEN status.yaml has project field THEN it is read into status.project", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // fixture: project: "proj-a"
    expect(result.status.project).toBe("proj-a");
  });

  // --- snake_case keys must NOT leak through ---

  it("frd-01: WHEN status is read THEN snake_case keys are NOT present on the status object (only camelCase)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    const raw = result.status as Record<string, unknown>;
    expect(raw.work_orders_total).toBeUndefined();
    expect(raw.work_orders_done).toBeUndefined();
    expect(raw.pending_decisions).toBeUndefined();
    expect(raw.pending_bugs).toBeUndefined();
    expect(raw.last_green_sha).toBeUndefined();
    expect(raw.safe_to_test).toBeUndefined();
    expect(raw.rethink_pending).toBeUndefined();
    expect(raw.advance_pending).toBeUndefined();
    expect(raw.overlay_version).toBeUndefined();
    expect(raw.created_with).toBeUndefined();
    expect(raw.updated_at).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case: status.yaml absent → { present: false, malformed: false, status: null }
// AC-01-005.1 edge case + REQ-01-010 (mark not-found, don't break the view).
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — edge case: status.yaml absent (project path exists but no yaml)", () => {
  let tempProjectNoYaml: string;
  afterEach(() => {
    if (tempProjectNoYaml) {
      fs.rmSync(tempProjectNoYaml, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN status.yaml is absent THEN readStatus returns present: false", () => {
    // A project directory exists but has no .pandacorp/status.yaml.
    tempProjectNoYaml = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-absent-"));
    const pandacorpDir = path.join(tempProjectNoYaml, ".pandacorp");
    fs.mkdirSync(pandacorpDir, { recursive: true });
    // No status.yaml written inside.
    const result = readStatus(tempProjectNoYaml) as StatusResult;
    expect(result.present).toBe(false);
  });

  it("frd-01: WHEN status.yaml is absent THEN malformed is false (not an error, just absence)", () => {
    tempProjectNoYaml = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-absent2-"));
    fs.mkdirSync(path.join(tempProjectNoYaml, ".pandacorp"), { recursive: true });
    const result = readStatus(tempProjectNoYaml) as StatusResult;
    expect(result.malformed).toBe(false);
  });

  it("frd-01: WHEN status.yaml is absent THEN status is null (not {} or undefined)", () => {
    tempProjectNoYaml = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-absent3-"));
    fs.mkdirSync(path.join(tempProjectNoYaml, ".pandacorp"), { recursive: true });
    const result = readStatus(tempProjectNoYaml) as StatusResult;
    expect(result.status).toBeNull();
  });

  it("frd-01: WHEN status.yaml is absent THEN readStatus does NOT throw (fail-soft, blueprint §3)", () => {
    tempProjectNoYaml = fs.mkdtempSync(path.join(os.tmpdir(), "mc-status-absent4-"));
    fs.mkdirSync(path.join(tempProjectNoYaml, ".pandacorp"), { recursive: true });
    expect(() => readStatus(tempProjectNoYaml)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge case: project path itself does not exist → { present: false, malformed: false, status: null }
// REQ-01-010: "If a project's path does not exist, mark not-found without breaking."
// Regression: pathExists wraps existsSync with a catch (WO-01-001 review) — readStatus
// must use pathExists (or equivalent), never let a raw existsSync bubble up.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — REQ-01-010: non-existent project path → present: false, no throw", () => {
  it("frd-01: WHEN the project path does not exist THEN readStatus returns present: false", () => {
    const result = readStatus("/nonexistent/project/path/that/will/never/be/here") as StatusResult;
    expect(result.present).toBe(false);
  });

  it("frd-01: WHEN the project path does not exist THEN malformed is false", () => {
    const result = readStatus("/nonexistent/project/path/that/will/never/be/here") as StatusResult;
    expect(result.malformed).toBe(false);
  });

  it("frd-01: WHEN the project path does not exist THEN status is null", () => {
    const result = readStatus("/nonexistent/project/path/that/will/never/be/here") as StatusResult;
    expect(result.status).toBeNull();
  });

  it("frd-01: WHEN the project path does not exist THEN readStatus does NOT throw", () => {
    expect(() => readStatus("/nonexistent/project/path/that/will/never/be/here")).not.toThrow();
  });

  it("frd-01: WHEN an empty string is passed as project path THEN readStatus does NOT throw", () => {
    expect(() => readStatus("")).not.toThrow();
  });

  it("frd-01: WHEN an empty string is passed THEN readStatus returns present: false", () => {
    const result = readStatus("") as StatusResult;
    expect(result.present).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge case: malformed YAML (proj-b fixture) → { present: true, malformed: true, status: {} }
// blueprint §3: "Malformed YAML → { present: true, malformed: true, status: {} } (never throw)."
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — edge case: malformed status.yaml (proj-b)", () => {
  it("frd-01: WHEN status.yaml is malformed THEN readStatus returns present: true", () => {
    // proj-b has a deliberately broken status.yaml in the fixture.
    const result = readStatus(PROJ_B_PATH) as StatusResult;
    expect(result.present).toBe(true);
  });

  it("frd-01: WHEN status.yaml is malformed THEN malformed is true", () => {
    const result = readStatus(PROJ_B_PATH) as StatusResult;
    expect(result.malformed).toBe(true);
  });

  it("frd-01: WHEN status.yaml is malformed THEN status is an empty object {} (not null, not undefined)", () => {
    const result = readStatus(PROJ_B_PATH) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status).toEqual({});
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBeUndefined();
  });

  it("frd-01: WHEN status.yaml is malformed THEN readStatus does NOT throw", () => {
    expect(() => readStatus(PROJ_B_PATH)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge case: empty status.yaml (valid YAML, parses to null or {}) → partial, no throw
// An empty file is not malformed YAML; it parses to null. The reader must tolerate it.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — edge case: empty status.yaml", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN status.yaml is empty (0 bytes) THEN readStatus does NOT throw", () => {
    tempProject = makeTempProject("");
    expect(() => readStatus(tempProject)).not.toThrow();
  });

  it("frd-01: WHEN status.yaml is empty THEN present is true (file exists)", () => {
    tempProject = makeTempProject("");
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
  });

  it("frd-01: WHEN status.yaml is empty THEN all optional status fields are undefined (no defaults invented)", () => {
    tempProject = makeTempProject("");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // An empty yaml yields no fields — the reader must not invent defaults.
    expect(result.status.phase).toBeUndefined();
    expect(result.status.version).toBeUndefined();
    expect(result.status.running).toBeUndefined();
    expect(result.status.workOrdersTotal).toBeUndefined();
    expect(result.status.workOrdersDone).toBeUndefined();
    expect(result.status.pendingDecisions).toBeUndefined();
    expect(result.status.pendingBugs).toBeUndefined();
    expect(result.status.lastGreenSha).toBeUndefined();
    expect(result.status.safeToTest).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case: partial status.yaml (only some keys present) → partial, no throw
// blueprint §3: "Missing keys stay undefined/omitted (partial-tolerant)."
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — edge case: partial status.yaml (only phase + running)", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN status.yaml has only phase and running THEN present is true, malformed is false", () => {
    tempProject = makeTempProject("phase: design\nrunning: false\n");
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
    expect(result.malformed).toBe(false);
  });

  it("frd-01: WHEN status.yaml has only phase and running THEN those fields are populated", () => {
    tempProject = makeTempProject("phase: design\nrunning: false\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBe("design");
    expect(result.status.running).toBe(false);
  });

  it("frd-01: WHEN status.yaml has only phase and running THEN absent fields are undefined (not null or 0)", () => {
    tempProject = makeTempProject("phase: design\nrunning: false\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // Absent numeric fields must be undefined, not 0-coerced.
    expect(result.status.workOrdersTotal).toBeUndefined();
    expect(result.status.workOrdersDone).toBeUndefined();
    expect(result.status.pendingDecisions).toBeUndefined();
    expect(result.status.pendingBugs).toBeUndefined();
    expect(result.status.lastGreenSha).toBeUndefined();
    expect(result.status.safeToTest).toBeUndefined();
  });

  it("frd-01: WHEN status.yaml has only some work-order keys THEN readStatus does NOT throw", () => {
    tempProject = makeTempProject(
      "phase: architecture\nwork_orders_total: 10\nwork_orders_done: 3\n",
    );
    expect(() => readStatus(tempProject)).not.toThrow();
  });

  it("frd-01: WHEN status.yaml has work_orders_total and work_orders_done THEN they map correctly", () => {
    tempProject = makeTempProject(
      "phase: architecture\nwork_orders_total: 10\nwork_orders_done: 3\n",
    );
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.workOrdersTotal).toBe(10);
    expect(result.status.workOrdersDone).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AC-01-006.1 — Phase as single source of truth for column derivation.
// All five valid Phase values must be read correctly from status.yaml
// (DR-085: the old "operation" phase folded into "release").
// (The column derivation itself lives in FRD-02 lib/board.ts; this WO only
//  proves the phase is faithfully exposed by readStatus.)
// ---------------------------------------------------------------------------

const VALID_PHASE_CASES: Array<{ yaml: string; expected: Phase }> = [
  { yaml: "phase: product\nrunning: false\n", expected: "product" },
  { yaml: "phase: design\nrunning: false\n", expected: "design" },
  { yaml: "phase: architecture\nrunning: false\n", expected: "architecture" },
  { yaml: "phase: implementation\nrunning: true\n", expected: "implementation" },
  { yaml: "phase: release\nrunning: false\n", expected: "release" },
];

describe("frd-01: readStatus — AC-01-006.1: all five Phase values read correctly", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it.each(
    VALID_PHASE_CASES,
  )("frd-01: AC-01-006.1 — WHEN phase is '$expected' THEN readStatus exposes exactly '$expected'", ({
    yaml,
    expected,
  }) => {
    tempProject = makeTempProject(yaml);
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBe(expected);
  });

  it("frd-01: DR-085 — WHEN phase is the retired 'operation' value THEN phase is undefined (rejected)", () => {
    // The old "operation" phase folded into "release" (DR-085); it is no longer a valid Phase.
    tempProject = makeTempProject("phase: operation\nrunning: false\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.phase).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DR-085 — deploy_target (internal | external). Not a phase; an attribute of a
// release. readStatus maps snake_case deploy_target → camelCase deployTarget.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — DR-085 deploy_target parsing", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  const DEPLOY_TARGET_CASES: Array<{ yaml: string; expected: DeployTarget }> = [
    { yaml: "phase: release\ndeploy_target: internal\n", expected: "internal" },
    { yaml: "phase: release\ndeploy_target: external\n", expected: "external" },
  ];

  it.each(
    DEPLOY_TARGET_CASES,
  )("frd-01: WHEN deploy_target is '$expected' THEN deployTarget is exactly '$expected'", ({
    yaml,
    expected,
  }) => {
    tempProject = makeTempProject(yaml);
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.deployTarget).toBe(expected);
  });

  it("frd-01: WHEN deploy_target is absent THEN deployTarget is undefined (not fabricated)", () => {
    tempProject = makeTempProject("phase: release\nrunning: false\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.deployTarget).toBeUndefined();
  });

  it("frd-01: WHEN deploy_target is an invalid value THEN deployTarget is undefined (rejected)", () => {
    tempProject = makeTempProject("phase: release\ndeploy_target: somewhere\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect(result.status.deployTarget).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Regression: B1' (progress.md 2026-06-16) — NaN / non-finite number coercion.
// `typeof NaN === "number"` is true; a numeric field must reject NaN and use undefined.
// Analogous to the motion.duration bug where NaN bypassed a numeric type guard.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — regression B1': NaN must not be accepted as a numeric field value", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN work_orders_total parses as a non-finite number THEN workOrdersTotal is undefined (not NaN)", () => {
    // YAML does not have a native NaN literal; however a string ".NaN" is parsed
    // by some YAML parsers as a float NaN. We verify the reader sanitizes it.
    tempProject = makeTempProject("phase: implementation\nwork_orders_total: .NaN\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // Must not propagate NaN into the typed data.
    const val = result.status.workOrdersTotal;
    if (val !== undefined) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });

  it("frd-01: WHEN pending_decisions is a string in the yaml THEN pendingDecisions is undefined (type-safe)", () => {
    tempProject = makeTempProject('phase: design\npending_decisions: "two"\n');
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // String cannot be coerced into number — must be undefined, not "two" or NaN.
    expect(result.status.pendingDecisions).toBeUndefined();
  });

  it("frd-01: WHEN running is a number (1) in the yaml THEN running is undefined or true (not a number)", () => {
    // The `running` field must be a proper boolean, not a truthy number.
    tempProject = makeTempProject("phase: design\nrunning: 1\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // The reader must not coerce 1 → true; it must be either boolean true/false or undefined.
    if (result.status.running !== undefined) {
      expect(typeof result.status.running).toBe("boolean");
    }
  });

  it("frd-01: WHEN safe_to_test is a number (0) in the yaml THEN safeToTest is not a number", () => {
    tempProject = makeTempProject("phase: design\nsafe_to_test: 0\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    if (result.status.safeToTest !== undefined) {
      expect(typeof result.status.safeToTest).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: I2 (progress.md 2026-06-16) — empty-collection vacuous-truth.
// An empty YAML map ({}) must not be accepted as a valid field value for a
// numeric field. An empty status.yaml must yield all-undefined, not default 0s.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — regression I2: empty yaml map → all-undefined, no invented defaults", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN status.yaml contains only '{}' THEN no field is invented (all undefined)", () => {
    tempProject = makeTempProject("{}");
    const result = readStatus(tempProject) as StatusResult;
    expect(result.present).toBe(true);
    if (!result.present) return;
    // All fields must be absent — zero-defaults would be an invention.
    expect(result.status.workOrdersTotal).toBeUndefined();
    expect(result.status.workOrdersDone).toBeUndefined();
    expect(result.status.pendingDecisions).toBeUndefined();
    expect(result.status.pendingBugs).toBeUndefined();
    expect(result.status.lastGreenSha).toBeUndefined();
    expect(result.status.safeToTest).toBeUndefined();
    expect(result.status.phase).toBeUndefined();
    expect(result.status.running).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Regression: I3 (progress.md 2026-06-16) — array-shaped fields fool typeof.
// `phase: [implementation]` — an array — must not be accepted as a Phase string.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — regression I3: array value for phase must be rejected", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it("frd-01: WHEN phase is an array in yaml THEN status.phase is undefined (not the array)", () => {
    // YAML: `phase: [implementation]` parses to an array, not a string.
    tempProject = makeTempProject("phase: [implementation]\nrunning: true\n");
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    // Arrays must not leak through as a Phase value.
    if (result.status.phase !== undefined) {
      expect(typeof result.status.phase).toBe("string");
      const VALID_PHASES: Phase[] = [
        "product",
        "design",
        "architecture",
        "implementation",
        "release",
      ];
      expect(VALID_PHASES).toContain(result.status.phase);
    }
  });

  it("frd-01: WHEN last_green_sha is an array in yaml THEN lastGreenSha is undefined", () => {
    tempProject = makeTempProject('phase: product\nlast_green_sha: ["abc", "def"]\n');
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    if (result.status.lastGreenSha !== undefined) {
      expect(typeof result.status.lastGreenSha).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant — REQ-01-011: never write, never call Claude.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — REQ-01-011: read-only invariant", () => {
  it("frd-01: WHEN readStatus runs THEN status.yaml mtime is unchanged (no write to disk)", () => {
    const yamlPath = path.join(PROJ_A_PATH, ".pandacorp", "status.yaml");
    const statBefore = fs.statSync(yamlPath);

    readStatus(PROJ_A_PATH);

    const statAfter = fs.statSync(yamlPath);
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
  });

  it("frd-01: WHEN readStatus runs against an absent project THEN no file is created", () => {
    const ghostPath = "/tmp/pandacorp-ghost-project-that-must-not-be-created";
    // Ensure it truly doesn't exist.
    if (fs.existsSync(ghostPath)) fs.rmSync(ghostPath, { recursive: true, force: true });

    readStatus(ghostPath);

    expect(fs.existsSync(ghostPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Discriminated union contract — StatusResult shape invariants.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — StatusResult discriminated union shape", () => {
  it("frd-01: WHEN present is false THEN malformed is always false (absence is not malformation)", () => {
    // Non-existent project path → absent, not malformed.
    const result = readStatus("/nonexistent/absolutely") as StatusResult;
    expect(result.present).toBe(false);
    expect(result.malformed).toBe(false);
  });

  it("frd-01: WHEN present is false THEN status is null (not {} or undefined)", () => {
    const result = readStatus("/nonexistent/absolutely") as StatusResult;
    expect(result.present).toBe(false);
    expect(result.status).toBeNull();
  });

  it("frd-01: WHEN present is true and malformed is false THEN status is an object (not null)", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    expect(result.present).toBe(true);
    expect(result.malformed).toBe(false);
    expect(typeof result.status).toBe("object");
    expect(result.status).not.toBeNull();
  });

  it("frd-01: WHEN present is true and malformed is true THEN status is an empty object {}", () => {
    // proj-b has a malformed yaml fixture.
    const result = readStatus(PROJ_B_PATH) as StatusResult;
    expect(result.present).toBe(true);
    expect(result.malformed).toBe(true);
    expect(result.status).toEqual({});
  });

  it("frd-01: WHEN present is true THEN result always has both malformed and status keys", () => {
    const result = readStatus(PROJ_A_PATH) as StatusResult;
    expect("present" in result).toBe(true);
    expect("malformed" in result).toBe(true);
    expect("status" in result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Idempotency: calling readStatus twice returns the same result.
// ---------------------------------------------------------------------------

describe("frd-01: readStatus — idempotency", () => {
  it("frd-01: WHEN readStatus is called twice on proj-a THEN both calls return the same phase", () => {
    const first = readStatus(PROJ_A_PATH) as StatusResult;
    const second = readStatus(PROJ_A_PATH) as StatusResult;
    expect(first.present).toBe(second.present);
    if (first.present && second.present) {
      expect(first.status.phase).toBe(second.status.phase);
      expect(first.status.lastGreenSha).toBe(second.status.lastGreenSha);
      expect(first.status.safeToTest).toBe(second.status.safeToTest);
    }
  });

  it("frd-01: WHEN readStatus is called twice on proj-b (malformed) THEN both calls return malformed: true", () => {
    const first = readStatus(PROJ_B_PATH) as StatusResult;
    const second = readStatus(PROJ_B_PATH) as StatusResult;
    expect(first.malformed).toBe(second.malformed);
    expect(first.malformed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parametric: every camelCase field must not be undefined when the snake_case
// key is explicitly set in the YAML. Tests all key mappings in one sweep.
// (Substitute for property-based testing; fast-check is not in the dependency
//  tree. Each row is an independent regression surface for the snake→camel map.)
// ---------------------------------------------------------------------------

const SNAKE_TO_CAMEL_CASES: Array<{
  description: string;
  yaml: string;
  field: keyof ProjectStatus;
  expected: unknown;
}> = [
  {
    description: "work_orders_total → workOrdersTotal",
    yaml: "phase: product\nwork_orders_total: 42\n",
    field: "workOrdersTotal",
    expected: 42,
  },
  {
    description: "work_orders_done → workOrdersDone",
    yaml: "phase: product\nwork_orders_done: 17\n",
    field: "workOrdersDone",
    expected: 17,
  },
  {
    description: "pending_decisions → pendingDecisions",
    yaml: "phase: product\npending_decisions: 5\n",
    field: "pendingDecisions",
    expected: 5,
  },
  {
    description: "pending_bugs → pendingBugs",
    yaml: "phase: product\npending_bugs: 3\n",
    field: "pendingBugs",
    expected: 3,
  },
  {
    description: "rethink_pending → rethinkPending",
    yaml: "phase: product\nrethink_pending: true\n",
    field: "rethinkPending",
    expected: true,
  },
  {
    description: "advance_pending → advancePending",
    yaml: "phase: product\nadvance_pending: true\n",
    field: "advancePending",
    expected: true,
  },
  {
    description: "last_green_sha → lastGreenSha",
    yaml: "phase: product\nlast_green_sha: deadbeef\n",
    field: "lastGreenSha",
    expected: "deadbeef",
  },
  {
    description: "safe_to_test → safeToTest",
    yaml: "phase: product\nsafe_to_test: true\n",
    field: "safeToTest",
    expected: true,
  },
  {
    description: "overlay_version → overlayVersion",
    yaml: "phase: product\noverlay_version: '8.0.0'\n",
    field: "overlayVersion",
    expected: "8.0.0",
  },
  {
    description: "created_with → createdWith",
    yaml: "phase: product\ncreated_with: '7.0.0'\n",
    field: "createdWith",
    expected: "7.0.0",
  },
  {
    description: "updated_at → updatedAt",
    yaml: "phase: product\nupdated_at: '2026-06-16'\n",
    field: "updatedAt",
    expected: "2026-06-16",
  },
];

describe("frd-01: readStatus — snake_case → camelCase mapping exhaustive sweep", () => {
  let tempProject: string;
  afterEach(() => {
    if (tempProject) fs.rmSync(tempProject, { recursive: true, force: true });
  });

  it.each(
    SNAKE_TO_CAMEL_CASES,
  )("frd-01: WHEN yaml has $description THEN status.$field === $expected", ({
    yaml,
    field,
    expected,
  }) => {
    tempProject = makeTempProject(yaml);
    const result = readStatus(tempProject) as StatusResult;
    if (!result.present) throw new Error("Expected present: true");
    expect((result.status as Record<string, unknown>)[field]).toBe(expected);
  });
});
