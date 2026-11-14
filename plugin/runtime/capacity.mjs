import { open, readdir } from "node:fs/promises";
import path from "node:path";

const TOOLS = ["claude", "codex"];
const TYPES = ["plan", "design", "judgment", "implement", "review", "mechanical", "images"];
const TTL = { claude: 600, codex: 3600 };
const TAIL_BYTES = 256 * 1024;
const PRIORS = {
  "luna/low": [0.4, 0.1], "haiku/low": [0.6, 0.15],
  "sol/low": [1, 0.25], "sonnet/medium": [1.6, 0.4],
  "sol/medium": [1.6, 0.4], "sol/high": [2.4, 0.6],
  "astra/high": [4, 1], "opus/high": [4, 1],
  "opus/low": [2, 0.5], "opus/medium": [3, 0.75], images: [4, 1],
};
const iso = ms => new Date(ms).toISOString();
const timestamp = value => typeof value === "number" ? value : value instanceof Date ? value.getTime() :
  typeof value === "string" && value.trim() ? Date.parse(value) : NaN;
const resetTime = value => typeof value === "number" ? timestamp(value < 1e12 ? value * 1000 : value) : timestamp(value);
const validTime = value => Number.isFinite(value) && Math.abs(value) <= 8.64e15;
const clock = value => {
  const ms = timestamp(value);
  if (!validTime(ms)) throw new TypeError("now must be an ISO instant, Date or epoch milliseconds");
  return ms;
};
const emptyWindow = (id, applicability = "required") => ({ id, scope: "all", applicability, percentUsed: null, resetsAt: null });
const naCodex = () => ({ ...emptyWindow("five_hour", "not_applicable"), reason: "owner_confirmed_weekly_only" });
const unknown = (tool, reason) => ({ schema: 1, tool, source: tool === "codex" ? "codex_rollout" : "get_usage",
  state: "unknown", reason, observedAt: null, ageSeconds: null,
  windows: tool === "codex" ? [naCodex(), emptyWindow("weekly")] : [emptyWindow("five_hour"), emptyWindow("weekly")] });
const relevant = windows => windows.filter(w => w.scope === "all");

function assess(reading, now) {
  const ms = clock(now), observed = timestamp(reading.observedAt);
  let reason = reading.state === "unknown" ? reading.reason : null;
  if (!validTime(observed) || observed > ms + 30000) reason ??= "invalid_timestamp";
  else if ((ms - observed) / 1000 > TTL[reading.tool]) reason ??= "stale_reading";
  const windows = relevant(reading.windows);
  const required = reading.tool === "claude" ? ["five_hour", "weekly"] : ["weekly"];
  if (required.some(id => !windows.some(w => w.id === id && w.applicability === "required"))) reason ??= "missing_window";
  const seen = new Map();
  for (const w of windows) {
    if (w.applicability === "not_applicable" && reading.tool === "codex" && w.id === "five_hour") continue;
    if (w.applicability !== "required" || !Number.isFinite(w.percentUsed) || w.percentUsed < 0 || w.percentUsed > 100 ||
        !validTime(timestamp(w.resetsAt))) reason ??= "invalid_window";
    else if (timestamp(w.resetsAt) <= ms) reason ??= "expired_reset";
    const key = `${w.scope}/${w.id}`, previous = seen.get(key);
    if (previous && (previous.percentUsed !== w.percentUsed || previous.resetsAt !== w.resetsAt)) reason ??= "conflicting_windows";
    seen.set(key, w);
  }
  return { ...reading, state: reason ? "unknown" : "known", reason: reason || "fresh_reading",
    ageSeconds: validTime(observed) ? Math.max(0, (ms - observed) / 1000) : null };
}

function window(id, percentUsed, resetsAt, scope = "all") {
  const reset = resetTime(resetsAt);
  return { id, scope, applicability: "required", percentUsed: typeof percentUsed === "number" && Number.isFinite(percentUsed) ? percentUsed : null,
    resetsAt: validTime(reset) ? iso(reset) : null };
}

/** Normalize the Desktop get_usage object without calling Claude. A payload without a timestamp
 * is a live handoff observed at now; cached callers must retain observedAt.
 * @param {object|null} json {status?, observedAt?, plan:{windows:[{label,percentUsed,resetsAt}]}}
 * @param {string|number|Date} now Injected clock (epoch numbers are milliseconds).
 * @returns {object} Schema-1 reading; malformed/stale/contradictory input is unknown. */
export function normalizeClaudeUsage(json, now) {
  const ms = clock(now), plan = json?.plan;
  if (!plan || !Array.isArray(plan.windows)) return unknown("claude", "missing_usage");
  const rawObserved = json.observedAt ?? json.observed_at ?? json.timestamp ?? plan.observedAt ?? iso(ms);
  const observed = timestamp(rawObserved), windows = [];
  for (const w of plan.windows) {
    const label = typeof w?.label === "string" ? w.label.trim().toLowerCase() : "";
    if (label === "5-hour limit") windows.push(window("five_hour", w.percentUsed, w.resetsAt));
    else if (label === "weekly · all models") windows.push(window("weekly", w.percentUsed, w.resetsAt));
    else if (label.startsWith("weekly · ")) windows.push(window("weekly", w.percentUsed, w.resetsAt, `model:${label.slice(9).trim()}`));
    else return unknown("claude", "unrecognized_window");
  }
  const status = json.status ?? plan.status ?? "ok";
  return assess({ schema: 1, tool: "claude", source: "get_usage", state: status === "ok" ? "known" : "unknown",
    reason: status === "ok" ? null : "usage_unavailable", observedAt: validTime(observed) ? iso(observed) : null, windows }, ms);
}

/** Normalize an event_msg/token_count rollout envelope; duration, not primary/secondary order,
 * identifies the window. Missing Codex 5h is not applicable for the owner-confirmed weekly-only plan.
 * @param {object|null} event Real rollout envelope, timestamp plus payload.rate_limits.
 * @param {string|number|Date} now Injected clock.
 * @returns {object} Schema-1 reading with each reported window retained. */
export function normalizeCodexRateLimits(event, now) {
  const ms = clock(now), limits = event?.payload?.rate_limits;
  if (event?.type !== "event_msg" || event?.payload?.type !== "token_count" || !limits || typeof limits !== "object") {
    return unknown("codex", "missing_rate_limits");
  }
  const observed = timestamp(event.timestamp), windows = [];
  for (const raw of [limits.primary, limits.secondary]) {
    if (raw == null) continue;
    const minutes = raw.window_minutes;
    if (!Number.isFinite(minutes) || minutes <= 0) return unknown("codex", "invalid_window_duration");
    windows.push(window(minutes === 10080 ? "weekly" : minutes === 300 ? "five_hour" : `other:${minutes}`,
      raw.used_percent, raw.resets_at));
  }
  if (!windows.some(w => w.id === "five_hour")) windows.unshift(naCodex());
  const wrongBucket = limits.limit_id != null && limits.limit_id !== "codex";
  return assess({ schema: 1, tool: "codex", source: "codex_rollout", state: wrongBucket ? "unknown" : "known",
    reason: wrongBucket ? "unrecognized_limit_id" : null, observedAt: validTime(observed) ? iso(observed) : null, windows }, ms);
}

async function rolloutFiles(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await rolloutFiles(file));
    else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) files.push(file);
  }
  return files;
}

/** Read rollout tails without inference or writes. Scan every rollout's last 256 KiB, selecting
 * the greatest valid event timestamp across files/lines (never mtime); equal-time conflicts are unknown.
 * @param {string} dir Sessions directory, recursively searched; symlinks are not followed.
 * @param {string|number|Date} now Injected clock.
 * @returns {Promise<object>} Normalized reading; no usable events or inaccessible files yield unknown. */
export async function readCodexFromRollouts(dir, now) {
  const ms = clock(now);
  let latest = null, latestMs = -Infinity, conflict = false;
  try {
    for (const file of await rolloutFiles(dir)) {
      let handle;
      try {
        handle = await open(file, "r");
        const { size } = await handle.stat(), start = Math.max(0, size - TAIL_BYTES);
        const buffer = Buffer.alloc(Math.min(size, TAIL_BYTES));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
        const lines = buffer.subarray(0, bytesRead).toString("utf8").split("\n");
        if (start) lines.shift();
        for (const line of lines) {
          if (!line.includes('"rate_limits"')) continue;
          let event;
          try { event = JSON.parse(line); } catch { continue; }
          if (event.type !== "event_msg" || event.payload?.type !== "token_count" || !event.payload.rate_limits ||
              event.payload.rate_limits.limit_id != null && event.payload.rate_limits.limit_id !== "codex") continue;
          const at = timestamp(event.timestamp);
          if (!validTime(at) || at > ms + 30000 || at < latestMs) continue;
          const candidate = { ...normalizeCodexRateLimits(event, ms), file };
          if (at === latestMs) {
            conflict ||= JSON.stringify(candidate.windows) !== JSON.stringify(latest.windows);
          } else { latest = candidate; latestMs = at; conflict = false; }
        }
      } finally { await handle?.close(); }
    }
  } catch (error) { return unknown("codex", `rollout_read_error:${error.code || "IO"}`); }
  if (!latest) return unknown("codex", "no_rate_limit_event");
  return conflict ? { ...latest, state: "unknown", reason: "conflicting_events" } : latest;
}

function cellFor(type, risk, tool) {
  if (risk === "critical") return { tool, model: tool === "codex" ? "astra" : "opus", effort: "high" };
  if (type === "images") return tool === "codex" ? { tool, model: "sol", effort: "low" } : null;
  if (["plan", "design", "judgment"].includes(type)) return { tool, model: tool === "codex" ? "sol" : "opus", effort: "high" };
  if (risk === "delicate") return { tool, model: tool === "codex" ? "sol" : "sonnet", effort: "medium" };
  if (type === "mechanical") return { tool, model: tool === "codex" ? "luna" : "haiku", effort: "low" };
  return { tool, model: tool === "codex" ? "sol" : type === "review" ? "opus" : "sonnet", effort: tool === "claude" && type === "implement" ? "medium" : "low" };
}

function validateCell(cell) {
  if (!cell || !TOOLS.includes(cell.tool) || !Object.hasOwn(PRIORS, `${cell.model}/${cell.effort}`) ||
      !(cell.tool === "claude" ? ["haiku", "sonnet", "opus"] : ["luna", "sol", "astra"]).includes(cell.model)) {
    throw new TypeError("Invalid pin/override cell (Fable is disabled)");
  }
}

function validateCosts(costs) {
  if (!costs || typeof costs !== "object" || Array.isArray(costs)) throw new TypeError("costs must be a cell-cost map");
  for (const [key, value] of Object.entries(costs)) {
    if (!Object.hasOwn(PRIORS, key) || !value || ![value.five_hour, value.weekly].every(n => Number.isFinite(n) && n >= 0)) {
      throw new TypeError(`Invalid cost prior: ${key}`);
    }
  }
}

function fit(reading, cell, type, imageReserve, costs, pinned) {
  if (reading.state === "unknown") return { fits: true, resets: [] };
  const key = type === "images" ? "images" : `${cell.model}/${cell.effort}`;
  const prior = costs[key] ?? { five_hour: PRIORS[key][0], weekly: PRIORS[key][1] };
  const blocked = relevant(reading.windows).filter(w => {
    if (w.applicability === "not_applicable") return false;
    if (pinned) return w.percentUsed >= 100;
    const reserve = 2 + (cell.tool === "codex" && type !== "images" && w.id === "weekly" ? imageReserve : 0);
    const cost = prior[w.id] ?? 100;
    return w.percentUsed >= 100 || cost > 100 - w.percentUsed - reserve + 1e-10;
  });
  return { fits: blocked.length === 0, resets: blocked.map(w => timestamp(w.resetsAt)) };
}

/** Decide one task without IO, mutation or model calls. Inputs are normalized schema-1 readings.
 * Pins use catalog keys (opus/sol/astra/luna/sonnet/haiku); only a fresh 100% limit pauses a pin.
 * @param {object} input
 * @param {{id:string,type:string,risk?:string,override?:string|object,pin?:object,imageDemandPp?:number}} input.task
 * @param {{claude?:object,codex?:object}} [input.readings] Cached readings retain their observedAt.
 * @param {string|number|Date} input.now Injected clock.
 * @param {Object<string,{five_hour:number,weekly:number}>} [input.costs] Overrides, keyed model/effort or images.
 * @returns {object} run with pin, or per-task wait with resumeAt and readings_used (including age).
 */
export function decide({ task, readings = {}, now, costs = {} }) {
  const ms = clock(now);
  if (!task || typeof task.id !== "string" || !task.id || !TYPES.includes(task.type)) throw new TypeError("Invalid task id/type");
  const risk = task.risk ?? "critical", type = task.type;
  if (!["normal", "delicate", "critical"].includes(risk) || type === "images" && risk !== "normal") {
    throw new TypeError("Invalid risk; image risk assessment must be a separate task");
  }
  const demand = task.imageDemandPp ?? 0;
  if (!Number.isFinite(demand) || demand < 0) throw new TypeError("imageDemandPp must be nonnegative");
  validateCosts(costs);
  const readings_used = Object.fromEntries(TOOLS.map(tool => {
    const r = readings?.[tool];
    return [tool, r?.schema === 1 && r.tool === tool && Array.isArray(r.windows) ? assess(r, ms) : unknown(tool, "missing_reading")];
  }));
  const preferred = ["plan", "design", "judgment"].includes(type) ? "claude" : "codex";
  const override = typeof task.override === "string" ? { tool: task.override } : task.override;
  if (override && (!TOOLS.includes(override.tool) || type === "images" && override.tool !== "codex")) throw new TypeError("Invalid tool override");
  if (task.pin) {
    validateCell(task.pin);
    if (type === "images" && (task.pin.tool !== "codex" || task.pin.model !== "sol" || task.pin.effort !== "low")) throw new TypeError("Images require Codex Sol low");
  }
  const tools = task.pin ? [task.pin.tool] : override ? [override.tool] : type === "images" ? ["codex"] : [preferred, TOOLS.find(t => t !== preferred)];
  const candidates = tools.map(tool => {
    const cell = task.pin ? { tool, model: task.pin.model, effort: task.pin.effort } : cellFor(type, risk, tool);
    if (!task.pin && override && (override.model && override.model !== cell.model || override.effort && override.effort !== cell.effort)) {
      throw new TypeError("Override must preserve the task's qualified cell and risk floor");
    }
    return { cell, reading: readings_used[tool], ...fit(readings_used[tool], cell, type, Math.min(8, Math.max(2, demand)), costs, !!task.pin) };
  });
  let viable = candidates.filter(c => c.fits), reason = task.pin ? "pinned_task" : override ? "explicit_override" : "preferred_tool";
  if (!task.pin && !override && viable.length) {
    const known = viable.filter(c => c.reading.state === "known");
    if (known.length) viable = known;
    if (viable[0].cell.tool !== preferred) reason = candidates[0].reading.state === "unknown" ? "healthy_reading_preferred" : "preferred_tool_unavailable";
    if (viable.length > 1 && viable[0].reading.state === "known" && relevant(viable[0].reading.windows).some(w => w.applicability === "required" && w.percentUsed > 85)) {
      viable.reverse(); reason = "preferred_tool_over_85";
    }
    if (viable[0].reading.state === "unknown") reason = "unknown_reading_last_resort";
  }
  if (viable.length) {
    const pin = { ...viable[0].cell };
    return { action: "run", ...pin, pin, reason, readings_used };
  }
  const fixed = candidates.length === 1 ? candidates[0].cell : { tool: null, model: null, effort: null };
  const resets = candidates.flatMap(c => c.resets).filter(t => t > ms);
  return { action: "wait", ...fixed, ...(task.pin ? { pin: { ...fixed } } : {}),
    reason: task.pin ? "pinned_tool_exhausted" : "no_tool_fits", resumeAt: iso(resets.length ? Math.min(...resets) : ms + 60000), readings_used };
}

/** One Spanish log line; reason is a stable machine-readable code on the decision.
 * @param {object} decision Result of decide.
 * @returns {string} Single-line description, without task contents. */
export function explain(decision) {
  const reasons = { pinned_task: "selección fija de la tarea", explicit_override: "herramienta fijada explícitamente",
    preferred_tool: "preferencia por tipo y riesgo", healthy_reading_preferred: "se prioriza la lectura sana",
    preferred_tool_unavailable: "la herramienta preferida no tiene margen", preferred_tool_over_85: "la preferida supera el 85 %",
    unknown_reading_last_resort: "lectura desconocida, último recurso", pinned_tool_exhausted: "cupo de la tarea fijada agotado",
    no_tool_fits: "ninguna herramienta apta tiene margen" };
  const reason = reasons[decision.reason] ?? "decisión de capacidad";
  return decision.action === "wait" ? `Esperar hasta ${decision.resumeAt}: ${reason}.` :
    `Ejecutar en ${decision.tool === "claude" ? "Claude" : "Codex"} ${decision.model}/${decision.effort}: ${reason}.`;
}
