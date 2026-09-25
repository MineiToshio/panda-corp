/**
 * formatChangeDate — Spanish relative label for a Changes-tab card's date
 * (REQ-04-011, WO-04-008).
 *
 * Pure, with an injected `now` (no hidden `Date.now()` — testable, matches the
 * `freshnessBand`/`isLive` pattern in `src/lib/status/liveness.ts`). Compares
 * via `Date.parse`, never lexicographically (LESSON-0009: producers don't all
 * share the same offset/precision).
 *
 * Fail-loud (DR-078): an empty or unparseable date returns an explicit
 * `{ ok: false }` result — never `null`/`""` — so the caller can fall back to
 * showing the raw string instead of silently hiding the date.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH_APPROX = 30;
const DAYS_PER_YEAR_APPROX = 365;

export type ChangeDateResult =
  | { readonly ok: true; readonly label: string }
  | { readonly ok: false; readonly error: string };

/**
 * Midnight (UTC) of the given instant, for whole-day diffing.
 *
 * UTC, not local time: a date-only frontmatter value (`"2026-09-24"`) parses
 * per ISO 8601 as UTC midnight, so diffing it against a local-midnight `now`
 * would shift by the runner's offset (e.g. UTC-5 turns "hoy" into "ayer").
 * Comparing both sides in UTC keeps the day boundary consistent everywhere.
 */
function startOfDay(instant: Date): number {
  return Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * @param date - The raw `ChangeQueueItem.date` string (frontmatter `date`, coerced
 *   to a trimmed string upstream by `src/lib/changes/changes.ts`).
 * @param now - The caller's clock, injected for purity/testability.
 */
export function formatChangeDate(date: string, now: Date): ChangeDateResult {
  const trimmed = date.trim();
  if (trimmed === "") {
    return { ok: false, error: "empty date" };
  }

  const stampMs = Date.parse(trimmed);
  if (!Number.isFinite(stampMs)) {
    return { ok: false, error: `unparseable date: "${date}"` };
  }

  const diffDays = Math.max(
    0,
    Math.round((startOfDay(now) - startOfDay(new Date(stampMs))) / MS_PER_DAY),
  );

  if (diffDays === 0) return { ok: true, label: "hoy" };
  if (diffDays === 1) return { ok: true, label: "ayer" };
  if (diffDays < DAYS_PER_MONTH_APPROX) {
    return { ok: true, label: `hace ${diffDays} días` };
  }
  if (diffDays < DAYS_PER_YEAR_APPROX) {
    const months = Math.round(diffDays / DAYS_PER_MONTH_APPROX);
    return { ok: true, label: `hace ${months} ${pluralize(months, "mes", "meses")}` };
  }
  const years = Math.round(diffDays / DAYS_PER_YEAR_APPROX);
  return { ok: true, label: `hace ${years} ${pluralize(years, "año", "años")}` };
}
