/**
 * WO-04-003 — `workspaceCommands(phase)` — ADVERSARIAL suite (reviewer, DR-015)
 *
 * Written by the reviewer (Opus 4.8) — a DIFFERENT model from the implementer —
 * to probe edge cases, abuse and mutation-survival the implementer's own
 * `lib/next-step.wo04003.test.ts` did not cover. None of these duplicate the
 * implementer's assertions; each targets a hole.
 *
 * Traceability: REQ-04-005 / AC-04-005.1 / IF-04-next-step.
 *
 * Probes:
 *   1. Shared-mutable-state: the function returns `[...BUILDING_ROWS]` (a shallow
 *      copy). The ROW OBJECTS are shared by reference across calls. A caller that
 *      mutates a returned row would corrupt every subsequent call. The `readonly`
 *      annotation is compile-time only; at runtime the objects are plain & mutable.
 *      This is a real latent bug for a "pure, deterministic" function.
 *   2. Cross-phase row-object identity isolation.
 *   3. `when` descriptions must be distinct per row (a mutant copying one row's
 *      `when` onto another passes the implementer's length-only checks).
 *   4. Construction (implementation) vs launched (release) `iterate` rows must not
 *      share the same `when` (different context: "during build" vs "launched project").
 *   5. Unknown/empty/whitespace phase strings → safe fallback, never building cmds.
 *
 * Pure function — no fs, no mocks. Stack: Vitest.
 */

import { describe, expect, it } from "vitest";
import { workspaceCommands } from "../next-step";

type Row = { command: string; when: string };

// NOTE on ordering: the shared-mutable-state probes (block "1") deliberately
// mutate a returned row to prove the leak. Because the bug IS that those rows
// alias module-level constants, running them first would poison every later
// test in this file. They are therefore placed LAST, after the read-only
// diagnostics, so each finding stays cleanly attributable.

// ---------------------------------------------------------------------------
// 3. `when` descriptions must be distinct per row.
//
// The implementer only checks `when.length > 5`. A mutant that sets every row's
// `when` to the same string (or copies one onto another) survives that. The
// Commands tab needs a DIFFERENT "when to use" per command to be useful.
// ---------------------------------------------------------------------------

describe("frd-04 adversarial: each row's 'when' is unique within a phase", () => {
  it("implementation: the three 'when' descriptions are all distinct", () => {
    const whens = workspaceCommands("implementation").map((r: Row) => r.when);
    expect(new Set(whens).size).toBe(whens.length);
  });

  it("release: the two 'when' descriptions are distinct", () => {
    const whens = workspaceCommands("release").map((r: Row) => r.when);
    expect(new Set(whens).size).toBe(whens.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Context-specific copy — the iterate row's 'when' should differ between a
//    mid-build (implementation) context and a launched (release) context (they
//    describe different moments). A mutant reusing the build 'when' for the
//    launched phase is misleading.
// ---------------------------------------------------------------------------

describe("frd-04 adversarial: iterate row 'when' is context-specific", () => {
  it("the iterate row's 'when' differs between implementation and release phases", () => {
    const buildingIterate = workspaceCommands("implementation").find(
      (r: Row) => r.command === "/pandacorp:iterate",
    );
    const releaseIterate = workspaceCommands("release").find(
      (r: Row) => r.command === "/pandacorp:iterate",
    );
    expect(buildingIterate).toBeDefined();
    expect(releaseIterate).toBeDefined();
    expect(buildingIterate?.when).not.toBe(releaseIterate?.when);
  });
});

// ---------------------------------------------------------------------------
// 5. Hostile / malformed phase strings — must never produce a building command.
//    The implementer tested undefined and "build"; these add empty string,
//    whitespace, casing and prototype-pollution-shaped keys.
// ---------------------------------------------------------------------------

describe("frd-04 adversarial: malformed phase strings fall back safely", () => {
  const hostile = [
    "",
    "   ",
    "IMPLEMENTATION", // wrong casing — must not match
    "implementation ", // trailing space — must not match
    "__proto__",
    "constructor",
    "release\n",
  ];

  for (const phase of hostile) {
    it(`phase ${JSON.stringify(phase)} → does not throw, returns >=1 row, no building command`, () => {
      expect(() => workspaceCommands(phase as never)).not.toThrow();
      const rows = workspaceCommands(phase as never);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const commands = rows.map((r: Row) => r.command);
      expect(commands).not.toContain("/pandacorp:implement");
      expect(commands).not.toContain("/pandacorp:release");
      expect(commands).not.toContain("/pandacorp:iterate");
      expect(commands).not.toContain("/pandacorp:new-version");
    });
  }

  it("null phase → does not throw and returns a safe fallback row", () => {
    expect(() => workspaceCommands(null as never)).not.toThrow();
    const rows = workspaceCommands(null as never);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.command).not.toBe("/pandacorp:implement");
  });
});

// ---------------------------------------------------------------------------
// 1. Shared-mutable-state — determinism must survive a caller mutating a result.
//    (Placed LAST: these probes mutate returned rows; with the current
//     implementation that corrupts the module constants, so they would poison
//     any test that ran after them.)
//
// A function documented as "Pure: no side effects. Same input → same output
// every time" must not hand callers a reference into its internal constant
// arrays (`BUILDING_ROWS` / `RELEASE_ROWS`). `[...CONST]` copies the array
// but the ROW OBJECTS are shared by reference; `readonly` is compile-time only.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. Mutation-killing: pin the exact (command, when) PAIRING per phase.
//    The implementer pins `command` and the reviewer pins `when` uniqueness, but
//    a mutant that swaps two rows' `when` (each still unique) or rewires a
//    command→when pairing survives both. Pinning the full pair closes that.
//    (DR-016 mutation testing at FRD milestones.)
// ---------------------------------------------------------------------------

describe("frd-04 adversarial: command→when pairing is pinned (mutation kill)", () => {
  it("implementation: each command carries its OWN 'when', not another row's", () => {
    const rows = workspaceCommands("implementation");
    const byCmd = new Map(rows.map((r: Row) => [r.command, r.when]));
    // implement's 'when' must speak to continuing the build, not releasing/iterating.
    expect(byCmd.get("/pandacorp:implement")).toMatch(/construc|reanud/i);
    // release's 'when' must speak to launching when work orders are done.
    expect(byCmd.get("/pandacorp:release")).toMatch(/work order|lanzar/i);
    // iterate's 'when' must speak to adding/adjusting an FRD.
    expect(byCmd.get("/pandacorp:iterate")).toMatch(/FRD|ajust|corrig/i);
  });

  it("release: new-version's 'when' is about a milestone/major version, not iteration", () => {
    const rows = workspaceCommands("release");
    const byCmd = new Map(rows.map((r: Row) => [r.command, r.when]));
    expect(byCmd.get("/pandacorp:new-version")).toMatch(/hito|versi[oó]n mayor/i);
    // new-version's 'when' must NOT be the iterate copy (a swap mutant).
    expect(byCmd.get("/pandacorp:new-version")).not.toBe(byCmd.get("/pandacorp:iterate"));
  });

  it("every returned row has a non-empty command AND a non-empty 'when' (no blank-string mutant)", () => {
    for (const p of ["implementation", "release", "product", "design", "architecture"] as const) {
      for (const r of workspaceCommands(p)) {
        expect(r.command.trim().length).toBeGreaterThan(0);
        expect(r.when.trim().length).toBeGreaterThan(0);
        // every command is a /pandacorp:* invocation (no leaked label/garbage).
        expect(r.command).toMatch(/^\/pandacorp:/);
      }
    }
  });

  it("release phase yields DIFFERENT rows from implementation (launched ≠ construction, DR-085)", () => {
    // DR-085: implementation is the construction set (implement/release/iterate);
    // release is the launched set (iterate/new-version). They must NOT be equal.
    const impl = workspaceCommands("implementation");
    const rel = workspaceCommands("release");
    expect(rel).not.toEqual(impl);
    expect(rel.map((r: Row) => r.command)).toEqual([
      "/pandacorp:iterate",
      "/pandacorp:new-version",
    ]);
  });
});

describe("frd-04 adversarial: returned rows must not alias shared module state", () => {
  it("mutating a returned building row must NOT corrupt the next call (no shared reference)", () => {
    const firstRow = workspaceCommands("implementation")[0];
    expect(firstRow).toBeDefined();
    if (firstRow === undefined) return;
    // Hostile caller mutates the row it received.
    firstRow.command = "/pandacorp:HACKED";
    firstRow.when = "tampered";

    const second = workspaceCommands("implementation");
    expect(second[0]?.command).toBe("/pandacorp:implement");
    expect(second[0]?.when).not.toBe("tampered");
  });

  it("mutating a returned release (launched) row must NOT corrupt the next call", () => {
    const firstRow = workspaceCommands("release")[0];
    expect(firstRow).toBeDefined();
    if (firstRow === undefined) return;
    firstRow.command = "/pandacorp:HACKED";
    const second = workspaceCommands("release");
    expect(second[0]?.command).toBe("/pandacorp:iterate");
  });

  it("the returned array reference differs between calls (fresh array each time)", () => {
    const a = workspaceCommands("implementation");
    const b = workspaceCommands("implementation");
    expect(a).not.toBe(b);
  });

  it("a returned row object is not the SAME object instance as the next call's row", () => {
    // If row objects are shared, a[0] === b[0]; a pure boundary must hand out
    // fresh (or frozen) objects so callers cannot reach module state.
    const a = workspaceCommands("release");
    const b = workspaceCommands("release");
    expect(a[0]).not.toBe(b[0]);
  });
});
