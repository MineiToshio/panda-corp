// Factory backlog item filed after an engine failure (DR-103). ../failure.mjs is the public entry.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { nowIso } from "../fsx.mjs";
import { integrationBranchOf, oneLine } from "./common.mjs";

export const sanitize = (text, project, deps) => {
  let out = String(text ?? "");
  const home = (deps.env ?? process.env).HOME;
  if (project) out = out.split(path.resolve(project)).join("<project>");
  if (home && home.length > 1) out = out.split(home).join("~");
  return out;
};

async function readFactoryRoot(project, deps) {
  if (deps.factoryRoot) return deps.factoryRoot;
  try {
    const guide = await (deps.fs ?? fsp).readFile(path.join(project, ".pandacorp", "guide.md"), "utf8");
    return guide.match(/^[-*]?\s*Factory:\s*`([^`]+)`/m)?.[1] ?? null;
  } catch { return null; }
}

/** Next free `factory/backlog/BL-NNNN` id, by the same rule as validate-backlog.sh (max existing + 1). */
async function nextBacklogId(dir, fs) {
  const names = await fs.readdir(dir);
  return names.reduce((max, name) => Math.max(max, Number(name.match(/^BL-(\d+)/)?.[1] ?? 0)), 0) + 1;
}

function backlogBody({ id, title, date, failure, project, deps }) {
  const stack = sanitize(failure.stack, project, deps).split("\n").slice(0, 8).join("\n");
  return [
    "---",
    `id: BL-${String(id).padStart(4, "0")}`,
    "type: bug",
    "area: build-engine",
    `title: ${JSON.stringify(title)}`,
    "status: open",
    "severity: p1",
    `opened: ${date}`,
    "closed:",
    `source: ${JSON.stringify(`pandacorp-build engine failure, run ${failure.runId ?? "unknown"}`)}`,
    "closes:",
    "links: [DR-103]",
    "---",
    "",
    "## Problem",
    `The v2 build engine stopped itself at a safe point (exit 8). Command: \`${failure.cmd ?? "unknown"}\`, step: \`${failure.step ?? "unknown"}\`. It failed, was retried once after \`rebuild-state\`, and failed again (the retry ${failure.retried ? "ran" : "was skipped: the fault confirms itself"}).`,
    `Error code: \`${failure.code ?? "none"}\`. Message: ${oneLine(sanitize(failure.message, project, deps), 400)}`,
    "```",
    stack || "(no stack trace)",
    "```",
    `Run \`${failure.runId ?? "unknown"}\`, epoch ${failure.epoch ?? "unknown"}. The product work is preserved on the run's integration branch \`${integrationBranchOf(failure.runId)}\`; the run is resumable once this is fixed. This failure consumed no unit attempt.`,
    "",
    "## Root cause",
    "Not investigated yet. Reproduce from the run journal (`.pandacorp/run/build/journal.jsonl`) and `handback/engine.md` of the affected project.",
    "",
    "## Fix plan",
    "1. Reproduce with the journal of the failed run and a fixture of the same shape.",
    "2. Fix the module in `plugin/runtime/build/` named by the stack; keep the failure policy intact (BUILD-15).",
    "3. PATCH or MINOR plugin release; the owner resumes the SAME `run_id` with `/pandacorp:implement --resume`.",
    "",
    "## Tests (prove the fix, RED then GREEN)",
    "A regression case in the matching `plugin/scripts/test-build-v2-*.mjs` suite that fails with this error before the fix and passes after, plus a resume of the interrupted run.",
    "",
    "## Done when",
    "- The regression test is green and the engine suite passes.",
    "- The plugin version is bumped and the failed run resumes to completion.",
    "",
  ].join("\n");
}

/** File the factory backlog item (DR-103). Returns `{id, file}`, or `{id: null, reason}` when the factory cannot be reached. */
export async function fileBacklogNote({ project, failure, deps }) {
  const fs = deps.fs ?? fsp;
  const factory = await readFactoryRoot(project, deps);
  if (!factory) return { id: null, file: null, reason: "no se encontró la ruta de la fábrica en .pandacorp/guide.md" };
  const dir = path.join(factory, "factory", "backlog");
  const date = nowIso(deps).slice(0, 10);
  const title = `Fix v2 build engine failure in ${failure.cmd ?? "a command"}: ${oneLine(sanitize(failure.message, project, deps), 90)}`;
  const slug = `engine-failure-${String(failure.cmd ?? "step").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`.slice(0, 50);
  try {
    let id = await nextBacklogId(dir, fs);
    for (let tries = 0; tries < 5; tries += 1, id += 1) {
      const file = path.join(dir, `BL-${String(id).padStart(4, "0")}-${slug}.md`);
      try {
        await fs.writeFile(file, backlogBody({ id, title, date, failure, project, deps }), { flag: "wx", mode: 0o644 });
        return { id: `BL-${String(id).padStart(4, "0")}`, file, reason: null };
      } catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    return { id: null, file: null, reason: "no quedó un número de BL libre tras 5 intentos" };
  } catch (error) {
    return { id: null, file: null, reason: `no se pudo escribir el BL: ${oneLine(error.message, 140)}` };
  }
}
