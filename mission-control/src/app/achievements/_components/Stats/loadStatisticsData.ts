import path from "node:path";
import { cache } from "react";
import { STATS_AGGREGATE_FILENAME } from "@/lib/achievements/read-model/aggregate";
import { resolvePortadaFromAggregate } from "@/lib/achievements/read-model/aggregateConsumer";
import { readStatsFactory } from "@/lib/achievements/read-model/factoryStoreReader";
import { resolveInformeSources } from "@/lib/achievements/read-model/informeResolver";
import { readStatsAggregate } from "@/lib/achievements/read-model/statsReader";
import { ideasSeries, weeklyFlow } from "@/lib/achievements/report/flowSeries";
import { funnelAndFlow } from "@/lib/achievements/report/funnel";
import { lessonCounts } from "@/lib/achievements/report/lessons";
import { phaseTransitions } from "@/lib/achievements/report/phaseTransitions";
import { reportScalars } from "@/lib/achievements/report/scalars";
import { recordedKinds } from "@/lib/achievements/report/statProvenance";
import { usageMix } from "@/lib/achievements/report/usage";
import { signalsFor } from "@/lib/achievements/signals";
import type { ReaderData } from "@/lib/achievements/stats";
import { resolveFactoryRoot } from "@/lib/config/config";
import { eventSourceHealth } from "@/lib/events/eventSourceHealth";
import { readEvents } from "@/lib/events/events";
import { getGuildState } from "@/lib/gamification/guildState";
import { durableEvents, readLedger } from "@/lib/gamification/ledger";
import { readIdeas } from "@/lib/ideas/ideas";
import { buildInformeData } from "../../Informe/informeData";

/** Request-scoped adapter over the existing report readers and Informe assembly. */
export const loadStatisticsData = cache(() => {
  const { statuses, outcomes } = getGuildState();
  const ideas = readIdeas();
  // Achievements read the FULL event stream (uncapped) so only-grow counters stay
  // honest — the guild level keeps getGuildState's tail (FRD-09 unchanged).
  const eventsSnapshot = readEvents({ cap: 100_000 });

  // The hero's XP bar reads toward the next LEVEL now (rank = a band of levels),
  // so the subtitle is just the current rank title (aria/flavor).

  // ── Build ReaderData for the achievements engine ──────────────────────────
  const readerData: ReaderData = {
    ideas,
    statuses,
    eventsSnapshot,
    durableEvents: durableEvents(readLedger()),
    workOrdersDoneLive: outcomes.workOrdersDone,
  };

  // ── Informe operativo report data (WO-10-015 consumes WO-10-014 readers) ───
  // Mission Control's own repo is the project whose git history backs the series;
  // it lives at the process cwd (it shares the factory .git one level up — see CLAUDE.md).
  const projectPath =
    process.env.MC_GIT_FIXTURE === undefined
      ? process.cwd()
      : path.resolve(resolveFactoryRoot(), "../projects/mission-control");
  const reportSignals = signalsFor(readerData);
  // FRD-23: read the Informe numbers from the O(1) AGGREGATE index first (AC-23-003.1 clause b) —
  // one file read of `<factory-root>/.pandacorp/stats-aggregate.json`, independent of N projects.
  // `readPortadaViaAggregate` seal-validates the current project's entry and falls back to the
  // per-project portada (WO-23-003) on any non-usable outcome; `resolveInformeSources` then falls
  // back to the live git readers (WO-10-014, unchanged) on ANY non-`ok` result — missing / stale /
  // corrupt all fall back (REQ-23-001). MC's project key is its portfolio path cell ("mission-control").
  // `getPendingMerge` is a separate module and stays live (AC-23-005.1, untouched).
  const factoryRoot = resolveFactoryRoot();
  const aggregatePath = path.join(factoryRoot, ".pandacorp", STATS_AGGREGATE_FILENAME);
  const portadaResult = resolvePortadaFromAggregate(
    readStatsAggregate(aggregatePath),
    "mission-control",
    projectPath,
  );
  // FRD-23 SSOT split (REQ-23-006/007): factory-wide facts come from the factory-scoped store
  // (validated by the FACTORY seal), independently seal-validated and independently falling back to
  // the live cores. A phase change in ANOTHER project mismatches the factory seal → this project's
  // Informe re-derives the factory-wide facts live instead of serving a stale cross-project copy
  // (AC-23-007.3). Per-project facts stay sourced from the portada above.
  const factoryResult = readStatsFactory(factoryRoot);
  const informeSources = resolveInformeSources(
    portadaResult,
    {
      weeklyFlow: () => weeklyFlow(projectPath),
      ideasSeries: () => ideasSeries(),
      phaseTransitions: () => phaseTransitions(),
      scalars: () => reportScalars(projectPath),
      lessons: () => lessonCounts(),
      funnel: () => funnelAndFlow(ideas, statuses),
    },
    factoryResult,
  );
  const reportScalarsValue = informeSources.scalars;
  const lessons = informeSources.lessons;
  const usageHealth = eventSourceHealth();
  const counterKinds = [...recordedKinds(readerData)];
  const usageResult = { ok: true as const, value: usageMix(readerData) };
  const informeData = buildInformeData({
    weeklyFlow: informeSources.weeklyFlow,
    usage: usageResult,
    funnel: informeSources.funnel,
    transitions: informeSources.phaseTransitions,
    statuses,
    lessons,
    relaunches: reportSignals.relaunches,
  });
  const statsRecords = {
    peakWeek: informeData.weeklyFlow.ok ? informeData.weeklyFlow.value.peakWeek : null,
    capturedLessons: lessons?.captured ?? null,
    subagents: reportSignals.subagents,
  };

  return {
    readerData,
    informeData,
    statsScalars: reportScalarsValue,
    statsRecords,
    usageHealth,
    counterKinds,
  };
});
