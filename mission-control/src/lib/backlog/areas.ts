import type { BacklogItem } from "./backlog";

const AREA_KEYS = {
  "build-engine": "buildEngine",
  "plugin-skill": "pluginSkill",
  templates: "templates",
  hooks: "hooks",
  "plugin-hooks": "hooks",
  standards: "standards",
  "mission-control": "missionControl",
  "plugin-agent": "pluginAgent",
  plugin: "plugin",
} as const;

/** Shared catalogue key for a factory area, or the fallback for unknown area codes. */
export type BacklogAreaKey = (typeof AREA_KEYS)[keyof typeof AREA_KEYS] | "other";

/** Resolve raw factory area codes to shared catalogue leaves, including unknown codes. */
export function backlogAreaKey(area: string): BacklogAreaKey {
  return Object.hasOwn(AREA_KEYS, area) ? AREA_KEYS[area as keyof typeof AREA_KEYS] : "other";
}

/** Count merged areas, ordered by descending count then catalogue key. */
export function countByArea(
  items: readonly Pick<BacklogItem, "area">[],
): { key: BacklogAreaKey; count: number }[] {
  const counts = new Map<BacklogAreaKey, number>();
  for (const item of items) {
    const key = backlogAreaKey(item.area);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
