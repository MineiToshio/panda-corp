/**
 * Chronological comparison for event `at` timestamps (stream hygiene, 2026-07-07).
 *
 * Pure module — no I/O, no node built-ins — so both the server event reader
 * (`lib/events/events.ts`) and client live shells (`PartyLiveShell`) can import it
 * without pulling `fs` into the client bundle.
 *
 * WHY: the engine now mixes second-precision stamps (`2026-07-07T10:00:00Z`) with
 * millisecond-precision ones (`2026-07-07T10:00:00.500Z`). Lexicographic string
 * order breaks on these — `"…00.500Z" < "…00Z"` because `.` (0x2E) sorts before
 * `Z` (0x5A) — so a LATER millisecond event would compare as OLDER than an
 * earlier whole-second one, freezing "lastEventAt" on a stale value. Normalising
 * through `Date.parse` (epoch ms) restores true chronological order.
 */

/**
 * True when timestamp `a` is chronologically strictly newer than `b`.
 *
 * Both values are normalised via `Date.parse` so mixed second/millisecond
 * precisions (and timezone offsets) order correctly. When either value is
 * unparseable we fall back to the lexicographic compare — never throws.
 *
 * @param a - Candidate timestamp (ISO 8601).
 * @param b - Baseline timestamp (ISO 8601).
 */
export function isNewerTimestamp(a: string, b: string): boolean {
  const am = Date.parse(a);
  const bm = Date.parse(b);
  if (!Number.isNaN(am) && !Number.isNaN(bm)) {
    // Equal instants (e.g. `…00Z` vs `…00.000Z`, or an offset that resolves to
    // the same UTC time) are NOT strictly newer than each other.
    return am > bm;
  }
  return a > b; // one/both unparseable → best-effort lexicographic
}
