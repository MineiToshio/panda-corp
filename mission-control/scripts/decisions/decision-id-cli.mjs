/**
 * scripts/decisions/decision-id-cli.mjs — the one-shot decision-id CLI (FRD-24, WO-24-001, REQ-24-001).
 *
 * A one-shot script that prints the ordered decision ids Mission Control's `readDecisions()` would
 * derive for a given `decisions.md` file — reusing the exact same pure derivation
 * (`parseDecisionBlocks`) instead of re-deriving the id rule in prose. Built so an external caller
 * outside the Next.js runtime — the factory's `/pandacorp:decide` skill, invoked by a coding agent via
 * Bash in a different repo (`panda-corp`) — can get the same ordered id list Mission Control shows.
 *
 * Run from the Mission Control repo root:
 *   node --loader ./scripts/read-model/ts-loader.mjs scripts/decisions/decision-id-cli.mjs <path-to-decisions.md>
 * or via the documented package script — the stdout-silencing flag is REQUIRED, not optional:
 *   pnpm --silent decisions:ids <path-to-decisions.md>
 * (without it, `pnpm decisions:ids` writes pnpm's own run banner — "> mission-control@0.1.0 …",
 * "> node --loader …" — to STDOUT ahead of the ids, so a caller splitting stdout would parse those
 * banner lines as decision ids. `--silent` / `-s` / `--reporter=silent` keeps stdout id-only.)
 *
 * Unlike `parseDecisionBlocks`/`readDecisions` (which fail-soft to `[]` — an absent/unreadable
 * decisions.md is a normal, expected state for a project's Summary tab), this CLI is a boundary: a
 * caller invoking it with a bad path made a mistake and should see a loud failure, not a silent empty
 * list — one-line message to stderr, non-zero exit.
 */

import fs from "node:fs";
import { parseDecisionBlocks } from "../../src/lib/docs/activity.ts";

function main() {
  const targetPath = process.argv[2];

  if (!targetPath || targetPath.trim() === "") {
    process.stderr.write("decision-id-cli: missing required <path-to-decisions.md> argument\n");
    process.exit(1);
  }

  let content;
  try {
    content = fs.readFileSync(targetPath, "utf-8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`decision-id-cli: cannot read ${targetPath} (${reason})\n`);
    process.exit(1);
    return;
  }

  const decisions = parseDecisionBlocks(content);
  for (const decision of decisions) {
    process.stdout.write(`${decision.id}\n`);
  }
}

main();
