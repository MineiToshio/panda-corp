// units/render.mjs: the unit brief text (pure) and the role file of an agent type (CLI doc section 11.1).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASE_VAR, REVIEW_KINDS } from "./common.mjs";

/** Absolute `plugin/` directory this module ships in (role files live under `agents/`). */
export const PLUGIN_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const ROLE_FILES = {
  "pandacorp:implementer": "implementer.md",
  "pandacorp:reviewer": "reviewer.md",
  "pandacorp:test-writer": "test-writer.md",
  "pandacorp:security-auditor": "security-auditor.md",
};

/** Absolute role file of an agent type (`null` for `general-purpose`). */
export function agentRoleFile(agentType, pluginRoot = PLUGIN_ROOT) {
  const name = ROLE_FILES[agentType];
  return name ? path.join(pluginRoot, "agents", name) : null;
}

const bullets = (items, empty) => (items.length ? items.map((i) => `- ${i}`).join("\n") : empty);

/**
 * Render a brief (pure). See the CLI doc section 11.1 for the template.
 * @param {object} input
 * @param {{id: string, kind: string, wos: string[], frd: string|null, attempt: number, zone: string, risk_rules: string[]}} input.unit
 * @param {{runtime: string, model: string, effort: string|null}} input.cell
 * @param {string} input.agentType
 * @param {string|null} input.roleFile absolute role file
 * @param {{dentro: string[], fuera: string[]}|null} input.card verbatim card lines (`null` when the run has no card)
 * @param {string[]} input.acLines owned acceptance criteria, verbatim
 * @param {string[]} input.allowlist patterns the unit may write
 * @param {string[]} input.contextPack absolute paths to read
 * @param {string} input.root absolute product root of the unit worktree (the only place to work)
 * @param {string} input.reportPath
 * @param {string} input.schemaPath
 * @param {string} input.token the UNIT token (never the lease token)
 * @param {string[]} [input.verification] commands to run, in order
 * @param {string[]} [input.readOnlyPaths] hashed test and probe files the unit must not edit
 * @param {object[]} [input.previous] evidence of earlier attempts `{attempt, outcome, reason, failing[], tail, diagnosis}`
 * @param {object[]} [input.findings] reviewer findings a patch must fix
 * @param {{question: string, decision: string, rationale: string}|null} [input.decision] a decided doubt
 * @param {string[]} [input.notes] extra owner answers or constraints
 * @param {{range: string, scopeLens: boolean}|null} [input.review] review inputs (review-type kinds)
 * @param {object|null} [input.doubt] the doubt object (doubt-consult)
 * @param {boolean} [input.sourcesSkipped] doubt-consult: the sources step was skipped
 * @returns {string} Markdown
 */
export function renderBrief(input) {
  const { unit, cell, token } = input;
  const effort = cell.effort ?? "session default";
  const out = [];
  out.push(`# Unit ${unit.id}: ${unit.kind}`, "");
  out.push("## 1. Role");
  out.push(input.roleFile
    ? `Act as \`${input.agentType}\` (read \`${input.roleFile}\` for the role rules). Runtime: ${cell.runtime}, model ${cell.model}, effort ${effort}.`
    : `Act as a general-purpose consultant (no role file). Runtime: ${cell.runtime}, model ${cell.model}, effort ${effort}.`, "");
  out.push("## 2. Unit");
  out.push(`- id: ${unit.id}`, `- kind: ${unit.kind}`, `- work orders: ${unit.wos.length ? unit.wos.join(", ") : "none"}`, `- FRD: ${unit.frd ?? "none"}`);
  out.push(`- attempt: ${unit.attempt}`, `- risk zone: ${unit.zone}${unit.risk_rules?.length ? ` (rules: ${unit.risk_rules.join(", ")})` : ""}`, "");
  if (unit.kind !== "doubt-consult") out.push(...scopeSection(input));
  out.push(...contextSection(input));
  if (REVIEW_KINDS.includes(unit.kind)) out.push(...reviewSections(input));
  else if (unit.kind === "doubt-consult") out.push(...consultSections(input));
  else out.push(...workSections(input));
  out.push("## 9. Identity", `unit: ${unit.id}`, `token: ${token}`, "(copy both verbatim into the report)", "");
  return out.join("\n");
}

function scopeSection({ unit, card, acLines, allowlist }) {
  const lines = ["## 3. Scope"];
  if (card) lines.push("Dentro (verbatim from the card):", bullets(card.dentro, "- (the card lists nothing)"), "", "Fuera (verbatim from the card):", bullets(card.fuera, "- (the card lists nothing)"), "");
  else lines.push("No card: the scope is this unit's work orders only.", "");
  lines.push("Owned acceptance criteria (verbatim):", bullets(acLines, "- (none cited)"), "");
  lines.push(`Write allowlist (\`artifacts\`): ${allowlist.length ? allowlist.map((a) => `\`${a}\``).join(", ") : "no repository files"}`, "");
  lines.push("Forbidden paths (never touch): `**/*-snapshots/**`, the frontmatter of every work order, hashed test files, anything listed in Fuera.");
  if (unit.kind === "tests") lines.push("", "RED-first acceptance tests: each new test must fail by assertion, never by an import or syntax error; touch no production code. The report carries no hashes; the engine computes them.");
  lines.push("");
  return lines;
}

function contextSection({ contextPack, readOnlyPaths = [], previous = [], findings = [], decision = null, notes = [] }) {
  const lines = ["## 4. Context pack", bullets(contextPack, "- (none)")];
  if (readOnlyPaths.length) lines.push("", "Read-only, hashed by the engine (a change gets your report rejected):", bullets(readOnlyPaths, ""));
  if (findings.length) lines.push("", "Findings to fix:", ...findings.map((f) => `- ${f.id ?? ""} [${f.severity ?? "?"}] ${f.file ?? ""}${f.line ? `:${f.line}` : ""} ${f.summary ?? ""}${f.probe ? ` (RED probe: ${f.probe})` : ""}`.replace(/\s+/g, " ").trim()));
  if (previous.length) {
    lines.push("", "Evidence of earlier attempts of this unit (the engine's own re-runs):");
    for (const a of previous) {
      lines.push(`- attempt ${a.attempt}: ${a.outcome}${a.reason ? ` (${a.reason})` : ""}${a.failing?.length ? `; failing: ${a.failing.join("; ")}` : ""}${a.diagnosis ? `; diagnosis: ${a.diagnosis.cause}: ${a.diagnosis.detail}` : ""}`);
      if (a.tail) lines.push("  ```", ...String(a.tail).split("\n").slice(-20).map((l) => `  ${l}`), "  ```");
    }
  }
  if (decision) lines.push("", `Decision on your earlier doubt: ${decision.decision} (${decision.rationale}). Question was: ${decision.question}`);
  if (notes.length) lines.push("", "Notes:", bullets(notes, ""));
  lines.push("");
  return lines;
}

function workSections({ root, verification = [], reportPath, schemaPath }) {
  const cmds = verification.length ? verification.map((c) => `- \`${c}\``).join("\n") : "- (none given)";
  return [
    "## 5. Working directory and git",
    `Work only in: ${root}`,
    "Never run `git commit`, `git push`, `git reset`, `git checkout`, `git stash` or `git add -A`. The engine commits.",
    `Never set \`${RELEASE_VAR}\`.`, "",
    "## 6. Verification",
    "Run, in this order, one heavy tool at a time, at most 3 fix cycles:", cmds,
    "Test budget: existing tests reached by the change always; at most one new behaviour spec per new or changed main flow; at most 5 cases per module for branching logic; cite the AC ids in test names.",
    "Record each command's exit code and the output tail in the report.", "",
    "## 7. Doubts",
    "Never ask the owner. If a decision needed to proceed is not answered by the documents, stop and return `status:\"doubt\"` with `question`, `options`, `preferred` and `why`.", "",
    "## 8. Output",
    `Write a JSON object valid against \`${schemaPath}\` to \`${reportPath}\`, and print the same JSON as your final message.`, "",
  ];
}

function reviewSections({ root, review, reportPath, schemaPath }) {
  return [
    "## 5. Review inputs",
    `Diff range: ${review?.range ?? "(not given)"}`,
    `Worktree for probes: ${root} (probe files only, under the test globs; never production code)`,
    `Scope lens: open a \`scope\` finding when the diff touches anything listed in Fuera${review?.scopeLens === false ? " (no card: not applicable)" : ""}.`,
    "Never run `git commit`, `git push`, `git reset`, `git checkout` or `git stash`.", "",
    "## 6. Verification",
    "Re-run the evidence yourself; never trust a claim of passing tests. One heavy tool at a time.", "",
    "## 7. Doubts",
    "Never ask the owner. Return `verdict:\"doubt\"` with a `doubt` object when a decision is missing.", "",
    "## 8. Output",
    `Write a JSON object valid against \`${schemaPath}\` to \`${reportPath}\`, and print the same JSON as your final message.`, "",
  ];
}

function consultSections({ doubt, sourcesSkipped, reportPath }) {
  return [
    "## 3. Doubt",
    "```json", JSON.stringify(doubt ?? {}, null, 2), "```",
    sourcesSkipped ? "The sources step was skipped: check the repository documents and the decision log first." : "The documents were already checked; answer from judgment.", "",
    "## 8. Output",
    `Write \`{"decision": string|null, "rationale": string, "confidence": "low|medium|high", "reversible": boolean}\` to \`${reportPath}\` and print the same JSON as your final message. Read-only: change no repository file.`, "",
  ];
}
