import { expect, it } from "vitest";
import { t } from "@/lib/copy/copy";
import { formatSignalAge } from "../signal-age";

it("AC-06-020.6: signal ages switch from minutes to whole hours at sixty minutes", () => {
  expect(formatSignalAge(null)).toBe(t("common.build.noEvents"));
  expect(formatSignalAge(59)).toBe(t("common.build.minutesAgo", { minutes: 59 }));
  expect(formatSignalAge(60)).toBe(t("common.build.hoursAgo", { hours: 1 }));
  expect(formatSignalAge(119)).toBe(t("common.build.hoursAgo", { hours: 1 }));
  expect(formatSignalAge(120)).toBe(t("common.build.hoursAgo", { hours: 2 }));
});
