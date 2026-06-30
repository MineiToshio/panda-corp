/**
 * CMP-09-guild-state — readGuildState() single source of truth (FRD-09)
 *
 * Verifies the guild state is derived ONCE from the live data layers, with the
 * portfolio path RESOLVED before readStatus (the regression: an unresolved path
 * read ABSENT for every project, so the header showed NV3 while Logros showed NV1).
 *
 * Uses the established temp-factory-root pattern (PANDACORP_FACTORY_ROOT), same as
 * layout.guildbartop.test.tsx — exercises the real readers, no mocks.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeGuildLevel, deriveGuildOutcomes } from "../gamification";
import { readGuildState } from "../guildState";

let tmpRoot: string;
const ORIGINAL_ENV = process.env.PANDACORP_FACTORY_ROOT;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-guild-state-"));
  fs.mkdirSync(path.join(tmpRoot, "factory"), { recursive: true });
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.PANDACORP_FACTORY_ROOT;
  } else {
    process.env.PANDACORP_FACTORY_ROOT = ORIGINAL_ENV;
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

/** Write factory/portfolio.md with a single project whose path is `relPath`. */
function writePortfolio(relPath: string): void {
  const md = [
    "# Portfolio",
    "",
    "| Name | Path | Phase |",
    "| --- | --- | --- |",
    `| Demo | ${relPath} | release |`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(tmpRoot, "factory", "portfolio.md"), md, "utf-8");
}

/** Write `<relPath>/.pandacorp/status.yaml` (factory-root-relative project). */
function writeStatus(relPath: string, yaml: string): void {
  const dir = path.join(tmpRoot, relPath, ".pandacorp");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "status.yaml"), yaml, "utf-8");
}

describe("readGuildState — single source of truth", () => {
  it("resolves the factory-root-relative portfolio path before readStatus (regression)", () => {
    process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
    writePortfolio("demo");
    writeStatus(
      "demo",
      ["phase: release", "deploy_target: external", "work_orders_total: 10"].join("\n"),
    );

    const state = readGuildState();

    // The project status was actually READ (present:true) — NOT ABSENT, which is
    // what an unresolved "demo" path would have produced.
    expect(state.statuses).toHaveLength(1);
    expect(state.statuses[0]?.present).toBe(true);
  });

  it("returns a level that is exactly computeGuildLevel(outcomes) (no divergence)", () => {
    process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
    writePortfolio("demo");
    writeStatus("demo", ["phase: release", "deploy_target: external"].join("\n"));

    const state = readGuildState();

    // The invariant every consumer relies on: level is derived from THESE outcomes.
    expect(state.level).toEqual(computeGuildLevel(state.outcomes));
    expect(state.outcomes).toEqual(
      deriveGuildOutcomes({ statuses: state.statuses, eventsSnapshot: state.eventsSnapshot }),
    );
  });

  it("returns the honest base level when the factory is empty (no projects)", () => {
    process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
    // No portfolio.md written → no projects.
    const state = readGuildState();

    expect(state.statuses).toHaveLength(0);
    expect(state.level).toEqual(computeGuildLevel(state.outcomes));
  });

  it("pendingDecisions is the live decisions.md count, not the stale status.yaml counter (DR-092)", () => {
    process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
    writePortfolio("demo");
    // Deliberately stale/mismatched counter — the bug this regression catches: the
    // "Tu turno" pending-decisions sum on Inicio must not trust this stored field.
    writeStatus("demo", ["phase: release", "pending_decisions: 99"].join("\n"));
    fs.mkdirSync(path.join(tmpRoot, "demo", ".pandacorp", "inbox"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, "demo", ".pandacorp", "inbox", "decisions.md"),
      "## 2026-06-21 (NECESITA DECISIÓN DEL OWNER) — Solo una pendiente\n" +
        "## 2026-06-20 (RESUELTO por el owner) — Ya resuelta\n",
      "utf-8",
    );

    const state = readGuildState();

    expect(state.statuses).toHaveLength(1);
    expect(state.statuses[0]?.present).toBe(true);
    expect(state.statuses[0]?.status?.pendingDecisions).toBe(1);
  });
});
