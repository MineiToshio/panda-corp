// Work-order index and the legal transition route (pure readers of an integration worktree).
import * as fsp from "node:fs/promises";
import path from "node:path";
import { err } from "./common.mjs";

/** Legal work-order transitions (mirror of build-state.mjs `applyWoTransition`; that function still enforces them). */
const WO_TRANSITIONS = Object.freeze({
  PLANNED: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["IN_REVIEW", "BLOCKED", "PLANNED"],
  IN_REVIEW: ["VERIFIED", "PLANNED", "BLOCKED"],
  BLOCKED: ["PLANNED"],
  VERIFIED: [],
});
/** Longest route the engine walks on its own (reopen and late-dispatch cases); VERIFIED is only ever reached directly. */
const MAX_ROUTE_STEPS = 2;

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;
const fmScalar = (block, key) => {
  const m = block.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "m"));
  return m ? m[1].replace(/^["']|["']$/g, "") : null;
};

/**
 * Index the work orders of a worktree: lowercase id (frontmatter `id`, file stem, and the `wo-NN-MMM` token of the stem)
 * -> `{id, file, frd, status}`.
 * @param {string} root worktree root
 * @returns {Promise<Map<string, {file: string, frd: string, status: string|null}>>} `file` is repo-relative with forward slashes
 */
export async function indexWorkOrders(root, fs) {
  const map = new Map();
  const frdsDir = path.join(root, "docs", "frds");
  let frds = [];
  try { frds = (await fs.readdir(frdsDir)).sort(); } catch (e) { if (e.code !== "ENOENT") throw e; }
  for (const frd of frds) {
    const dir = path.join(frdsDir, frd, "work-orders");
    let names = [];
    try { names = (await fs.readdir(dir)).sort(); } catch (e) { if (e.code !== "ENOENT") throw e; }
    for (const name of names) {
      if (!/^wo-.*\.md$/.test(name)) continue;
      const block = (await fs.readFile(path.join(dir, name), "utf8")).match(FM_BLOCK)?.[1] ?? "";
      const stem = name.replace(/\.md$/, "");
      const info = { id: fmScalar(block, "id") || stem, file: `docs/frds/${frd}/work-orders/${name}`, frd, status: fmScalar(block, "implementation_status") };
      const keys = [fmScalar(block, "id"), stem, stem.match(/^(wo-\d+-\d+)/)?.[1]];
      for (const k of keys) if (k && !map.has(k.toLowerCase())) map.set(k.toLowerCase(), info);
    }
  }
  return map;
}

/**
 * Locate a work order file inside a worktree.
 * @param {string} root worktree root
 * @param {string} woId work-order id, any case (`WO-05-002` or `wo-05-002`)
 * @returns {Promise<{id: string, file: string, frd: string, status: string|null}>} frontmatter id, repo-relative file, FRD folder slug, current `implementation_status`
 * @throws INVALID_STATE when no work order matches
 */
export async function findWorkOrder(root, woId, deps = {}) {
  const info = (await indexWorkOrders(root, deps.fs ?? fsp)).get(String(woId).toLowerCase());
  if (!info) throw err("INVALID_STATE", `work order ${woId} not found in ${root}`, { hint: "rebuild-state" });
  return info;
}

/**
 * Shortest legal chain of statuses from `from` to `to` (BFS over the work-order transition table), excluding `from`,
 * at most two steps and VERIFIED only directly (never a walk BLOCKED -> ... -> VERIFIED).
 * `IN_REVIEW -> IN_PROGRESS` is `[PLANNED, IN_PROGRESS]`, the patch path of D22.
 * @param {string} from current status
 * @param {string} to wanted status
 * @returns {string[]} empty when already there
 * @throws INVALID_STATE when `to` is unreachable (for example from VERIFIED)
 */
export function workOrderRoute(from, to) {
  if (from === to) return [];
  if (!Object.hasOwn(WO_TRANSITIONS, from) || !Object.hasOwn(WO_TRANSITIONS, to)) throw err("INVALID_STATE", `unknown work-order status ${from} or ${to}`);
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of WO_TRANSITIONS[cur]) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === to) {
        const route = [];
        for (let s = to; s !== from; s = prev.get(s)) route.unshift(s);
        if (route.length > MAX_ROUTE_STEPS || (to === "VERIFIED" && route.length > 1)) break;
        return route;
      }
      queue.push(next);
    }
  }
  throw err("INVALID_STATE", `illegal work-order transition ${from} -> ${to}`);
}
