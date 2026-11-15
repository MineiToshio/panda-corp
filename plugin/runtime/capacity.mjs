import fs from "node:fs";
import { COMPLEXITIES } from "./complexity.mjs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";

const TOOLS = ["claude", "codex"];
const TYPES = ["plan", "design", "judgment", "implement", "review", "mechanical", "images", "image"];
const TTL = { claude: 600, codex: 3600 };
const TAIL_BYTES = 256 * 1024;
const PRIORS = {
  "luna/low": [0.4, 0.1], "haiku/low": [0.6, 0.15],
  "sol/low": [1, 0.25], "sonnet/medium": [1.6, 0.4],
  "sol/medium": [1.6, 0.4], "sol/high": [2.4, 0.6], "sonnet/high": [2.4, 0.6],
  "astra/xhigh": [6, 1.5], "opus/xhigh": [6, 1.5],
  "astra/high": [4, 1], "opus/high": [4, 1],
  "opus/low": [2, 0.5], "opus/medium": [3, 0.75], images: [4, 1],
};
const iso = ms => new Date(ms).toISOString();
// Accept only calendar-valid ISO instants with an explicit zone; Date.parse alone rolls invalid days.
function timestamp(value) {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string") return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return NaN;
  const [, year, month, day, hour, minute, second, zone] = m;
  const y = Number(year), mo = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mo < 1 || mo > 12 || d < 1 || d > days[mo - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 ||
      zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return NaN;
  return Date.parse(value);
}
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
const relevant = (windows, model) => windows.filter(w => w.scope === "all" || model && w.scope === `model:${model}`);
const usableWindow = w => w.state === "known" || w.state === "stale";

function assess(reading, now) {
  const ms = clock(now), observed = timestamp(reading.observedAt);
  // Window-level failures can be re-assessed without discarding independent, still-current constraints.
  // Reassess old snapshots too: pre-fix TTL expiry used to be stored as unknown/stale_reading.
  const windowReasons = ["expired_reset", "missing_window", "invalid_window", "conflicting_windows", "stale_reading"];
  let reason = reading.state === "unknown" && !windowReasons.includes(reading.reason) ? reading.reason : null;
  if (!validTime(observed) || observed > ms + 30000) reason ??= "invalid_timestamp";
  const ageSeconds = validTime(observed) ? Math.max(0, (ms - observed) / 1000) : null;
  const stale = reading.source !== "usage_limit" && ageSeconds > TTL[reading.tool];
  const margin = stale ? ageSeconds > 86400 ? 10 : 5 : 0;
  const observationValid = !reason;
  const required = reading.tool === "claude" ? ["five_hour", "weekly"] : ["weekly"];
  if (required.some(id => !relevant(reading.windows).some(w => w.id === id && w.applicability === "required"))) reason ??= "missing_window";
  const conflicts = new Set(), seen = new Map();
  for (const w of reading.windows) {
    const key = `${w.scope}/${w.id}`, previous = seen.get(key);
    if (previous && (previous.percentUsed !== w.percentUsed || timestamp(previous.resetsAt) !== timestamp(w.resetsAt))) conflicts.add(key);
    seen.set(key, w);
  }
  const windows = reading.windows.map(w => {
    if (w.applicability === "not_applicable" && reading.tool === "codex" && w.id === "five_hour") return { ...w };
    let failure = null;
    if (w.applicability !== "required" || !Number.isFinite(w.percentUsed) || w.percentUsed < 0 || w.percentUsed > 100 ||
        !validTime(timestamp(w.resetsAt))) failure = "invalid_window";
    else if (conflicts.has(`${w.scope}/${w.id}`)) failure = "conflicting_windows";
    else if (timestamp(w.resetsAt) <= ms) failure = "expired_reset";
    reason ??= failure;
    const usable = observationValid && !failure;
    return { ...w, state: usable ? stale ? "stale" : "known" : "unknown",
      safetyMarginPp: usable ? margin : 0,
      effectivePercentUsed: usable ? Math.min(100, w.percentUsed + margin) : null,
      reason: failure === "expired_reset" ? "reset_pending_confirmation" : failure || (observationValid ? stale ? "stale_window" : "fresh_window" : reason) };
  });
  return { ...reading, windows, state: reason ? "unknown" : stale ? "stale" : "known",
    reason: reason || (stale ? "stale_reading" : "fresh_reading"), ageSeconds };
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
 * @returns {object} Schema-1 reading; stale valid windows retain conservative usage; invalid input is unknown. */
export function normalizeClaudeUsage(json, now) {
  const ms = clock(now), plan = json?.plan;
  if (!plan || !Array.isArray(plan.windows)) return unknown("claude", "missing_usage");
  const rawObserved = json.observedAt ?? json.observed_at ?? json.timestamp ?? plan.observedAt ?? iso(ms);
  const observed = timestamp(rawObserved), windows = [];
  for (const w of plan.windows) {
    const label = typeof w?.label === "string" ? w.label.trim().toLowerCase() : "";
    if (label === "5-hour limit") windows.push(window("five_hour", w.percentUsed, w.resetsAt));
    else if (label === "weekly · all models") windows.push(window("weekly", w.percentUsed, w.resetsAt));
    else if (/^(weekly|5-hour limit) · .+/.test(label)) {
      const [duration, model] = label.split(" · ");
      windows.push(window(duration === "weekly" ? "weekly" : "five_hour", w.percentUsed, w.resetsAt, model === "all models" ? "all" : `model:${model}`));
    }
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
      raw.used_percent, raw.resets_at, raw.scope ?? (raw.model ? `model:${raw.model}` : "all")));
  }
  if (!windows.some(w => w.id === "five_hour")) windows.unshift(naCodex());
  const wrongBucket = limits.limit_id != null && limits.limit_id !== "codex";
  return assess({ schema: 1, tool: "codex", source: "codex_rollout", state: wrongBucket ? "unknown" : "known",
    reason: wrongBucket ? "unrecognized_limit_id" : null, observedAt: validTime(observed) ? iso(observed) : null, windows }, ms);
}

function rolloutFiles(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...rolloutFiles(file));
    else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) files.push(file);
  }
  return files;
}

/** Read rollout tails without inference or writes. Scan every rollout's last 256 KiB, selecting
 * the greatest valid event timestamp across files/lines (never mtime); equal-time conflicts are unknown.
 * @param {string} dir Sessions directory, recursively searched; symlinks are not followed.
 * @param {string|number|Date} now Injected clock.
 * @returns {Promise<object>} Normalized reading; no usable events or inaccessible files yield unknown. */
export function readCodexFromRolloutsSync(dir, now) {
  const ms = clock(now);
  let latest = null, latestMs = -Infinity, conflict = false;
  try {
    for (const file of rolloutFiles(dir)) {
      let handle;
      try {
        handle = fs.openSync(file, "r");
        const { size } = fs.fstatSync(handle), start = Math.max(0, size - TAIL_BYTES);
        // Include the preceding byte to distinguish a full boundary record from a partial one.
        const readStart = start ? start - 1 : 0;
        const buffer = Buffer.alloc(size - readStart);
        const bytesRead = fs.readSync(handle, buffer, 0, buffer.length, readStart);
        const lines = buffer.subarray(start ? 1 : 0, bytesRead).toString("utf8").split("\n");
        if (start && buffer[0] !== 10) lines.shift();
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
      } finally { if (handle !== undefined) fs.closeSync(handle); }
    }
  } catch (error) { return unknown("codex", `rollout_read_error:${error.code || "IO"}`); }
  if (!latest) return unknown("codex", "no_rate_limit_event");
  return conflict ? { ...latest, state: "unknown", reason: "conflicting_events" } : latest;
}

export async function readCodexFromRollouts(dir, now) { return readCodexFromRolloutsSync(dir, now); }

// Ordered executable cells, independent of legacy model-tiers routing tables.
export const CELL_LADDERS = Object.freeze({
  codex: Object.freeze(["luna/low", "sol/low", "sol/medium", "sol/high", "astra/high", "astra/xhigh"]),
  claude: Object.freeze(["haiku/low", "sonnet/medium", "sonnet/high", "opus/low", "opus/medium", "opus/high", "opus/xhigh"]),
});
const cellKey = cell => `${cell.model}/${cell.effort}`;
const rank = cell => CELL_LADDERS[cell.tool].indexOf(cellKey(cell));
const atRank = (tool, index) => {
  const key = CELL_LADDERS[tool][index];
  if (!key) return null; // At the absolute ceiling, another identical reviewer is never eligible.
  const [model, effort] = key.split("/");
  return { tool, model, effort };
};
const crossEquivalent = {
  "luna/low": "haiku/low", "sol/low": "sonnet/medium", "sol/medium": "sonnet/high",
  "sol/high": "opus/medium", "astra/high": "opus/high", "astra/xhigh": "opus/xhigh",
  "haiku/low": "luna/low", "sonnet/medium": "sol/low", "sonnet/high": "sol/medium",
  "opus/low": "sol/medium", "opus/medium": "sol/high", "opus/high": "astra/high", "opus/xhigh": "astra/xhigh",
};
function cellFor(type, risk, tool, complexity = "normal") {
  if (risk === "critical") return { tool, model: tool === "codex" ? "astra" : "opus", effort: "high" };
  if (type === "images") return tool === "codex" ? { tool, model: "sol", effort: "low" } : null;
  if (["plan", "design", "judgment"].includes(type)) return { tool, model: tool === "codex" ? "sol" : "opus", effort: "high" };
  if (type === "mechanical") return risk === "delicate" ? atRank(tool, tool === "codex" ? 2 : 1) : atRank(tool, 0);
  const index = COMPLEXITIES.indexOf(complexity);
  const base = atRank(tool, tool === "codex" ? index + 1 : [1, 2, 4][index]);
  return risk === "delicate" && tool === "codex" && rank(base) < 2 ? atRank(tool, 2) : base;
}
function reviewerFloor(tool, risk, authors) {
  let floor = Math.max(tool === "codex" ? 2 : 3, rank(cellFor("implement", risk, tool, "trivial")));
  for (const author of authors) {
    const sameTool = author.tool === tool;
    const equivalent = sameTool ? cellKey(author) : crossEquivalent[cellKey(author)];
    let next = CELL_LADDERS[tool].indexOf(equivalent) + 1;
    // Cross-tool top-high equivalence is allowed; same-tool review must advance to xhigh.
    if (!sameTool && ["astra/high", "opus/high"].includes(cellKey(author))) next--;
    floor = Math.max(floor, next);
  }
  return floor;
}
function qualifiedCell(type, risk, tool, complexity, authors) {
  const base = cellFor(type, risk, tool, complexity);
  if (type !== "review") return base;
  // With no recorded author, ordinary reviews use the nominal implementer on this tool.
  const reference = authors.length ? authors : risk === "critical" ? [] : [base];
  return atRank(tool, reviewerFloor(tool, risk, reference));
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
  const key = type === "images" ? "images" : `${cell.model}/${cell.effort}`;
  const prior = costs[key] ?? { five_hour: PRIORS[key][0], weekly: PRIORS[key][1] };
  const blocked = relevant(reading.windows, cell.model).filter(w => {
    if (w.applicability === "not_applicable" || !usableWindow(w)) return false;
    const reserve = 2 + (cell.tool === "codex" && type !== "images" && w.id === "weekly" ? imageReserve : 0);
    const cost = pinned ? 0 : prior[w.id] ?? 100;
    return w.effectivePercentUsed >= 100 || cost > 100 - w.effectivePercentUsed - reserve + 1e-10;
  });
  const required = reading.tool === "claude" ? ["five_hour", "weekly"] : ["weekly"];
  const known = required.every(id => reading.windows.some(w => w.scope === "all" && w.id === id && usableWindow(w))) &&
    relevant(reading.windows, cell.model).every(w => w.applicability === "not_applicable" || usableWindow(w));
  const pressure = Math.max(0, ...relevant(reading.windows, cell.model).filter(usableWindow).map(w => w.effectivePercentUsed));
  // A valid high window still constrains a cell when a different window is unknown.
  return { fits: blocked.length === 0, level: pressure >= 85 ? 2 : known ? 0 : 1, pressure,
    resets: blocked.map(w => timestamp(w.resetsAt)) };
}

/** Decide one task without IO, mutation or model calls. Inputs are normalized schema-1 readings.
 * Pins use catalog keys (opus/sol/astra/luna/sonnet/haiku), preserve risk floors and mandatory reserves.
 * @param {object} input
 * @param {{id:string,type:string,risk?:string,complexity?:string,implementerCell?:object,implementerCells?:object[],override?:string|object,pin?:object,imageDemandPp?:number}} input.task Complexity defaults to normal; implementerCell carries the actual author cell. Risk defaults to normal for images, critical otherwise.
 * @param {{claude?:object,codex?:object}} [input.readings] Cached readings retain their observedAt.
 * @param {string|number|Date} input.now Injected clock.
 * @param {Object<string,{five_hour:number,weekly:number}>} [input.costs] Overrides, keyed model/effort or images.
 * @returns {object} run with pin, or per-task wait with resumeAt and readings_used (including age).
 */
export function decide({ task, readings = {}, now, costs = {} }) {
  const ms = clock(now);
  if (!task || typeof task.id !== "string" || !task.id || !TYPES.includes(task.type)) throw new TypeError("Invalid task id/type");
  const type = task.type === "image" ? "images" : task.type, risk = task.risk ?? (type === "images" ? "normal" : "critical");
  if (!["normal", "delicate", "critical"].includes(risk) || type === "images" && risk !== "normal") {
    throw new TypeError("Invalid risk; image risk assessment must be a separate task");
  }
  const complexity = task.complexity ?? "normal";
  if (!COMPLEXITIES.includes(complexity)) throw new TypeError("Invalid complexity");
  const authors = [...(task.implementerCells ?? []), ...(task.implementerCell ? [task.implementerCell] : [])].map(cell => ({
    tool: cell.tool ?? cell.runtime, model: cell.model, effort: cell.effort,
  }));
  for (const author of authors) validateCell(author);
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
    const { model, effort } = task.pin;
    const floor = type === "review" ? reviewerFloor(task.pin.tool, risk, authors) : risk === "normal" ? 0 : rank(cellFor("implement", risk, task.pin.tool, "trivial"));
    if (rank(task.pin) < floor) throw new TypeError("Pin is below the task's risk floor or reviewer floor");
    if (override && (override.tool !== task.pin.tool || override.model !== undefined && override.model !== model ||
        override.effort !== undefined && override.effort !== effort)) throw new TypeError("Pin conflicts with explicit override");
    if (type === "images" && (task.pin.tool !== "codex" || task.pin.model !== "sol" || task.pin.effort !== "low")) throw new TypeError("Images require Codex Sol low");
  }
  const tools = task.pin ? [task.pin.tool] : override ? [override.tool] : type === "images" ? ["codex"] : [preferred, TOOLS.find(t => t !== preferred)];
  const candidates = tools.map(tool => {
    const cell = task.pin ? { tool, model: task.pin.model, effort: task.pin.effort } : qualifiedCell(type, risk, tool, complexity, authors);
    if (!cell) return { cell: null, fits: false, resets: [] };
    if (!task.pin && override && (override.model !== undefined && override.model !== cell.model || override.effort !== undefined && override.effort !== cell.effort)) {
      throw new TypeError("Override must preserve the task's qualified cell and risk floor");
    }
    return { cell, reading: readings_used[tool], ...fit(readings_used[tool], cell, type, Math.min(8, Math.max(2, demand)), costs, !!task.pin) };
  });
  let viable = candidates.filter(c => c.fits), reduced = false;
  // Only after neither requested cell fits, reduce effort once, preserving model and hard floors.
  if (!viable.length && !task.pin && !override?.model && !override?.effort && complexity !== "trivial" && ["implement", "review"].includes(type)) {
    const lower = candidates.filter(c => c.cell).map(c => {
      const effort = { xhigh: "high", high: "medium", medium: "low" }[c.cell.effort];
      const cell = { ...c.cell, effort };
      const floor = type === "review" ? reviewerFloor(cell.tool, risk, authors) : rank(cellFor("implement", risk, cell.tool, "trivial"));
      if (!Object.hasOwn(PRIORS, cellKey(cell)) || rank(cell) < floor) return null;
      return { cell, ...fit(readings_used[cell.tool], cell, type, Math.min(8, Math.max(2, demand)), costs, false) };
    }).filter(Boolean);
    candidates.push(...lower);
    viable = lower.filter(c => c.fits); reduced = viable.length > 0;
  }
  let reason = task.pin ? "pinned_task" : override ? "explicit_override" : "preferred_tool";
  if (!task.pin && !override && viable.length) {
    // Healthy <85% > unknown > high >=85%; unfit cells were excluded above.
    // Within high pressure, minimize the worst applicable window before the task tie-break.
    viable.sort((a, b) => a.level - b.level || (a.level === 2 ? a.pressure - b.pressure : 0));
    if (viable[0].cell.tool !== preferred) reason = !candidates[0].fits ? "preferred_tool_unavailable" :
      viable[0].level < candidates[0].level ? "capacity_health_preferred" : "lower_pressure_preferred";
    if (viable[0].level === 1) reason = "unknown_reading_selected";
  }
  if (viable.length) {
    const pin = { ...viable[0].cell };
    return { action: "run", ...pin, pin, reason: reduced ? "complexity_effort_reduced" : reason, ...(reduced ? { reduced: true } : {}), readings_used };
  }
  const fixed = candidates.length === 1 && candidates[0].cell ? candidates[0].cell : { tool: null, model: null, effort: null };
  // A cell fits only after ALL its blocking windows reset; then choose the first eligible cell.
  const resets = candidates.map(c => c.resets.filter(t => t > ms)).filter(ts => ts.length).map(ts => Math.max(...ts));
  return { action: "wait", ...fixed, ...(task.pin ? { pin: { ...fixed } } : {}),
    reason: task.pin ? "pinned_tool_exhausted" : "no_tool_fits", resumeAt: iso(resets.length ? Math.min(...resets) : ms + 60000), readings_used };
}

/** One Spanish log line; reason is a stable machine-readable code on the decision.
 * @param {object} decision Result of decide.
 * @returns {string} Single-line description, without task contents. */
export function explain(decision) {
  const reasons = { complexity_effort_reduced: "esfuerzo reducido un escalón por cupo, conservando los pisos", pinned_task: "selección fija de la tarea", explicit_override: "herramienta fijada explícitamente",
    preferred_tool: "preferencia por tipo y riesgo", capacity_health_preferred: "se prioriza el nivel de salud del cupo",
    preferred_tool_unavailable: "la herramienta preferida no tiene margen", lower_pressure_preferred: "menor uso máximo entre ventanas con presión alta",
    unknown_reading_selected: "lectura desconocida, preferida a un cupo alto", pinned_tool_exhausted: "cupo de la tarea fijada agotado",
    no_tool_fits: "ninguna herramienta apta tiene margen" };
  const reason = reasons[decision.reason] ?? "decisión de capacidad";
  return decision.action === "wait" ? `Esperar hasta ${decision.resumeAt}: ${reason}.` :
    `Ejecutar en ${decision.tool === "claude" ? "Claude" : "Codex"} ${decision.model}/${decision.effort}: ${reason}.`;
}

/** Account-wide store: one file per provider/fact, never project-owned policy state. */
export function capacityDir(env = process.env) {
  return env.PANDACORP_CAPACITY_DIR || path.join(env.PANDACORP_HOST_DIR || path.join(os.homedir(), ".pandacorp", "host"), "capacity");
}
/** Lock-free whole-snapshot replacement: unique exclusive temp + atomic rename, private even after overwrite. */
export function writeCapacitySnapshot(name, value, { env = process.env } = {}) {
  if (!["claude", "codex", "claude-limit", "codex-limit"].includes(name)) throw new TypeError("Invalid capacity snapshot");
  const dir = capacityDir(env), file = path.join(dir, `${name}.json`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value) + "\n", { flag: "wx", mode: 0o600 });
    fs.renameSync(tmp, file);
  } finally { try { fs.unlinkSync(tmp); } catch (e) { if (e.code !== "ENOENT") throw e; } }
  return value;
}
export function readCapacitySnapshot(name, { env = process.env } = {}) {
  const tool = name.startsWith("claude") ? "claude" : "codex";
  try {
    const value = JSON.parse(fs.readFileSync(path.join(capacityDir(env), `${name}.json`), "utf8"));
    if (value?.schema !== 1 || value.tool !== tool || !Array.isArray(value.windows) || value.windows.some(w => !w || typeof w !== "object"))
      return unknown(tool, "invalid_snapshot");
    return value;
  } catch (e) {
    return e.code === "ENOENT" ? null : unknown(tool, `snapshot_read_error:${e.code || "JSON"}`);
  }
}

export function ingestClaude(json, { now = new Date().toISOString(), env = process.env } = {}) {
  return writeCapacitySnapshot("claude", normalizeClaudeUsage(json, now), { env });
}
/** Reconcile passive observations with a real limit; a newer observation supersedes the limit. */
export function readCapacity({ env = process.env, now = env.PANDACORP_NOW ?? new Date().toISOString(), codexHome } = {}) {
  const readings = { claude: readCapacitySnapshot("claude", { env }),
    codex: readCodexFromRolloutsSync(path.join(codexHome || env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions"), now) };
  const storedCodex = readCapacitySnapshot("codex", { env });
  if (storedCodex && (!readings.codex?.observedAt || timestamp(storedCodex.observedAt) > timestamp(readings.codex.observedAt))) readings.codex = storedCodex;
  for (const tool of TOOLS) {
    const limit = readCapacitySnapshot(`${tool}-limit`, { env });
    if (limit && Array.isArray(limit.windows) &&
        (!readings[tool]?.observedAt || timestamp(limit.observedAt) >= timestamp(readings[tool].observedAt))) readings[tool] = limit;
  }
  return readings;
}
function activeRunLog(start = process.cwd()) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    const build = path.join(dir, ".pandacorp", "run", "build");
    try {
      const state = JSON.parse(fs.readFileSync(path.join(build, "state.json"), "utf8"));
      if (state?.status === "active" && state.run_id) return path.join(build, "capacity-decisions.jsonl");
    } catch { /* no active run at this ancestor: host audit remains the fallback */ }
    if (path.dirname(dir) === dir) return null;
  }
}
export function logCapacityDecision(task, decision, { env = process.env, now = env.PANDACORP_NOW ?? new Date().toISOString(), log } = {}) {
  const file = log || env.PANDACORP_CAPACITY_LOG || activeRunLog() || path.join(capacityDir(env), "decisions.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const { id, type, risk, complexity, implementerCell, implementerCells, override, pin, imageDemandPp } = task;
  fs.appendFileSync(file, JSON.stringify({ at: new Date(now).toISOString(), task: { id, type, risk, complexity, implementerCell, implementerCells, override, pin, imageDemandPp },
    decision, reason: decision.reason, readings_used: decision.readings_used }) + "\n", { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}
export function decideCapacity(task, options = {}) {
  const env = options.env ?? process.env, now = options.now ?? env.PANDACORP_NOW ?? new Date().toISOString();
  const decision = decide({ task, readings: options.readings ?? readCapacity({ ...options, env, now }), now });
  logCapacityDecision(task, decision, { ...options, env, now });
  return decision;
}
