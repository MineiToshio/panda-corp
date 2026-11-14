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
// This file is the public entry and the orchestration of `runPreflight`; the checks live under `./preflight/` (common,
// scope, phase, access, machine, gates, freshness). Nothing below `./preflight/` imports this file.
import path from "node:path";
import { readCard, resolveDeps } from "./card.mjs";
import { readDeferred } from "./deferred.mjs";
import { detect as realDetect, readWorkOrders } from "./detect.mjs";
import { atomicWriteJson, readJson } from "./fsx.mjs";
import { buildPaths } from "./paths.mjs";
import { computeRisk as realComputeRisk } from "./risk.mjs";
import { buildAnnounce, GATE_LABELS_ES } from "./summary.mjs";
import { codexLoginCheck, envPendingCheck, quotaChecks, testDbCheck } from "./preflight/access.mjs";
import {
  asArray, CODEX_LOGIN_TIMEOUT_MS, CODEX_PROBE_TIMEOUT_MS, execIn, fail, guarded, makeRunner, mk,
} from "./preflight/common.mjs";
import { scopeKey } from "./preflight/freshness.mjs";
import {
  availabilityOf, cardPathFiles, foreseenGates, plainRouting, scopeArtifacts,
} from "./preflight/gates.mjs";
import { diskCheck, powerCheck, ramCheck } from "./preflight/machine.mjs";
import { phaseChecks } from "./preflight/phase.mjs";
import { conflictChecks, scopeChecks, sizeOf } from "./preflight/scope.mjs";

export { loadFreshPreflight, PREFLIGHT_MAX_AGE_MS, scopeKey } from "./preflight/freshness.mjs";

const ROWS = [1, 2, 3, 4, 5, 6, 7];

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
  const signals = (await detect({ project, args: "", resume: row === 2, sessionRuntime: input.coordinator ?? label }, deps)).signals;
  const launched = signals.launched === true;
  const card = scope.card ? await readCard(project, scope.card, { where: "any" }, ctx) : null;
  if (scope.card && !card) throw fail("INVALID_INPUT", `card not found: ${scope.card}`);
  const { wos: allWos, frds: frdDirs } = await readWorkOrders(project, ctx);
  const size = sizeOf({ signals, scope, card, frdDirs });
  // BL-0319: the coordinator is the SESSION runtime, never inferred from the builder label: a Claude session building with
  // Codex workers (label codex) is R-C, not the Codex app; inferring it made Claude look unreachable and announced a
  // degraded Codex Astra reviewer the run never uses.
  const coordinator = input.coordinator ?? "claude";
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
