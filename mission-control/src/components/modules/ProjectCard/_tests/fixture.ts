import type { ProjectOverviewItem } from "@/lib/portfolio/overview";

export const PROJECT = {
  id: "alpha",
  name: "Alpha Project",
  path: "/projects/alpha",
  phase: "implementation",
  stageIndex: 5,
  source: {
    name: "Alpha Project",
    path: "/projects/alpha",
    exists: true,
    stage: "implementation",
    status: { present: false, malformed: false, status: null },
  },
  pathMissing: false,
  build: { kind: "idle", lastSignalAt: null, ageMinutes: null },
  nowIso: "2026-10-30T12:00:00Z",
  lastCommit: { at: "2026-10-30T10:00:00Z" },
  counts: {
    ordersVerified: 2,
    ordersTotal: 5,
    frds: 3,
    docs: 8,
    adrs: 1,
    openChanges: 2,
    pendingDecisions: 4,
  },
  nextCommand: "/pandacorp:implement",
} satisfies ProjectOverviewItem;
