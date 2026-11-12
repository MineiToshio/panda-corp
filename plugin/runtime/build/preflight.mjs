/**
 * Pandacorp build engine v2: the first minute (`start --preflight`, BUILD-12, PLAN 3.2/3.10, D19, D29, D33).
 *
 * Computes, with no LLM and well under 60 s, every question the owner must answer before leaving: one batch of
 * checks (groups scope, conflict, phase, access, mac, gates, deferred), each ask carrying an id (`q-<check id>`), a
 * conservative default, `affects` and `reversible`. Writes `build/preflight.json` (mode 0600; `start --run` reuses it
 * when at most 15 minutes old for the same row and scope, see `loadFreshPreflight`). In a launched project it only checks
 * the untracked pre-push hook (`start --run` installs it; a missing hook means `drive` is not armable). Codex availability comes from `codex login status` and, only when the reading is old and high, the
 * injected quota probe.
 *
 * Pure with respect to its inputs: every effect goes through `deps` (`fs`, `env`, `homedir`, `now`, `exec`,
 * `monotonic`, `platform`, `detect`, `installPrePush`, `probeCodex`, `computeRisk`, `readSignals`, `tcpProbe`, `statfs`).
 * Owner-facing strings are Spanish and carry no em or en dash.
 */
import { execFile } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { installPrePush as realInstallPrePush } from "../../scripts/install-pre-push.mjs";
import { readSignals as realReadSignals } from "./admission.mjs";
import {
  frontmatterList, parseYamlSubset, readCard, resolveDeps, splitFrontmatter,
} from "./card.mjs";
import { readDeferred } from "./deferred.mjs";
import { detect as realDetect, provisionalSize, readWorkOrders } from "./detect.mjs";
import { atomicWriteJson, readJson } from "./fsx.mjs";
import { buildPaths } from "./paths.mjs";
import {
  effective, loadThresholds, probeCodex as realProbeCodex, readQuota, recordCodex, resetsAtOf,
} from "./quota.mjs";
import { builderCell, reviewCell } from "./routing.mjs";
import { computeRisk as realComputeRisk } from "./risk.mjs";
import { buildAnnounce, describeCell, GATE_LABELS_ES } from "./summary.mjs";

/** `start --run` reuses a preflight at most this old (D19). */
export const PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000;
const CHECK_TIMEOUT_MS = 25_000;
const CODEX_LOGIN_TIMEOUT_MS = 15_000;
const CODEX_PROBE_TIMEOUT_MS = 40_000;
const TOOL_TIMEOUT_MS = 5_000;
const TCP_TIMEOUT_MS = 1_500;
const DISK_WARN_BYTES = 5 * 1024 ** 3;
const DISK_FAIL_BYTES = 1024 ** 3;
const NO_DOUBT_RE = /^(?:ninguna?s?|none|n\/a|no hay|sin dudas?)[.\s]*$/i;
const PATH_TOKEN_RE = /`([\w@.-]+(?:\/[\w@.-]+)+\.[A-Za-z0-9]+)`/g;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const ROWS = [1, 2, 3, 4, 5, 6, 7];

/** Gate kinds foreseeable from a card's text (keyword scan over Spanish and English wording). */
const GATE_PATTERNS = Object.freeze([
  { kind: "production", re: /(?:a|en) producci[oó]n|production deploy|desplieg|\bdeploy(?:ar)?\b|go[- ]live/i, line: "Producción: lo que llegue a `main` de un proyecto lanzado espera tu orden." },
  { kind: "money", re: /\bpagos?\b|cobr|factur|stripe|paypal|checkout|billing|reembols|gastar|comprar|dinero/i, line: "Dinero: cualquier gasto esperará tu OK." },
  { kind: "delete", re: /borrar|borrado|eliminar (?:datos|cuentas?|usuarios?|registros)|purgar|drop table|truncate|delete (?:all|data|user|account)|destructiv/i, line: "Borrado de datos: esperará tu OK." },
  { kind: "external", re: /enviar (?:un )?(?:correo|email|mail|mensaje)|(?:correo|email) a |newsletter|publicar|tuit|tweet|comunicaci[oó]n externa/i, line: "Comunicación externa: esperará tu OK." },
  { kind: "production_migration", re: /migraci[oó]n(?:es)? (?:en|de|a) producci[oó]n|production migration|migrate prod/i, line: "Migración de producción: esperará tu OK." },
]);

const fail = (code, message) => Object.assign(new Error(message), { code });
const asArray = (value) => (Array.isArray(value) ? value : []);
const clip = (text, max = 90) => {
  const one = String(text ?? "").replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 3).trimEnd()}...` : one;
};
const unique = (list) => [...new Set(list)];

/** A check entry (`checks[]` of the output). */
const mk = (group, id, status, detail_es, question) => ({ group, id, status, detail_es, ...(question ? { question } : {}) });
/** A question (D19): `{id, text_es, default_es, default_action, affects, reversible}` with `id = q-<check id>`. */
const ask = (checkId, text_es, default_es, default_action, affects, reversible) => ({
  id: `q-${checkId}`, text_es, default_es, default_action, affects, reversible,
});
const affectsFrds = (frds) => (frds.length > 0 ? { frds } : { all: true });

/**
 * Stable key of a row and scope, for the "same row and scope" reuse rule (D19).
 * @param {number} row detection row
 * @param {{card?: string|null, frds?: string[], wos?: string[]}} scope
 * @returns {string}
 */
export function scopeKey(row, scope) {
  return JSON.stringify({
    row,
    card: scope?.card ?? null,
    frds: [...asArray(scope?.frds)].sort(),
    wos: [...asArray(scope?.wos)].sort(),
  });
}

/**
 * Read `build/preflight.json` and say whether `start --run` may reuse it (at most 15 min old, same row and scope).
 * @param {{project: string, row: number, scope: object}} input
 * @param {object} [deps] see `resolveDeps` in card.mjs
 * @returns {Promise<{ok: true, preflight: object}|{ok: false, reason: "missing"|"stale"|"mismatch"}>}
 */
export async function loadFreshPreflight(input, deps = {}) {
  const ctx = resolveDeps(deps);
  const file = buildPaths(path.resolve(input.project), { env: ctx.env, homedir: ctx.homedir }).preflightFile;
  const saved = await readJson(file, { fs: ctx.fs });
  if (!saved || typeof saved !== "object") return { ok: false, reason: "missing" };
  const age = ctx.now() - Date.parse(saved.created_at);
  if (!Number.isFinite(age) || age > PREFLIGHT_MAX_AGE_MS || age < 0) return { ok: false, reason: "stale" };
  if (saved.scope_key !== scopeKey(input.row, input.scope)) return { ok: false, reason: "mismatch" };
  return { ok: true, preflight: saved };
}

// ----------------------------------------------------------------------------------------------- shared helpers

/** Default `exec`: no shell, never rejects, and the child sees the injected `env` (the test hooks reach fake binaries). */
function execIn(env) {
  return (file, args, opts = {}) => new Promise((resolve) => {
    execFile(file, args, { encoding: "utf8", cwd: opts.cwd, timeout: opts.timeout, env, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === "number" ? error.code : null) : 0,
        stdout: stdout || "",
        stderr: stderr || "",
        error: error ? String(error.message || error).split("\n")[0] : "",
      });
    });
  });
}

function makeRunner(exec) {
  return async (file, args, { cwd, timeout = TOOL_TIMEOUT_MS } = {}) => {
    try {
      const r = (await exec(file, args, { cwd, timeout, timeoutMs: timeout })) ?? {};
      const code = r.code ?? r.status;
      return { code: typeof code === "number" ? code : null, stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? ""), error: r.error ? String(r.error) : "" };
    } catch (error) {
      return { code: null, stdout: "", stderr: "", error: String(error?.message ?? error) };
    }
  };
}

/** Runs one async check with a time cap; a throw or a timeout becomes a conservative `fail` entry. */
async function guarded(group, id, unevaluated, work, timeoutMs = CHECK_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("tiempo agotado")), timeoutMs); }),
    ]);
  } catch (error) {
    unevaluated.push(id);
    return { check: mk(group, id, "fail", `No pude evaluarlo (${clip(error?.message ?? error, 120)}). Sigo por el camino conservador.`) };
  } finally {
    clearTimeout(timer);
  }
}

async function readText(fs, file) {
  try { return await fs.readFile(file, "utf8"); } catch (error) { if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null; throw error; }
}

function parseDotenv(text) {
  const out = {};
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

function connectsTo(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

// ------------------------------------------------------------------------------------------------- scope checks

function sizeOf({ signals, scope, card, frdDirs }) {
  const hasWos = scope.wos.length > 0;
  const named = card ? [card.frd, ...card.affected_frds].filter(Boolean) : [];
  const known = (name) => frdDirs.includes(name.toLowerCase()) || frdDirs.some((d) => d.startsWith(`${name.toLowerCase()}-`));
  const newFrd = card ? named.length === 0 || named.some((f) => !known(f)) : false;
  const points = card ? (card.has_dentro && card.dentro.length > 0 ? card.dentro.length : null) : null;
  return provisionalSize({
    firstImpl: signals.first_impl === true,
    wos: scope.wos.length,
    frds: scope.frds.length,
    points: hasWos ? scope.wos.length : points,
    newFrd: hasWos ? false : newFrd,
  });
}

function scopeChecks({ card, scope, size, signals, versionScale }) {
  const frds = scope.frds;
  const checks = [];
  const realDoubts = asArray(card?.dudas).filter((d) => !NO_DOUBT_RE.test(String(d.text).trim()));
  checks.push(realDoubts.length > 0
    ? mk("scope", "scope.doubts", "ask", `La tarjeta trae ${realDoubts.length} duda(s) abiertas.`, ask(
      "scope.doubts",
      `La tarjeta ${card.slug} trae ${realDoubts.length} duda(s) abiertas: ${realDoubts.slice(0, 3).map((d) => `"${clip(d.text, 70)}"`).join("; ")}.`,
      "las dejo fuera: construyo lo claro y aparco lo que dependa de ellas",
      "exclude_doubtful_points", affectsFrds(frds), true))
    : mk("scope", "scope.doubts", "pass", "Sin dudas abiertas en la tarjeta."));

  const uncited = card?.has_dentro ? card.dentro.filter((i) => !i.cited) : [];
  checks.push(uncited.length > 0
    ? mk("scope", "scope.summary_citation", "ask", `${uncited.length} punto(s) de Dentro no citan tu mensaje.`, ask(
      "scope.summary_citation",
      `${uncited.length} punto(s) de Dentro no citan tu mensaje (vienen solo de un resumen): ${uncited.slice(0, 3).map((i) => `"${clip(i.text, 70)}"`).join("; ")}.`,
      "los paso a Fuera como \"por confirmar\" y no los construyo",
      "move_to_fuera_por_confirmar", affectsFrds(frds), true))
    : mk("scope", "scope.summary_citation", "pass", "Cada punto de Dentro cita tu mensaje."));

  checks.push(size === "giant"
    ? mk("scope", "scope.giant", "ask", `El alcance es gigante: ${frds.length} FRDs y ${scope.wos.length} tareas.`, ask(
      "scope.giant",
      `El alcance es gigante (${frds.length} FRDs, ${scope.wos.length} tareas${signals.first_impl ? ", primera implementación del proyecto" : ""}).`,
      "lo construyo en tandas de 2 FRDs y el resto queda en cola",
      "tranches_of_2_frds", { all: true }, true))
    : mk("scope", "scope.giant", "pass", `Tamaño provisional: ${size}.`));

  checks.push(versionScale === true
    ? mk("scope", "scope.version", "ask", "Lo pedido parece un paquete de versión.", ask(
      "scope.version",
      "Lo pedido parece un paquete de versión (producto nuevo o varias épicas), no un cambio.",
      "no lo construyo; te dejo la lista de tarjetas y planes pendientes",
      "do_not_build", { all: true }, true))
    : mk("scope", "scope.version", "pass", "No es un paquete de versión."));
  return checks;
}

// ----------------------------------------------------------------------------------------------- conflict checks

async function conflictChecks({ project, ctx, row, scope, card, signals }) {
  const checks = [];
  const live = signals.lease === "live" && row !== 2;
  checks.push(live
    ? mk("conflict", "conflict.foreign_lease", "ask", "Hay otro build vivo en el proyecto.", ask(
      "conflict.foreign_lease",
      `Hay otro build en marcha en este proyecto${signals.lease_coordinator === "drive" ? " (lo lleva el relevo de Codex)" : ""}. ¿Construyo esto después?`,
      "queda en cola y no lo construyo ahora", "queue_for_later", { all: true }, true))
    : mk("conflict", "conflict.foreign_lease", "pass", "Ningún otro build vivo."));

  const pausedRun = signals.run_status && signals.run_status !== "finished";
  checks.push([3, 4, 5].includes(row) && pausedRun
    ? mk("conflict", "conflict.paused_plus_card", "ask", `Hay un build ${signals.run_status} y además pediste otro alcance.`, ask(
      "conflict.paused_plus_card",
      `Hay un build ${signals.run_status} en este proyecto y además pediste esto.`,
      "primero lo conversado; el build pausado se retoma después", "conversed_first", { all: true }, true))
    : mk("conflict", "conflict.paused_plus_card", "pass", "Sin build pausado que choque con lo pedido."));

  const wanted = new Set(scope.frds);
  const clashes = [];
  for (const half of asArray(signals.cards_half)) {
    if (half.slug === scope.card) continue;
    const other = await readCard(project, half.slug, {}, ctx).catch(() => null);
    const frds = other ? [other.frd, ...other.affected_frds].filter(Boolean) : [];
    const shared = frds.filter((f) => wanted.has(f));
    clashes.push({ slug: half.slug, shared });
  }
  checks.push(clashes.length > 0
    ? mk("conflict", "conflict.half_cards", "ask", "Hay tarjetas a medio construir en el proyecto.", ask(
      "conflict.half_cards",
      `Hay tarjetas a medio construir sin un build vivo: ${clashes.map((c) => c.slug).join(", ")}.`,
      "no las toco y construyo solo este alcance", "leave_half_cards",
      clashes.some((c) => c.shared.length > 0) ? affectsFrds(unique(clashes.flatMap((c) => c.shared))) : { all: true }, true))
    : mk("conflict", "conflict.half_cards", "pass", "Ninguna tarjeta a medio construir choca con este alcance."));
  return checks;
}

// ------------------------------------------------------------------------------------------------- phase checks

async function phaseChecks({ project, launched, deps, unevaluated }) {
  const launchedCheck = mk("phase", "phase.launched", "pass", launched ? "Proyecto lanzado: `main` es producción." : "Proyecto no lanzado.");
  if (!launched) {
    return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "pass", "El candado de push no aplica: el proyecto no está lanzado.")], prepush: { status: "not_needed", code: null, verified: true, will_install: false } };
  }
  const install = deps.installPrePush ?? realInstallPrePush;
  let installed;
  try {
    installed = await install({ project, check: true });
  } catch (error) {
    unevaluated.push("phase.prepush_missing");
    return {
      checks: [launchedCheck, mk("phase", "phase.prepush_missing", "fail", `No pude comprobar el candado de push (${clip(error?.message ?? error, 100)}).`)],
      prepush: { status: "error", code: null, verified: false, will_install: false },
    };
  }
  // R2: the preflight only CHECKS; `start --run` installs. Exit 1 (missing or stale) is installable at start.
  const verified = installed.code === 0;
  const willInstall = installed.code === 1;
  const prepush = { status: installed.status, code: installed.code, verified, will_install: willInstall };
  if (verified) return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "pass", "Candado de push instalado y al día.")], prepush };
  if (willInstall) return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "pass", "El candado de push se instala al arrancar el build.")], prepush };
  if (installed.code === 3) {
    return {
      checks: [launchedCheck, mk("phase", "phase.prepush_missing", "ask", "No puedo instalar el candado de push: el proyecto versiona sus hooks de git.", ask(
        "phase.prepush_missing",
        "El proyecto versiona sus hooks de git (core.hooksPath dentro del repo) y no puedo instalar el candado de push sin tocar archivos versionados. En un proyecto lanzado no construyo sin ese candado.",
        "no arranco el build en este proyecto", "do_not_build", { all: true }, true))],
      prepush,
    };
  }
  return { checks: [launchedCheck, mk("phase", "phase.prepush_missing", "fail", `El candado de push no quedó verificado (${clip(installed.message, 100)}).`)], prepush };
}

// ------------------------------------------------------------------------------------------------- access checks

async function codexLoginCheck({ project, ctx, run, label }) {
  const bin = ctx.env.PANDACORP_CODEX_BIN || "codex";
  const r = await run(bin, ["login", "status"], { cwd: project, timeout: CODEX_LOGIN_TIMEOUT_MS });
  if (r.code === 0) return { check: mk("access", "access.codex_login", "pass", "Codex tiene la sesión iniciada."), ok: true };
  const why = r.code === null ? "no se pudo ejecutar Codex" : "la sesión de Codex ha caducado";
  const codexBuilds = label === "codex";
  return {
    ok: false,
    check: mk("access", "access.codex_login", "ask", `Codex no está listo: ${why}.`, ask(
      "access.codex_login",
      `Codex no está listo (${why}) y solo tú puedes arreglarlo con \`codex login\`.`,
      codexBuilds
        ? "no arranco: pediste construir con Codex"
        : "sigo sin Codex: construyo y reviso solo con Claude, con revisiones degradadas y sin relevo",
      codexBuilds ? "do_not_build" : "continue_without_codex", { all: true }, true)),
  };
}

async function quotaChecks({ project, ctx, deps, exec, input, coordinator }) {
  const p = buildPaths(project, { env: ctx.env, homedir: ctx.homedir });
  const qdeps = { env: ctx.env, homedir: () => ctx.homedir, exec };
  const now = ctx.now();
  const thresholds = loadThresholds(qdeps);
  let q = await readQuota({ file: p.quotaFile, codexHome: p.codexHome, now, coordinator, probe: false }, qdeps);
  let probed = false;
  if (input.probeCodex === true && q.needs_probe) {
    const probe = deps.probeCodex ?? realProbeCodex;
    const reading = await probe({ ...qdeps, codexHome: p.codexHome, now, cwd: project, timeoutMs: CODEX_PROBE_TIMEOUT_MS });
    const stored = recordCodex(reading, { now, file: p.quotaFile, deps: qdeps });
    q = { ...q, codex: stored, effective: { ...q.effective, codex: effective(stored, now, { thresholds }) }, needs_probe: false };
    probed = true;
  }
  const view = (name, reading, eff) => ({ pct: eff.pct, state: eff.state, resets_at: resetsAtOf(reading), provider: name });
  const claude = view("claude", q.claude, q.effective.claude);
  const codex = view("codex", q.codex, q.effective.codex);
  const line = (name, v) => {
    if (v.state !== "known") return null;
    if (v.pct >= thresholds.quota_stop) return `${name} está al ${Math.round(v.pct)} %: las piezas nuevas pasan a la otra compañía.`;
    return null;
  };
  const claudeWarn = line("Claude", claude);
  const codexWarn = line("Codex", codex);
  const claudeCheck = claude.state !== "known"
    ? mk("access", "access.quota_claude", "warn", "Sin lectura reciente del cupo de Claude: voy reactivo (solo reacciono a un límite).")
    : mk("access", "access.quota_claude", claudeWarn ? "warn" : "pass", claudeWarn ?? `Claude al ${Math.round(claude.pct)} %.`);
  let codexCheck;
  if (codex.state !== "known") codexCheck = mk("access", "access.quota_codex", "warn", "Sin lectura del cupo de Codex: voy reactivo (solo reacciono a un límite).");
  else if (q.needs_probe) codexCheck = mk("access", "access.quota_codex", "warn", `Codex al ${Math.round(codex.pct)} % con una lectura vieja y sin sonda.`);
  else codexCheck = mk("access", "access.quota_codex", codexWarn ? "warn" : "pass", codexWarn ?? `Codex al ${Math.round(codex.pct)} %${probed ? " (medido con una sonda)" : ""}.`);
  return { checks: [claudeCheck, codexCheck], quota: { claude, codex }, policy: q.policy, thresholds, probed };
}

async function testDbCheck({ project, ctx, deps }) {
  const pkgText = await readText(ctx.fs, path.join(project, "package.json"));
  let scripts = {};
  try { scripts = JSON.parse(pkgText ?? "{}").scripts ?? {}; } catch { scripts = {}; }
  if (!scripts["db:test:up"]) return { check: mk("access", "access.test_db", "pass", "El proyecto no usa base de datos de pruebas local.") };
  const url = ctx.env.TEST_DATABASE_URL || parseDotenv(await readText(ctx.fs, path.join(project, ".env.local")))["TEST_DATABASE_URL"];
  const dflt = "arranco igual; las piezas con base de datos esperan en su compuerta y lo demás sigue";
  const mkAsk = (detail, text) => ({ check: mk("access", "access.test_db", "ask", detail, ask("access.test_db", text, dflt, "continue_without_test_db", { all: true }, true)) });
  if (!url) return mkAsk("TEST_DATABASE_URL no está definido.", "El proyecto usa base de datos de pruebas pero TEST_DATABASE_URL no está definido. Levántala con `pnpm db:test:up` y defínelo.");
  let parsed;
  try { parsed = new URL(url); } catch { return mkAsk("TEST_DATABASE_URL no es una URL válida.", "TEST_DATABASE_URL no es una URL válida."); }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    return mkAsk("La base de pruebas apunta fuera de este Mac.", `TEST_DATABASE_URL apunta a ${parsed.hostname}: las pruebas solo usan la base local de este Mac. Corrígela.`);
  }
  const port = Number(parsed.port || 5432);
  const reachable = await (deps.tcpProbe ?? connectsTo)(parsed.hostname.replace(/^\[|\]$/g, ""), port, TCP_TIMEOUT_MS);
  return reachable
    ? { check: mk("access", "access.test_db", "pass", `La base de pruebas responde en ${parsed.hostname}:${port}.`) }
    : mkAsk(`La base de pruebas no responde en ${parsed.hostname}:${port}.`, `La base de datos de pruebas no responde en ${parsed.hostname}:${port}. Levántala con \`pnpm db:test:up\`.`);
}

async function envPendingCheck({ project, ctx, scope }) {
  const [example, local, delivery] = await Promise.all(
    [".env.example", ".env.local", ".pandacorp/comms/entrega-entornos.md"].map((f) => readText(ctx.fs, path.join(project, f))),
  );
  const dflt = "arranco igual; las piezas que dependan de esos valores esperan en su compuerta y lo demás sigue";
  const wantsLocal = example !== null && Object.keys(parseDotenv(example)).length > 0;
  if (wantsLocal && local === null) {
    return { check: mk("access", "access.env_pending", "ask", "Falta .env.local.", ask(
      "access.env_pending", "Falta el archivo .env.local con los valores de desarrollo y solo tú los tienes.", dflt, "continue_with_pending_env", { all: true }, true)) };
  }
  const tokens = scope.frds.map((f) => (/^frd-(\d+)/i.exec(f)?.[1] ?? f).toLowerCase());
  const pending = [];
  for (const line of String(delivery ?? "").split(/\r?\n/)) {
    if (!/^\s*(?:[-*|]|\d+[.)])/.test(line) || !/pendiente|pending/i.test(line)) continue;
    if (/\b(?:sin|no hay|cero|0|ning[uú]n[oa]?)\s+(?:valores?\s+|entregas?\s+)?pendientes?|no pending/i.test(line)) continue;
    const named = scope.frds.filter((f, i) => new RegExp(`frd[- ]?${tokens[i]}\\b|${f}`, "i").test(line));
    if (tokens.length === 0 || named.length > 0) pending.push({ line, named });
  }
  if (pending.length === 0) return { check: mk("access", "access.env_pending", "pass", "Sin entregas de entorno pendientes para este alcance.") };
  return { check: mk("access", "access.env_pending", "ask", `${pending.length} entrega(s) de entorno pendientes.`, ask(
    "access.env_pending",
    `Hay ${pending.length} entrega(s) de entorno pendientes para este alcance (valores que solo tienes tú).`,
    dflt, "continue_with_pending_env", affectsFrds(unique(pending.flatMap((x) => x.named))), true)) };
}

async function diskCheck({ project, ctx, deps }) {
  const statfs = deps.statfs ?? ((dir) => ctx.fs.statfs(dir));
  const s = await statfs(project);
  const free = Number(s.bavail) * Number(s.bsize);
  const gib = (free / 1024 ** 3).toFixed(1);
  if (free < DISK_FAIL_BYTES) return { check: mk("access", "access.disk", "fail", `Quedan ${gib} GiB libres: el build puede fallar. Libera espacio.`) };
  if (free < DISK_WARN_BYTES) return { check: mk("access", "access.disk", "warn", `Quedan ${gib} GiB libres: libera espacio si puedes.`) };
  return { check: mk("access", "access.disk", "pass", `Hay ${gib} GiB libres en el disco.`) };
}

async function ramCheck({ ctx, deps, run }) {
  const readSignals = deps.readSignals ?? realReadSignals;
  const signalsFile = ctx.env.PANDACORP_SIGNALS_FILE || null;
  const exec = async (file, args) => {
    const r = await run(file, args, { timeout: TOOL_TIMEOUT_MS });
    if (r.code !== 0) throw new Error(r.error || `${file} salió con ${r.code}`);
    return r.stdout;
  };
  let s;
  try {
    s = await readSignals({ exec, signalsFile });
  } catch (error) {
    return { check: mk("access", "access.ram", "fail", `No pude leer la memoria (${clip(error?.message ?? error, 80)}): arranco en modo seguro, una pieza a la vez.`), unreadable: true };
  }
  if (s.L >= 4) return { check: mk("access", "access.ram", "warn", "Presión de memoria crítica: el build esperará a que baje.") };
  return { check: mk("access", "access.ram", "pass", `Memoria libre ${Number(s.A_gib).toFixed(1)} GiB, presión ${s.L}.`) };
}

// --------------------------------------------------------------------------------------------------- mac checks

async function powerCheck({ project, deps, run }) {
  if ((deps.platform ?? process.platform) !== "darwin") return { check: mk("mac", "mac.power", "pass", "La alimentación no se comprueba fuera de macOS.") };
  const r = await run("pmset", ["-g", "batt"], { cwd: project, timeout: TOOL_TIMEOUT_MS });
  if (r.code !== 0) throw new Error(r.error || "pmset falló");
  if (/Battery Power/i.test(r.stdout)) return { check: mk("mac", "mac.power", "warn", "El Mac va con batería: enchúfalo para que el build no se corte.") };
  return { check: mk("mac", "mac.power", "pass", "El Mac está enchufado.") };
}

// -------------------------------------------------------------------------------------------- gates and routing

function foreseenGates({ card, launched }) {
  const text = card ? `${card.title}\n${card.body}` : "";
  const hits = GATE_PATTERNS.filter((g) => g.re.test(text));
  const kinds = hits.map((g) => g.kind);
  const lines = hits.map((g) => g.line);
  if (launched && !kinds.includes("production")) { kinds.push("production"); lines.push(GATE_PATTERNS[0].line); }
  return { kinds, lines };
}

function cardPathFiles(card) {
  return unique([...String(card?.body ?? "").matchAll(PATH_TOKEN_RE)].map((m) => m[1]));
}

async function scopeArtifacts({ project, ctx, scope, allWos }) {
  const files = [];
  for (const id of scope.wos) {
    const wo = allWos.find((w) => w.id === id);
    if (!wo) continue;
    const raw = await readText(ctx.fs, path.join(project, wo.file));
    const parts = raw === null ? null : splitFrontmatter(raw);
    if (parts) files.push(...frontmatterList(parseYamlSubset(parts.fm).data.artifacts));
  }
  return unique(files);
}

function availabilityOf(policyView, codexLoginOk) {
  return {
    claude: policyView?.claude_new_units === false ? "quota" : "ok",
    codex: codexLoginOk === false ? "unreachable" : policyView?.codex_new_units === false ? "quota" : "ok",
  };
}

function plainRouting({ label, size, zone, availability, coordinator }) {
  const shape = coordinator === "codex" ? "R-B" : undefined;
  try {
    const builder = builderCell({ kind: "build", size }, { label, zone, quota: availability, shape });
    if (!builder.runtime) return { builders: builder.paused ? "esperando cupo" : `${describeCell(builder.deferred)} cuando haya cupo`, reviewers: "por decidir" };
    const review = reviewCell({ authors: [{ runtime: builder.runtime, model: builder.model, effort: builder.effort }], kind: size === "touch" ? "touch" : "frd", zone, availability, shape });
    let reviewers = "por decidir";
    if (review.parked) reviewers = "sin revisor disponible: la pieza se aparca";
    else if (review.used) reviewers = `${describeCell(review.used)}${review.degraded ? ` (degradada: ${review.degraded})` : ""}`;
    return { builders: describeCell(builder), reviewers };
  } catch {
    return { builders: "por decidir", reviewers: "por decidir" };
  }
}

// ---------------------------------------------------------------------------------------------------- main entry

/**
 * `start --preflight`: run every first-minute check and write `build/preflight.json`.
 * @param {{project: string, row: number, scope?: {card?: string|null, frds?: string[], wos?: string[]}, scopeFile?: string,
 *   label?: "claude"|"codex", sessionModel?: string|null, probeCodex?: boolean, coordinator?: "claude"|"codex",
 *   versionScale?: boolean, write?: boolean}} input `scope` is the `scope` object of `start --detect`
 *   (`--scope-json <file>` = `scopeFile`, D33); `probeCodex` is the `--probe-codex` flag (the probe runs only when needed);
 *   `coordinator: "codex"` means the Codex app (Claude unreachable); `write: false` skips the file (tests)
 * @param {object} [deps] `fs`, `env`, `homedir`, `now`, `exec`, `monotonic`, `platform`, `detect`, `installPrePush`,
 *   `probeCodex`, `computeRisk`, `readSignals`, `tcpProbe`, `statfs`
 * @returns {Promise<object>} `{ok, cmd:"start", mode:"preflight", elapsed_ms, row, label, checks[], need_from_owner[], questions[],
 *   announce, drive_armable, drive_block_reason, drive_block_code, prepush, failclosed, unevaluated[], created_at, scope,
 *   scope_key, session_model}`
 * @throws INVALID_INPUT (bad row or scope, card not found), NOT_A_PROJECT (no `.pandacorp/status.yaml`)
 */
export async function runPreflight(input, deps = {}) {
  const monotonic = deps.monotonic ?? (() => performance.now());
  const started = monotonic();
  const ctx = resolveDeps(deps);
  const project = path.resolve(input?.project ?? "");
  if (!input?.project) throw fail("INVALID_INPUT", "preflight needs a project");
  if (!ROWS.includes(input.row)) throw fail("INVALID_INPUT", `row must be 1..7, got ${String(input.row)}`);
  const row = input.row;
  const label = input.label === "codex" ? "codex" : "claude";

  let rawScope = input.scope;
  if (!rawScope && input.scopeFile) rawScope = await readJson(path.resolve(project, input.scopeFile), { fs: ctx.fs, required: true });
  if (!rawScope || typeof rawScope !== "object") throw fail("INVALID_INPUT", "preflight needs a scope ({card, frds, wos}) or a scope file");
  const scope = { card: rawScope.card ?? null, frds: asArray(rawScope.frds).map(String), wos: asArray(rawScope.wos).map(String) };

  const p = buildPaths(project, { env: ctx.env, homedir: ctx.homedir });
  const detect = deps.detect ?? realDetect;
  const signals = (await detect({ project, args: "", resume: row === 2, sessionRuntime: label }, deps)).signals;
  const launched = signals.launched === true;
  const card = scope.card ? await readCard(project, scope.card, { where: "any" }, ctx) : null;
  if (scope.card && !card) throw fail("INVALID_INPUT", `card not found: ${scope.card}`);
  const { wos: allWos, frds: frdDirs } = await readWorkOrders(project, ctx);
  const size = sizeOf({ signals, scope, card, frdDirs });
  const coordinator = input.coordinator ?? (label === "codex" ? "codex" : "claude");
  const unevaluated = [];
  const exec = deps.exec ?? execIn(ctx.env);
  const run = makeRunner(exec);

  const phase = await phaseChecks({ project, launched, deps, unevaluated });
  const [codexLogin, quota, testDb, envPending, disk, ram, power, risk] = await Promise.all([
    guarded("access", "access.codex_login", unevaluated, () => codexLoginCheck({ project, ctx, run, label }), CODEX_LOGIN_TIMEOUT_MS + 5_000),
    guarded("access", "access.quota", unevaluated, () => quotaChecks({ project, ctx, deps, exec, input, coordinator: coordinator === "codex" ? "codex-session" : "claude-session" }), CODEX_PROBE_TIMEOUT_MS + 10_000),
    guarded("access", "access.test_db", unevaluated, () => testDbCheck({ project, ctx, deps })),
    guarded("access", "access.env_pending", unevaluated, () => envPendingCheck({ project, ctx, scope })),
    guarded("access", "access.disk", unevaluated, () => diskCheck({ project, ctx, deps })),
    guarded("access", "access.ram", unevaluated, () => ramCheck({ ctx, deps, run })),
    guarded("mac", "mac.power", unevaluated, () => powerCheck({ project, deps, run })),
    guarded("gates", "risk.zone", unevaluated, async () => {
      const files = (await scopeArtifacts({ project, ctx, scope, allWos }));
      const known = files.length > 0 ? files : cardPathFiles(card);
      if (known.length === 0) return { zone: "none" };
      const result = await (deps.computeRisk ?? realComputeRisk)({ root: project, files: known }, { exec });
      return { zone: result.zone };
    }),
  ]);

  const quotaChecksList = quota.checks ?? [mk("access", "access.quota_claude", "fail", "No pude leer el cupo."), mk("access", "access.quota_codex", "fail", "No pude leer el cupo.")];
  const zone = risk.zone ?? "r1";
  const gates = foreseenGates({ card, launched });
  const deferredLedger = await readDeferred(project, { ...deps, fs: ctx.fs });
  const deferredPending = asArray(deferredLedger).filter((e) => e.status === "pending").length;

  const loginOk = codexLogin.ok === true;
  const prepushOk = phase.prepush.verified === true || phase.prepush.will_install === true;
  const driveArmable = loginOk && prepushOk;
  const blockCodes = [];
  if (!loginOk) blockCodes.push("codex_login");
  if (!prepushOk) blockCodes.push("prepush_hook");
  const driveBlockReason = blockCodes.length === 0 ? null : blockCodes.map((c) => (c === "codex_login" ? "el login de Codex no está activo" : "proyecto lanzado sin el candado de push verificado")).join(" y ");

  const checks = [
    ...scopeChecks({ card, scope, size, signals, versionScale: input.versionScale }),
    ...await conflictChecks({ project, ctx, row, scope, card, signals }),
    ...phase.checks,
    codexLogin.check,
    ...quotaChecksList,
    testDb.check, envPending.check, disk.check, ram.check,
    power.check,
    mk("mac", "mac.keep_awake", "warn", "Déjalo enchufado y con la tapa abierta."),
    driveArmable
      ? mk("mac", "mac.drive_armed", "pass", "El relevo a Codex se puede armar.")
      : mk("mac", "mac.drive_armed", "warn", `El relevo a Codex no se puede armar: ${driveBlockReason}.`),
    mk("gates", "gates.foreseen", gates.lines.length > 0 ? "warn" : "pass", gates.lines.length > 0 ? `Hay compuertas previsibles: ${gates.kinds.map((k) => GATE_LABELS_ES[k] ?? k).join(", ")}.` : "Ninguna compuerta previsible.", undefined),
    mk("deferred", "deferred.pending", "pass", `${deferredPending} revisión(es) diferida(s) pendiente(s).`),
  ].map((c) => (c.id === "gates.foreseen" ? { ...c, kinds: gates.kinds } : c));

  const questions = checks.filter((c) => c.status === "ask" && c.question).map((c) => c.question);
  const availability = availabilityOf(quota.policy, loginOk);
  const routing = plainRouting({ label, size, zone, availability, coordinator });
  const announce = buildAnnounce({
    scope, card, size, zone, builders: routing.builders, reviewers: routing.reviewers, gates: gates.lines, launched,
    driveArmable, driveBlockReason, quota: quota.quota, quotaStop: quota.thresholds?.quota_stop, deferredPending,
  });

  const result = {
    ok: true, cmd: "start", mode: "preflight",
    elapsed_ms: Math.round(monotonic() - started),
    row, label, checks,
    need_from_owner: questions.map((q) => q.id),
    questions,
    announce,
    drive_armable: driveArmable,
    drive_block_reason: driveBlockReason,
    drive_block_code: blockCodes.length > 0 ? blockCodes.join("+") : null,
    prepush: phase.prepush,
    failclosed: unevaluated.length > 0,
    unevaluated,
    created_at: new Date(ctx.now()).toISOString(),
    scope,
    scope_key: scopeKey(row, scope),
    session_model: input.sessionModel ?? null,
  };
  if (input.write !== false) await atomicWriteJson(p.preflightFile, result, { fs: ctx.fs });
  return result;
}
