import { t } from "./copy";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

const ABSOLUTE = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const ABSOLUTE_UTC = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Absolute short Spanish date, «19 oct. 2026». Date-only values are read in UTC so the day never shifts.
 * @returns the raw string unchanged when it can not be parsed: never a thrown error, never an invented date.
 */
export function formatDate(value: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return value;
  return (DATE_ONLY.test(value) ? ABSOLUTE_UTC : ABSOLUTE).format(ms);
}

/**
 * Relative Spanish age: «hoy · ayer · hace N días», «hace N min» and the hour forms.
 * @param then ISO timestamp or date-only value.
 * @param now ISO string (or instant) supplied by the caller; this module reads no clock.
 */
export function formatRelative(then: string, now: string | number | Date): string {
  const thenMs = Date.parse(then);
  const nowMs = typeof now === "string" ? Date.parse(now) : new Date(now).getTime();
  if (Number.isNaN(thenMs) || Number.isNaN(nowMs)) return t("common.relativeTime.noRecord");
  const elapsed = Math.max(0, nowMs - thenMs);
  if (DATE_ONLY.test(then)) {
    const days = Math.floor((Math.floor(nowMs / MS_DAY) * MS_DAY - thenMs) / MS_DAY);
    return dayLabel(Math.max(0, days));
  }
  if (elapsed < MS_HOUR)
    return t("common.build.minutesAgo", { minutes: Math.max(1, Math.floor(elapsed / MS_MINUTE)) });
  if (elapsed < MS_DAY) return t("common.build.hoursAgo", { hours: Math.floor(elapsed / MS_HOUR) });
  return dayLabel(Math.floor(elapsed / MS_DAY));
}

function dayLabel(days: number): string {
  if (days === 0) return t("common.relativeTime.today");
  if (days === 1) return t("common.relativeTime.yesterday");
  return t("common.relativeTime.days", { days });
}
