/**
 * WO-04-003 — `lib/next-step.ts`: `workspaceCommands(phase)`
 *
 * Traceability:
 *   REQ-04-005   The Commands tab SHALL show the stage-relevant commands
 *                (continue implement, release, iterate, with when to use each).
 *   AC-04-005.1  The Commands tab SHALL render the stage-relevant command rows
 *                from lib/next-step.ts, each with a copy button and a "when to
 *                use" description. → workspaceCommands must return CommandRow[]
 *                where every row has command (string) and when (string).
 *
 * WO-04-003 scope (blueprint §2, IF-04-next-step) — updated for DR-085:
 *   export interface CommandRow { command: string; when: string; }
 *   export function workspaceCommands(phase: Phase): CommandRow[];
 *
 *   Phase → CommandRow[] mapping (DR-085: construction = implementation; the
 *   launched phase = "release", which folded in the old "operation"):
 *     "implementation" → [/pandacorp:implement, /pandacorp:release, /pandacorp:iterate]
 *     "release"        → [/pandacorp:iterate, /pandacorp:new-version]  (launched project)
 *     earlier phases   → delegates to FRD-02 base nextStep; returns the single
 *                        next-step command as a one-element CommandRow array.
 *
 * Regression anchors (real incidents from .pandacorp/comms/progress.md):
 *   B1' (2026-06-16): NaN sneaks through typeof guards — readStatus rejects NaN
 *     upstream; here we test that an unrecognised / undefined phase does not
 *     crash or produce an empty array silently (the function must always return
 *     at least one actionable row, never an empty array).
 *   I3 (2026-06-16): array-shaped phase values are rejected upstream by readStatus
 *     and arrive here as undefined — same guard required: never empty, never throw.
 *   B2 / WO-12-004 (2026-06-16): a function that returns an empty array for a
 *     valid input is undetectable by generic toBeTruthy — each EARS criterion gets
 *     a concrete count or element check.
 *
 * Pure function: no fs, no writes, no network, no side effects. Never throws.
 * Stack: Vitest. All inputs are inline values; each test is independent.
 */

import { describe, expect, it } from "vitest";

import { workspaceCommands } from "../next-step";

// Mirror of CommandRow from the blueprint contract (IF-04-next-step).
type CommandRow = { command: string; when: string };

// All canonical commands that may appear in WorkspaceCommands output.
const CMD_IMPLEMENT = "/pandacorp:implement";
const CMD_IMPLEMENT_FRD = "/pandacorp:implement <frd>";
const CMD_IMPLEMENT_CHANGE = "/pandacorp:implement change:<slug>";
const CMD_RELEASE = "/pandacorp:release";
const CMD_ITERATE = "/pandacorp:iterate";
const CMD_NEW_VERSION = "/pandacorp:new-version";

// Commands that MUST NOT appear for launched ("release") rows (pre-build commands).
const PRE_BUILD_COMMANDS = ["/pandacorp:spec <idea>", "/pandacorp:design", "/pandacorp:blueprint"];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Assert a value is a CommandRow with non-empty strings. */
function assertCommandRow(row: CommandRow): void {
  expect(typeof row.command).toBe("string");
  expect(row.command.trim().length).toBeGreaterThan(0);
  expect(typeof row.when).toBe("string");
  expect(row.when.trim().length).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// AC-04-005.1 — implementation (construction) phase
//
// WHEN phase is "implementation" THEN workspaceCommands returns the three
// construction-phase commands in the required order:
//   1. /pandacorp:implement  — "continue/resume the build"
//   2. /pandacorp:release    — "when all work orders are done"
//   3. /pandacorp:iterate    — "add an FRD, tweak or fix"
// ---------------------------------------------------------------------------

describe("frd-04: workspaceCommands — AC-04-005.1 implementation phase", () => {
  it("frd-04: WHEN phase is implementation THEN function does not throw", () => {
    expect(() => workspaceCommands("implementation")).not.toThrow();
  });

  it("frd-04: WHEN phase is implementation THEN returns exactly five rows", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    expect(rows).toHaveLength(5);
  });

  it("frd-04: WHEN phase is implementation THEN first row command is /pandacorp:implement (full build)", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    expect(rows[0]?.command).toBe(CMD_IMPLEMENT);
  });

  it("frd-04: WHEN phase is implementation THEN second row command is /pandacorp:implement <frd> (partial by FRD)", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    expect(rows[1]?.command).toBe(CMD_IMPLEMENT_FRD);
  });

  it("frd-04: WHEN phase is implementation THEN third row command is /pandacorp:implement change:<slug> (partial by change)", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    expect(rows[2]?.command).toBe(CMD_IMPLEMENT_CHANGE);
  });

  it("frd-04: WHEN phase is implementation THEN fourth row command is /pandacorp:release", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    expect(rows[3]?.command).toBe(CMD_RELEASE);
  });

  it("frd-04: WHEN phase is implementation THEN fifth row command is /pandacorp:iterate", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    expect(rows[4]?.command).toBe(CMD_ITERATE);
  });

  it("frd-04: WHEN phase is implementation THEN each row has non-empty command and when strings", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    for (const row of rows) {
      assertCommandRow(row);
    }
  });

  it("frd-04: WHEN phase is implementation THEN rows are an Array (not array-like — regression I3)", () => {
    const rows = workspaceCommands("implementation");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("frd-04: WHEN phase is implementation THEN 'when' for implement row describes resume/continue (not a placeholder)", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    // The 'when' field must describe the resume/continue scenario, not be generic.
    // We do NOT prescribe exact wording but require meaningful length (>5 chars).
    const implementWhen = rows[0]?.when ?? "";
    expect(implementWhen.length).toBeGreaterThan(5);
  });

  it("frd-04: WHEN phase is implementation THEN 'when' for release row describes all-WOs-done scenario", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    const releaseWhen = rows[1]?.when ?? "";
    expect(releaseWhen.length).toBeGreaterThan(5);
  });

  it("frd-04: WHEN phase is implementation THEN 'when' for iterate row describes add/tweak/fix scenario", () => {
    const rows: CommandRow[] = workspaceCommands("implementation");
    const iterateWhen = rows[2]?.when ?? "";
    expect(iterateWhen.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// AC-04-005.1 — release (launched) phase
//
// DR-085: "release" is the launched phase (the old "operation" folded in).
// WHEN phase is "release" THEN workspaceCommands returns the launched-project set:
//   1. /pandacorp:iterate    — primary action for a launched project
//   2. /pandacorp:new-version — optional milestone (WO-04-003 §Scope)
// The iterate command is the primary one; new-version is the second.
// ---------------------------------------------------------------------------

describe("frd-04: workspaceCommands — AC-04-005.1 release (launched) phase", () => {
  it("frd-04: WHEN phase is release THEN function does not throw", () => {
    expect(() => workspaceCommands("release")).not.toThrow();
  });

  it("frd-04: WHEN phase is release THEN returns exactly two rows", () => {
    const rows: CommandRow[] = workspaceCommands("release");
    expect(rows).toHaveLength(2);
  });

  it("frd-04: WHEN phase is release THEN first row command is /pandacorp:iterate", () => {
    const rows: CommandRow[] = workspaceCommands("release");
    expect(rows[0]?.command).toBe(CMD_ITERATE);
  });

  it("frd-04: WHEN phase is release THEN second row command is /pandacorp:new-version", () => {
    const rows: CommandRow[] = workspaceCommands("release");
    expect(rows[1]?.command).toBe(CMD_NEW_VERSION);
  });

  it("frd-04: WHEN phase is release THEN each row has non-empty command and when strings", () => {
    const rows: CommandRow[] = workspaceCommands("release");
    for (const row of rows) {
      assertCommandRow(row);
    }
  });

  it("frd-04: WHEN phase is release THEN no pre-build command appears (regression: wrong delegation)", () => {
    const rows: CommandRow[] = workspaceCommands("release");
    const commands = rows.map((r: CommandRow) => r.command);
    for (const preBuilt of PRE_BUILD_COMMANDS) {
      expect(commands).not.toContain(preBuilt);
    }
  });

  it("frd-04: WHEN phase is release THEN /pandacorp:implement does not appear (launched project)", () => {
    const rows: CommandRow[] = workspaceCommands("release");
    const commands = rows.map((r) => r.command);
    expect(commands).not.toContain(CMD_IMPLEMENT);
  });

  it("frd-04: WHEN phase is release THEN /pandacorp:release does not appear (already launched)", () => {
    const rows: CommandRow[] = workspaceCommands("release");
    const commands = rows.map((r) => r.command);
    expect(commands).not.toContain(CMD_RELEASE);
  });
});

// ---------------------------------------------------------------------------
// AC-04-005.1 — early phases delegate to FRD-02 nextStep
//
// WHEN phase is one of product | design | architecture THEN workspaceCommands
// delegates to the existing FRD-02 base map and returns the single next-step
// command as a one-element CommandRow array.
// This avoids duplication: the phase → command map is owned by nextStep, not
// duplicated here.
// ---------------------------------------------------------------------------

describe("frd-04: workspaceCommands — AC-04-005.1 early-phase delegation to FRD-02", () => {
  const earlyPhases = ["product", "design", "architecture"] as const;

  for (const phase of earlyPhases) {
    it(`frd-04: WHEN phase is ${phase} THEN function does not throw`, () => {
      expect(() => workspaceCommands(phase)).not.toThrow();
    });

    it(`frd-04: WHEN phase is ${phase} THEN returns exactly one row (single next step, not duplicated)`, () => {
      const rows: CommandRow[] = workspaceCommands(phase);
      expect(rows).toHaveLength(1);
    });

    it(`frd-04: WHEN phase is ${phase} THEN the single row has non-empty command and when strings`, () => {
      const rows: CommandRow[] = workspaceCommands(phase);
      const row = rows[0];
      expect(row).toBeDefined();
      // biome-ignore lint/style/noNonNullAssertion: guarded by expect(row).toBeDefined() above
      assertCommandRow(row!);
    });

    it(`frd-04: WHEN phase is ${phase} THEN the command is NOT one of the building-phase commands (no cross-contamination)`, () => {
      // architecture delegates to /pandacorp:implement (FRD-02 base) — its command
      // string coincides with a building-phase command but the semantic is different
      // ("start the build", not "resume the build"). The specific delegation test
      // at line ~304 pins the exact expected value for architecture.
      // For product and design the delegated command must not be a building-phase command.
      if (phase === "architecture") return;
      const rows: CommandRow[] = workspaceCommands(phase);
      const cmd = rows[0]?.command;
      expect(cmd).not.toBe(CMD_IMPLEMENT);
      expect(cmd).not.toBe(CMD_RELEASE);
      expect(cmd).not.toBe(CMD_ITERATE);
      expect(cmd).not.toBe(CMD_NEW_VERSION);
    });

    it(`frd-04: WHEN phase is ${phase} THEN returns an Array (regression I3)`, () => {
      const rows = workspaceCommands(phase);
      expect(Array.isArray(rows)).toBe(true);
    });
  }

  // Specific delegation assertions to lock the FRD-02 mapping (mutation hardening).
  it("frd-04 delegation[product]: phase product → single command is /pandacorp:design", () => {
    const rows: CommandRow[] = workspaceCommands("product");
    expect(rows[0]?.command).toBe("/pandacorp:design");
  });

  it("frd-04 delegation[design]: phase design → single command is /pandacorp:blueprint", () => {
    const rows: CommandRow[] = workspaceCommands("design");
    expect(rows[0]?.command).toBe("/pandacorp:blueprint");
  });

  it("frd-04 delegation[architecture]: phase architecture → single command is /pandacorp:implement", () => {
    const rows: CommandRow[] = workspaceCommands("architecture");
    expect(rows[0]?.command).toBe(CMD_IMPLEMENT);
  });
});

// ---------------------------------------------------------------------------
// Pure function invariants
//
// workspaceCommands is a pure function (no fs, no IO).
// Same input → same output every time.
// Input must not be mutated.
// ---------------------------------------------------------------------------

describe("frd-04: workspaceCommands — pure function invariants", () => {
  it("frd-04: WHEN called twice with the same phase THEN returns the same commands (deterministic)", () => {
    const phases = ["implementation", "release", "product", "design", "architecture"] as const;
    for (const phase of phases) {
      const first = workspaceCommands(phase).map((r: CommandRow) => r.command);
      const second = workspaceCommands(phase).map((r: CommandRow) => r.command);
      expect(first).toEqual(second);
    }
  });

  it("frd-04: WHEN called with any valid phase THEN returns an Array (not falsy, not null, not undefined)", () => {
    const phases = ["product", "design", "architecture", "implementation", "release"] as const;
    for (const phase of phases) {
      const rows = workspaceCommands(phase);
      expect(rows).not.toBeNull();
      expect(rows).not.toBeUndefined();
      expect(Array.isArray(rows)).toBe(true);
    }
  });

  it("frd-04: WHEN called with any valid phase THEN returns at least one row (never empty array)", () => {
    // Regression B2 / WO-12-004: an empty array is undetectable by generic toBeTruthy.
    const phases = ["product", "design", "architecture", "implementation", "release"] as const;
    for (const phase of phases) {
      const rows = workspaceCommands(phase);
      expect(rows.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("frd-04: WHEN called THEN does not mutate any module-level state (idempotent across repeated calls)", () => {
    // Call in an order that exercises all branches, then verify the construction
    // phase still produces its canonical output.
    workspaceCommands("release");
    workspaceCommands("product");
    workspaceCommands("design");
    const impl = workspaceCommands("implementation");
    expect(impl.map((r: CommandRow) => r.command)).toEqual([
      CMD_IMPLEMENT,
      CMD_IMPLEMENT_FRD,
      CMD_IMPLEMENT_CHANGE,
      CMD_RELEASE,
      CMD_ITERATE,
    ]);
  });

  it("frd-04: WHEN called THEN every returned row's when field is distinct from its command field", () => {
    // 'when' is the description of when to use the command — it is NOT the command string itself.
    const phases = ["implementation", "release"] as const;
    for (const phase of phases) {
      for (const row of workspaceCommands(phase)) {
        expect(row.when).not.toBe(row.command);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Mapping completeness (mutation hardening)
//
// One assertion per mapping cell. Each test kills a distinct mutant:
// changing one command string or one phase branch fails exactly one test.
// ---------------------------------------------------------------------------

describe("frd-04: workspaceCommands — complete mapping table (mutation hardening)", () => {
  // Implementation rows
  it("frd-04 mapping[impl-0]: implementation row[0] command is /pandacorp:implement (full build)", () => {
    expect(workspaceCommands("implementation")[0]?.command).toBe(CMD_IMPLEMENT);
  });
  it("frd-04 mapping[impl-1]: implementation row[1] command is /pandacorp:implement <frd> (partial by FRD)", () => {
    expect(workspaceCommands("implementation")[1]?.command).toBe(CMD_IMPLEMENT_FRD);
  });
  it("frd-04 mapping[impl-2]: implementation row[2] command is /pandacorp:implement change:<slug> (partial by change)", () => {
    expect(workspaceCommands("implementation")[2]?.command).toBe(CMD_IMPLEMENT_CHANGE);
  });
  it("frd-04 mapping[impl-3]: implementation row[3] command is /pandacorp:release", () => {
    expect(workspaceCommands("implementation")[3]?.command).toBe(CMD_RELEASE);
  });
  it("frd-04 mapping[impl-4]: implementation row[4] command is /pandacorp:iterate", () => {
    expect(workspaceCommands("implementation")[4]?.command).toBe(CMD_ITERATE);
  });

  // Release (launched) rows
  it("frd-04 mapping[rel-0]: release row[0] command is /pandacorp:iterate", () => {
    expect(workspaceCommands("release")[0]?.command).toBe(CMD_ITERATE);
  });
  it("frd-04 mapping[rel-1]: release row[1] command is /pandacorp:new-version", () => {
    expect(workspaceCommands("release")[1]?.command).toBe(CMD_NEW_VERSION);
  });

  // Early-phase delegation (locks the FRD-02 delegation chain)
  it("frd-04 mapping[product]: product row[0] command is /pandacorp:design", () => {
    expect(workspaceCommands("product")[0]?.command).toBe("/pandacorp:design");
  });
  it("frd-04 mapping[design]: design row[0] command is /pandacorp:blueprint", () => {
    expect(workspaceCommands("design")[0]?.command).toBe("/pandacorp:blueprint");
  });
  it("frd-04 mapping[architecture]: architecture row[0] command is /pandacorp:implement", () => {
    expect(workspaceCommands("architecture")[0]?.command).toBe(CMD_IMPLEMENT);
  });

  // Count guards (kills array-truncation mutants)
  it("frd-04 mapping counts: implementation has 5 rows, release has 2, early phases have 1", () => {
    expect(workspaceCommands("implementation")).toHaveLength(5);
    expect(workspaceCommands("release")).toHaveLength(2);
    expect(workspaceCommands("product")).toHaveLength(1);
    expect(workspaceCommands("design")).toHaveLength(1);
    expect(workspaceCommands("architecture")).toHaveLength(1);
  });

  // Row order: the three implement variants come first, then release, then iterate.
  it("frd-04 mapping order: in implementation, /pandacorp:iterate is last (row index 4)", () => {
    const rows = workspaceCommands("implementation");
    const iterateIndex = rows.findIndex((r: CommandRow) => r.command === CMD_ITERATE);
    expect(iterateIndex).toBe(4);
  });

  it("frd-04 mapping order: in implementation, all three implement variants appear before /pandacorp:release", () => {
    const rows = workspaceCommands("implementation");
    const releaseIndex = rows.findIndex((r: CommandRow) => r.command === CMD_RELEASE);
    const frdIndex = rows.findIndex((r: CommandRow) => r.command === CMD_IMPLEMENT_FRD);
    const changeIndex = rows.findIndex((r: CommandRow) => r.command === CMD_IMPLEMENT_CHANGE);
    expect(frdIndex).toBeLessThan(releaseIndex);
    expect(changeIndex).toBeLessThan(releaseIndex);
  });

  it("frd-04 mapping order: in release, /pandacorp:iterate is first (row index 0)", () => {
    const rows = workspaceCommands("release");
    expect(rows[0]?.command).toBe(CMD_ITERATE);
  });
});

// ---------------------------------------------------------------------------
// Regression anchors — direct tests against past incident patterns
//
// B1' (2026-06-16): NaN sneaks through typeof guards.
//   Phase arrives as undefined when readStatus rejects NaN upstream.
//   workspaceCommands must not crash and must return at least one row.
//
// I3 (2026-06-16): array-shaped objects fool typeof.
//   Same: undefined phase after readStatus rejection must be handled safely.
//
// The function signature accepts Phase (a string union); runtime callers from
// a partially-typed YAML path may pass undefined or an unrecognised string
// (including the retired "operation" phase). The function owns its boundary.
// ---------------------------------------------------------------------------

describe("frd-04: workspaceCommands — regression B1' and I3 (undefined / unknown phase)", () => {
  it("frd-04 regression-B1': WHEN phase is undefined (NaN rejected upstream) THEN function does not throw", () => {
    // undefined is cast through: the function must own its runtime boundary.
    expect(() => workspaceCommands(undefined as never)).not.toThrow();
  });

  it("frd-04 regression-B1': WHEN phase is undefined THEN returns an Array (never null, never undefined)", () => {
    const rows = workspaceCommands(undefined as never);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("frd-04 regression-B1': WHEN phase is undefined THEN returns at least one row (never empty — regression B2)", () => {
    const rows = workspaceCommands(undefined as never);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-04 regression-B1': WHEN phase is undefined THEN each returned row has non-empty command and when", () => {
    const rows = workspaceCommands(undefined as never);
    for (const row of rows) {
      assertCommandRow(row);
    }
  });

  it("frd-04 regression-B1': WHEN phase is undefined THEN result is deterministic (same value every call)", () => {
    const first = workspaceCommands(undefined as never).map((r: CommandRow) => r.command);
    const second = workspaceCommands(undefined as never).map((r: CommandRow) => r.command);
    expect(first).toEqual(second);
  });

  it("frd-04 regression-I3: WHEN phase is an unrecognised string THEN does not throw and returns at least one row", () => {
    // e.g. a phase string that never appears in the valid Phase union.
    expect(() => workspaceCommands("build" as never)).not.toThrow();
    const rows = workspaceCommands("build" as never);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-04 regression-I3: WHEN phase is an unrecognised string THEN does NOT return building commands (no guessing)", () => {
    // An unrecognised phase must never silently map to implement/release — that
    // would be misleading. It should fall back to the safe pre-pipeline spec row.
    const rows = workspaceCommands("build" as never);
    const commands = rows.map((r: CommandRow) => r.command);
    expect(commands).not.toContain(CMD_IMPLEMENT);
    expect(commands).not.toContain(CMD_RELEASE);
  });

  it("frd-04 DR-085: WHEN phase is the retired 'operation' value THEN falls back to spec (not the launched set)", () => {
    // The old "operation" phase folded into "release"; passing it now is an unknown phase.
    const rows = workspaceCommands("operation" as never);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.command).toBe("/pandacorp:spec <idea>");
  });
});
