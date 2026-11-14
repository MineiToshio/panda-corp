// Compatibility adapter. Account capacity and all admission policy belong to ../capacity.mjs.
import nodeFs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { decide, normalizeClaudeUsage, normalizeCodexRateLimits, readCapacity,
  readCodexFromRolloutsSync, writeCapacitySnapshot } from "../capacity.mjs";
/** Error with a stable `code` the CLI maps to an exit code (D26): USAGE 2, INVALID_INPUT 6, INVALID_STATE 5. */
export class QuotaError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "QuotaError";
    this.code = code;
  }
}

const fsOf = (deps) => deps?.fs ?? nodeFs;

/** Resolves an instant (Date, epoch ms or ISO string) to epoch ms; default `PANDACORP_NOW`, then the wall clock. */
export function resolveNow(now, deps) {
  const value = now ?? deps?.env?.PANDACORP_NOW ?? process.env.PANDACORP_NOW ?? Date.now();
  const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw new QuotaError("INVALID_INPUT", `not a valid instant: ${String(value)}`);
  return ms;
}

export function loadThresholds(deps = {}) { return deps.thresholds ?? JSON.parse(nodeFs.readFileSync(new URL("../model-tiers.json", import.meta.url), "utf8")).thresholds; }
const USAGE_LIMIT_RES = [
  /usage[ _-]?limit/i,
  /insufficient[ _-]?quota|exceeded your current quota|quota (?:exceeded|exhausted|reached)/i,
  /purchase more credits|credit balance/i,
  /(?:5-hour|five-hour|weekly|daily|monthly|session) limit/i,
  /(?:you've|you have) (?:hit|reached) your (?:usage )?limit/i,
  /upgrade to (?:plus|pro)/i,
  /try again at\b/i,
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
  return match ? new Date(Number(match[1]) < 1e12 ? Number(match[1]) * 1000 : Number(match[1])).toISOString() : null;
}


export const QUOTA_CONSERVE_DEFAULT = 85; // Compatibility only; no conserve/veto policy.
const emptyQuota = () => ({ schema: 1, claude: null, codex: null });
export function readQuotaFile(file, deps = {}) {
  try {
    const value = JSON.parse(fsOf(deps).readFileSync(file, "utf8"));
    if (value?.schema !== 1) throw new Error("schema 1 required");
    return value;
  } catch (e) {
    if (e.code === "ENOENT") return emptyQuota();
    throw new QuotaError("INVALID_STATE", `${file}: ${e.message}`);
  }
}
function projection(file, provider, reading, deps = {}) {
  if (!file) return;
  const fs = fsOf(deps), tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(tmp, JSON.stringify({ ...readQuotaFile(file, deps), [provider]: reading }) + "\n", { mode: 0o600, flag: "wx" });
    fs.renameSync(tmp, file);
  } finally { try { fs.unlinkSync(tmp); } catch(e) { if (e.code !== "ENOENT") throw e; } }
}
/** Translate old public shapes; windows retain the complete shared reading. */
export function capacityReading(reading, provider, now) {
  if (reading?.schema === 1 && reading.tool) return reading;
  if (reading?.capacity) return reading.capacity;
  if (provider === "claude") return normalizeClaudeUsage({ status: reading?.status ?? "unavailable", observedAt: reading?.observed_at,
    plan: { windows: [ { label: "5-hour limit", percentUsed: reading?.five_hour_pct, resetsAt: reading?.five_hour_resets_at },
      { label: "Weekly · all models", percentUsed: reading?.weekly_pct, resetsAt: reading?.weekly_resets_at } ] } }, now);
  return normalizeCodexRateLimits({ type: "event_msg", timestamp: reading?.observed_at,
    payload: { type: "token_count", rate_limits: reading?.state === "known" ? { primary: { used_percent: reading.used_percent,
      window_minutes: reading.window_minutes, resets_at: reading.resets_at } } : null } }, now);
}
function legacy(reading) {
  if (!reading) return null;
  const wins = reading.windows.filter(w => w.scope === "all" && w.applicability === "required");
  if (reading.tool === "claude") {
    const w = id => wins.find(w => w.id === id);
    return { provider: "claude", status: reading.state === "known" ? "ok" : "unavailable",
      five_hour_pct: w("five_hour")?.percentUsed ?? null, weekly_pct: w("weekly")?.percentUsed ?? null,
      five_hour_resets_at: w("five_hour")?.resetsAt ?? null, weekly_resets_at: w("weekly")?.resetsAt ?? null,
      observed_at: reading.observedAt, capacity: reading };
  }
  const binding = wins.reduce((a, w) => !a || w.percentUsed > a.percentUsed ? w : a, null);
  return { provider: "codex", state: reading.state, reason: reading.reason,
    used_percent: reading.state === "known" ? binding?.percentUsed ?? null : null,
    window_minutes: binding?.id === "weekly" ? 10080 : 300, resets_at: binding?.resetsAt ?? null,
    credits: null, source: reading.source === "usage_limit" ? "limit" : "rollout", observed_at: reading.observedAt,
    file: reading.file ?? null, capacity: reading };
}
export function readCodexQuota({ codexHome, now } = {}, deps = {}) {
  const env = deps.env ?? process.env;
  const home = codexHome ?? env.CODEX_HOME ?? path.join((deps.homedir ?? os.homedir)(), ".codex");
  return legacy(readCodexFromRolloutsSync(path.join(home, "sessions"), resolveNow(now, deps)));
}
export function recordClaude(input = {}, { now, file, epoch, deps = {} } = {}) {
  const status = input.status ?? "ok";
  if (!["ok", "unavailable"].includes(status)) throw new QuotaError("INVALID_INPUT", "status must be ok or unavailable");
  for (const key of ["five_hour_pct", "weekly_pct"]) if (status === "ok" &&
    (input[key] == null || input[key] === "" || !Number.isFinite(Number(input[key])) || Number(input[key]) < 0 || Number(input[key]) > 100))
    throw new QuotaError("INVALID_INPUT", `${key} must be between 0 and 100`);
  for (const key of ["five_hour_resets_at", "weekly_resets_at"]) if (input[key] != null && !Number.isFinite(Date.parse(input[key])))
    throw new QuotaError("INVALID_INPUT", `${key} must be an instant`);
  const reading = { provider: "claude", five_hour_pct: status === "ok" ? Number(input.five_hour_pct) : null,
    weekly_pct: status === "ok" ? Number(input.weekly_pct) : null, five_hour_resets_at: input.five_hour_resets_at ?? null,
    weekly_resets_at: input.weekly_resets_at ?? null, status, observed_at: new Date(resolveNow(now, deps)).toISOString() };
  writeCapacitySnapshot("claude", capacityReading(reading, "claude", resolveNow(now, deps)), { env: deps.env ?? process.env });
  projection(file, "claude", reading, deps);
  if (epoch != null) deps.journal?.({ type: "quota_reading", data: { provider: "claude", reading } });
  return reading;
}
export function recordCodex(reading, { now, file, deps = {} } = {}) {
  writeCapacitySnapshot("codex", capacityReading(reading, "codex", resolveNow(now, deps)), { env: deps.env ?? process.env });
  projection(file, "codex", reading, deps); return reading;
}
export function recordLimit({ provider, resetsAt = null }, { now, file, epoch, deps = {} } = {}) {
  if (!["claude", "codex"].includes(provider)) throw new QuotaError("INVALID_INPUT", "unknown provider");
  const ms = resolveNow(now, deps), env = deps.env ?? process.env;
  const at = resetsAt && Date.parse(resetsAt) > ms ? resetsAt : new Date(ms + 5 * 3600000).toISOString();
  const windows = (provider === "claude" ? ["five_hour", "weekly"] : ["weekly"]).map(id =>
    ({ id, scope: "all", applicability: "required", percentUsed: 100, resetsAt: at }));
  if (provider === "codex") windows.unshift({ id: "five_hour", scope: "all", applicability: "not_applicable", percentUsed: null, resetsAt: null });
  const shared = { schema: 1, tool: provider, state: "known", source: "usage_limit", reason: "observed_limit", observedAt: new Date(ms).toISOString(), windows };
  writeCapacitySnapshot(`${provider}-limit`, shared, { env });
  const reading = legacy(shared); projection(file, provider, reading, deps);
  if (epoch != null) deps.journal?.({ type: "quota_reading", data: { provider, reading } });
  return reading;
}
export function effective(reading, now, { deps } = {}) {
  const ms = resolveNow(now, deps), r = capacityReading(reading, reading?.provider ?? reading?.tool, ms);
  const d = decide({ task: { id: "effective", type: "implement", risk: "normal" }, readings: { [r.tool]: r }, now: ms });
  const used = d.readings_used[r.tool];
  const pcts = used?.windows.filter(w => w.scope === "all" && w.applicability === "required").map(w => w.percentUsed) ?? [];
  return { pct: used?.state === "known" && pcts.length ? Math.max(...pcts) : null, state: used?.state ?? "unknown", needs_probe: false };
}
export function resetsAtOf(reading) {
  if (!reading) return null;
  if (reading.provider === "codex") return reading.resets_at ?? null;
  return (reading.weekly_pct > reading.five_hour_pct ? reading.weekly_resets_at : reading.five_hour_resets_at) ?? null;
}
/** Legacy effective inputs are accepted for existing consumers; production supplies complete shared readings. */
export function policy({ claude, codex, readings, now, deps } = {}) {
  const ms = resolveNow(now, deps);
  if (!readings) readings = Object.fromEntries(["claude", "codex"].map(tool => {
    const r = tool === "claude" ? claude : codex;
    if (r?.provider || r?.tool) return [tool, capacityReading(r, tool, ms)];
    const windows = (tool === "claude" ? ["five_hour", "weekly"] : ["weekly"]).map(id =>
      ({ id, scope: "all", applicability: "required", percentUsed: r?.pct, resetsAt: new Date(ms + 3600000).toISOString() }));
    return [tool, { schema: 1, tool, state: r?.state ?? "unknown", observedAt: new Date(ms).toISOString(), windows }];
  }));
  const task = { id: "quota-policy", type: "implement", risk: "normal" };
  const decision = decide({ task, readings, now: ms });
  const can = tool => decide({ task: { ...task, override: tool }, readings, now: ms }).action === "run";
  return { claude_new_units: can("claude"), codex_new_units: can("codex"), claude_conserve: false, codex_conserve: false,
    handoff: false, paused: decision.action === "wait", decision, resumeAt: decision.resumeAt ?? null, readings, now: ms,
    degrade_reviews_of: { claude_authored: false, codex_authored: false } };
}
/** Compatibility name only. Passive rollout read, never launches a model. */
export async function probeCodex(options = {}) { return readCodexQuota(options, options); }
export async function readQuota({ codexHome, now } = {}, deps = {}) {
  const ms = resolveNow(now, deps), readings = readCapacity({ env: deps.env ?? process.env, now: ms, codexHome });
  const claude = legacy(readings.claude), codex = legacy(readings.codex);
  return { claude, codex, readings, effective: { claude: effective(claude, ms), codex: effective(codex, ms) }, needs_probe: false,
    policy: policy({ readings, now: ms }) };
}
