#!/usr/bin/env node
// pandacorp-build: the v2 build engine's only executor (docs: plugin/docs/build-engine-cli.md).
// This file is the dispatcher: argument parsing, project resolution, error-code to exit-code map (D26), one JSON line on stdout.
// Every effect lives in plugin/runtime/build/*.mjs; nothing here decides policy.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { answerCommand } from "../runtime/build/answers.mjs";
import { admit, countHostSlots, readHistory } from "../runtime/build/admission.mjs";
import { cardCheckCommand } from "../runtime/build/card.mjs";
import { detect } from "../runtime/build/detect.mjs";
import { doubtCommand } from "../runtime/build/doubts.mjs";
import { driveDeps, isStandbyAlive, runDrive } from "../runtime/build/drive.mjs";
import { handbackCommand, handleEngineFailure, withEngineRecovery } from "../runtime/build/failure.mjs";
import { defaultExec } from "../runtime/build/fsx.mjs";
import { land } from "../runtime/build/land.mjs";
import {
  finishRun, planCommand, rebuildStateCommand, requestHandoff, startResume, startRun, statusSnapshot, stopRun,
} from "../runtime/build/lifecycle.mjs";
import { next } from "../runtime/build/next.mjs";
import { buildPaths } from "../runtime/build/paths.mjs";
import { runPreflight } from "../runtime/build/preflight.mjs";
import { policy, readQuota, recordClaude } from "../runtime/build/quota.mjs";
import { ingestReport } from "../runtime/build/report.mjs";
import { reviewRecord } from "../runtime/build/review.mjs";
import { computeRisk } from "../runtime/build/risk.mjs";
import { fencedTwoPhase, readState } from "../runtime/build/state.mjs";
import { readSummary } from "../runtime/build/summary.mjs";
import { emitEvent } from "../runtime/build/telemetry.mjs";
import * as workersModule from "../runtime/build/workers.mjs";

const EXIT_BY_CODE = Object.freeze({
  USAGE: 2, FENCE: 3, QUIESCED: 3, CONTENDED: 4, INVALID_STATE: 5, LEDGER_CORRUPT: 5, JOURNAL_CHAIN: 5,
  INVALID_INPUT: 6, EVIDENCE: 6, INVALID_PATH: 6, GATE_RED: 6, WAITING_GATE: 7, ROLLBACK_FAILED: 8, ENGINE_FAILURE: 8, FAILCLOSED: 9, NOT_A_PROJECT: 10,
});
const EPOCH = ["epoch"];
const FENCED_FILE = [...EPOCH, "unit", "token", "file"];

/** Command table: flag sets and the documented one-line usage (the `--help` text is generated from it). */
const COMMANDS = Object.freeze({
  card: { subs: ["check"], bool: [], value: [], usage: "card check <path>" },
  plan: { bool: ["explain"], value: ["scope-json"], usage: "plan [--explain]" },
  "lint-plan": { bool: ["strict"], value: ["scope-json"], usage: "lint-plan [--strict]" },
  risk: { bool: [], value: ["files", "range"], usage: "risk --files a,b | --range base..head" },
  next: { bool: [], value: ["epoch", "wait"], usage: "next --epoch N [--wait S]" },
  report: { bool: [], value: FENCED_FILE, usage: "report --epoch N --unit U --token T --file F" },
  "review-record": { bool: [], value: FENCED_FILE, usage: "review-record --epoch N --unit U --token T --file F" },
  land: { bool: [], value: EPOCH, usage: "land --epoch N" },
  doubt: { subs: ["open", "answer"], bool: [], value: ["epoch", "unit", "id", "file", "token"], usage: "doubt open|answer --epoch N ..." },
  answer: { bool: [], value: ["epoch", "question", "value"], usage: "answer --epoch N --question Q --value JSON" },
  handback: { bool: [], value: ["epoch", "unit", "reason"], usage: "handback --epoch N --unit U --reason TEXT" },
  quota: {
    subs: ["record", "read"], bool: ["probe"],
    value: ["provider", "five-hour", "weekly", "five-hour-resets-at", "weekly-resets-at", "status", "epoch"], usage: "quota record|read",
  },
  admit: { bool: ["dry-run"], value: ["class"], usage: "admit [--class B|H]" },
  handoff: { bool: [], value: ["epoch", "reason"], usage: "handoff --epoch N --reason quota95|limit|manual|test" },
  drive: { bool: ["standby"], value: ["run", "handoff-after", "transcript"], usage: "drive --standby --run R | --run R [--handoff-after N]" },
  finish: { bool: [], value: EPOCH, usage: "finish --epoch N" },
  stop: { bool: ["dead", "owner-confirmed"], value: EPOCH, usage: "stop [--epoch N] | --dead --owner-confirmed" },
  status: { bool: [], value: [], usage: "status" },
  summary: { bool: [], value: [], usage: "summary" },
  "rebuild-state": { bool: [], value: EPOCH, usage: "rebuild-state --epoch N" },
});
const START_MODES = Object.freeze({
  detect: { bool: [], value: ["args", "session-card", "session-id", "session-runtime"], usage: "start --detect [--args RAW] [--session-card P] [--session-id ID] [--session-runtime R]" },
  preflight: { bool: ["probe-codex"], value: ["row", "scope-json", "label", "session-model"], usage: "start --preflight --row N --scope-json F [--label L] [--session-model M] [--probe-codex]" },
  run: { bool: [], value: ["scope-json", "label", "coordinator", "k", "mode", "session-model", "answers"], usage: "start --run --scope-json F --coordinator C [--label L] [--k N] [--mode M] [--session-model M] [--answers J]" },
  resume: { bool: ["owner-confirmed"], value: ["coordinator", "session-model", "run"], usage: "start --resume --coordinator C [--session-model M] [--run ID] [--owner-confirmed]" },
});

const usage = (message) => Object.assign(new Error(message), { code: "USAGE" });
const bad = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

/** The `--help` payload: exactly the documented surface. */
const helpBody = () => ({
  usage: "node pandacorp-build.mjs <cmd> [sub] [--project <dir>] [flags]",
  commands: [...Object.values(START_MODES), ...Object.values(COMMANDS)].map((c) => c.usage),
});

/**
 * Split argv into the command, its positionals and its flags. `--name value` or `--name=value`; booleans are bare;
 * `--args` always consumes the next token; any other value that starts with `--` must use `--name=value`.
 */
function parseArgv(argv, spec) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) { positionals.push(token); continue; }
    const eq = token.indexOf("=");
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);
    if (spec.bool.includes(name)) {
      if (inline !== undefined) throw usage(`El flag --${name} no lleva valor.`);
      flags[name] = true;
    } else if (spec.value.includes(name)) {
      let value = inline;
      if (value === undefined) {
        const following = argv[i + 1];
        if (following === undefined || (following.startsWith("--") && name !== "args")) throw usage(`Falta el valor de --${name} (si empieza por --, usa --${name}=valor).`);
        value = following; i += 1;
      }
      flags[name] = value;
    } else throw usage(`Flag desconocido: --${name}. Usa --help para ver los comandos.`);
  }
  return { flags, positionals };
}

const int = (flags, name, { required = false, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = flags[name];
  if (raw === undefined) { if (required) throw usage(`Falta --${name}.`); return null; }
  const n = Number(raw);
  if (!/^-?\d+$/.test(String(raw)) || !Number.isInteger(n) || n < min || n > max) throw usage(`--${name} debe ser un entero entre ${min} y ${max}.`);
  return n;
};
const need = (flags, name) => { if (flags[name] === undefined || flags[name] === "") throw usage(`Falta --${name}.`); return flags[name]; };
const abs = (value) => (value === undefined ? undefined : path.resolve(process.cwd(), value));
// `anthropic` is an alias of `claude` so a Codex session never has to write that word on its command line.
const company = (value, name) => {
  if (value === undefined) return undefined;
  const v = value === "anthropic" ? "claude" : value;
  if (v !== "claude" && v !== "codex") throw usage(`--${name} debe ser claude (o anthropic) o codex.`);
  return v;
};

function findProject(flag) {
  const hasStatus = (dir) => fs.existsSync(path.join(dir, ".pandacorp", "status.yaml"));
  if (flag) {
    const dir = path.resolve(process.cwd(), flag);
    if (!hasStatus(dir)) throw bad("NOT_A_PROJECT", `no .pandacorp/status.yaml in ${dir}`);
    return dir;
  }
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    if (hasStatus(dir)) return dir;
    if (path.dirname(dir) === dir) throw bad("NOT_A_PROJECT", "no .pandacorp/status.yaml found above the current directory");
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Handlers: (context) => {body, exit?}. `deps` stays minimal: modules default every collaborator.
// ---------------------------------------------------------------------------------------------------------------

const fenced = (c, step) => withEngineRecovery({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), cmd: c.cmd, step }, c.deps);

const modeOf = (mode) => {
  if (mode === undefined) return null;
  if (!["touch", "feature", "giant"].includes(mode)) throw usage("--mode debe ser touch, feature o giant.");
  return mode;
};

const startHandlers = {
  async detect(c) {
    const r = await detect({
      project: c.project, args: c.flags.args ?? "", sessionCard: abs(c.flags["session-card"]) ?? null, sessionId: c.flags["session-id"] ?? null,
      sessionRuntime: company(c.flags["session-runtime"], "session-runtime") ?? null, resume: c.flags.resume === true,
    }, c.deps);
    const { failclosed, ...body } = r;
    return { body, exit: failclosed ? 9 : 0 };
  },
  async preflight(c) {
    const row = int(c.flags, "row", { required: true, min: 1, max: 7 });
    const r = await runPreflight({
      project: c.project, row, scopeFile: abs(need(c.flags, "scope-json")), label: company(c.flags.label, "label"),
      sessionModel: c.flags["session-model"] ?? null, probeCodex: c.flags["probe-codex"] === true,
    }, c.deps);
    return { body: r, exit: r.failclosed ? 9 : 0 };
  },
  async run(c) {
    const r = await startRun({
      project: c.project, scopeFile: abs(need(c.flags, "scope-json")), label: company(c.flags.label, "label"), coordinator: company(need(c.flags, "coordinator"), "coordinator"),
      k: int(c.flags, "k", { min: 1 }), mode: modeOf(c.flags.mode),
      sessionModel: c.flags["session-model"] ?? null, answers: c.flags.answers ?? null,
    }, c.deps);
    return { body: { mode: "run", ...r } };
  },
  async resume(c) {
    const r = await startResume({
      project: c.project, coordinator: company(need(c.flags, "coordinator"), "coordinator"), sessionModel: c.flags["session-model"] ?? null,
      runId: c.flags.run ?? null, ownerConfirmed: c.flags["owner-confirmed"] === true,
    }, c.deps);
    return { body: { mode: "resume", ...r } };
  },
};

async function recordQuota(c) {
  const { flags, project, deps } = c;
  if ((flags.provider === undefined ? "claude" : company(flags.provider, "provider")) !== "claude") throw usage("quota record solo admite --provider claude.");
  const status = flags.status ?? "ok";
  if (status === "ok" && (flags["five-hour"] === undefined || flags.weekly === undefined)) throw usage("quota record con --status ok necesita --five-hour y --weekly.");
  const input = {
    five_hour_pct: flags["five-hour"], weekly_pct: flags.weekly, five_hour_resets_at: flags["five-hour-resets-at"], weekly_resets_at: flags["weekly-resets-at"], status,
  };
  const file = buildPaths(project, deps).quotaFile;
  if (flags.epoch === undefined) return { body: { sub: "record", reading: recordClaude(input, { file, deps }) } };
  const epoch = int(flags, "epoch", { required: true });
  const reading = await fencedTwoPhase({ project, epoch, deps }, undefined, undefined, async (_r, _i, ctx) => {
    const stored = recordClaude(input, { file, deps });
    await ctx.appendEvent({ type: "quota_reading", data: { provider: "claude", reading: stored } });
    return stored;
  });
  const state = await readState(project, deps);
  if (state) await emitEvent(project, { runtime: state.coordinator === "claude-session" ? "claude" : "codex", runId: state.run_id, name: "quota.reading", data: { provider: "claude", reading } }, deps);
  return { body: { sub: "record", reading } };
}

/** The run state, or null when there is none yet; a corrupt or unreadable state propagates (never read as "no run"). */
async function readStateOrNull(project, deps) {
  try {
    return await readState(project, deps);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function readQuotaView(c) {
  const { project, deps } = c;
  const p = buildPaths(project, deps);
  const state = await readStateOrNull(project, deps);
  const coordinator = state?.coordinator ?? "claude-session";
  const r = await readQuota({ file: p.quotaFile, codexHome: p.codexHome, coordinator, probe: c.flags.probe === true }, { ...deps, exec: defaultExec });
  const driveAlive = await isStandbyAlive(project, { runId: state?.run_id }, deps);
  return { body: { sub: "read", claude: r.claude, codex: r.codex, effective: r.effective, needs_probe: r.needs_probe, policy: policy({ claude: r.effective.claude, codex: r.effective.codex, coordinator, driveAlive, deps }) } };
}

async function admitView(c) {
  const cls = c.flags.class ?? "B";
  if (cls !== "B" && cls !== "H") throw usage("--class debe ser B o H.");
  const { project, deps } = c;
  const p = buildPaths(project, deps);
  const state = await readStateOrNull(project, deps);
  const live = { B: (state?.units ?? []).filter((u) => u.state === "admitted" || u.state === "running").length, H: countHostSlots({ host: p.hostDir }).held };
  const shape = !state ? "R-A" : state.coordinator === "codex-session" ? "R-B" : state.coordinator === "drive" ? "drive" : state.label === "codex" ? "R-C" : "R-A";
  const now = deps.env.PANDACORP_NOW ? Date.parse(deps.env.PANDACORP_NOW) : Date.now();
  const r = await admit({
    class: cls, signalsFile: deps.env.PANDACORP_SIGNALS_FILE || null, history: readHistory({ file: p.admissionFile }), reservations: [], live,
    readyWidth: 8, caps: {}, runtimeShape: shape, nowMs: now,
  });
  return { body: r, exit: r.safe_mode ? 9 : 0 };
}

const HANDLERS = {
  async card(c) {
    const file = c.positionals[2];
    if (!file) throw usage("Falta la ruta de la tarjeta: card check <ruta>.");
    const here = abs(file);
    const r = await cardCheckCommand(c.project, fs.existsSync(here) ? here : path.resolve(c.project, file), {}, c.deps);
    return { body: r, exit: r.ok ? 0 : 6 };
  },
  async plan(c) {
    const r = await planCommand({ project: c.project, scopeFile: abs(c.flags["scope-json"]) ?? null, explain: c.flags.explain === true }, c.deps);
    return { body: r.body };
  },
  async "lint-plan"(c) {
    const r = await planCommand({ project: c.project, scopeFile: abs(c.flags["scope-json"]) ?? null, strict: c.flags.strict === true, lint: true }, c.deps);
    return { body: { ok: r.ok, ...r.body }, exit: r.ok ? 0 : 6 };
  },
  async risk(c) {
    const { files, range } = c.flags;
    if (Boolean(files) === Boolean(range)) throw usage("risk necesita exactamente uno de --files o --range.");
    const r = await computeRisk({ root: c.project, ...(files ? { files: files.split(",").map((f) => f.trim()).filter(Boolean) } : { range }) }, {});
    return { body: r, exit: r.failclosed ? 9 : 0 };
  },
  next: (c) => fenced(c, async () => ({ body: await next({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), wait: int(c.flags, "wait", { max: 300 }) ?? 0, actor: "cli" }, c.deps) })),
  async report(c) {
    const r = await fenced(c, () => ingestReport({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), unit: need(c.flags, "unit"), token: need(c.flags, "token"), file: abs(need(c.flags, "file")), actor: "cli", openDoubt: true }, c.deps));
    return { body: r, exit: r.outcome === "rejected" ? 6 : r.outcome === "waiting_gate" ? 7 : 0 };
  },
  "review-record": (c) => fenced(c, async () => ({ body: await reviewRecord({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), unit: need(c.flags, "unit"), token: need(c.flags, "token"), file: abs(need(c.flags, "file")) }, c.deps) })),
  async land(c) {
    const r = await fenced(c, () => land({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), actor: "cli" }, c.deps));
    return { body: r.output, exit: r.exit };
  },
  async doubt(c) {
    const sub = c.positionals[1];
    if (sub !== "open" && sub !== "answer") throw usage("doubt admite open o answer.");
    const file = abs(need(c.flags, "file"));
    const r = await fenced(c, () => doubtCommand({ sub, project: c.project, epoch: int(c.flags, "epoch", { required: true }), unit: c.flags.unit, id: c.flags.id, file, token: c.flags.token ?? null }, c.deps));
    return { body: r };
  },
  answer: (c) => fenced(c, async () => ({ body: await answerCommand({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), question: need(c.flags, "question"), value: c.flags.value }, c.deps) })),
  async handback(c) {
    const r = await fenced(c, () => handbackCommand({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), unit: need(c.flags, "unit"), reason: need(c.flags, "reason") }, c.deps));
    return { body: r };
  },
  quota: (c) => (c.positionals[1] === "record" ? recordQuota(c) : c.positionals[1] === "read" ? readQuotaView(c) : Promise.reject(usage("quota admite record o read."))),
  admit: admitView,
  async handoff(c) {
    const reason = need(c.flags, "reason");
    if (!["quota95", "limit", "manual", "test"].includes(reason)) throw usage("--reason debe ser quota95, limit, manual o test.");
    return { body: await fenced(c, () => requestHandoff({ project: c.project, epoch: int(c.flags, "epoch", { required: true }), reason }, c.deps)) };
  },
  async finish(c) {
    const epoch = int(c.flags, "epoch", { required: true });
    const r = await fenced(c, () => finishRun({ project: c.project, epoch }, c.deps));
    return { body: r, exit: r.waiting_gate ? 7 : 0 };
  },
  async stop(c) {
    const r = await stopRun({ project: c.project, epoch: int(c.flags, "epoch"), dead: c.flags.dead === true, ownerConfirmed: c.flags["owner-confirmed"] === true }, c.deps);
    return { body: r };
  },
  async status(c) {
    const r = await statusSnapshot(c.project, c.deps);
    const { gaps, ...body } = r;
    return { body: gaps.length ? { ...body, gaps } : body, exit: gaps.length ? 9 : 0 };
  },
  async summary(c) { return { body: await readSummary(c.project, c.deps) }; },
  async "rebuild-state"(c) { return { body: await fenced(c, () => rebuildStateCommand({ project: c.project, epoch: int(c.flags, "epoch", { required: true }) }, c.deps)) }; },
};

/** `drive`: the detached relay. Writes nothing to stdout (the log is build/drive/drive.log); the exit code is the loop's. */
async function runDriveCommand(c) {
  const { flags } = c;
  const argv = [...(flags.standby ? ["--standby"] : []), "--run", need(flags, "run"), ...(flags["handoff-after"] !== undefined ? ["--handoff-after", flags["handoff-after"]] : []), ...(flags.transcript ? ["--transcript", flags.transcript] : [])];
  const engine = {
    next: (ref, engineDeps) => next(ref, engineDeps),
    land: async (ref, engineDeps) => (await land(ref, engineDeps)).output,
    finish: (ref) => finishRun({ project: ref.project, epoch: ref.epoch, actor: ref.actor ?? "drive" }, c.deps),
    engineFailure: ({ project, epoch, error }) => handleEngineFailure({ project, epoch, cmd: "drive", step: "loop", error }, c.deps),
    workers: workersModule,
  };
  return runDrive({ project: c.project, argv }, driveDeps({ ...engine, env: c.deps.env }));
}

// ---------------------------------------------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------------------------------------------

function print(object, code) {
  process.stdout.write(`${JSON.stringify(object)}\n`, () => process.exit(code));
}

function failure(cmd, error) {
  const code = error?.code && EXIT_BY_CODE[error.code] ? error.code : "ENGINE_FAILURE";
  const body = { ok: false, cmd, code, message: String(error?.message ?? error).split("\n")[0] };
  if (error?.hint) body.hint = error.hint;
  if (error?.prepush) body.prepush = error.prepush;
  if (Array.isArray(error?.errors)) body.errors = error.errors;
  if (error?.result?.path) { body.handback = error.result.path; body.notice_es = error.result.message; body.message = "engine failure: the run stopped at a safe point (see handback/engine.md)"; }
  return { body, exit: EXIT_BY_CODE[code] };
}

/**
 * Run one CLI invocation.
 * @param {string[]} argv arguments after the script name
 * @returns {Promise<void>} prints one JSON line (except `drive`) and exits
 */
export async function main(argv) {
  let cmd = null;
  try {
    if (argv.length === 0) throw usage("Falta el comando. Usa --help para ver los comandos.");
    if (argv.includes("--help") || argv.includes("-h")) return print({ ok: true, cmd: "help", ...helpBody() }, 0);
    let rest = argv;
    let projectFlag;
    const at = argv.findIndex((a) => a === "--project" || a.startsWith("--project="));
    if (at !== -1) {
      const eq = argv[at].indexOf("=");
      projectFlag = eq === -1 ? argv[at + 1] : argv[at].slice(eq + 1);
      if (!projectFlag) throw usage("Falta el valor de --project.");
      rest = argv.filter((_, i) => i !== at && !(eq === -1 && i === at + 1));
    }
    cmd = rest.find((a) => !a.startsWith("--")) ?? null;
    if (!cmd) throw usage("Falta el comando. Usa --help para ver los comandos.");
    const tail = rest.slice(rest.indexOf(cmd) + 1);
    let spec;
    let handler;
    let resumeFlag = false;
    let startMode = null;
    if (cmd === "start") {
      // `--run <id>` is also a value flag of `start --resume`, so `--resume` decides first.
      const has = (m) => tail.includes(`--${m}`);
      resumeFlag = has("resume") && has("detect");
      const modes = has("resume") ? (has("detect") ? ["detect"] : ["resume"]) : ["detect", "preflight", "run"].filter(has);
      if (modes.length !== 1) throw usage("start necesita exactamente uno de --detect, --preflight, --run o --resume.");
      const mode = modes[0];
      startMode = mode;
      spec = { bool: [...START_MODES[mode].bool, mode, ...(resumeFlag ? ["resume"] : [])], value: START_MODES[mode].value };
      handler = startHandlers[mode];
    } else if (COMMANDS[cmd]) { spec = COMMANDS[cmd]; handler = HANDLERS[cmd]; } else throw usage(`Comando desconocido: ${cmd}. Usa --help para ver los comandos.`);
    const { flags, positionals } = parseArgv(tail, spec);
    if (cmd === "start") delete flags[startMode];
    if (spec.subs && !spec.subs.includes(positionals[0] ?? "")) throw usage(`${cmd} admite: ${spec.subs.join(", ")}.`);
    const allowed = spec.subs ? (cmd === "card" ? 2 : 1) : 0;
    if (positionals.length > allowed) throw usage(`Argumento inesperado: ${positionals[allowed]}.`);
    const project = findProject(projectFlag);
    const c = { cmd, project, flags, positionals: [cmd, ...positionals], deps: { env: process.env } };
    if (cmd === "drive") { process.exitCode = await runDriveCommand(c); return undefined; }
    const result = await handler(c);
    return print({ ok: true, cmd, ...result.body }, result.exit ?? 0);
  } catch (error) {
    const f = failure(cmd ?? "unknown", error);
    return print(f.body, f.exit);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) await main(process.argv.slice(2));
