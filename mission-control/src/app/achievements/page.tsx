/**
 * CMP-10-hall-page — Achievements Hall page (WO-10-005 re-styled)
 *
 * 4-tab layout (Resumen · Misiones · Trofeos · Estadísticas) matching the
 * prototype logrosView() + logrosTabs() structure.
 *
 * Server Component: reads factory data, pre-computes all achievement data,
 * passes to HallTabs client shell. The tab shell handles active-tab state;
 * each tab body is pure server-renderable content passed as props.
 *
 * Architecture §11 surface: app/achievements
 *
 * Golden rule (architecture §1): read-only, never calls Claude.
 * Read chain: readPortfolio → readStatus → readEvents → readIdeas →
 *             deriveGuildOutcomes → computeGuildLevel → render.
 *
 * Traceability:
 *   AC-10-005.1 — hero: guild level/XP + party avatars + tabs
 *   AC-10-005.2 — stats panel with counters + tier medals
 *   AC-10-005.3 — tabular-nums on numbers; XP bar reuses CMP-09-xp-bar (honest)
 *   AC-10-005.4 — empty factory → honest zeros, no fabricated trophies (negative AC)
 *   AC-10-005.5 — design tokens only; Spanish labels/aria; keyboard nav; focus
 *   AC-10-006.1..5 — ChainCard RPG visual via HallTabs Misiones tab
 *   AC-10-007.1..4 — UniquesSection via HallTabs Trofeos tab
 *   AC-10-008.1..4 — SecretsPanel via HallTabs Trofeos tab (secretos)
 *
 * Blueprint: CMP-10-hall-page, CMP-10-stats-panel
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import path from "node:path";
import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Chip } from "@/components/core/Chip/Chip";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
import { GuildHero } from "@/components/modules/GuildHero/GuildHero";
import { computeChains, computeSecrets, computeUniques } from "@/lib/achievements/achievements";
import { STATS_AGGREGATE_FILENAME } from "@/lib/achievements/read-model/aggregate";
import { resolvePortadaFromAggregate } from "@/lib/achievements/read-model/aggregateConsumer";
import { readStatsFactory } from "@/lib/achievements/read-model/factoryStoreReader";
import { resolveInformeSources } from "@/lib/achievements/read-model/informeResolver";
import { readStatsAggregate } from "@/lib/achievements/read-model/statsReader";
import { weeklyFlow } from "@/lib/achievements/report/flowSeries";
import { funnelAndFlow } from "@/lib/achievements/report/funnel";
import { lessonCounts } from "@/lib/achievements/report/lessons";
import { phaseTransitions } from "@/lib/achievements/report/phaseTransitions";
import { reportScalars } from "@/lib/achievements/report/scalars";
import { usageMix } from "@/lib/achievements/report/usage";
import { signalsFor } from "@/lib/achievements/signals";
import type { ReaderData } from "@/lib/achievements/stats";
import { computeStats } from "@/lib/achievements/stats";
import { resolveFactoryRoot } from "@/lib/config/config";
import { readEvents } from "@/lib/events/events";
import { getGuildState } from "@/lib/gamification/guildState";
import { readIdeas } from "@/lib/ideas/ideas";
import { HallTabs } from "./_components/HallTabs";
import { buildInformeData } from "./Informe/informeData";

// ── Party roster (prototype logrosHero roster — 6 agents) ──────────────────────
const HALL_PARTY_ROLES: readonly AgentRole[] = [
  "product-manager",
  "architect",
  "backend-dev",
  "frontend-dev",
  "designer",
  "reviewer",
] as const;

// ── Page (Server Component) ───────────────────────────────────────────────────

export default async function HallPage(): Promise<React.JSX.Element> {
  // ── Read phase (fail-soft, read-only) ────────────────────────────────────
  // Guild state (statuses + events + level) from THE single source of truth, so the
  // hero's level matches the header GuildBar and the Inicio dashboard exactly.
  const { statuses, level: guildLevel, liveOutcomes } = getGuildState();
  const ideas = readIdeas();
  // Achievements read the FULL event stream (uncapped) so only-grow counters stay
  // honest — the guild level keeps getGuildState's tail (FRD-09 unchanged).
  const eventsSnapshot = readEvents({ cap: 100_000 });

  // The hero's XP bar reads toward the next LEVEL now (rank = a band of levels),
  // so the subtitle is just the current rank title (aria/flavor).
  const nextTitle = guildLevel.title;

  // ── Build ReaderData for the achievements engine ──────────────────────────
  const readerData: ReaderData = {
    ideas,
    statuses,
    eventsSnapshot,
    workOrdersDoneLive: liveOutcomes.workOrdersDone,
  };

  // ── Informe operativo report data (WO-10-015 consumes WO-10-014 readers) ───
  // Mission Control's own repo is the project whose git history backs the series;
  // it lives at the process cwd (it shares the factory .git one level up — see CLAUDE.md).
  const projectPath = process.cwd();
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
      phaseTransitions: () => phaseTransitions(),
      scalars: () => reportScalars(projectPath),
      lessons: () => lessonCounts(),
      funnel: () => funnelAndFlow(ideas, statuses),
    },
    factoryResult,
  );
  const reportScalarsValue = informeSources.scalars;
  const lessons = informeSources.lessons;
  // Fail-loud usage band (AC-10-015.3): an absent event stream → "no cableado". Usage is not
  // part of the materialized portada (blueprint §4) — it stays on its own live derivation.
  const usageResult: ReturnType<typeof buildInformeData>["usage"] =
    eventsSnapshot.events.length === 0 && eventsSnapshot.lastEventAt === null
      ? { ok: false, reason: "git-unavailable" }
      : { ok: true, value: usageMix(readerData) };
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
    peakWeek: informeData.weeklyFlow.ok ? informeData.weeklyFlow.value.peakWeek : 0,
    capturedLessons: lessons?.captured ?? 0,
    subagents: reportSignals.subagents,
  };

  // ── Derive all achievement data ───────────────────────────────────────────
  // `Date.now()` is the server render clock — injected so the NUEVO badge (isNew)
  // is derived from the real unlock date, keeping computeUniques pure.
  const statsRows = computeStats(readerData);
  const chains = computeChains(statsRows);
  const uniques = computeUniques(readerData, Date.now());
  const secrets = computeSecrets(readerData);

  // ── GuildHero stats ───────────────────────────────────────────────────────
  const shippedStat = statsRows.find((s) => s.key === "shipped");
  const streakStat = statsRows.find((s) => s.key === "streak");
  const speedStat = statsRows.find((s) => s.key === "speed");
  const statsLanzados = shippedStat?.value ?? 0;
  const statsRacha = streakStat?.value ?? 0;
  // Récord idea→launch (días, lower-is-better): the honest "speed" stat computed by
  // computeStats() from speed:<days> achievement events. 0 = no record yet (null state),
  // never a fabricated value (FRD-10 honesty contract). Same source the Estadísticas tab uses.
  const statsVelocidad = speedStat?.value ?? 0;

  const trophiesCount = uniques.filter((u) => u.unlocked).length;
  const trophiesTotal = uniques.length;

  // Counts (prototype logrosCounts): tiers = Σ(currentTierIndex+1) across chains;
  // hazañas = tiers + trophies; misiones en curso = chains with a next tier.
  const tiersReached = chains.reduce((n, c) => n + (c.currentTierIndex + 1), 0);
  const missionsActive = chains.filter((c) => c.nextTier !== null).length;
  const featsCount = tiersReached + trophiesCount;

  return (
    <PageLayout
      icon="ti-award"
      title="Logros"
      subtitle="El salón del gremio · tus hazañas, misiones, trofeos y la hoja de personaje de la fábrica."
      tail={<Chip tone="warn">{`${featsCount} hazañas`}</Chip>}
      testId="achievements-page"
    >
      {/* ── 4-tab body: Resumen (hero + quests + vitrina) · Misiones · Trofeos · Estadísticas.
          The GuildHero lives ONLY inside the Resumen tab (prototype logrosResumen); the
          persistent guild level is the header GuildBar. ───────────────────────────── */}
      <HallTabs
        chains={chains}
        uniques={uniques}
        secrets={secrets}
        readerData={readerData}
        informeData={informeData}
        statsScalars={reportScalarsValue}
        statsRecords={statsRecords}
        trophiesCount={trophiesCount}
        trophiesTotal={trophiesTotal}
        missionsActive={missionsActive}
        level={guildLevel}
        hero={
          <GuildHero
            level={guildLevel.level}
            title={guildLevel.title}
            xp={guildLevel.xp}
            next={guildLevel.next}
            pctToNext={guildLevel.pctToNext}
            nextTitle={nextTitle}
            rankIcon={guildLevel.icon}
            rankSprite={guildLevel.sprite}
            rankGrade={guildLevel.grade}
            featsCount={featsCount}
            trophiesCount={trophiesCount}
            trophiesTotal={trophiesTotal}
            missionsActive={missionsActive}
            partyRoster={HALL_PARTY_ROLES}
            statsLanzados={statsLanzados}
            statsRacha={statsRacha}
            statsVelocidad={statsVelocidad}
          />
        }
      />
    </PageLayout>
  );
}
