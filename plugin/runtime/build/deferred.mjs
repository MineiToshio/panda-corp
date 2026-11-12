// Deferred re-review ledger (D11, BUILD-10 "Deferred re-review"): `.pandacorp/run/deferred-reviews.json`.
// Every degraded review (other company out of quota or unreachable, N7 same-model, Sol at capacity) and every
// audit deferred under drive is appended here. The ledger OUTLIVES runs; it is written only by the epoch holder
// inside a run (review-record phase 2, `next` phase 2), never by a reader such as the next preflight.
// Pure ledger: no journal, no state, no routing. Callers (review.mjs, next.mjs) journal what they change.
import * as fsp from "node:fs/promises";
import { assertValid, atomicWriteJson, loadSchema, nowIso, readJson } from "./fsx.mjs";
import { buildPaths } from "./paths.mjs";

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const ID_RE = /^dr-(\d+)$/;

/** Unit id `next` gives the `deferred-review` unit that serves ledger entry `entryId` (A13 naming: `u-<kind>-<ref>`). */
export const deferredUnitId = (entryId) => `u-deferred-review-${entryId}`;

/** Inverse of `deferredUnitId`: the ledger id a unit id refers to, or null. */
export const entryIdOfUnit = (unitId) => (typeof unitId === "string" && unitId.startsWith("u-deferred-review-") ? unitId.slice("u-deferred-review-".length) : null);

/**
 * Is a company able to serve a deferred re-review right now? Truthy booleans and routing's `"ok"` count; quota,
 * unreachable and at-capacity do not (the entry waits).
 * @param {boolean|string|undefined} availability
 */
export const companyServes = (availability) => availability === true || availability === "ok";

/**
 * Read the ledger. A missing file is an empty ledger; an unparsable or schema-invalid one fails loud.
 * @param {string} project absolute project root
 * @param {{fs?: object}} [deps]
 * @returns {Promise<object[]>} entries (deferred-reviews.schema.json items)
 * @throws LEDGER_CORRUPT (unparsable) or INVALID_STATE (schema mismatch)
 */
export async function readDeferred(project, deps = {}) {
  const { fs = fsp } = deps;
  const entries = await readJson(buildPaths(project, deps).deferredReviewsFile, { fs });
  if (entries === null) return [];
  assertValid(await loadSchema("deferred-reviews", { fs }), entries, { label: "deferred-reviews.json", code: "INVALID_STATE" });
  return entries;
}

/**
 * Replace the ledger atomically (mode 0600) after validating it against the schema.
 * @param {string} project absolute project root
 * @param {object[]} entries
 * @param {{fs?: object}} [deps]
 * @returns {Promise<object[]>} the written entries
 */
export async function writeDeferred(project, entries, deps = {}) {
  const { fs = fsp } = deps;
  const lease = await (deps.buildState?.currentLease ?? (await import("../build-state.mjs")).currentLease)(project);
  if (!lease) throw Object.assign(new Error("deferred-reviews.json is written only inside a run"), { code: "INVALID_STATE" });
  assertValid(await loadSchema("deferred-reviews", { fs }), entries, { label: "deferred-reviews.json", code: "INVALID_STATE" });
  await atomicWriteJson(buildPaths(project, deps).deferredReviewsFile, entries, { fs });
  return entries;
}

/**
 * Pending entries, oldest first (`created_at`, then id).
 * @param {object[]} entries a ledger
 * @param {{needed?: "claude"|"codex", frd?: string|null, kind?: "review"|"audit"}} [filter]
 * @returns {object[]}
 */
export function pendingEntries(entries, filter = {}) {
  return entries
    .filter((e) => e.status === "pending" && (!filter.needed || e.needed === filter.needed) && (filter.frd === undefined || e.frd === filter.frd) && (!filter.kind || e.kind === filter.kind))
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
}

/**
 * Read the ledger and return its pending entries (the preflight count and the "listed at landing" view).
 * @param {string} project
 * @param {{needed?: string, frd?: string|null, kind?: string}} [filter]
 * @param {object} [deps]
 */
export async function pendingDeferred(project, filter = {}, deps = {}) {
  return pendingEntries(await readDeferred(project, deps), filter);
}

/**
 * The entry `next` should serve first: the oldest pending one whose needed company is available ("below 90 %").
 * Pure; the caller passes the availability it derived from the quota policy.
 * @param {object[]} entries a ledger
 * @param {{claude?: boolean|string, codex?: boolean|string}} availability
 * @returns {object|null}
 */
export function pickDeferred(entries, availability = {}) {
  return pendingEntries(entries).find((e) => companyServes(availability[e.needed])) ?? null;
}

/**
 * Append an entry. Idempotent per unit and kind: a pending entry of the same unit and kind is refreshed in place
 * (newer range, reviewer and author) instead of duplicated.
 * @param {string} project absolute project root
 * @param {{unit: string, kind: "review"|"audit", frd: string|null, sha_range: string, author: object, reviewer_used: object|null,
 *   degraded: "quota_90"|"unreachable"|"at_capacity"|"same_model"|null, needed: "claude"|"codex", created_at?: string}} input
 * @param {{fs?: object, env?: object, clock?: Function}} [deps]
 * @returns {Promise<{entry: object, created: boolean}>}
 * @throws INVALID_STATE when the entry does not match the schema
 */
export async function enqueueDeferred(project, input, deps = {}) {
  const entries = await readDeferred(project, deps);
  const twinAt = entries.findIndex((e) => e.status === "pending" && e.unit === input.unit && e.kind === input.kind);
  if (twinAt >= 0) {
    // One pending entry per unit and kind: a newer review of the same unit refreshes it (the older range is stale).
    const refreshed = { ...entries[twinAt], frd: input.frd ?? null, sha_range: input.sha_range, author: input.author, reviewer_used: input.reviewer_used ?? null, degraded: input.degraded ?? null, needed: input.needed };
    if (JSON.stringify(refreshed) !== JSON.stringify(entries[twinAt])) await writeDeferred(project, entries.map((e, i) => (i === twinAt ? refreshed : e)), deps);
    return { entry: refreshed, created: false };
  }
  const last = entries.reduce((max, e) => Math.max(max, Number(ID_RE.exec(e.id)?.[1] ?? 0)), 0);
  const entry = {
    id: `dr-${String(last + 1).padStart(4, "0")}`, unit: input.unit, kind: input.kind, frd: input.frd ?? null, sha_range: input.sha_range,
    author: input.author, reviewer_used: input.reviewer_used ?? null, degraded: input.degraded ?? null, needed: input.needed,
    created_at: input.created_at ?? nowIso(deps), status: "pending",
  };
  await writeDeferred(project, [...entries, entry], deps);
  return { entry, created: true };
}

/**
 * Mark a pending entry done and attach its result (the re-review's verdict summary).
 * @param {string} project
 * @param {string} id ledger id (`dr-0001`)
 * @param {{result: object}} outcome `result` is free-form, schema `{type: object}`
 * @param {object} [deps]
 * @returns {Promise<object>} the updated entry
 * @throws INVALID_STATE when the id is unknown or the entry is already done
 */
export async function completeDeferred(project, id, outcome, deps = {}) {
  const entries = await readDeferred(project, deps);
  const at = entries.findIndex((e) => e.id === id);
  if (at < 0) throw err("INVALID_STATE", `unknown deferred review ${id}`);
  if (entries[at].status !== "pending") throw err("INVALID_STATE", `deferred review ${id} is already done`);
  const entry = { ...entries[at], status: "done", result: outcome.result ?? {} };
  await writeDeferred(project, entries.map((e, i) => (i === at ? entry : e)), deps);
  return entry;
}

/**
 * The pending entry a `deferred-review` unit serves. Order: explicit id, the `u-deferred-review-<id>` naming,
 * the single pending entry of the unit's FRD, the only pending entry.
 * @param {object[]} entries a ledger
 * @param {{id: string, frd?: string|null}} unit state unit
 * @param {string|null} [explicitId]
 * @returns {object|null}
 */
export function entryForUnit(entries, unit, explicitId = null) {
  const pending = entries.filter((e) => e.status === "pending");
  const byId = (id) => pending.find((e) => e.id === id) ?? null;
  if (explicitId) return byId(explicitId);
  const named = entryIdOfUnit(unit.id);
  if (named) return byId(named);
  const sameFrd = unit.frd ? pending.filter((e) => e.frd === unit.frd) : [];
  if (sameFrd.length === 1) return sameFrd[0];
  return pending.length === 1 ? pending[0] : null;
}
