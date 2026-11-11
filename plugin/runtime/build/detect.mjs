/**
 * Pandacorp build engine v2 — context detection behind `start --detect` (BUILD-7, PLAN 3.10, D18, 3.16 A4/A17).
 *
 * Read-only and unfenced: it reads the lease, `build/state.json`, `status.yaml`, the change queue and the work
 * orders, applies the 7-row table (first match wins) and returns the scope, a provisional size and the builder label.
 * It never writes a card, a state file or a lease, and it never calls an LLM.
 *
 *   1 lease live and no `--resume`                                       -> do not build
 *   2 `--resume`; or lease stale/absent with a non-terminal v2 run, a v2 building card, or suspended runs -> resume
 *   3 target is a card (ready/draft)                                      -> that card
 *   4 target is FRDs                                                      -> their pending WOs
 *   5 a session card (written in this conversation)                       -> the conversed scope only
 *   6 pending plan WOs (not claimed by an open card)                      -> the pending plan
 *   7 nothing                                                             -> list cards, stop
 *
 * Two readings that refine the table, both from BUILD-7 / A4: a session card (row 5) or an explicit target (rows 3/4)
 * outranks the NON-explicit triggers of row 2 (a paused run, a half-built card, suspended runs): the build never
 * resumes another scope instead of the named one, and `signals.suspendable_run` tells the preflight which paused run
 * the new run would suspend. An explicit `--resume` and a live lease keep their table position.
 *
 * Anything unreadable fails CLOSED (`failclosed: true`, listed in `signals.unreadable`): a corrupt lease counts as
 * live, a corrupt `state.json` as a non-terminal run, a malformed work order is not counted as pending. The
 * dispatcher maps `failclosed` to exit 9 and prints the result in full.
 *
 * Pure with respect to its inputs: every side effect goes through `deps` (see `resolveDeps` in card.mjs).
 */
import path from "node:path";
import { buildPaths, hostPaths } from "./paths.mjs";
import {
  cardPaths, frontmatterList, listCards, parseCardRef, parseYamlSubset, readCard, resolveDeps, splitFrontmatter, SLUG_RE,
} from "./card.mjs";

/** The seven detection rows, by number. */
export const DETECT_ROWS = Object.freeze({
  LIVE_LEASE: 1, RESUME: 2, TARGET_CARD: 3, TARGET_FRDS: 4, SESSION_CARD: 5, PENDING_PLAN: 6, NOTHING: 7,
});
/** Words from the retired mode picker: accepted and ignored. */
export const LEGACY_MODE_WORDS = Object.freeze(["pro", "balanced", "powerful", "deep"]);
/** `state.status` values of a finished (not resumable) run; every other status is resumable. */
export const TERMINAL_RUN_STATUSES = Object.freeze(["finished"]);
/** Work-order `implementation_status` values (DR-050). */
export const WO_STATUSES = Object.freeze(["PLANNED", "IN_PROGRESS", "IN_REVIEW", "VERIFIED", "BLOCKED"]);

const OPEN_CARD_STATUSES = new Set(["ready", "draft", "building", "closing"]);
const FRD_ARG_RE = /^frd-\d+(?:-[a-z0-9-]+)?$/i;
const SAFE_SESSION_ID = /^[A-Za-z0-9._-]{1,160}$/;
const VALUE_FLAGS = new Set(["--k", "--mode", "--run", "--answers", "--session-model", "--scope-json"]);
const GIANT_FRDS = 4;
const GIANT_WOS = 15;

const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const isEnoent = (error) => error?.code === "ENOENT" || error?.code === "ENOTDIR";

async function readText(fs, file) {
  try { return await fs.readFile(file, "utf8"); } catch (error) { if (isEnoent(error)) return null; throw error; }
}

const statusScalar = (yaml, key) => {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(yaml);
  if (!m) return null;
  return m[1].replace(/\s+#.*$/, "").trim().replace(/^(["'])(.*)\1$/, "$2") || null;
};

// ---------------------------------------------------------------------------------------------------------------
// Arguments and label
// ---------------------------------------------------------------------------------------------------------------

/**
 * Parse the owner's raw arguments after `/pandacorp:implement` (pure).
 * @param {string} raw the raw argument string
 * @returns {{raw: string, label: "claude"|"codex"|null, resume: boolean, run: string|null, card_ref: string|null,
 *   frds: string[], bare: string[], legacy_words: string[], version_scale: boolean, warnings: string[]}}
 *   `card_ref` is set only for an explicit `change:<id>` / `change=<id>`; `bare` are slug-like words (a card or junk)
 */
export function parseDetectArgs(raw) {
  const text = String(raw ?? "");
  const tokens = [...text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  const out = { raw: text, label: null, resume: false, run: null, card_ref: null, frds: [], bare: [], legacy_words: [], version_scale: false, warnings: [] };
  const warn = (message) => { if (!out.warnings.includes(message)) out.warnings.push(message); };
  const setLabel = (value) => {
    if (value !== "claude" && value !== "codex") { warn(`unknown label ignored: ${value}`); return; }
    if (out.label && out.label !== value) warn(`conflicting labels, using ${out.label}`);
    out.label ??= value;
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const low = token.toLowerCase();
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const name = eq < 0 ? token : token.slice(0, eq);
      let value = eq < 0 ? null : token.slice(eq + 1);
      const takesValue = name === "--label" || VALUE_FLAGS.has(name);
      if (takesValue && value === null && i + 1 < tokens.length && !tokens[i + 1].startsWith("--")) { i += 1; value = tokens[i]; }
      if (name === "--resume") out.resume = true;
      else if (name === "--label") setLabel(String(value ?? "").toLowerCase());
      else if (name === "--run") out.run = value && /^[A-Za-z0-9._-]{1,160}$/.test(value) ? value : null;
      else if (!takesValue) warn(`unknown argument ignored: ${name}`);
    } else if (LEGACY_MODE_WORDS.includes(low)) {
      out.legacy_words.push(low);
      warn("legacy mode word ignored");
    } else if (low === "v2") { /* the opt-in keyword of releases before 10.0.0 */ } else if (low === "claude" || low === "codex") setLabel(low);
    else if (/^change[:=]/.test(low)) {
      const slug = parseCardRef(low);
      if (!slug) throw fail("INVALID_INPUT", `invalid card reference: ${token}`);
      out.card_ref ??= slug;
    } else if (FRD_ARG_RE.test(low)) out.frds.push(low);
    else if (low === "new-version") out.version_scale = true;
    else if (SLUG_RE.test(low)) out.bare.push(low);
    else warn(`unrecognized argument ignored: ${token}`);
  }
  return out;
}

/**
 * Label precedence (step 0): explicit word > orchestrate flag (read-only) > the calling session's runtime.
 * @param {{explicit: string|null, flag: string|null, sessionRuntime: string|null}} input `flag` = the content of the
 *   orchestrate flag file (null when absent or not applicable)
 * @returns {{label: "claude"|"codex", label_source: "explicit"|"orchestrate"|"default"}}
 */
export function resolveLabel({ explicit, flag, sessionRuntime }) {
  if (explicit === "claude" || explicit === "codex") return { label: explicit, label_source: "explicit" };
  if (flag === "claude" || flag === "codex") return { label: flag, label_source: "orchestrate" };
  return { label: sessionRuntime === "codex" ? "codex" : "claude", label_source: "default" };
}

async function readOrchestrateFlag(ctx, sessionId, sessionRuntime, warn) {
  if (sessionRuntime === "codex" || !sessionId) return null;
  if (!SAFE_SESSION_ID.test(sessionId)) { warn("orchestrate flag ignored: unsafe session id"); return null; }
  const dir = hostPaths({ env: ctx.env, homedir: ctx.homedir }).orchestrateDir;
  let content;
  try { content = await readText(ctx.fs, path.join(dir, `${sessionId}.on`)); } catch { warn("orchestrate flag unreadable, ignored"); return null; }
  const value = content?.trim().toLowerCase() ?? null;
  if (value !== null && value !== "claude" && value !== "codex") { warn("orchestrate flag ignored: unexpected content"); return null; }
  return value;
}

// ---------------------------------------------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------------------------------------------

async function readLease(ctx, p, nowMs) {
  const dirEntry = await ctx.fs.lstat(p.leaseDir).catch((error) => { if (isEnoent(error)) return null; throw error; });
  if (!dirEntry) return { state: "free", coordinator: null, run_id: null, unreadable: false };
  let lease;
  try { lease = JSON.parse(await ctx.fs.readFile(p.leaseFile, "utf8")); } catch { lease = null; }
  const renewed = Date.parse(lease?.renewed_at);
  if (!lease || typeof lease !== "object" || !Number.isFinite(renewed) || !(Number(lease.ttl_seconds) > 0)) {
    return { state: "live", coordinator: null, run_id: null, unreadable: true };
  }
  const fresh = nowMs - renewed < Number(lease.ttl_seconds) * 1000;
  return { state: fresh ? "live" : "stale", coordinator: typeof lease.coordinator === "string" ? lease.coordinator : null, run_id: typeof lease.run_id === "string" ? lease.run_id : null, unreadable: false };
}

async function readRunState(ctx, file) {
  let text;
  try { text = await readText(ctx.fs, file); } catch { return { run: null, unreadable: true }; }
  if (text === null) return { run: null, unreadable: false };
  try {
    const state = JSON.parse(text);
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("not an object");
    return { run: state, unreadable: false };
  } catch { return { run: { engine: "v2", run_id: null, status: null, corrupt: true }, unreadable: true }; }
}

/**
 * Read every work order under `docs/frds/<frd>/work-orders/` (frontmatter only; lenient parse).
 * @param {string} project absolute project root
 * @param {object} [deps] see `resolveDeps` in card.mjs
 * @returns {Promise<{wos: {id: string, frd: string, file: string, status: string, source_change: string[], depends_on: string[]}[],
 *   frds: string[], errors: {file: string, reason: string}[]}>} ids are lowercase (`wo-05-001`); `frds` = every FRD directory
 */
export async function readWorkOrders(project, deps = {}) {
  const { fs } = resolveDeps(deps);
  const root = path.join(project, "docs", "frds");
  const wos = [];
  const errors = [];
  let frdDirs;
  try { frdDirs = (await fs.readdir(root)).filter((n) => /^frd-/.test(n)).sort(); } catch (error) { if (isEnoent(error)) return { wos, frds: [], errors }; throw error; }
  for (const frd of frdDirs) {
    const dir = path.join(root, frd, "work-orders");
    let names;
    try { names = (await fs.readdir(dir)).filter((n) => /^wo-.*\.md$/.test(n)).sort(); } catch (error) { if (isEnoent(error)) continue; throw error; }
    for (const name of names) {
      const file = `docs/frds/${frd}/work-orders/${name}`;
      let raw;
      try { raw = await fs.readFile(path.join(dir, name), "utf8"); } catch { errors.push({ file, reason: "unreadable" }); continue; }
      const parts = splitFrontmatter(raw);
      if (!parts) { errors.push({ file, reason: "missing frontmatter" }); continue; }
      const { data } = parseYamlSubset(parts.fm);
      const status = typeof data.implementation_status === "string" ? data.implementation_status : "";
      if (!WO_STATUSES.includes(status)) { errors.push({ file, reason: `implementation_status missing or unknown: ${status || "(none)"}` }); continue; }
      const id = (typeof data.id === "string" && /^wo-/i.test(data.id) ? data.id : name.replace(/^(wo-\d+-\d+).*$/, "$1")).toLowerCase();
      wos.push({
        id, frd, file, status,
        source_change: frontmatterList(data.source_change).map((s) => s.toLowerCase()),
        depends_on: frontmatterList(data.dependsOn ?? data.depends_on).map((s) => s.toLowerCase()),
      });
    }
  }
  return { wos, frds: frdDirs, errors };
}

const isPending = (wo) => wo.status !== "VERIFIED" && wo.status !== "BLOCKED";

function resolveFrdName(name, frdDirs) {
  const low = String(name).toLowerCase();
  if (frdDirs.includes(low)) return low;
  const matches = frdDirs.filter((d) => d.startsWith(`${low}-`));
  return matches.length === 1 ? matches[0] : null;
}

/** Scope of one card: its affected FRDs plus the pending WOs that name it in `source_change`. */
function cardScope(card, workOrders, frdDirs) {
  const named = [card.frd, ...card.affected_frds].filter(Boolean).map((f) => resolveFrdName(f, frdDirs) ?? f.toLowerCase());
  const bound = workOrders.filter((wo) => wo.source_change.includes(card.slug));
  const wos = bound.filter(isPending);
  const frds = [...new Set([...named, ...wos.map((wo) => wo.frd)])].sort();
  return { card: card.slug, frds, wos: wos.map((wo) => wo.id).sort() };
}

const emptyScope = () => ({ card: null, frds: [], wos: [] });

/**
 * Provisional size (BUILD-9): giant on a first implementation, more than 4 FRDs or 15 WOs; touch for 0-1 WO without a new
 * FRD; feature otherwise. A card with no WOs yet is sized from its Dentro points (unknown count = feature). Can rise later,
 * never fall.
 * @param {{firstImpl: boolean, wos: number, frds: number, points: number|null, newFrd: boolean}} input
 * @returns {"touch"|"feature"|"giant"}
 */
export function provisionalSize({ firstImpl, wos, frds, points, newFrd }) {
  if (firstImpl || frds > GIANT_FRDS || wos > GIANT_WOS) return "giant";
  const count = wos > 0 ? wos : points;
  return count !== null && count <= 1 && !newFrd ? "touch" : "feature";
}

function sizeOfScope(scope, { firstImpl, card, frdDirs }) {
  const hasWos = scope.wos.length > 0;
  const named = card ? [card.frd, ...card.affected_frds].filter(Boolean) : [];
  const newFrd = card ? named.length === 0 || named.some((f) => resolveFrdName(f, frdDirs) === null) : false;
  const points = card ? (card.has_dentro && card.dentro.length > 0 ? card.dentro.length : null) : null;
  return provisionalSize({ firstImpl, wos: scope.wos.length, frds: scope.frds.length, points: hasWos ? scope.wos.length : points, newFrd: hasWos ? false : newFrd });
}

function unmetDependencies(scope, workOrders) {
  const inScope = new Set(scope.wos);
  const byId = new Map(workOrders.map((wo) => [wo.id, wo]));
  const unmet = [];
  for (const id of scope.wos) {
    for (const dep of byId.get(id)?.depends_on ?? []) {
      const target = byId.get(dep);
      if (!inScope.has(dep) && target?.status !== "VERIFIED") unmet.push({ wo: id, depends_on: dep, status: target?.status ?? null });
    }
  }
  return unmet;
}

// ---------------------------------------------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------------------------------------------

/**
 * Compute the context signals, apply the 7-row table and return the `start --detect` result.
 * @param {{project: string, args?: string, sessionCard?: string|null, sessionId?: string|null, sessionRuntime?: "claude"|"codex"|null,
 *   resume?: boolean}} input `sessionCard` is a path (absolute or relative to the project) under `.pandacorp/inbox/changes/`;
 *   `resume` is the CLI's `--resume` flag (also accepted inside `args`)
 * @param {object} [deps] see `resolveDeps` in card.mjs (`fs`, `env`, `homedir`, `now`); the clock is `env.PANDACORP_NOW`,
 *   the orchestrate flag directory `env.PANDACORP_ORCHESTRATE_DIR`
 * @returns {Promise<object>} `{ok, cmd:"start", mode:"detect", signals, row, scope, size_provisional, label, label_source, warnings, failclosed}`;
 *   `failclosed` true means a signal was unreadable (the dispatcher exits 9 and still prints the result)
 * @throws {Error} code `NOT_A_PROJECT` (no status.yaml), `INVALID_INPUT` (bad card reference, invalid or non-ready session card,
 *   a named card that fails its check), `INVALID_PATH` (session card outside the queue)
 */
export async function detect(input, deps = {}) {
  const ctx = resolveDeps(deps);
  const project = path.resolve(input.project);
  const p = buildPaths(project, { env: ctx.env, homedir: ctx.homedir });
  const warnings = [];
  const warn = (message) => { if (!warnings.includes(message)) warnings.push(message); };
  const unreadable = [];

  const statusYaml = await readText(ctx.fs, p.statusYaml).catch(() => { throw fail("NOT_A_PROJECT", "status.yaml is unreadable"); });
  if (statusYaml === null) throw fail("NOT_A_PROJECT", "no .pandacorp/status.yaml: not a Pandacorp project");
  const phase = statusScalar(statusYaml, "phase");
  const launched = phase === "release" && statusScalar(statusYaml, "deploy_target") !== "internal";

  const args = parseDetectArgs(input.args ?? "");
  if (input.resume === true) args.resume = true;
  for (const w of args.warnings) warn(w);
  const flag = await readOrchestrateFlag(ctx, input.sessionId ?? null, input.sessionRuntime ?? null, warn);
  const { label, label_source } = resolveLabel({ explicit: args.label, flag, sessionRuntime: input.sessionRuntime ?? null });

  const lease = await readLease(ctx, p, ctx.now());
  if (lease.unreadable) { unreadable.push("lease"); warn("lease unreadable: treated as live (fail closed)"); }
  const { run: state, unreadable: stateBad } = await readRunState(ctx, p.stateFile);
  if (stateBad) { unreadable.push("state"); warn("build/state.json unreadable: treated as a non-terminal run (hint: rebuild-state)"); }
  const v2Run = state && state.engine === "v2" ? state : null;
  const nonTerminalRun = v2Run && !TERMINAL_RUN_STATUSES.includes(v2Run.status) ? v2Run : null;
  const suspended = await readDirNames(ctx.fs, p.buildSuspendedRoot);

  const { cards, errors: cardErrors } = await listCards(project, {}, ctx);
  const { wos: allWos, frds: frdDirs, errors: woErrors } = await readWorkOrders(project, ctx);
  if (woErrors.length > 0) { unreadable.push("work_orders"); warn(`${woErrors.length} work order(s) unreadable or without a valid implementation_status: not counted`); }
  const cardBySlug = new Map(cards.map((c) => [c.slug, c]));
  const openSlugs = new Set(cards.filter((c) => OPEN_CARD_STATUSES.has(c.status)).map((c) => c.slug));
  const pendingWos = allWos.filter(isPending);
  const planWos = pendingWos.filter((wo) => !wo.source_change.some((s) => openSlugs.has(s)));
  const cardBound = pendingWos.filter((wo) => wo.source_change.some((s) => openSlugs.has(s)));
  const firstImpl = !allWos.some((wo) => wo.status === "VERIFIED");

  const liveRunId = lease.state === "live" ? lease.run_id : null;
  const halfCards = cards.filter((c) => c.status === "building" && !(liveRunId && c.run_id === liveRunId));
  const v2HalfCard = halfCards.find((c) => c.engine === "v2") ?? null;

  const cardsView = cards.filter((c) => c.status === "ready" || c.status === "draft").map((c) => {
    const bound = allWos.filter((wo) => wo.source_change.includes(c.slug));
    return { slug: c.slug, status: c.status, type: c.type, class: c.class, title: c.title, frd: c.frd, date: c.date, wos_bound: bound.length, wos_pending: bound.filter(isPending).length };
  });
  const halfView = halfCards.map((c) => ({ slug: c.slug, engine: c.engine === "v2" ? "v2" : c.v1 ? "v1" : null, run_id: c.run_id || null, title: c.title }));

  // Session card (row 5): validated as `card check` does, strict about Dentro/Fuera.
  let sessionCard = null;
  if (input.sessionCard) {
    sessionCard = await loadSessionCard(ctx, project, input.sessionCard);
    if (sessionCard.status !== "ready") throw fail("INVALID_INPUT", `session card ${sessionCard.slug} must be status: ready (it is ${sessionCard.status})`);
  }

  // Explicit target (rows 3/4).
  const target = resolveTarget(args, { cardBySlug, cardErrors, frdDirs, pendingWos, warn });

  const resumeRunId = nonTerminalRun?.run_id ?? (args.run && suspended.includes(args.run) ? args.run : (suspended.at(-1) ?? null));
  const implicitResume = lease.state !== "live" && (nonTerminalRun !== null || v2HalfCard !== null || suspended.length > 0);

  let row;
  if (lease.state === "live" && !args.resume) row = DETECT_ROWS.LIVE_LEASE;
  else if (args.resume) row = DETECT_ROWS.RESUME;
  else if (sessionCard) row = DETECT_ROWS.SESSION_CARD;
  else if (args.version_scale) { row = DETECT_ROWS.NOTHING; warn("version-scale request: it is product scope and is not built here"); }
  else if (target.kind === "unresolved") row = DETECT_ROWS.NOTHING;
  else if (target.kind === "card" && target.row === DETECT_ROWS.TARGET_CARD) row = DETECT_ROWS.TARGET_CARD;
  else if (target.kind === "frds") row = DETECT_ROWS.TARGET_FRDS;
  else if (target.kind === "card" || implicitResume) row = DETECT_ROWS.RESUME;
  else row = planWos.length > 0 ? DETECT_ROWS.PENDING_PLAN : DETECT_ROWS.NOTHING;
  if (row === DETECT_ROWS.TARGET_FRDS && target.wos.length === 0) { row = DETECT_ROWS.NOTHING; warn("the named FRD(s) have no pending work orders"); }

  let scope = emptyScope();
  let size = null;
  let unmet = [];
  let resume = null;
  if (row === DETECT_ROWS.RESUME) {
    ({ scope, size, resume } = await resumeScope(ctx, p, { nonTerminalRun, resumeRunId, v2HalfCard, allWos, frdDirs, firstImpl, warn }));
  } else if (row === DETECT_ROWS.SESSION_CARD) {
    scope = cardScope(sessionCard, allWos, frdDirs);
    size = sizeOfScope(scope, { firstImpl, card: sessionCard, frdDirs });
  } else if (row === DETECT_ROWS.TARGET_CARD) {
    scope = cardScope(target.card, allWos, frdDirs);
    size = sizeOfScope(scope, { firstImpl, card: target.card, frdDirs });
  } else if (row === DETECT_ROWS.TARGET_FRDS) {
    scope = { card: null, frds: target.frds, wos: target.wos };
    size = sizeOfScope(scope, { firstImpl, card: null, frdDirs });
  } else if (row === DETECT_ROWS.PENDING_PLAN) {
    scope = { card: null, frds: [...new Set(planWos.map((wo) => wo.frd))].sort(), wos: planWos.map((wo) => wo.id).sort() };
    size = sizeOfScope(scope, { firstImpl, card: null, frdDirs });
  }
  if ([DETECT_ROWS.TARGET_CARD, DETECT_ROWS.TARGET_FRDS, DETECT_ROWS.SESSION_CARD].includes(row)) {
    unmet = unmetDependencies(scope, allWos);
    for (const u of unmet) warn(`${u.wo} depends on ${u.depends_on} (${u.status ?? "not found"}), outside the scope: hand back, never pulled in`);
  }
  const suspendable = [DETECT_ROWS.SESSION_CARD, DETECT_ROWS.TARGET_CARD, DETECT_ROWS.TARGET_FRDS].includes(row) && nonTerminalRun ? (nonTerminalRun.run_id ?? null) : null;

  return {
    ok: true, cmd: "start", mode: "detect",
    signals: {
      lease: lease.state, lease_coordinator: lease.state === "free" ? null : lease.coordinator,
      run_status: v2Run ? (v2Run.status ?? null) : null,
      args: { raw: args.raw, label: args.label, resume: args.resume, run: args.run, card: target.slug ?? null, frds: target.kind === "frds" ? target.frds : args.frds, legacy_words: args.legacy_words },
      card_session: sessionCard ? { slug: sessionCard.slug, path: sessionCard.path, status: sessionCard.status, type: sessionCard.type, points: sessionCard.dentro.length, session_id: input.sessionId ?? null } : null,
      wos_pending: planWos.length, wos_card_bound: cardBound.map((wo) => wo.id).sort(), first_impl: firstImpl,
      phase, launched,
      cards: cardsView, cards_half: halfView, card_errors: cardErrors,
      suspended, suspendable_run: suspendable, resume_run: resume,
      unmet_deps: unmet, wo_errors: woErrors, unreadable,
    },
    row, scope, size_provisional: size, label, label_source, warnings, failclosed: unreadable.length > 0,
  };
}

async function readDirNames(fs, dir) {
  try {
    const names = (await fs.readdir(dir)).filter((n) => /^[A-Za-z0-9._-]{1,160}$/.test(n)).sort();
    const real = [];
    for (const n of names) { const e = await fs.lstat(path.join(dir, n)).catch(() => null); if (e?.isDirectory() && !e.isSymbolicLink()) real.push(n); }
    return real;
  } catch (error) { if (isEnoent(error)) return []; throw error; }
}

async function loadSessionCard(ctx, project, file) {
  const dirs = cardPaths(project);
  const abs = path.resolve(project, file);
  const slug = path.basename(abs, ".md");
  if (path.dirname(abs) !== dirs.pending || !abs.endsWith(".md") || !SLUG_RE.test(slug)) throw fail("INVALID_PATH", `session card must be .pandacorp/inbox/changes/<slug>.md: ${file}`);
  const card = await readCard(project, slug, { where: "pending", requireScope: true }, ctx);
  if (!card) throw fail("INVALID_INPUT", `session card not found: ${file}`);
  if (card.errors.length > 0) throw fail("INVALID_INPUT", `session card fails card check: ${card.errors.join("; ")}`, { errors: card.errors });
  return { ...card, path: abs };
}

function resolveTarget(args, { cardBySlug, cardErrors, frdDirs, pendingWos, warn }) {
  const none = { kind: "none", slug: null, card: null, row: null, frds: [], wos: [] };
  let slug = args.card_ref;
  if (!slug) {
    const known = args.bare.filter((s) => cardBySlug.has(s));
    if (known.length > 0) slug = known[0];
    else if (args.bare.length === 1 && args.frds.length === 0) slug = args.bare[0];
    else if (args.bare.length > 0) warn(`unrecognized argument ignored: ${args.bare.join(" ")}`);
    if (known.length > 1) warn(`one card per run: ignored ${known.slice(1).join(", ")}`);
  }
  if (slug) {
    if (args.frds.length > 0) warn("a card was named: the FRD arguments were ignored");
    const card = cardBySlug.get(slug) ?? null;
    const broken = cardErrors.find((e) => e.file === `${slug}.md`);
    if (broken) throw fail("INVALID_INPUT", `card ${slug} fails card check: ${broken.reason}`);
    if (!card) { warn(`card not found in the queue: ${slug}`); return { ...none, kind: "unresolved", slug }; }
    if (card.errors.length > 0) throw fail("INVALID_INPUT", `card ${slug} fails card check: ${card.errors.join("; ")}`, { errors: card.errors });
    if (card.status === "ready" || card.status === "draft") return { kind: "card", slug, card, row: DETECT_ROWS.TARGET_CARD, frds: [], wos: [] };
    if (card.status === "building" && card.engine === "v2") return { kind: "card", slug, card, row: DETECT_ROWS.RESUME, frds: [], wos: [] };
    warn(`card ${slug} is ${card.status}: it cannot be built`);
    return { ...none, kind: "unresolved", slug };
  }
  if (args.frds.length > 0) {
    const frds = [];
    for (const name of args.frds) {
      const dir = resolveFrdName(name, frdDirs);
      if (dir) frds.push(dir); else warn(`FRD not found: ${name}`);
    }
    const unique = [...new Set(frds)].sort();
    return { ...none, kind: unique.length > 0 ? "frds" : "unresolved", frds: unique, wos: pendingWos.filter((wo) => unique.includes(wo.frd)).map((wo) => wo.id).sort() };
  }
  return none;
}

async function resumeScope(ctx, p, { nonTerminalRun, resumeRunId, v2HalfCard, allWos, frdDirs, firstImpl, warn }) {
  let source = nonTerminalRun;
  if (!source && resumeRunId) {
    const { run } = await readRunState(ctx, path.join(p.buildSuspendedDir(resumeRunId), "state.json"));
    source = run;
  }
  if (source?.scope && Array.isArray(source.scope.wos)) {
    const scope = { card: source.scope.card ?? null, frds: [...(source.scope.frds ?? [])], wos: [...source.scope.wos] };
    return { scope, size: ["touch", "feature", "giant"].includes(source.size) ? source.size : "feature", resume: source.run_id ?? resumeRunId };
  }
  if (v2HalfCard) {
    const scope = cardScope(v2HalfCard, allWos, frdDirs);
    return { scope, size: sizeOfScope(scope, { firstImpl, card: v2HalfCard, frdDirs }), resume: v2HalfCard.run_id || null };
  }
  warn("nothing to resume: no non-terminal run, suspended run or v2 building card");
  return { scope: emptyScope(), size: null, resume: null };
}
