/**
 * formatChangeDate — Spanish relative label for a Changes-tab card's date
 * (REQ-04-011, WO-04-008).
 *
 * Pure, with an injected `now` (no hidden `Date.now()` — testable, matches the
 * `freshnessBand`/`isLive` pattern in `src/lib/status/liveness.ts`). Compares
 * calendar days numerically, never timestamp strings lexicographically
 * (LESSON-0009: producers don't all share the same offset/precision).
 *
 * "hoy"/"ayer" mean the VIEWER's local calendar day: a date-only value is the
 * calendar day as written (the owner writes it in their local day), a
 * timestamp is reduced to the local day it falls on, and `now` to the local
 * day it falls on — so a change filed today never reads "ayer" in the evening
 * of a UTC-5 viewer, nor yesterday's "hoy" in the morning of a UTC+9 one.
 *
 * Fail-loud (DR-078): an empty date, anything that is not a strict ISO-8601
 * date (prose, dd/mm/yyyy — `Date.parse` alone would invent a date from those)
 * or an impossible calendar day (2026-02-30, which `Date.parse` rolls over)
 * returns an explicit `{ ok: false }` result — never `null`/`""` or a
 * fabricated age — so the caller shows the raw string instead.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH_APPROX = 30;
const DAYS_PER_YEAR_APPROX = 365;

export type ChangeDateResult =
  | { readonly ok: true; readonly label: string }
  | { readonly ok: false; readonly error: string };

/** The only accepted shape: ISO-8601 date, optionally with time, fraction and offset. */
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

const DATE_ONLY_LENGTH = "YYYY-MM-DD".length;

/**
 * A calendar day as a comparable key (epoch ms of that day's UTC midnight).
 * UTC here only encodes the day numerically; which day it is was decided by
 * the caller (as written, or the viewer's local day).
 */
function dayKey(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day);
}

/** The viewer's local calendar day that `instant` falls on. */
function localDayKey(instant: Date): number {
  return dayKey(instant.getFullYear(), instant.getMonth(), instant.getDate());
}

/** True when year/month/day name a real calendar day (rejects 2026-02-30). */
function isRealCalendarDay(year: number, month: number, day: number): boolean {
  const probe = new Date(dayKey(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Day key of a strict ISO-8601 `raw` string, or `NaN` for anything else. A
 * date-only value is the calendar day as written (never parsed as UTC
 * midnight); a timestamp is the viewer's local day of the instant it names.
 */
function parseStampDay(raw: string): number {
  const match = ISO_DATE_TIME.exec(raw);
  if (!match) return Number.NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealCalendarDay(year, month, day)) return Number.NaN;
  if (raw.length === DATE_ONLY_LENGTH) return dayKey(year, month - 1, day);
  const stampMs = Date.parse(raw);
  return Number.isFinite(stampMs) ? localDayKey(new Date(stampMs)) : Number.NaN;
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

  const stampDay = parseStampDay(trimmed);
  if (!Number.isFinite(stampDay)) {
    return { ok: false, error: `unparseable date: "${date}"` };
  }

  const diffDays = Math.max(0, Math.round((localDayKey(now) - stampDay) / MS_PER_DAY));

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
