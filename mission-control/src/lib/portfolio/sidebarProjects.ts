import { setImmediate } from "node:timers/promises";
import { cache } from "react";
import { resolveFactoryRoot } from "@/lib/config/config";
import { getProjectOverview, type ProjectOverviewItem } from "./overview";

const CACHE_MS = 5_000;
let recent: { key: string; expires: number; value: Promise<ProjectOverviewItem[]> } | undefined;

/** Deferred canonical overview, shared across shell refreshes for five seconds. */
export const getSidebarProjects = cache((): Promise<ProjectOverviewItem[]> => {
  const key = JSON.stringify([
    resolveFactoryRoot(),
    process.env.MC_GIT_FIXTURE,
    process.env.MC_CLOCK,
  ]);
  if (recent?.key === key && Date.now() < recent.expires) return recent.value;
  const value = setImmediate().then(() => getProjectOverview());
  const entry = { key, expires: Number.POSITIVE_INFINITY, value };
  recent = entry;
  void value.then(
    () => {
      entry.expires = Date.now() + CACHE_MS;
    },
    () => {
      if (recent === entry) recent = undefined;
    },
  );
  return value;
});
