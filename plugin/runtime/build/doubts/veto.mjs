// The deterministic veto of the doubt ladder (BUILD-12 "Never decided this way"): risk of the unit files, the
// classifier on the doubt text, fixed scope/gate/money patterns and the DRs with `requiere_humano`.
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultExec } from "../fsx.mjs";
import { computeRisk } from "../risk.mjs";
import { oneLine } from "./common.mjs";

// Directory of the engine modules (`plugin/runtime/build`), the location the veto paths were resolved against.
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLASSIFY_TIMEOUT_MS = 60_000;

// Text patterns of the never-decide list that no classifier signal covers. Matching is deliberately wide: a false
// positive parks a doubt (the owner answers it), a false negative would decide something only the owner may decide.
const SCOPE_RE_I = /\b(out of scope|in scope|scope|widen\w*|narrow the scope|reduce the scope|reinterpret\w*|product scope|prd|epics?|alcance|ampliar el alcance|reducir el alcance|reinterpretar|[ée]picas?)\b/i;
const SCOPE_RE_CASED = /\b(Dentro|Fuera)\b/;
const GATE_RE = /\b(deploy\w*|despleg\w*|production|producci[oó]n|release to|publish\w*|publicar|send (an? )?e-?mails?|e-?mails? (to )?(the )?(users|customers|clients)|newsletter|enviar (un |el )?correo|correos? a (los )?(usuarios|clientes)|sms|push notifications?|notificaci[oó]n push|PANDACORP_OWNER_RELEASE_OK)\b/i;
const MONEY_RE = /\b(payments?|billing|pricing|prices?|invoices?|subscriptions?|refunds?|spend\w*|money|pago|pagos|cobr(ar|o|os)|precios?|dinero|factur\w*|suscripci[oó]n\w*|tarifas?|gastar|reembolso\w*)\b|[€$£]\s?\d/i;
const DR_RE = /\bDR-\d{3,}\b/g;

/** Classifier signals that make the doubt itself irreversible (risk.mjs IRREVERSIBLE_SIGNALS). */
const TEXT_SIGNAL_REASON = Object.freeze({ S5: "irreversible", S8: "irreversible", S6: "money", S7: "human_gate" });

/**
 * DR ids whose registry entry has `requiere_humano: true`.
 * @param {string} yaml text of `factory/decisions/registry.yaml`
 * @returns {Set<string>}
 */
export function drsRequiringOwner(yaml) {
  const out = new Set();
  let current = null;
  for (const line of String(yaml).split("\n")) {
    const id = line.match(/^\s*-\s+id:\s*["']?(DR-\d+)/);
    if (id) { current = id[1]; continue; }
    if (current && /^\s+requiere_humano:\s*true\b/.test(line)) out.add(current);
  }
  return out;
}

async function registryText(project, deps) {
  const fs = deps.fs ?? fsp;
  const candidates = [];
  if (deps.registryFile) candidates.push(deps.registryFile);
  try {
    const guide = await fs.readFile(path.join(project, ".pandacorp", "guide.md"), "utf8");
    const factory = guide.match(/Factory:\s*`([^`]+)`/);
    if (factory) candidates.push(path.join(factory[1], "factory", "decisions", "registry.yaml"));
  } catch { /* no guide: fall back to the plugin's own factory */ }
  candidates.push(path.resolve(HERE, "../../../factory/decisions/registry.yaml"));
  for (const file of candidates) {
    try { return await fs.readFile(file, "utf8"); } catch { /* try the next location */ }
  }
  return null;
}

/**
 * The `artifacts` of the given WOs, read from the frontmatter of `docs/frds/<frd>/work-orders/*.md` under `root`. Both
 * YAML list forms are read: the block form (`artifacts:` then `  - a` lines) and the inline form (`artifacts: [a, b]`).
 * Fail-closed inputs (N10b): a WO that cannot be found, a missing `docs/frds`, or a directory/file that cannot be read
 * is listed in `missing`/`unreadable`, and the veto treats the risk of the unit's files as unknown.
 * @param {string} root worktree root (the integration worktree)
 * @param {string[]} wos WO ids
 * @returns {Promise<{artifacts: string[], missing: string[], unreadable: string[]}>}
 */
export async function readWoArtifacts(root, wos, deps = {}) {
  const fs = deps.fs ?? fsp;
  const wanted = new Map(wos.map((w) => [String(w).toLowerCase(), w]));
  const artifacts = new Set();
  const found = new Set();
  const unreadable = [];
  let frds = [];
  try {
    frds = (await fs.readdir(path.join(root, "docs", "frds"))).filter((n) => n.startsWith("frd-"));
  } catch (error) {
    unreadable.push(`docs/frds: ${error.code ?? oneLine(error.message, 80)}`);
  }
  for (const frd of frds) {
    const dir = path.join(root, "docs", "frds", frd, "work-orders");
    let names = [];
    try {
      names = (await fs.readdir(dir)).filter((n) => /^wo-.*\.md$/i.test(n));
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") unreadable.push(`docs/frds/${frd}/work-orders: ${error.code ?? oneLine(error.message, 80)}`);
      continue;
    }
    for (const name of names) {
      const lower = name.toLowerCase();
      let raw;
      try {
        raw = await fs.readFile(path.join(dir, name), "utf8");
      } catch (error) {
        unreadable.push(`docs/frds/${frd}/work-orders/${name}: ${error.code ?? oneLine(error.message, 80)}`);
        continue;
      }
      const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const id = (fm.match(/^id:\s*["']?([^"'\s]+)/m)?.[1] ?? name.replace(/\.md$/i, "")).toLowerCase();
      const key = wanted.has(id) ? id : [...wanted.keys()].find((w) => lower.startsWith(w));
      if (!key) continue;
      found.add(key);
      for (const item of frontmatterList(fm, "artifacts")) artifacts.add(item);
    }
  }
  return { artifacts: [...artifacts], missing: [...wanted.keys()].filter((k) => !found.has(k)).map((k) => wanted.get(k)), unreadable };
}

const unquote = (v) => v.trim().replace(/^["']|["']$/g, "").trim();

/** Items of one top-level YAML list key of a frontmatter, in block (`key:` + `  - a`) or inline (`key: [a, b]`) form. */
function frontmatterList(fm, key) {
  const inline = fm.match(new RegExp(`^${key}:[ \\t]*\\[([^\\]]*)\\][ \\t]*$`, "m"));
  if (inline) return inline[1].split(",").map(unquote).filter(Boolean);
  const block = fm.match(new RegExp(`^${key}:[ \\t]*\\r?\\n((?:[ \\t]+-.*\\r?\\n?)*)`, "m"))?.[1] ?? "";
  return block.split(/\r?\n/).map((line) => line.match(/^\s+-\s*(.+?)\s*$/)?.[1]).filter(Boolean).map(unquote).filter(Boolean);
}

/**
 * Run classify-change.mjs over a text (its `--text` content signals S5-S8), by execFile, never imported. The text is a
 * `.ts` file in a private temp dir outside the repository so the prose exemption of S8 does not hide a destructive
 * statement and nothing lands in the project tree.
 * @param {{root: string, text: string}} input root = a git worktree of the project
 * @param {{exec?: Function, classifyScript?: string, tmpdir?: string, fs?: object}} [deps]
 * @returns {Promise<{ok: true, hits: {signal: string, level: string, detail: string}[]}|{ok: false, detail: string}>}
 */
export async function classifyText({ root, text }, deps = {}) {
  const fs = deps.fs ?? fsp;
  const dir = await fs.mkdtemp(path.join(deps.tmpdir ?? os.tmpdir(), "pandacorp-doubt-"));
  try {
    const file = path.join(dir, "doubt-text.ts");
    await fs.writeFile(file, text, { mode: 0o600 });
    const script = deps.classifyScript ?? path.resolve(HERE, "../../scripts/classify-change.mjs");
    const exec = deps.exec ?? defaultExec;
    const res = await exec(process.execPath, [script, "--repo", root, "--files", "doubt-text.ts", "--text", file], { cwd: root, timeout: CLASSIFY_TIMEOUT_MS });
    if (res.code !== 0) return { ok: false, detail: `classify-change exited ${res.code}` };
    const line = String(res.stdout).trim().split("\n").pop();
    let parsed;
    try { parsed = JSON.parse(line); } catch { return { ok: false, detail: "classify-change printed no JSON" }; }
    if (!Array.isArray(parsed?.floor_hits)) return { ok: false, detail: "classify-change JSON has no floor_hits" };
    if (parsed.floor_hits.some((h) => h.signal === "FAILCLOSED")) return { ok: false, detail: "classify-change failed closed" };
    return { ok: true, hits: parsed.floor_hits };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Pure part of the veto: the never-decide reasons implied by a unit, a risk result, the classifier hits on the doubt
 * text, the doubt text itself and the DRs it cites.
 * @param {{unit: object, doubt: object, risk?: {irreversible: boolean, failclosed: boolean, zone: string}|null,
 *   text?: {ok: boolean, hits?: object[], detail?: string}|null, ownerDrs?: Set<string>|null}} input
 *   `ownerDrs` null = the registry could not be read
 * @returns {{reason: string, detail: string}[]} empty = the ladder may decide
 */
export function vetoReasons({ unit, doubt, risk = null, text = null, ownerDrs = new Set() }) {
  const out = [];
  const add = (reason, detail) => { if (!out.some((r) => r.reason === reason && r.detail === detail)) out.push({ reason, detail }); };
  if (unit.zone === "r1") add("irreversible", "unit zone r1");
  if (unit.waiting_gate) add("human_gate", `unit waits at gate ${unit.waiting_gate}`);
  if (risk?.failclosed) add("failclosed", "risk of the unit files was computed fail-closed");
  else if (risk?.irreversible) add("irreversible", `risk of the unit files: zone ${risk.zone}`);
  if (text && !text.ok) add("failclosed", `doubt text classifier: ${text.detail}`);
  for (const hit of text?.hits ?? []) {
    if (hit.level !== "critical") continue;
    add(TEXT_SIGNAL_REASON[hit.signal] ?? "floor_signal", `${hit.signal} in the doubt text`);
  }
  const body = [doubt.question, doubt.why, ...doubt.options.map((o) => o.text)].join("\n");
  if (SCOPE_RE_I.test(body) || SCOPE_RE_CASED.test(body)) add("scope", "the doubt is about scope (Dentro/Fuera, PRD, epics)");
  if (MONEY_RE.test(body)) add("money", "the doubt mentions money");
  if (GATE_RE.test(body)) add("human_gate", "the doubt mentions production, publishing or external communication");
  const cited = [...new Set(body.match(DR_RE) ?? [])];
  if (cited.length && ownerDrs === null) add("requires_owner_dr", `cites ${cited.join(", ")} and the decision registry is unreadable`);
  for (const dr of cited) if (ownerDrs?.has(dr)) add("requires_owner_dr", `${dr} has requiere_humano: true`);
  return out;
}

/**
 * Compute the deterministic veto of a doubt (outside the lease mutex: it runs the classifier).
 * @param {{project: string, root: string, unit: object, doubt: object}} input root = the integration worktree
 * @param {object} [deps] `computeRisk(input)`, `classifyText(input)`, `readArtifacts(root, wos)`, `registryFile`, fs, exec
 * @returns {Promise<{reasons: {reason: string, detail: string}[], vetoed: boolean}>}
 */
export async function assessVeto({ project, root, unit, doubt }, deps = {}) {
  const wos = Array.isArray(unit.wos) ? unit.wos : [];
  const read = wos.length ? await (deps.readArtifacts ?? ((r, w) => readWoArtifacts(r, w, deps)))(root, wos) : { artifacts: [] };
  const artifacts = read.artifacts ?? [];
  const unknown = [...(read.missing ?? []).map((w) => `${w}: work order not found`), ...(read.unreadable ?? [])];
  let risk = null;
  if (unknown.length) {
    // The files of the unit cannot all be known: their risk is unknown, so the doubt is never decided without the owner.
    risk = { zone: "r1", irreversible: true, failclosed: true, detail: oneLine(unknown.join("; "), 200) };
  } else if (artifacts.length) {
    try {
      risk = await (deps.computeRisk ?? computeRisk)({ root, files: artifacts }, deps.riskDeps ?? {});
    } catch (error) {
      risk = { zone: "r1", irreversible: true, failclosed: true, detail: oneLine(error.message, 120) };
    }
  }
  const body = [`Question: ${doubt.question}`, `Why: ${doubt.why}`, ...doubt.options.map((o) => `Option ${o.id}: ${o.text}`)].join("\n");
  let text;
  try {
    text = await (deps.classifyText ?? ((input) => classifyText(input, deps)))({ root, text: `${body}\n` });
  } catch (error) {
    text = { ok: false, detail: oneLine(error.message, 120) };
  }
  const cites = DR_RE.test(body);
  DR_RE.lastIndex = 0;
  const yaml = cites ? await registryText(project, deps) : "";
  const reasons = vetoReasons({ unit, doubt, risk, text, ownerDrs: yaml === null ? null : drsRequiringOwner(yaml) });
  return { reasons, vetoed: reasons.length > 0 };
}
