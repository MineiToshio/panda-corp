// preflight/access.mjs: Codex login, quota, local test database and pending environment checks (group `access`).
import path from "node:path";
import { buildPaths } from "../paths.mjs";
import {
  effective, loadThresholds, probeCodex as realProbeCodex, readQuota, recordCodex, resetsAtOf,
} from "../quota.mjs";
import {
  affectsFrds, ask, CODEX_LOGIN_TIMEOUT_MS, CODEX_PROBE_TIMEOUT_MS, connectsTo, mk, parseDotenv, readText, unique,
} from "./common.mjs";

const TCP_TIMEOUT_MS = 1_500;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export async function codexLoginCheck({ project, ctx, run, label }) {
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

export async function quotaChecks({ project, ctx, deps, exec, input, coordinator }) {
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

export async function testDbCheck({ project, ctx, deps }) {
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

export async function envPendingCheck({ project, ctx, scope }) {
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
