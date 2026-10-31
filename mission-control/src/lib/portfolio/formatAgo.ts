import { t } from "@/lib/copy/copy";

/** Project catalogue ages use hours below two days, then whole days. */
export function formatAgo(then: string | null, now: Date): string {
  const stamp = then === null ? Number.NaN : Date.parse(then);
  if (!Number.isFinite(stamp)) return t("common.relativeTime.noRecord");
  const hours = Math.max(0, Math.floor((now.getTime() - stamp) / 3_600_000));
  if (hours < 1) return t("common.relativeTime.lessThanHour");
  if (hours < 48) return t("common.relativeTime.hours", { hours });
  return t("common.relativeTime.days", { days: Math.floor(hours / 24) });
}
