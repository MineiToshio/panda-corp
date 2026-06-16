/**
 * WO-12-001 — `topN` cap helper (IF-12-topn).
 *
 * Pure bounded-ranking helper. The single enforced top-5 cap for any
 * grouping or ranking in Mission Control (AC-12-004.1, REQ-12-004).
 *
 * Contract:
 *   topN<T>(items: T[], n?: number): T[]
 *   - Default cap: 5 (the REQ-12-004 invariant).
 *   - Preserves input order — returns the first N items.
 *   - Returns an independent shallow copy (mutations don't alias the source).
 *   - Invalid n (NaN, negative) falls back to default 5 or 0 respectively.
 *     Infinity → treated as "all items" (returns slice of full length).
 *   - Never throws regardless of input shape.
 *
 * Regression anchors:
 *   B1' (WO-13-001): typeof NaN === "number" — must use Number.isFinite
 *     before applying n; NaN → fallback to DEFAULT_TOPN.
 *   I3  (WO-13-001): array-shaped T must not confuse generic slice logic.
 *   FREEZE-ON-RED: must never throw.
 *
 * Traceability: AC-12-004.1 → REQ-12-004 → IF-12-topn → WO-12-001.
 */

/** The default cap enforcing the top-5 invariant (REQ-12-004). */
const DEFAULT_TOPN = 5;

/**
 * Return the first `n` items of `items`, enforcing the top-5 cap by default.
 *
 * @param items - The ranked list to cap. The function does not sort; the
 *                caller is responsible for pre-sorting if a ranking is needed.
 * @param n     - Maximum number of items to return. Defaults to 5.
 *                - NaN → falls back to DEFAULT_TOPN (5).
 *                - Infinity → returns all items (min(∞, length) = length).
 *                - Negative → 0 (no items).
 *                - Zero → [] (boundary).
 * @returns An independent shallow slice of at most `n` items.
 */
export function topN<T>(items: T[], n?: number): T[] {
  // Resolve the effective cap.
  const cap = resolveN(n);

  // slice(0, cap) is safe even when cap > items.length (returns all).
  // Array.prototype.slice always returns a new array, so no aliasing.
  return items.slice(0, cap);
}

/**
 * Resolve the `n` parameter to a safe non-negative integer.
 *
 * Rules (regression anchor B1'):
 *   - undefined       → DEFAULT_TOPN (5)
 *   - NaN             → DEFAULT_TOPN (5); must use Number.isFinite
 *   - +Infinity       → Infinity passed to slice → slice treats as length
 *                        (effectively returns all items, no throw)
 *   - -Infinity       → 0 (clamp)
 *   - negative finite → 0 (clamp)
 *   - zero            → 0 (boundary, explicit)
 *   - positive finite → Math.trunc(n) (truncate floats)
 */
function resolveN(n: number | undefined): number {
  if (n === undefined) {
    return DEFAULT_TOPN;
  }
  if (Number.isNaN(n)) {
    // B1' regression: NaN must not silently produce [] via slice(0, NaN).
    return DEFAULT_TOPN;
  }
  if (n === Number.POSITIVE_INFINITY) {
    // Infinity → return all items. slice(0, Infinity) returns the full array.
    return Number.POSITIVE_INFINITY;
  }
  if (n === Number.NEGATIVE_INFINITY || n < 0) {
    return 0;
  }
  // Finite non-negative: truncate to integer.
  return Math.trunc(n);
}
