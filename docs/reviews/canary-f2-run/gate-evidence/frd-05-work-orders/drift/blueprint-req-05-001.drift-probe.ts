/**
 * Drift probe (DR-122) — FRD-05 blueprint §1 derived-ID table vs frd.md REQ-05-001.
 *
 * frd.md REQ-05-001 (the higher source of truth, FRD > blueprint) mandates FIVE columns including
 * Fail; the code (wo-board.tsx COLUMNS) renders five. The blueprint's §1 table row for REQ-05-001
 * and its AC-05-001.1 still describe the OLD four-column board (no Fail) — a stale spec.
 * Fails on an assertion while the blueprint is stale; passes once it is re-synced.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODULE = path.resolve(process.cwd(), "docs/frds/frd-05-work-orders");
const frd = fs.readFileSync(path.join(MODULE, "frd.md"), "utf8");
const blueprint = fs.readFileSync(path.join(MODULE, "blueprint.md"), "utf8");

describe("drift: FRD-05 blueprint REQ-05-001 tracks frd.md", () => {
  it("frd.md REQ-05-001 mandates five columns including Fail (the contract)", () => {
    const req = frd.split("\n").find((l) => l.includes("**REQ-05-001**")) ?? "";
    expect(req).toMatch(/\bfive\b/i);
    expect(req).toMatch(/\bFail\b/);
  });

  it("the blueprint's REQ-05-001 row and AC-05-001.1 describe the same five-column board", () => {
    const row = blueprint.split("\n").find((l) => l.startsWith("| REQ-05-001 |")) ?? "";
    const ac = blueprint.split("\n").find((l) => l.includes("**AC-05-001.1**")) ?? "";
    expect(row, "blueprint §1 REQ-05-001 row lacks the Fail column").toMatch(/\bFail\b/);
    expect(ac, "blueprint AC-05-001.1 still says four columns").not.toMatch(/\bfour columns\b/i);
  });
});
