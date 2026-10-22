// Builds an FRD's work-order plan (ids, states, dependency chain, build times) from a
// compact description, so each project spec reads like a table instead of 50 objects.
import { addMinutes, hash, pad, rng, slugify } from "./common.mjs";

const STATE = { d: "done", r: "review", t: "todo", p: "in_progress", f: "fail" };

/**
 * @param {object} o
 * @param {number} o.n FRD number.
 * @param {string} o.slug Folder slug (frd-NN-...).
 * @param {string[]} o.titles Work-order titles, in order.
 * @param {string} o.states One letter per order: d done, r review, t todo, p in progress, f blocked.
 * @param {number[]} [o.ids] Explicit order numbers (defaults to 1..n).
 * @param {number|null} [o.from] Build start (ms) of the first order; null for an unbuilt plan.
 * @param {number} [o.every] Minutes between consecutive starts.
 * @param {Record<number,string[]>} [o.extraDeps] Extra upstream ids per order index.
 * @param {boolean} [o.chain] Each order depends on the previous one (default true).
 * @param {{verdict:string, after?:number}|null} [o.review] FRD gate after the last end.
 */
export function planFrd(o) {
  const r = rng(hash(o.slug));
  const ids = o.ids ?? o.titles.map((_, k) => k + 1);
  const every = o.every ?? 30;
  const wos = o.titles.map((title, k) => {
    const state = STATE[o.states[k]];
    if (!state) throw new Error(`${o.slug}: no state for order ${k + 1}`);
    const id = `WO-${pad(o.n)}-${pad(ids[k], 3)}`;
    const deps = [...(o.chain === false || k === 0 ? [] : [`WO-${pad(o.n)}-${pad(ids[k - 1], 3)}`]), ...(o.extraDeps?.[k] ?? [])];
    const timed = o.from != null && state !== "todo";
    const start = timed ? addMinutes(o.from, k * every + Math.round(r() * 6)) : null;
    const end = timed && state !== "in_progress" ? addMinutes(start, 6 + Math.round(r() * (every - 8 > 4 ? every - 8 : 4))) : null;
    return { n: ids[k], id, slug: slugify(title).slice(0, 48).replace(/-$/, ""), title, state, deps, start, end, ...(o.overrides?.[k] ?? {}) };
  });
  const ends = wos.map((w) => w.end).filter((x) => x != null);
  const last = ends.length ? Math.max(...ends) : null;
  const review = o.review && last != null ? { verdict: o.review.verdict, start: addMinutes(last, o.review.after ?? 12), end: addMinutes(last, (o.review.after ?? 12) + (o.review.minutes ?? 40)) } : null;
  return { ...o, wos, review };
}
