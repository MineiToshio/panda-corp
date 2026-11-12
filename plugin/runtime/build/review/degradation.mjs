// review-record degradation: which units a review judges, who authored them, and whether the review was degraded.
import { MODEL_STRENGTH, reviewCell } from "../routing.mjs";
import { findUnit } from "../state.mjs";
import { REVIEWED_FROM } from "./common.mjs";

const AVAILABILITY_LEVELS = ["ok", "quota", "unreachable", "at_capacity"];

const isWorkUnit = (u) => u.kind === "build" || u.kind === "patch";

/**
 * The build and patch units a review unit judges: its `depends_on` work units, else the same FRD's integrated or
 * verified ones (an audit judges every such unit of the run).
 * @param {object} state
 * @param {object} review the review-type unit
 * @returns {object[]}
 */
export function reviewedUnits(state, review) {
  const named = (review.depends_on ?? []).map((id) => findUnit(state, id)).filter((u) => u && isWorkUnit(u));
  if (named.length > 0) return named;
  return state.units.filter((u) => isWorkUnit(u) && REVIEWED_FROM.includes(u.state) && (review.kind === "audit" || (review.frd && u.frd === review.frd)));
}

/** Author cells (the dispatch cells) of the reviewed units, deduplicated. */
export function authorsOf(units) {
  const seen = new Map();
  for (const u of units) {
    if (!u.worker) continue;
    const author = { runtime: u.worker.runtime, model: u.worker.model, effort: u.worker.effort ?? null, via: u.worker.via };
    seen.set(`${author.runtime}/${author.model}/${author.effort}/${author.via}`, author);
  }
  return [...seen.values()];
}

const sameCell = (a, b) => a.runtime === b.runtime && a.model === b.model && a.effort === b.effort;
export const asSchemaCell = (cell) => ({ runtime: cell.runtime, model: cell.model, effort: cell.effort ?? "high" });

function availabilityCandidates(hint) {
  const combos = [];
  for (const claude of AVAILABILITY_LEVELS.filter((l) => l !== "at_capacity")) for (const codex of AVAILABILITY_LEVELS) combos.push({ claude, codex });
  const weight = (c) => (c.claude !== "ok") + (c.codex !== "ok");
  combos.sort((a, b) => weight(a) - weight(b));
  return hint ? [hint, ...combos] : combos;
}

/** Keep only the quota picture's claude/codex fields. */
export const normalizeHint = (a) => (a ? { claude: a.claude, codex: a.codex } : undefined);

/**
 * Was this review degraded? Replays the BUILD-10 matrix (routing.mjs `reviewCell`, never a local copy) over the
 * availabilities that could have applied, fewest degradations first, and returns the first whose reviewer cell is the
 * one that actually reviewed. All companies available is tried first, so a primary reviewer is never degraded.
 * @param {{authors: object[], kind: "frd"|"touch", zone: string, reviewer: object, hint?: object, shapes?: Array<string|undefined>}} input
 * @param {object} [deps] `deps.tiers` replaces model-tiers.json (tests)
 * @returns {{matched: boolean, degraded: string|null, deferred: object|null, primary: object|null, row: number|null}}
 */
export function inferDegradation({ authors, kind, zone, reviewer, hint, shapes = [undefined] }, deps = {}) {
  if (authors.length === 0) return { matched: true, degraded: null, deferred: null, primary: null, row: null };
  for (const shape of shapes) {
    for (const availability of availabilityCandidates(hint)) {
      let result;
      try { result = (deps.routing?.reviewCell ?? deps.reviewCell ?? reviewCell)({ authors, kind, zone, availability, ...(shape ? { shape } : {}) }, deps); } catch (error) {
        if (error?.code === "ROUTING") continue;
        throw error;
      }
      if (result.used && sameCell(result.used, reviewer)) return { matched: true, degraded: result.degraded, deferred: result.deferred, primary: result.primary, row: result.row };
    }
  }
  return { matched: false, degraded: null, deferred: null, primary: null, row: null };
}

export const strongestAuthor = (authors) => authors.reduce((best, a) => ((MODEL_STRENGTH[a.model] ?? 0) > (MODEL_STRENGTH[best.model] ?? 0) ? a : best));
