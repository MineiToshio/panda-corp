// Engine faults preserve an owned live run through retry/rescue. Unleased startup failures
// retain their diagnostic fallback. ../failure.mjs is the public entry.
import { recordTechnicalFailure } from "../rescue.mjs";
import { withUnleasedProject } from "../../build-state.mjs";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { atomicWriteText, nowIso } from "../fsx.mjs";
import { withRunCleanup } from "../lifecycle/cleanup.mjs";
import { cleanupRunWorktrees } from "../integrate/worktrees.mjs";
import { finishPerformance } from "../perf.mjs";
import { buildPaths } from "../paths.mjs";
import { fencedTwoPhase, newUnit, readLeaseToken, readState, rebuildState } from "../state.mjs";
import { DONE_STATES, POLICY, WO_UNIT_KINDS, emitSafely, err, integrationBranchOf, oneLine, woKey } from "./common.mjs";
import { fileBacklogNote, sanitize } from "./engineBacklog.mjs";

/** Error codes that are control flow or bad input, never a fault of the engine itself. */
const EXPECTED_CODES = new Set(["FENCE", "QUIESCED", "USAGE", "CONTENDED", "INVALID_INPUT", "GATE_RED", "WAITING_GATE", "FAILCLOSED", "NOT_A_PROJECT", "INVALID_STATE", "INVALID_PATH", "EVIDENCE", "ENGINE_FAILURE"]);

/**
 * Is this error a fault of the CLI (retry once after rebuild-state, then stop) rather than expected control flow?
 * An error flagged `engine:true`, a `rebuild-state` hint (corrupt chain or state), a plain/unknown error (TypeError,
 * EIO, ENOSPC...) and an unsupported schema are engine faults; a fence, bad input or a refused state are not.
 */
export function isEngineFault(error) {
  if (!error || (error.code === "ENGINE_FAILURE" && error.result)) return false;
  if (error.code === "ENGINE_FAILURE") return true;
  if (error.engine === true || error.hint === "rebuild-state") return true;
  return !EXPECTED_CODES.has(error.code);
}

/**
 * Build an engine-fault error from inside a module (e.g. a second consecutive merge-queue exit 20): flagged so
 * `withEngineRecovery` treats it as an engine failure; `noRetry` skips the retry when the repeat IS the confirmation.
 */
export const engineFault = (message, { step = null, noRetry = false } = {}) => err("ENGINE_FAULT", message, { engine: true, step, noRetry });

const countEngineFailures = async (file, fs) => {
  try { return ((await fs.readFile(file, "utf8")).match(/"type":"engine_failure"/g) ?? []).length; } catch { return 0; }
};

const doneWorkOrders = (state) => new Set(state?.units?.filter((u) => WO_UNIT_KINDS.includes(u.kind) && DONE_STATES.includes(u.state)).flatMap((u) => u.wos.map(woKey)) ?? []).size;

function engineNotice({ runId, bl, doneWos, failures }) {
  const work = doneWos === null ? "tu trabajo" : `tu trabajo (${doneWos} WOs hechas)`;
  const how = bl.id ? `en la fábrica di 'arregla ${bl.id}'` : `avisa en la fábrica de este fallo (${bl.reason})`;
  const lines = [`El motor nuevo se ha parado por un fallo suyo, no de tu app. ${work[0].toUpperCase()}${work.slice(1)} está a salvo en la rama \`${integrationBranchOf(runId)}\`. Para seguir: ${how}; luego aquí, \`/pandacorp:implement --resume\`.`];
  if (failures >= POLICY.ENGINE_FAILURES_EXTRA_LINE) lines.push("Si lo consideras un desastre, dilo y se aplica el regreso.");
  return lines.join(" ");
}

function engineMarkdown({ now, cmd, step, failure, runId, epoch, state, bl, notice, warnings, retried }) {
  return [
    "# Fallo del motor",
    "",
    `cuándo: ${now}`,
    `comando: ${cmd ?? "desconocido"}   paso: ${step ?? "desconocido"}`,
    `run: ${runId ?? "desconocido"}   epoch: ${epoch ?? "sin lease"}`,
    `error: ${failure.code ?? "sin código"}: ${oneLine(failure.message, 500)}`,
    `reintento tras rebuild-state: ${retried ? "sí, y volvió a fallar" : "no, el fallo se confirmó solo"}`,
    `último punto seguro: ${state?.last_safe_point ? `${state.last_safe_point.kind} @ ${String(state.last_safe_point.sha).slice(0, 12)}` : "ninguno registrado"}`,
    `${bl.draft ? "borrador local pendiente de revisión" : "backlog de la fábrica"}: ${bl.id ?? `no abierto (${bl.reason})`}${bl.file ? ` (${bl.file})` : ""}`,
    "",
    notice,
    "",
    "El fallo no ha consumido ningún intento de ninguna unidad.",
    warnings.length ? `\nPasos del cierre que no se completaron:\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
    "",
  ].join("\n");
}

/**
 * Stop the run after a confirmed engine failure. Best effort on every step (none may hide the others): backlog item,
 * `handback/engine.md`, state `stopped` + journal `engine_failure`, lease quiesce + release (`projectStatus:false`),
 * telemetry. Never throws; failed steps are listed in `warnings` and inside `engine.md`.
 * @param {{project: string, epoch?: number|null, cmd?: string, step?: string, error: Error, retried?: boolean}} input `epoch` absent: unfenced command, nothing to stop
 * @param {object} [deps] fs, exec, env, clock, buildState, factoryRoot, emit
 * @returns {Promise<{message: string, path: string, bl: {id: string|null, file: string|null, reason: string|null}, run_id: string|null, warnings: string[], released: boolean, failures: number}>}
 */
export async function handleEngineFailure({ project, epoch = null, cmd = null, step = null, error, retried = false }, deps = {}) {
  if (epoch !== null && epoch !== undefined) {
    let live = await readState(project, deps).catch(() => null);
    if (!live) {
      const bs = deps.buildState ?? await import("../../build-state.mjs");
      const lease = await bs.currentLease(project);
      if (lease && lease.epoch === Number(epoch) && !lease.quiesced_at) {
        const token = await readLeaseToken(project, epoch, deps);
        await bs.renew(project, token, Number(epoch), { projectStatus: false });
        // state.json is a replayable cache, not authority to quiesce a healthy lease.
        try { await defaultRebuild({ project, epoch }, deps); live = await readState(project, deps); }
        catch (replayError) {
          if (["FENCE", "QUIESCED", "CONTENDED"].includes(replayError.code)) throw replayError;
          return { action: "retry", released: false, run_id: lease.run_id, message: `Recuperación del estado en curso: ${oneLine(replayError.message, 200)}.`, warnings: [] };
        }
      }
    }
    if (live && ["active", "waiting", "resuming"].includes(live.status)) {
      let target = live.units.find(u => u.id === error?.unit && u.state !== "suspended") ?? live.units.find(u => u.state === "rescue") ?? live.units.find(u => !["landed", "abandoned", "verified", "waiting_gate", "suspended"].includes(u.state));
      if (!target) {
        target = newUnit({ id: "u-rescue-run", kind: "docs" });
        await fencedTwoPhase({ project, epoch, deps }, async ctx => {
          const s = await ctx.readState();
          if (s.units.some(u => u.id === target.id)) return;
          await ctx.appendEvent({ type: "unit_queued", data: target });
          await ctx.writeState({ ...s, units: [...s.units, target] });
        }, value => value);
      }
      if (target) {
        const recovery = await fencedTwoPhase({ project, epoch, deps }, ctx => recordTechnicalFailure(ctx, target.id, { code: error?.code ?? error?.name ?? "Error", detail: error?.message, files: error?.file ? [error.file] : undefined }, deps), value => value);
        return { action: recovery.action, released: false, run_id: live.run_id, message: `Recuperación técnica: ${target.id} (${recovery.action}).`, warnings: [] };
      }
    }
  }
  const fs = deps.fs ?? fsp;
  const paths = buildPaths(project, deps);
  const bs = deps.buildState ?? await import("../../build-state.mjs");
  const now = nowIso(deps);
  const warnings = [];
  const note = (what, e) => warnings.push(`${what}: ${oneLine(e?.message ?? e, 200)}`);

  let lease = null;
  try { lease = await bs.currentLease(project); } catch (e) { note("lease", e); }
  let state = null;
  try { state = await readState(project, deps); } catch (e) { note("state.json", e); }
  const runId = lease?.run_id ?? state?.run_id ?? deps.runId ?? null;
  const failures = (await countEngineFailures(paths.journalFile, fs)) + 1;
  const failure = { cmd, step, code: error?.code ?? null, message: error?.message ?? String(error), stack: error?.stack ?? "", runId, epoch, retried };

  const bl = await fileBacklogNote({ project, failure, deps });
  const notice = engineNotice({ runId, bl, doneWos: state ? doneWorkOrders(state) : null, failures });

  let released = false;
  if (epoch !== null && epoch !== undefined) {
    try {
      await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_result, _intent, ctx) => {
        if (state) { try { await ctx.writeState({ ...state, status: "stopped", status_reason: "engine_failure" }); } catch (e) { note("state.json", e); } }
        try { await ctx.appendEvent({ type: "engine_failure", data: { reason: "engine_failure", cmd, step, code: failure.code, message: oneLine(sanitize(failure.message, project, deps), 400), retried, bl: bl.id, ...(bl.draft ? { backlog_draft: bl.file } : {}) } }); } catch (e) { note("journal", e); }
      });
    } catch (e) { note("fence (state and journal)", e); }
    try {
      const token = await readLeaseToken(project, epoch, deps);
      if (!lease?.quiesced_at) await bs.quiesce(project, token, epoch, { projectStatus: false });
      await bs.finalizeRelease(project, token, epoch);
      released = true;
    } catch (e) { note("lease release", e); }
  }

  const file = paths.engineHandbackFile;
  const complete = async (current) => {
    if (state && released) {
      try {
        const perf = await (deps.finishPerformance ?? finishPerformance)({ project, state: { ...state, status: "stopped", status_reason: "engine_failure" }, outcome: "engine_failure" }, deps);
        if (perf?.ok === false) note("performance journal", perf.error);
      } catch (e) { note("performance journal", e); }
    }

    if (state && released) {
      try { await cleanupRunWorktrees({ project, state: current }, deps); }
      catch (e) { note("worktree cleanup", e); }
    }
    const emitted = await emitSafely(deps, "engine.failure", { cmd, step, code: failure.code, bl: bl.id, run_id: runId });
    if (emitted) warnings.push(emitted);
    try {
      await atomicWriteText(file, engineMarkdown({ now, cmd, step, failure, runId, epoch, state, bl, notice, warnings, retried }), { fs });
    } catch (e) { note("handback/engine.md", e); }
  };
  try {
    if (state) await withRunCleanup({ project, state }, complete, deps);
    else if (!lease) await withUnleasedProject(project, async () => {
      if (await readState(project, deps)) throw err("CONTENDED", "El run cambió antes del cierre del fallo.");
      await complete(null);
    });
  } catch (e) { note("terminal cleanup", e); }
  return { message: notice, path: file, bl, run_id: runId, warnings, released, failures };
}

/** The error a command raises after an engine failure: code ENGINE_FAILURE (exit 8), Spanish message, `result` attached. */
export const engineFailureError = (result) => err("ENGINE_FAILURE", result.message, { result });

async function defaultRebuild({ project, epoch }, deps) {
  if (epoch === null || epoch === undefined) return;
  const rebuilt = await rebuildState({ project, deps });
  await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, (_result, _intent, ctx) => ctx.writeState(rebuilt.state));
}

/**
 * Run one command step under the engine-failure policy: a fault of the engine retries the step ONCE after `rebuild-state`;
 * if it repeats (or the rebuild itself fails) the run stops at the last safe point (`handleEngineFailure`) and ENGINE_FAILURE
 * (exit 8) is thrown. Expected errors (fence, bad input, refused state) pass through untouched and are never retried.
 * @param {{project: string, epoch?: number|null, cmd?: string, step: () => Promise<any>}} input `step` must be safe to run twice
 * @param {object} [deps] `rebuild({project, epoch})` replaces the default fenced rebuild; plus handleEngineFailure's deps
 * @returns {Promise<any>} the step's value
 * @throws ENGINE_FAILURE (exit 8) with `.result`; or the step's own expected error
 */
export async function withEngineRecovery({ project, epoch = null, cmd = null, step }, deps = {}) {
  const technical = error => isEngineFault(error) || cmd === "next" && ["INVALID_STATE", "EVIDENCE"].includes(error?.code);
  const recovered = async error => handleEngineFailure({ project, epoch, cmd, step: error.step ?? cmd, error }, deps);
  const response = result => {
    const out = { ok: true, cmd, action: result.action === "rescue" ? "rescue" : "wait", outcome: result.action, epoch, units: [], wait: { reason: "gate", retry_after_s: 1 }, notes_es: [result.message] };
    return cmd === "next" ? { body: out } : out;
  };
  let first;
  try { return await step(); } catch (error) { if (!technical(error)) throw error; first = error; }
  const one = await recovered(first);
  if (one.action === "rescue" || one.action === "abandoned") return response(one);
  try {
    await (deps.rebuild ?? defaultRebuild)({ project, epoch }, deps);
    return await step();
  } catch (second) {
    if (!technical(second)) throw second;
    const two = await recovered(second);
    if (two.action) return response(two);
    throw engineFailureError(two);
  }
}
