/**
 * aggregateWiring.reviewer.test.ts — REVIEWER-AUTHORED adversarial acceptance suite (DR-080, FRD-23).
 *
 * The implementer proved the aggregate join, the regen writer and the backfill CLI in ISOLATION
 * (aggregate.test.ts / regen.test.ts / backfill.test.ts). What NONE of those tests exercise is the
 * one thing AC-23-003.1 actually requires: that the aggregate index is **reachable from the running
 * system** — i.e. that `/pandacorp:sync-portfolio` joins the portadas and that some real read path
 * reads the aggregate. WO-23-004's Status Note asserts this wiring exists ("`/pandacorp:sync-portfolio`
 * runs `pnpm stats:sync-aggregate` after its portfolio walk"; "a git `post-commit` hook ... runs
 * `pnpm stats:regen`"), but the skill/hook files were never touched.
 *
 * These tests fail LOUD on that gap. They are RED against the current (unwired) tree and turn GREEN
 * only once the sync-portfolio skill invokes the aggregate join and a real read path consumes the
 * aggregate (AC-23-003.1's two clauses).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// mission-control repo root: _tests → read-model → achievements → lib → src → MC_ROOT (up 5).
const MC_ROOT = path.resolve(HERE, "../../../../..");
const FACTORY_ROOT = path.resolve(MC_ROOT, "..");
const SYNC_PORTFOLIO_SKILL = path.join(
  FACTORY_ROOT,
  "plugin",
  "skills",
  "sync-portfolio",
  "SKILL.md",
);

function readIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

describe("AC-23-003.1 — the aggregate index is reachable from the running system, not just unit-tested", () => {
  it("the /pandacorp:sync-portfolio skill invokes the aggregate join (stats:sync-aggregate)", () => {
    // The AC's SUBJECT is literally "sync-portfolio SHALL join every project's portada into one
    // aggregate file". If the skill never calls the join, the aggregate is never built in the real
    // system — the join CLI exists but nothing runs it on a portfolio refresh.
    const skill = readIfExists(SYNC_PORTFOLIO_SKILL);
    expect(skill, `sync-portfolio SKILL.md not found at ${SYNC_PORTFOLIO_SKILL}`).not.toBe("");
    expect(
      /stats:sync-aggregate|sync-aggregate\.mjs|stats-aggregate\.json/.test(skill),
      "sync-portfolio must run the aggregate join after its portfolio walk (AC-23-003.1) — the skill text references none of stats:sync-aggregate / sync-aggregate.mjs / stats-aggregate.json",
    ).toBe(true);
  });

  it("some real MC read path consumes readStatsAggregate (the O(1) index is actually read)", () => {
    // "one aggregate file MC reads in O(1)" — if no render/read path imports the aggregate reader,
    // the O(1) index is built (best case) but never consumed, so the Informe's cost is NOT sourced
    // from it. Grep the app + component + lib surface (excluding the module's own def/tests) for a
    // real consumer of readStatsAggregate.
    const consumers: string[] = [];
    const roots = [path.join(MC_ROOT, "src", "app"), path.join(MC_ROOT, "src", "components")];
    const skip = new Set(["_tests"]);

    function walk(dir: string): void {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!skip.has(entry.name)) walk(path.join(dir, entry.name));
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const src = readIfExists(path.join(dir, entry.name));
        if (src.includes("readStatsAggregate")) consumers.push(path.join(dir, entry.name));
      }
    }
    for (const root of roots) walk(root);

    expect(
      consumers.length,
      "readStatsAggregate has zero consumers in src/app or src/components — the O(1) aggregate index is dead from the running application's perspective (AC-23-003.1)",
    ).toBeGreaterThan(0);
  });
});
