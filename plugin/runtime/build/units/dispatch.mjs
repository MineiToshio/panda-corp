// units/dispatch.mjs: the entry points `next` and the CLI call: brief of a unit and the unit's worktree plus brief.
import path from "node:path";
import { buildPaths } from "../paths.mjs";
import { err, REVIEW_KINDS } from "./common.mjs";
import { writeUnitBrief } from "./brief.mjs";
import { createUnitWorktree } from "./worktrees.mjs";

const AGENT_OF_KIND = Object.freeze({
  docs: "pandacorp:implementer", build: "pandacorp:implementer", patch: "pandacorp:implementer", tests: "pandacorp:test-writer",
  review: "pandacorp:reviewer", "deferred-review": "pandacorp:reviewer", audit: "pandacorp:security-auditor", "doubt-consult": "general-purpose",
});

/**
 * Write the brief of a unit from the run's current `state.json` ({@link writeUnitBrief} with the agent type and schema
 * derived from the unit kind). The unit worktree may not exist yet: documents are then read from the integration worktree.
 * @param {{project: string, runId?: string, unit: object, token: string, cell: object, via?: string, agentType?: string,
 *   worktree?: string, reportPath?: string, extra?: object}} input `runId` and `via` are informational
 * @param {object} [deps] see {@link writeUnitBrief}; `readState` is imported lazily
 * @returns {Promise<{file: string, brief_path: string, report_path: string, text: string}>}
 */
export async function writeBrief({ project, unit, token, cell, agentType, worktree, reportPath, extra }, deps = {}) {
  const { readState } = await import("../state.mjs");
  const state = await readState(project, deps);
  if (!state) throw err("INVALID_STATE", "no build state: cannot write a brief", { hint: "rebuild-state" });
  const p = buildPaths(project, deps);
  const reviewType = REVIEW_KINDS.includes(unit.kind);
  const schemaPath = unit.kind === "doubt-consult" ? "" : p.schemaFile(reviewType ? "review-report" : "report");
  const out = await writeUnitBrief({ project, state, unit, cell, agentType: agentType ?? AGENT_OF_KIND[unit.kind], token, schemaPath, worktree, reportPath, extra }, deps);
  return { ...out, file: out.brief_path };
}

/**
 * The `units.prepare` sibling of `next` (NEXT_SIBLING_CONTRACT): worktree plus brief of one dispatched unit, outside the
 * mutex. A consult has no worktree (its brief was written by `doubt open`/`doubt answer`); a review-type unit reads the
 * integration tip's worktree for its probes.
 * @param {{project: string, state: object, unit: object, cell: object, via: string, token: string, attempt?: number,
 *   review?: object|null, consult_brief?: string|null, question_defaults?: object[]}} input
 * @param {object} [deps] see {@link writeUnitBrief}
 * @returns {Promise<{worktree: string|null, branch: string|null, brief_path: string, report_path: string, schema_path: string}>}
 */
export async function prepare({ project, state, unit, cell, via, token, attempt, review = null, consult_brief: consultBrief = null, question_defaults: questionDefaults = [] }, deps = {}) {
  const p = buildPaths(project, deps);
  const runId = state.run_id;
  if (unit.kind === "doubt-consult") {
    return { worktree: null, branch: null, brief_path: consultBrief ?? p.briefFile(unit.id), report_path: p.unitAnswerFile(unit.id), schema_path: via === "cli" ? p.schemaFile("doubt-answer") : "" };
  }
  const reviewType = REVIEW_KINDS.includes(unit.kind);
  const n = attempt ?? unit.attempt ?? 1;
  const refs = reviewType
    ? { worktree: path.resolve(project, state.integration.worktree), branch: state.integration.branch }
    : await createUnitWorktree({ project, runId, unit: unit.id, attempt: n, base: state.integration.branch }, deps);
  const brief = await writeUnitBrief({
    project, state, unit: { ...unit, attempt: n }, cell, agentType: AGENT_OF_KIND[unit.kind], token,
    schemaPath: p.schemaFile(reviewType ? "review-report" : "report"), worktree: refs.worktree,
    extra: { review, questionDefaults },
  }, deps);
  return { worktree: refs.worktree, branch: refs.branch, brief_path: brief.brief_path, report_path: brief.report_path, schema_path: p.schemaFile(reviewType ? "review-report" : "report") };
}
