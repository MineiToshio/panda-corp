import type { IconName } from "@/components/core/Icon/iconData";

const STAT_ICONS = {
  shipped: "rocket",
  workorders: "clipboard",
  phases: "stairs",
  builds: "factory",
  subagents: "users",
  ideas: "bulb",
  discarded: "trash",
  prds: "file",
  adrs: "book",
  flawless: "diamond",
  gates: "shield",
  reviews: "eye",
  findings: "search",
  agents: "users",
  modes: "layers",
  iterations: "rotate",
  streak: "flame",
  activedays: "clock",
  speed: "bolt",
  peak: "trophy",
  lessons: "book",
  frds: "layers",
  commits: "branch",
  projects: "folder",
  testsPassing: "check",
  decisions: "flag",
} as const satisfies Record<string, IconName>;

/** The shared mission and statistics symbol for a factory metric. */
export function statIcon(key: string): IconName {
  return isStatIconKey(key) ? STAT_ICONS[key] : "star";
}

function isStatIconKey(key: string): key is keyof typeof STAT_ICONS {
  return Object.hasOwn(STAT_ICONS, key);
}
