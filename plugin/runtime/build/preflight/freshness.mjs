// preflight/freshness.mjs: the key of a row and scope, and the reuse rule of a saved `build/preflight.json` (D19).
import path from "node:path";
import { resolveDeps } from "../card.mjs";
import { readJson } from "../fsx.mjs";
import { buildPaths } from "../paths.mjs";
import { asArray } from "./common.mjs";

/** `start --run` reuses a preflight at most this old (D19). */
export const PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Stable key of a row and scope, for the "same row and scope" reuse rule (D19).
 * @param {number} row detection row
 * @param {{card?: string|null, frds?: string[], wos?: string[]}} scope
 * @returns {string}
 */
export function scopeKey(row, scope) {
  return JSON.stringify({
    row,
    card: scope?.card ?? null,
    frds: [...asArray(scope?.frds)].sort(),
    wos: [...asArray(scope?.wos)].sort(),
  });
}

/**
 * Read `build/preflight.json` and say whether `start --run` may reuse it (at most 15 min old, same row and scope).
 * @param {{project: string, row: number, scope: object}} input
 * @param {object} [deps] see `resolveDeps` in card.mjs
 * @returns {Promise<{ok: true, preflight: object}|{ok: false, reason: "missing"|"stale"|"mismatch"}>}
 */
export async function loadFreshPreflight(input, deps = {}) {
  const ctx = resolveDeps(deps);
  const file = buildPaths(path.resolve(input.project), { env: ctx.env, homedir: ctx.homedir }).preflightFile;
  const saved = await readJson(file, { fs: ctx.fs });
  if (!saved || typeof saved !== "object") return { ok: false, reason: "missing" };
  const age = ctx.now() - Date.parse(saved.created_at);
  if (!Number.isFinite(age) || age > PREFLIGHT_MAX_AGE_MS || age < 0) return { ok: false, reason: "stale" };
  if (saved.scope_key !== scopeKey(input.row, input.scope)) return { ok: false, reason: "mismatch" };
  return { ok: true, preflight: saved };
}
