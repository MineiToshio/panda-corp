// Telemetry of the v2 build engine to Mission Control (PLAN 3.14, CLI doc section 10): ndjson events
// through event-transport.mjs and `track.jsonl` lines on the integration branch. Both are bulkheaded:
// a telemetry failure is returned as a value, never thrown, and never fails a build command.
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { nowIso } from "./fsx.mjs";
import { buildPaths, hostPaths } from "./paths.mjs";

const err = (code, message) => Object.assign(new Error(message), { code });

/** Coordinator companies that own an events file. */
const RUNTIMES = new Set(["claude", "codex"]);

/** Track line kinds and the extra fields each requires (shapes read by Mission Control's build-track.ts). */
const TRACK_KINDS = Object.freeze({
  wo_start: ["wo"],
  wo_end: ["wo", "state"],
  review_start: [],
  review_end: ["verdict"],
  frd_end: [],
});
const WO_END_STATES = new Set(["in_review", "verified", "failed"]);
const REVIEW_VERDICTS = new Set(["pass", "reject"]);

/** Work-order `implementation_status` -> the track line it produces (BLOCKED reads as a failed end). */
const TRANSITION_TRACK = Object.freeze({
  IN_PROGRESS: { kind: "wo_start" },
  IN_REVIEW: { kind: "wo_end", state: "in_review" },
  VERIFIED: { kind: "wo_end", state: "verified" },
  BLOCKED: { kind: "wo_end", state: "failed" },
});

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";

/**
 * Build and validate one `track.jsonl` line (pure apart from the clock).
 * @param {{kind: string, frd: string, wo?: string, state?: string, verdict?: string}} input
 * @param {{env?: object, clock?: () => Date}} [deps] clock hooks (`PANDACORP_NOW`)
 * @returns {object} `{kind, frd, [wo], at, [state], [verdict]}`
 * @throws INVALID_INPUT on an unknown kind or a missing/invalid field
 */
export function trackLine(input, deps = {}) {
  const { kind, frd } = input ?? {};
  if (!Object.hasOwn(TRACK_KINDS, kind)) throw err("INVALID_INPUT", `unknown track kind: ${JSON.stringify(kind)}`);
  if (!nonEmpty(frd)) throw err("INVALID_INPUT", `track line ${kind} needs a non-empty frd`);
  for (const field of TRACK_KINDS[kind]) {
    if (!nonEmpty(input[field])) throw err("INVALID_INPUT", `track line ${kind} needs ${field}`);
  }
  if (kind === "wo_end" && !WO_END_STATES.has(input.state)) {
    throw err("INVALID_INPUT", `wo_end state must be in_review|verified|failed, got ${JSON.stringify(input.state)}`);
  }
  if (kind === "review_end" && !REVIEW_VERDICTS.has(input.verdict)) {
    throw err("INVALID_INPUT", `review_end verdict must be pass|reject, got ${JSON.stringify(input.verdict)}`);
  }
  const line = { kind, frd: frd.trim() };
  if (kind === "wo_start" || kind === "wo_end") line.wo = input.wo;
  line.at = nowIso(deps);
  if (kind === "wo_end") line.state = input.state;
  if (kind === "review_end") line.verdict = input.verdict;
  return line;
}

/** Validate an already-built track line (kind, frd, per-kind fields, parseable `at`). @throws INVALID_INPUT */
function assertTrackLine(line) {
  if (typeof line !== "object" || line === null) throw err("INVALID_INPUT", "track line must be an object");
  if (!nonEmpty(line.at) || !Number.isFinite(Date.parse(line.at))) throw err("INVALID_INPUT", "track line needs an ISO at");
  const { at, ...rest } = line;
  trackLine(rest, { env: { PANDACORP_NOW: at } });
}

/**
 * The track line for a work-order transition, or null when the status has no track meaning
 * (PLANNED, VERIFIED-less states).
 * @param {{frd: string, wo: string, to: string}} input `to` = new `implementation_status`
 * @param {object} [deps] clock hooks
 * @returns {object|null}
 */
export function trackLineForTransition({ frd, wo, to }, deps = {}) {
  const map = TRANSITION_TRACK[to];
  return map ? trackLine({ ...map, frd, wo }, deps) : null;
}

/**
 * Append one line to `<integration worktree>/.pandacorp/track.jsonl`. The track is written only on the
 * integration branch (never the main checkout); the caller commits it with its integration commit.
 * Never throws.
 * @param {string} project main checkout root
 * @param {object} line a line from `trackLine`
 * @param {{appendFile?: Function, mkdir?: Function, env?: object, homedir?: string}} [deps]
 * @returns {Promise<{ok: true, file: string} | {ok: false, error: string}>}
 */
export async function appendTrack(project, line, deps = {}) {
  try {
    assertTrackLine(line);
    const file = path.join(buildPaths(project, deps).integrationWorktree, ".pandacorp", "track.jsonl");
    await (deps.mkdir ?? mkdir)(path.dirname(file), { recursive: true });
    await (deps.appendFile ?? appendFile)(file, `${JSON.stringify(line)}\n`);
    return { ok: true, file };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/**
 * Emit one vocabulary event to the coordinator company's events file. The name must be registered in
 * `event-vocabulary.json` (an unregistered name would display as `legacy.*`): it is refused, not sent.
 * `project` is always `basename(project)`. Never throws.
 * @param {string} project main checkout root
 * @param {{runtime: "claude"|"codex", runId: string, name: string, data?: object}} event
 * @param {{env?: object, homedir?: string, idFactory?: Function, now?: () => string, createEmitter?: Function, normalize?: Function}} [deps]
 * @returns {Promise<{ok: true, payload: object} | {ok: false, error: string}>}
 */
export async function emitEvent(project, event, deps = {}) {
  try {
    const { runtime, runId, name, data = {} } = event ?? {};
    if (!nonEmpty(name)) throw err("INVALID_INPUT", "event needs a name");
    if (!RUNTIMES.has(runtime)) throw err("INVALID_INPUT", `unsupported event runtime: ${runtime}`);
    const transport = await import("../event-transport.mjs");
    const normalize = deps.normalize ?? transport.normalizeRuntimeEvent;
    const { semanticName } = normalize(name, data);
    if (semanticName.startsWith("legacy.")) throw err("INVALID_INPUT", `event ${name} is not in event-vocabulary.json`);
    const emit = (deps.createEmitter ?? transport.createRuntimeEventEmitter)({
      runtime,
      runId,
      project,
      transportFile: hostPaths(deps).eventsFile(runtime),
      ...(deps.idFactory ? { idFactory: deps.idFactory } : {}),
      ...(deps.now ? { now: deps.now } : {}),
    });
    return { ok: true, payload: await emit(name, data) };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/** Convenience builders: the `data` shapes Mission Control's events reader parses (role, wo, frd, result, verdict, reason). */
export const eventData = Object.freeze({
  /** `AgentDone.result` is `green|red`. */
  agentDone: ({ role, model, unit, result, wo, frd }) => {
    if (result !== "green" && result !== "red") throw err("INVALID_INPUT", `AgentDone result must be green|red, got ${JSON.stringify(result)}`);
    return { role, model, unit, result, ...(wo ? { wo } : {}), ...(frd ? { frd } : {}) };
  },
  /** `GateVerdict.verdict` is `PASS|FAIL`. */
  gateVerdict: ({ frd, verdict }) => {
    const v = String(verdict).toUpperCase();
    if (v !== "PASS" && v !== "FAIL") throw err("INVALID_INPUT", `GateVerdict verdict must be PASS|FAIL, got ${JSON.stringify(verdict)}`);
    return { frd, verdict: v };
  },
});
