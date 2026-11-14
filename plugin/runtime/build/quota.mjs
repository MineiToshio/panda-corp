// Provider quota for the v2 build engine (BUILD-11, D9): the Codex rollout tail reader, the Claude reading the
// session hands in, the single limit detector, `effective()` freshness rules and the 90/95 `policy()`.
// Pure functions with an injectable `deps` ({fs, env, homedir, exec, journal, thresholds}); every function is
// synchronous except `probeCodex`/`readQuota` (they may spawn Codex). Node builtins only; no sibling imports.
import nodeFs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAIL_BYTES = 256 * 1024; // BUILD-11: never read more than the tail of a rollout
const MAX_ROLLOUTS_TRIED = 10; // never scan the whole sessions tree
const MAX_DAYS_BACK = 3;
const DAY_MS = 86_400_000;
const ASSUMED_LIMIT_WINDOW_MINUTES = 300; // a `usage_limit` with no known reset is assumed to be the 5 h window
const MODEL_TIERS_FILE = fileURLToPath(new URL("../model-tiers.json", import.meta.url));
const THRESHOLD_KEYS = ["quota_stop", "quota_handoff", "codex_probe_age_s", "codex_probe_min_pct", "claude_reading_max_age_s"];

/** Error with a stable `code` the CLI maps to an exit code (D26): USAGE 2, INVALID_INPUT 6, INVALID_STATE 5. */
export class QuotaError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "QuotaError";
    this.code = code;
  }
}

const fsOf = (deps) => deps?.fs ?? nodeFs;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Resolves an instant (Date, epoch ms or ISO string) to epoch ms; default `PANDACORP_NOW`, then the wall clock. */
export function resolveNow(now, deps) {
  const value = now ?? deps?.env?.PANDACORP_NOW ?? process.env.PANDACORP_NOW ?? Date.now();
  const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new QuotaError("INVALID_INPUT", `not a valid instant: ${String(value)}`);
  return ms;
}

/**
 * The `thresholds` object of model-tiers.json (stop 90, handoff 95, probe age/min, reading max age...).
 * @param {{thresholds?: object, fs?: object}} [deps] `deps.thresholds` replaces the file read.
 * @returns {object} validated thresholds (throws INVALID_STATE when a needed key is missing).
 */
export function loadThresholds(deps) {
  const thresholds = deps?.thresholds ?? JSON.parse(fsOf(deps).readFileSync(MODEL_TIERS_FILE, "utf8")).thresholds;
  const missing = THRESHOLD_KEYS.filter((key) => !Number.isFinite(thresholds?.[key]));
  if (missing.length) throw new QuotaError("INVALID_STATE", `model-tiers.json thresholds lack: ${missing.join(", ")}`);
  return thresholds;
}

// ---------------------------------------------------------------------------------------------- Codex rollouts

const listDir = (fs, dir) => {
  try {
    return fs.readdirSync(dir);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return [];
    throw error;
  }
};

/** Day directories `sessions/YYYY/MM/DD` within the last 3 days, newest first (UTC date of the directory name). */
function recentDayDirs(fs, sessionsDir, nowMs) {
  const today = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const min = today - MAX_DAYS_BACK * DAY_MS;
  const max = today + DAY_MS; // one day of tolerance: directories are named in the local calendar
  const numeric = (names, width) => names.filter((n) => new RegExp(`^\\d{${width}}$`).test(n)).sort().reverse();
  const days = [];
  for (const year of numeric(listDir(fs, sessionsDir), 4)) {
    for (const month of numeric(listDir(fs, path.join(sessionsDir, year)), 2)) {
      for (const day of numeric(listDir(fs, path.join(sessionsDir, year, month)), 2)) {
        const at = Date.UTC(Number(year), Number(month) - 1, Number(day));
        if (at >= min && at <= max) days.push(path.join(sessionsDir, year, month, day));
      }
    }
  }
  return days;
}

/** Rollout files of one day directory, newest mtime first. */
function rolloutsNewestFirst(fs, dir) {
  const files = [];
  for (const name of listDir(fs, dir)) {
    if (!/^rollout-.*\.jsonl$/.test(name)) continue;
    const file = path.join(dir, name);
    try {
      const stat = fs.statSync(file);
      if (stat.isFile()) files.push({ file, mtimeMs: stat.mtimeMs });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/** Last <= 256 KiB of a file as text; the first (possibly cut) line is dropped when the file is longer. */
function readTail(fs, file) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    let done = 0;
    while (done < length) {
      const n = fs.readSync(fd, buffer, done, length - done, size - length + done);
      if (n === 0) break;
      done += n;
    }
    const text = buffer.subarray(0, done).toString("utf8");
    return size > length ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    fs.closeSync(fd);
  }
}

/** The last `event_msg` / `token_count` event of a tail that carries a non-null `rate_limits`, or null. */
function lastRateLimits(tail) {
  const lines = tail.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.includes("rate_limits") || !line.includes("token_count")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // a torn line inside the tail: older events are still usable
    }
    const payload = event?.payload;
    if (event?.type === "event_msg" && payload?.type === "token_count" && isObject(payload.rate_limits)) {
      return { timestamp: event.timestamp, rateLimits: payload.rate_limits };
    }
  }
  return null;
}

/** Epoch seconds (ms tolerated) to ISO-8601; null when absent or not a finite number. */
function epochToIso(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value > 1e11 ? value : value * 1000).toISOString();
}

const clampPct = (value) => Math.min(100, Math.max(0, value));

/**
 * `used_percent = max(primary, secondary when present)`; a window already past its `resets_at` is stale and is
 * ignored while another window is still live (when every window is past, the literal max is returned and
 * `effective()` calls it unknown). A non-empty `rate_limit_reached_type` is a 100 % reading.
 */
function summarizeRateLimits(rateLimits, nowMs) {
  const windows = [rateLimits.primary, rateLimits.secondary]
    .filter((w) => isObject(w) && Number.isFinite(w.used_percent))
    .map((w) => ({ pct: clampPct(w.used_percent), minutes: Number.isFinite(w.window_minutes) ? Math.trunc(w.window_minutes) : 0, resetsAt: epochToIso(w.resets_at ?? w.reset_at) }));
  const reached = typeof rateLimits.rate_limit_reached_type === "string" && rateLimits.rate_limit_reached_type.trim() !== "";
  if (!windows.length && !reached) return null;
  const live = windows.filter((w) => w.resetsAt && Date.parse(w.resetsAt) > nowMs);
  const pool = live.length ? live : windows;
  const top = pool.reduce((best, w) => (w.pct > best.pct ? w : best), pool[0] ?? { pct: 0, minutes: 0, resetsAt: null });
  return { used_percent: reached ? 100 : top.pct, window_minutes: top.minutes, resets_at: top.resetsAt, credits: rateLimits.credits ?? null };
}

/**
 * Reads the Codex quota from the newest rollout (BUILD-11): newest `sessions/YYYY/MM/DD` dirs first (<= 3 days),
 * tail <= 256 KiB, last `token_count.rate_limits`. Never scans the whole tree and never throws on a missing or
 * unreadable store: it returns the honest `unknown` reading with a reason (reactive-only policy).
 * @param {{codexHome?: string, now?: Date|number|string}} [options] `codexHome` default `$CODEX_HOME` or `~/.codex`.
 * @param {{fs?: object, env?: object, homedir?: () => string}} [deps]
 * @returns {object} `{provider:"codex", state:"known", used_percent, window_minutes, resets_at (ISO), credits,
 *   source:"rollout", observed_at (the event's own timestamp), file}` or `{provider:"codex", state:"unknown", reason}`.
 */
export function readCodexQuota({ codexHome, now } = {}, deps = {}) {
  const fs = fsOf(deps);
  const nowMs = resolveNow(now, deps);
  const home = codexHome ?? deps.env?.CODEX_HOME ?? process.env.CODEX_HOME ?? path.join((deps.homedir ?? os.homedir)(), ".codex");
  const sessionsDir = path.join(home, "sessions");
  const unknown = (reason) => ({ provider: "codex", state: "unknown", reason });
  try {
    const days = recentDayDirs(fs, sessionsDir, nowMs);
    if (!days.length) return unknown(`no rollout directory within ${MAX_DAYS_BACK} days under ${sessionsDir}`);
    let tried = 0;
    for (const dir of days) {
      for (const { file, mtimeMs } of rolloutsNewestFirst(fs, dir)) {
        if (tried++ >= MAX_ROLLOUTS_TRIED) return unknown(`no rate_limits in the newest ${MAX_ROLLOUTS_TRIED} rollouts`);
        const found = lastRateLimits(readTail(fs, file));
        if (!found) continue;
        const summary = summarizeRateLimits(found.rateLimits, nowMs);
        if (!summary) continue;
        if (!summary.resets_at) return unknown(`rate_limits without resets_at in ${file}`);
        const stamped = Date.parse(found.timestamp);
        return { provider: "codex", state: "known", ...summary, source: "rollout", observed_at: new Date(Number.isFinite(stamped) ? stamped : mtimeMs).toISOString(), file };
      }
    }
    return unknown(tried ? "no token_count with rate_limits in the recent rollouts" : "no rollout file in the recent day directories");
  } catch (error) {
    return unknown(`cannot read ${sessionsDir}: ${error?.code ?? error?.message}`);
  }
}

// ----------------------------------------------------------------------------------------- limit text detector

const USAGE_LIMIT_RES = [
  /usage[ _-]?limit/i,
  /insufficient[ _-]?quota|exceeded your current quota|quota (?:exceeded|exhausted|reached)/i,
  /purchase more credits|credit balance/i,
  /(?:5-hour|five-hour|weekly|daily|monthly|session) limit/i,
  /(?:you've|you have) (?:hit|reached) your (?:usage )?limit/i,
  /upgrade to (?:plus|pro)/i,
  /try again at\b/i,
  /\bquota\b/i,
];
const RATE_LIMIT_RES = [/rate[ _-]?limit/i, /too many requests/i, /\b(?:429|529)\b/, /overloaded/i, /try again in\b/i];

/**
 * The single limit detector: the union of the v1 patterns (executor.mjs `classifyProviderFailure`, codex-worker
 * `LIMIT_RE`, the engine's `THROWN_LIMIT_RE` / `PROVIDER_ENVELOPE_RE`), copied, not imported. A `usage_limit` (an
 * exhausted window) wins over a `rate_limit` (429 / overloaded, transient) when both match.
 * @param {unknown} text worker or report output.
 * @returns {"usage_limit"|"rate_limit"|null}
 */
export function classifyLimitText(text) {
  if (typeof text !== "string" || !text) return null;
  if (USAGE_LIMIT_RES.some((re) => re.test(text))) return "usage_limit";
  if (RATE_LIMIT_RES.some((re) => re.test(text))) return "rate_limit";
  return null;
}

/** ISO reset instant carried by Claude's `usage limit reached|<epoch seconds>` envelope, else null. */
export function limitResetsAt(text) {
  const match = typeof text === "string" ? /usage limit reached\|(\d{9,13})/i.exec(text) : null;
  return match ? epochToIso(Number(match[1])) : null;
}

// ------------------------------------------------------------------------------------------ quota.json store

const emptyQuota = () => ({ schema: 1, claude: null, codex: null });

/**
 * Reads `build/quota.json` (schema `quota.schema.json`). A missing file is an empty store; a corrupt one fails loud.
 * @returns {{schema: 1, claude: object|null, codex: object|null}}
 */
export function readQuotaFile(file, deps = {}) {
  let text;
  try {
    text = fsOf(deps).readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return emptyQuota();
    throw error;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new QuotaError("INVALID_STATE", `${file} is not valid JSON: ${error.message}`);
  }
  if (!isObject(data) || data.schema !== 1) throw new QuotaError("INVALID_STATE", `${file} is not a quota.json (schema 1)`);
  return { schema: 1, claude: data.claude ?? null, codex: data.codex ?? null };
}

/** Atomic write (temp file + rename, mode 0600) of the whole store. */
function writeQuotaFile(file, store, deps) {
  const fs = fsOf(deps);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}

const pctInput = (value, name) => {
  if (value === undefined || value === null || value === "") throw new QuotaError("USAGE", `--${name} is required with status ok`);
  const number = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new QuotaError("INVALID_INPUT", `${name} must be a number between 0 and 100`);
  return number;
};

const resetsInput = (value, name) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new QuotaError("INVALID_INPUT", `${name} must be an ISO-8601 instant`);
  return value;
};

/**
 * Builds and (with `file`) persists the Claude reading the session read from `get_usage`. `status:"ok"` needs both
 * percentages; `status:"unavailable"` stores nulls (unknown, reactive-only). The journal entry `quota_reading` is
 * the caller's: `deps.journal({type, data})` is called only when `epoch` is given (the fenced form).
 * @param {{five_hour_pct?: number|string, weekly_pct?: number|string, five_hour_resets_at?: string, weekly_resets_at?: string, status?: "ok"|"unavailable"}} input
 * @param {{now?: Date|number|string, file?: string, epoch?: number, deps?: object}} [context]
 * @returns {object} the stored reading `{provider:"claude", five_hour_pct, weekly_pct, five_hour_resets_at, weekly_resets_at, status, observed_at}`.
 */
export function recordClaude(input = {}, { now, file, epoch, deps = {} } = {}) {
  const status = input.status ?? "ok";
  if (status !== "ok" && status !== "unavailable") throw new QuotaError("INVALID_INPUT", `status must be ok or unavailable, got ${String(status)}`);
  const ok = status === "ok";
  const reading = {
    provider: "claude",
    five_hour_pct: ok ? pctInput(input.five_hour_pct, "five-hour") : null,
    weekly_pct: ok ? pctInput(input.weekly_pct, "weekly") : null,
    five_hour_resets_at: resetsInput(input.five_hour_resets_at, "five-hour-resets-at"),
    weekly_resets_at: resetsInput(input.weekly_resets_at, "weekly-resets-at"),
    status,
    observed_at: new Date(resolveNow(now, deps)).toISOString(),
  };
  if (file) writeQuotaFile(file, { ...readQuotaFile(file, deps), claude: reading }, deps);
  if (epoch !== undefined && epoch !== null) deps.journal?.({ type: "quota_reading", data: { provider: "claude", reading } });
  return reading;
}

/**
 * Persists a Codex reading (rollout, probe or limit) into `quota.json`; the newer observation wins (usage only
 * rises within a window, so an unexpired stored reading is kept unless the new one is at least as recent).
 * @returns {object} the Codex reading now stored.
 */
export function recordCodex(reading, { now, file, deps = {} } = {}) {
  const store = file ? readQuotaFile(file, deps) : emptyQuota();
  const kept = pickCodex(store.codex, reading, resolveNow(now, deps));
  if (file) writeQuotaFile(file, { ...store, codex: kept }, deps);
  return kept;
}

/** The newer known, unexpired Codex observation; an unknown reading never replaces a live known one. */
function pickCodex(stored, fresh, nowMs) {
  const live = (r) => r?.state === "known" && Date.parse(r.resets_at) > nowMs;
  if (!live(stored)) return fresh ?? stored ?? null;
  if (!fresh || !live(fresh)) return stored;
  return Date.parse(fresh.observed_at) >= Date.parse(stored.observed_at) ? fresh : stored;
}

/**
 * Records a `usage_limit` as a 100 % reading for the provider (D9, `source:"limit"` for Codex). Reset instant:
 * `resetsAt` if given, else the stored reading's if still in the future, else now + 5 h (assumed window).
 * @param {{provider: "claude"|"codex", resetsAt?: string|null}} input
 * @param {{now?: Date|number|string, file?: string, epoch?: number, deps?: object}} [context]
 * @returns {object} the stored reading.
 */
export function recordLimit({ provider, resetsAt = null }, { now, file, epoch, deps = {} } = {}) {
  if (provider !== "claude" && provider !== "codex") throw new QuotaError("INVALID_INPUT", `unknown provider: ${String(provider)}`);
  const nowMs = resolveNow(now, deps);
  const observedAt = new Date(nowMs).toISOString();
  const store = file ? readQuotaFile(file, deps) : emptyQuota();
  const future = (iso) => (typeof iso === "string" && Date.parse(iso) > nowMs ? iso : null);
  let reading;
  if (provider === "claude") {
    const prev = store.claude;
    const claudeResets = future(resetsAt) ?? future(prev?.five_hour_resets_at) ?? null;
    reading = { provider, five_hour_pct: 100, weekly_pct: prev?.weekly_pct ?? null, five_hour_resets_at: claudeResets, weekly_resets_at: prev?.weekly_resets_at ?? null, status: "ok", observed_at: observedAt };
  } else {
    const prev = store.codex?.state === "known" ? store.codex : null;
    const minutes = prev?.window_minutes || ASSUMED_LIMIT_WINDOW_MINUTES;
    const codexResets = future(resetsAt) ?? future(prev?.resets_at) ?? new Date(nowMs + ASSUMED_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
    reading = { provider, state: "known", used_percent: 100, window_minutes: minutes, resets_at: codexResets, credits: prev?.credits ?? null, source: "limit", observed_at: observedAt, file: null };
  }
  if (file) writeQuotaFile(file, { ...store, [provider]: reading }, deps);
  if (epoch !== undefined && epoch !== null) deps.journal?.({ type: "quota_reading", data: { provider, reading } });
  return reading;
}

// ------------------------------------------------------------------------------------------ effective + policy

const UNKNOWN = Object.freeze({ pct: null, state: "unknown", needs_probe: false });

/**
 * Freshness rules (BUILD-11). Claude: known iff `status:"ok"`, a percentage exists and the reading is not older
 * than `claude_reading_max_age_s`; pct = max(five-hour, weekly). Codex: known until its `resets_at`;
 * `needs_probe` iff older than `codex_probe_age_s` and pct >= `codex_probe_min_pct` (never for a `limit` reading).
 * @param {object|null} reading a Claude or Codex reading (as stored in quota.json).
 * @param {Date|number|string} [now]
 * @param {{thresholds?: object, deps?: object}} [options]
 * @returns {{pct: number|null, state: "known"|"unknown", needs_probe: boolean}}
 */
export function effective(reading, now, { thresholds, deps } = {}) {
  if (!isObject(reading)) return { ...UNKNOWN };
  const limits = thresholds ?? loadThresholds(deps);
  const nowMs = resolveNow(now, deps);
  const ageMs = nowMs - Date.parse(reading.observed_at);
  if (reading.provider === "claude") {
    const pcts = [reading.five_hour_pct, reading.weekly_pct].filter((v) => Number.isFinite(v));
    const fresh = Number.isFinite(ageMs) && ageMs <= limits.claude_reading_max_age_s * 1000;
    if (reading.status !== "ok" || !pcts.length || !fresh) return { ...UNKNOWN };
    return { pct: Math.max(...pcts), state: "known", needs_probe: false };
  }
  if (reading.provider === "codex") {
    if (reading.state !== "known" || !Number.isFinite(reading.used_percent)) return { ...UNKNOWN };
    if (!(Date.parse(reading.resets_at) > nowMs)) return { ...UNKNOWN };
    const stale = Number.isFinite(ageMs) && ageMs > limits.codex_probe_age_s * 1000;
    const needsProbe = stale && reading.source !== "limit" && reading.used_percent >= limits.codex_probe_min_pct;
    return { pct: reading.used_percent, state: "known", needs_probe: needsProbe };
  }
  return { ...UNKNOWN };
}

/**
 * When a provider returns: the `resets_at` of the window that put it at its percentage (Claude: the higher of the
 * five-hour and weekly windows), else null. Used for the `paused-quota` report.
 * @returns {string|null} ISO-8601 instant.
 */
export function resetsAtOf(reading) {
  if (!isObject(reading)) return null;
  if (reading.provider === "codex") return reading.state === "known" ? reading.resets_at : null;
  const five = Number.isFinite(reading.five_hour_pct) ? reading.five_hour_pct : -1;
  const week = Number.isFinite(reading.weekly_pct) ? reading.weekly_pct : -1;
  return (week > five ? reading.weekly_resets_at : reading.five_hour_resets_at) ?? null;
}

const asEffective = (value, now, options) => (isObject(value) && value.provider ? effective(value, now, options) : (value ?? UNKNOWN));
const isOut = (eff, stop) => eff.state === "known" && eff.pct >= stop;
/** DR-161 default: a provider with less than 15 % left (a known reading at or above 85 % used) is conserved. */
export const QUOTA_CONSERVE_DEFAULT = 85;

/**
 * The BUILD-11 table and the A11 priority as a pure function (the one place the priority lives). A provider is
 * "out" when known and >= `quota_stop` (90); an unknown provider is never out (reactive-only). First match:
 * both providers out -> `paused`, never `handoff`; Claude known and >= `quota_handoff` (95) with a
 * `claude-session` coordinator -> `handoff` when `driveAlive === true`, else `paused` (nobody to take over).
 * A `codex-session` or `drive` coordinator never hands off.
 * @param {{claude: object, codex: object, coordinator?: string, driveAlive?: boolean, now?: Date|number|string, thresholds?: object, deps?: object}} input
 *   `claude`/`codex` are `effective()` results (`{pct, state}`) or stored readings (converted with `now`);
 *   `driveAlive` (default false): the drive standby is alive (`build/drive/standby.json` pid alive, state standby).
 * DR-161: a provider known at or above `quota_conserve` (85) and not yet out is `conserve`: it still takes the units
 * of its own label, but reviews of the OTHER company's work stay inside that company (BUILD-10 on_conserve cells).
 * @returns {{claude_new_units: boolean, codex_new_units: boolean, claude_conserve: boolean, codex_conserve: boolean,
 *   handoff: boolean, paused: boolean, degrade_reviews_of: {claude_authored: boolean, codex_authored: boolean}}}
 */
export function policy({ claude, codex, coordinator, driveAlive = false, now, thresholds, deps } = {}) {
  const limits = thresholds ?? loadThresholds(deps);
  const options = { thresholds: limits, deps };
  const claudeEff = asEffective(claude, now, options);
  const codexEff = asEffective(codex, now, options);
  const claudeOut = isOut(claudeEff, limits.quota_stop);
  const codexOut = isOut(codexEff, limits.quota_stop);
  const claudeAtHandoff = coordinator === "claude-session" && claudeEff.state === "known" && claudeEff.pct >= limits.quota_handoff;
  const handoff = !(claudeOut && codexOut) && claudeAtHandoff && driveAlive === true;
  const conserveAt = Number.isFinite(limits.quota_conserve) ? limits.quota_conserve : QUOTA_CONSERVE_DEFAULT;
  return {
    claude_new_units: !claudeOut,
    codex_new_units: !codexOut,
    claude_conserve: !claudeOut && isOut(claudeEff, conserveAt),
    codex_conserve: !codexOut && isOut(codexEff, conserveAt),
    handoff,
    paused: (claudeOut && codexOut) || (claudeAtHandoff && !handoff),
    degrade_reviews_of: { claude_authored: codexOut, codex_authored: claudeOut },
  };
}

// ------------------------------------------------------------------------------------------------ probe + read

/**
 * The minimal `codex exec` probe (~20k input tokens, preflight only): one short prompt that is NOT ephemeral so
 * Codex writes the rollout whose `token_count.rate_limits` is then read back. A `usage_limit` answer is a
 * 100 % `limit` reading; any other failure is an honest `unknown`.
 * @param {{exec: (command: string, args: string[], options: object) => ({code: number, stdout?: string, stderr?: string}|Promise<object>),
 *   codexHome?: string, now?: Date|number|string, cwd?: string, model?: string, timeoutMs?: number, env?: object, fs?: object, homedir?: () => string}} options
 *   `exec` is injected (sync or async); `env.PANDACORP_CODEX_BIN` names the binary (default `codex`); the rest of
 *   the object is also the `deps` of the read-back.
 * @returns {Promise<object>} a Codex reading with `source:"probe"` or `"limit"`, or `{state:"unknown", reason}`.
 */
export async function probeCodex({ exec, codexHome, now, cwd, model, timeoutMs = 120_000, ...deps } = {}) {
  if (typeof exec !== "function") throw new QuotaError("USAGE", "probeCodex needs an injected exec");
  const bin = deps.env?.PANDACORP_CODEX_BIN ?? process.env.PANDACORP_CODEX_BIN ?? "codex";
  const args = ["exec", "--skip-git-repo-check", "-s", "read-only", ...(model ? ["-m", model] : []), "Reply with the single word ok."];
  const result = await exec(bin, args, { cwd: cwd ?? os.tmpdir(), timeoutMs });
  const output = `${result?.stdout ?? ""}\n${result?.stderr ?? ""}`;
  if (classifyLimitText(output) === "usage_limit") return recordLimit({ provider: "codex", resetsAt: limitResetsAt(output) }, { now, deps });
  if (result?.code !== 0) return { provider: "codex", state: "unknown", reason: `probe failed (exit ${result?.code}): ${output.trim().slice(0, 200)}` };
  const reading = readCodexQuota({ codexHome, now }, deps);
  return reading.state === "known" ? { ...reading, source: "probe" } : reading;
}

/**
 * What `quota read` prints: the stored Claude reading, the freshest Codex reading (the rollout tail merged with the
 * stored one by recency, persisted when `file` is given), their `effective()` view and the derived `policy`.
 * With `probe` and `needs_probe`, runs `probeCodex` once (needs `deps.exec`).
 * @param {{file?: string, codexHome?: string, now?: Date|number|string, coordinator?: string, probe?: boolean}} [options]
 * @param {object} [deps]
 * @returns {Promise<{claude: object|null, codex: object|null, effective: {claude: object, codex: object}, needs_probe: boolean, policy: object}>}
 */
export async function readQuota({ file, codexHome, now, coordinator, probe = false } = {}, deps = {}) {
  const thresholds = loadThresholds(deps);
  const nowMs = resolveNow(now, deps);
  const store = file ? readQuotaFile(file, deps) : emptyQuota();
  let codex = pickCodex(store.codex, readCodexQuota({ codexHome, now: nowMs }, deps), nowMs);
  if (probe && effective(codex, nowMs, { thresholds }).needs_probe) {
    codex = pickCodex(codex, await probeCodex({ ...deps, codexHome, now: nowMs }), nowMs);
  }
  if (file && codex && codex !== store.codex) writeQuotaFile(file, { ...store, codex }, deps);
  const view = { claude: effective(store.claude, nowMs, { thresholds }), codex: effective(codex, nowMs, { thresholds }) };
  return {
    claude: store.claude,
    codex,
    effective: view,
    needs_probe: view.codex.needs_probe,
    policy: policy({ claude: view.claude, codex: view.codex, coordinator, thresholds }),
  };
}
