import { t } from "@/lib/copy/copy";
/** Signal ages keep minute precision below one hour and use whole hours thereafter. */
export function formatSignalAge(ageMinutes: number | null): string {
  if (ageMinutes === null) return t("common.build.noEvents");
  return ageMinutes >= 60
    ? t("common.build.hoursAgo", { hours: Math.floor(ageMinutes / 60) })
    : t("common.build.minutesAgo", { minutes: ageMinutes });
}
