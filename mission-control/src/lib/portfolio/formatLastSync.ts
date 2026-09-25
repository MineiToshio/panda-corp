/**
 * Pure formatter for the portfolio row's "last sync" chip (FRD-03, REQ-03-007, WO-03-006).
 *
 * Turns a `PortfolioEntry.lastSync` date string into a Spanish relative label. Deliberately
 * NOT shared with `src/lib/changes/formatChangeDate.ts` (FRD-04's change-card formatter) —
 * distinct domains kept disjoint so the two work orders can build in the same wave (DR-060).
 *
 * Traceability: IF-03-formatLastSync → REQ-03-007 → AC-03-007.1, AC-03-007.2.
 */

/** Discriminated result — fails loud on an unparseable date (DR-078), never null/"". */
export type FormatLastSyncResult =
  | { readonly ok: true; readonly label: string }
  | { readonly ok: false; readonly reason: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH_BUCKET = 30;
const MONTHS_PER_YEAR = 12;

/**
 * The only accepted shape: ISO-8601 date, optionally with time, fraction and offset. `Date.parse`
 * is not a validator (outside this shape V8 turns prose like "N/A 3" into 2001-01-01 and reads
 * "07/09/2026" month-first), so the shape is checked before it ever runs.
 */
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** True when year/month/day name a real calendar day (rejects 2026-02-30, which Date.parse rolls over). */
function isRealCalendarDay(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Epoch ms of a strict ISO-8601 `raw` string, or `NaN` (like `Date.parse`) for anything else. */
function parseStrictIsoMs(raw: string): number {
  const match = ISO_DATE_TIME.exec(raw);
  if (!match) return Number.NaN;
  if (!isRealCalendarDay(Number(match[1]), Number(match[2]), Number(match[3]))) return Number.NaN;
  return Date.parse(raw);
}

/** Midnight UTC for the given date's calendar day (time-of-day dropped before diffing). */
function startOfDayUTC(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Formats `date` (an ISO-ish string, as stored in the portfolio table) as a Spanish relative
 * label measured against `now` (default: the real current time; inject a fixed value in tests).
 *
 * Elapsed-day buckets: 0 → "hoy", 1 → "ayer", 2..29 → "hace N días", 30..~359 → "hace N meses"
 * (singular "hace 1 mes"), beyond → "hace N años" (singular "hace 1 año").
 *
 * Compared via `Date.parse` (LESSON-0009), never lexicographic string comparison — the portfolio
 * table's producers do not guarantee a uniform offset/precision.
 *
 * A future `date` (clock skew between the machine that wrote the portfolio row and this one) is
 * clamped to "hoy" rather than surfaced as a negative or invalid duration.
 *
 * Fails loud (DR-078): anything that is not a strict ISO-8601 date on a real calendar day (prose,
 * dd/mm/yyyy, 2026-02-30) returns `{ ok: false, reason }`, never `null`/`""` or a fabricated age.
 */
export function formatLastSync(date: string, now: Date = new Date()): FormatLastSyncResult {
  const parsedMs = parseStrictIsoMs(date.trim());
  if (Number.isNaN(parsedMs)) {
    return { ok: false, reason: `No se pudo interpretar la fecha de sincronización: "${date}"` };
  }

  const dayDiff = Math.floor((startOfDayUTC(now) - startOfDayUTC(new Date(parsedMs))) / MS_PER_DAY);
  const days = Math.max(dayDiff, 0);

  if (days === 0) return { ok: true, label: "hoy" };
  if (days === 1) return { ok: true, label: "ayer" };
  if (days < DAYS_PER_MONTH_BUCKET) return { ok: true, label: `hace ${days} días` };

  const months = Math.floor(days / DAYS_PER_MONTH_BUCKET);
  if (months < MONTHS_PER_YEAR) {
    return { ok: true, label: months === 1 ? "hace 1 mes" : `hace ${months} meses` };
  }

  const years = Math.floor(months / MONTHS_PER_YEAR);
  return { ok: true, label: years === 1 ? "hace 1 año" : `hace ${years} años` };
}
