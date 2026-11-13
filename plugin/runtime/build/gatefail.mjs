// Gate failure evidence: pure log parsing, WO attribution and patch planning. The I/O adapter only reads
// canonical WOs and persists the evidence; gate logs and worker-authored prose never define an allowlist.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, sha256Hex } from "./fsx.mjs";
import { executionsUsed } from "./failure/policy.mjs";
import { matchesArtifact } from "./units/allowlist.mjs";
import { readUnitWorkOrders } from "./units/workOrders.mjs";

const unique = (xs) => [...new Set(xs)].sort();
const key = (s) => String(s).toLowerCase();
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const FILE = /(?:\.?\.?\/|\/)?(?:[\w@().\[\]-]+\/)*[\w@().\[\]-]+\.(?:[cm]?[jt]sx?|jsonc?|ya?ml|mdx?|css|scss|html|sh)(?=[:(\s›>),]|$)/g;

function relativeFile(raw, root) {
  let rel = raw.replace(/\\/g, "/");
  if (rel.startsWith("/")) {
    if (!root || !rel.startsWith(`${root.replace(/\/$/, "")}/`)) return null;
    rel = rel.slice(root.replace(/\/$/, "").length + 1);
  }
  rel = rel.replace(/^\.\//, "");
  return rel.split("/").includes("..") ? null : rel;
}

/** Parse verify.sh output (vitest, Playwright, tsc, Biome, Next build, doc-lint). Pure, no shell or I/O.
 * Only diagnostics and failed test blocks contribute paths; PASS lines and command echoes never do.
 * Unknown formats retain a bounded tail and fall back to an unattributed patch.
 */
export function parseGateFailure({ log = "", root = null } = {}) {
  const clean = String(log).replace(ANSI, "").replace(/\r/g, "");
  const checks = new Set(); const tests = new Set(); const paths = new Set();
  let failedBlock = false; let nextBuild = false; let testFile = null;
  let docBullets = [];
  for (const line of clean.split("\n")) {
    const text = line.trim();
    if (/^(?:PASS|✓|✔|> |\$ )/.test(text) || /^Test Files|^Tests\s/.test(text)) { failedBlock = false; testFile = null; docBullets = []; continue; }
    const vitest = /^(?:FAIL\s+|❯\s+)(\S+\.(?:[cm]?[jt]sx?))\b(.*)/.exec(text);
    const pw = /^(?:\d+\)|[✘×]\s*\d+).*?((?:[^\s›]+\/)*[^\s›]+\.spec\.[cm]?[jt]s):\d+:\d+\s*›\s*(.+)/.exec(text);
    const tsc = /\berror TS\d+\b/.test(text);
    const biome = /\b(?:lint|format|parse)\//.test(text) || /\b(?:lint|format|parse)\s*[━─]/.test(text);
    const doc = /doc-lint/i.test(text) && !/\b(?:0 findings|passed|clean)\b/i.test(text);
    if (/Failed to compile|Build error occurred|Error occurred prerendering|Type error:/.test(text)) { nextBuild = true; checks.add("next-build"); }
    if (vitest && (text.startsWith("FAIL") || /\b[1-9]\d* failed\b/.test(text))) {
      checks.add("vitest"); failedBlock = true; testFile = vitest[1];
      if (vitest[2].includes(" > ")) tests.add(`${testFile} > ${vitest[2].split(" > ").slice(1).join(" > ").trim()}`);
    }
    if (pw) { checks.add("playwright"); tests.add(`${pw[1]} > ${pw[2].replace(/\s+\(\d[\d.]*m?s\)\s*$/, "")}`); failedBlock = true; }
    if (tsc) checks.add("tsc");
    if (biome) checks.add("biome");
    // Normal doc-lint prints a contiguous bullet block before its identifying summary.
    // Buffer only that block: a random list elsewhere in the gate log is not a diagnostic.
    if (/^•\s+/.test(text)) {
      for (const match of line.matchAll(FILE)) {
        const rel = relativeFile(match[0], root);
        if (rel) docBullets.push(rel);
      }
    } else if (doc) {
      checks.add("doc-lint");
      for (const rel of docBullets) paths.add(rel);
      docBullets = [];
    } else if (text && !/^[═━─=]+$/.test(text)) docBullets = [];
    if (failedBlock && testFile && /^[×✗✖]\s+/.test(text)) tests.add(`${testFile} > ${text.replace(/^[×✗✖]\s+/, "").replace(/\s+\d+(?:\.\d+)?m?s\s*$/, "")}`);
    // Next prints the file on its own line immediately after "Failed to compile".
    if (vitest || pw || tsc || biome || doc || failedBlock || (nextBuild && /^(?:\.\/|src\/|app\/|pages\/)/.test(text))) {
      for (const match of line.matchAll(FILE)) {
        const rel = relativeFile(match[0], root);
        if (rel) paths.add(rel);
      }
    }
  }
  return { schema: 1, checks: unique([...checks]), tests: unique([...tests]), paths: unique([...paths]), tail: clean.trimEnd().split("\n").slice(-40).join("\n").slice(-12000) };
}

/** Map implicated product paths to canonical artifacts and hashed tests, restricted to this gate's candidates. Pure. */
export function attributeGateFailure({ evidence, units, workOrders }) {
  const allowed = new Set(units.flatMap((u) => u.wos).map(key));
  const wanted = new Set();
  for (const file of evidence.paths) {
    for (const wo of workOrders) if (allowed.has(key(wo.id)) && wo.artifacts.some((a) => matchesArtifact(a, file))) wanted.add(key(wo.id));
    for (const u of units) if (Object.hasOwn(u.test_hashes ?? {}, file)) for (const wo of u.wos) if (allowed.has(key(wo))) wanted.add(key(wo));
  }
  const wos = unique(workOrders.filter((wo) => wanted.has(key(wo.id))).map((wo) => wo.id));
  const fixed = units.filter((u) => ["build", "patch"].includes(u.kind) && u.wos.some((wo) => wanted.has(key(wo))));
  return { wos, fixed };
}

/** A gate patch only spends the implicated WOs' budget. An unattributed patch starts its own three executions. */
export function planGatePatch({ state, units, workOrders, evidence, gate, frd = null, job }) {
  const scope = attributeGateFailure({ evidence, units, workOrders });
  const attributed = scope.wos.length > 0;
  const frds = unique(scope.fixed.map((u) => u.frd).filter(Boolean));
  const patchFrd = attributed ? (frds.length === 1 ? frds[0] : null) : frd;
  const fingerprint = sha256Hex(scope.wos.map(key).sort().join("\n")).slice(0, 12);
  const id = attributed ? `u-patch-${fingerprint}` : gate === "G3" ? "u-patch-g3" : `u-patch-g2-${frd}`;
  const previous = state.units.find((u) => u.id === id);
  const attempt = attributed ? Math.max(1, executionsUsed(state, scope.wos)) + 1 : (previous?.attempt ?? 0) + 1;
  const allowlistWos = attributed ? scope.wos : unique(units.flatMap((u) => u.wos));
  return { id, frd: patchFrd, attempt, fixed: scope.fixed, evidence: { ...evidence, gate, job, attributed, wos: scope.wos, allowlist_wos: allowlistWos, fixes: scope.fixed.map((u) => u.id) }, wos: allowlistWos };
}

/** Read-only adapter; canonical WO artifacts always come from the integration commit, not log text. */
export async function readGatePatch({ state, units, gate, frd = null, job, paths }, deps = {}) {
  const fs = deps.fs ?? fsp;
  let log;
  try { log = await fs.readFile(paths.jobOutFile(job.id), "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; log = ""; }
  const workOrders = await readUnitWorkOrders(state.integration.worktree, unique(units.flatMap((u) => u.wos)), deps);
  const evidence = parseGateFailure({ log, root: job.cwd ?? state.integration.worktree });
  return planGatePatch({ state, units, workOrders, evidence, gate, frd, job: job.id });
}

export async function writeGateFailure(paths, plan, deps = {}) {
  await atomicWriteJson(path.join(paths.unitDir(plan.id), "gate-failure.json"), plan.evidence, deps);
}
