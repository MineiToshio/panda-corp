/**
 * Synthetic factory git fixture for the read-model end-to-end tests (FRD-23).
 *
 * Builds a REAL, self-contained git repo in a TEMP dir shaped like the factory — portfolio +
 * decisions + memory + ideas + ONE in-repo project (Mission-Control-style) with a committed
 * `status.yaml` history and a docs/frds spine — so the writer→reader→equivalence chains exercise
 * real git end-to-end WITHOUT ever creating, overwriting or deleting anything under a real
 * `.pandacorp/` (the defect this replaced: the old e2e tests wrote and then `rmSync`'d the REAL
 * materialized caches on every gate run — destroying the owner's FRD-23 materialization).
 *
 * Bind the factory-root readers to the fixture with `withFactoryRoot(fixture.factoryRoot, …)`
 * (`src/tests/fixtures`): every reader resolves `PANDACORP_FACTORY_ROOT` at call time, so no
 * module mocking is needed. Same git-in-mkdtemp pattern as `factorySeal.test.ts`.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type SyntheticFactoryRepo = {
  /** Absolute path of the fixture factory repo root (a real git work-tree). */
  readonly factoryRoot: string;
  /** Absolute path of the fixture's one project (inside the factory repo, like Mission Control). */
  readonly projectPath: string;
  /** Remove the whole fixture tree (a temp dir only — never a real path). */
  readonly cleanup: () => void;
};

function git(cwd: string, args: string): void {
  execSync(`git ${args}`, { cwd, stdio: ["ignore", "ignore", "ignore"] });
}

function write(root: string, rel: string, content: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

/**
 * Create the synthetic factory repo. Two commits, so every derivation has real history:
 *   1. the factory skeleton + the project at `phase: product` (adds a VERIFIED work order —
 *      a weekly-flow crossing — and an idea card with `created:` — an ideas-captured point);
 *   2. the project's phase moves to `implementation` — a REAL phase transition for
 *      `phaseTransitions`, and the commit whose hash becomes the current (factory) seal.
 */
export function makeSyntheticFactoryRepo(): SyntheticFactoryRepo {
  const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "read-model-e2e-"));
  const projectPath = path.join(factoryRoot, "demo-app");

  // Factory skeleton — the factory-wide routes the seals + report cores read.
  write(
    factoryRoot,
    "factory/portfolio.md",
    ["| Name | Path |", "|---|---|", "| demo-app | `demo-app/` |", ""].join("\n"),
  );
  write(factoryRoot, "factory/decisions/registry.yaml", "decisiones: []\n");
  write(
    factoryRoot,
    "factory/memory/_inbox.md",
    "- candidate lesson one (agent-inferred)\n- candidate lesson two (agent-inferred)\n",
  );
  write(
    factoryRoot,
    "factory/ideas/demo-idea.md",
    "---\nstatus: discovered\ncreated: 2026-07-01\n---\n\n# Demo idea\n",
  );

  // The one in-repo project: committed status.yaml + a docs/frds spine with a VERIFIED wo.
  write(factoryRoot, "demo-app/.pandacorp/status.yaml", "phase: product\n");
  write(factoryRoot, "demo-app/docs/frds/frd-01-demo/frd.md", "# FRD-01 — demo\n");
  write(
    factoryRoot,
    "demo-app/docs/frds/frd-01-demo/work-orders/wo-01-001-demo.md",
    "---\nimplementation_status: VERIFIED\n---\n\n# WO-01-001 — demo\n",
  );

  git(factoryRoot, "init -q");
  git(factoryRoot, "config user.email fixture@pandacorp.dev");
  git(factoryRoot, "config user.name Fixture");
  git(factoryRoot, "config commit.gpgsign false");
  git(factoryRoot, "add -A");
  git(factoryRoot, 'commit -q -m "seed: factory skeleton + demo-app (phase: product)"');

  // Second commit: the phase moves — a real transition in the status.yaml git history.
  write(factoryRoot, "demo-app/.pandacorp/status.yaml", "phase: implementation\n");
  git(factoryRoot, "add demo-app/.pandacorp/status.yaml");
  git(factoryRoot, 'commit -q -m "demo-app: phase product -> implementation"');

  return {
    factoryRoot,
    projectPath,
    cleanup: (): void => {
      fs.rmSync(factoryRoot, { recursive: true, force: true });
    },
  };
}
