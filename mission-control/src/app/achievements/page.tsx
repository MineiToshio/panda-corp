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

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Chip } from "@/components/core/Chip/Chip";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
import { GuildHero } from "@/components/modules/GuildHero/GuildHero";
import { computeChains, computeSecrets, computeUniques } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { computeStats } from "@/lib/achievements/stats";
import { RANKS } from "@/lib/gamification/gamification";
import { getGuildState } from "@/lib/gamification/guildState";
import { readIdeas } from "@/lib/ideas/ideas";
import { HallTabs } from "./_components/HallTabs";

// ── Party roster ─────────────────────────────────────────────────────────────
const HALL_PARTY_ROLES: readonly AgentRole[] = [
  "researcher",
  "backend-dev",
  "frontend-dev",
  "test-writer",
  "reviewer",
] as const;

// ── Page (Server Component) ───────────────────────────────────────────────────

export default async function HallPage(): Promise<React.JSX.Element> {
  // ── Read phase (fail-soft, read-only) ────────────────────────────────────
  // Guild state (statuses + events + level) from THE single source of truth, so the
  // hero's level matches the header GuildBar and the Inicio dashboard exactly.
  const { statuses, eventsSnapshot, level: guildLevel } = getGuildState();
  const ideas = readIdeas();

  // ── Next rank title (for XpBar subtitle in GuildHero) ────────────────────
  const nextRankEntry = RANKS[guildLevel.level];
  const nextTitle = nextRankEntry?.title ?? guildLevel.title;

  // ── Build ReaderData for the achievements engine ──────────────────────────
  const readerData: ReaderData = { ideas, statuses, eventsSnapshot };

  // ── Derive all achievement data ───────────────────────────────────────────
  const statsRows = computeStats(readerData);
  const chains = computeChains(statsRows);
  const uniques = computeUniques(readerData);
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

  const featsCount = (eventsSnapshot?.events ?? []).filter(
    (e) => e.event === "achievement" || e.event === "end",
  ).length;

  const missionsActive = statuses.filter((s) => {
    if (!s.present || s.status === null) return false;
    return ["implementation", "build"].includes(s.status.phase ?? "");
  }).length;

  return (
    <PageLayout
      icon="ti-award"
      title="Logros"
      subtitle="El salón del gremio · tus hazañas, misiones, trofeos y la hoja de personaje de la fábrica."
      tail={<Chip tone="warn">{`${featsCount} hazañas`}</Chip>}
      testId="achievements-page"
    >
      {/* ── GuildHero character-sheet (AC-09-003.1..3, AC-09-004.1..5) ─────*/}
      <GuildHero
        level={guildLevel.level}
        title={guildLevel.title}
        xp={guildLevel.xp}
        next={guildLevel.next}
        pctToNext={guildLevel.pctToNext}
        nextTitle={nextTitle}
        featsCount={featsCount}
        trophiesCount={trophiesCount}
        trophiesTotal={trophiesTotal}
        missionsActive={missionsActive}
        partyRoster={HALL_PARTY_ROLES}
        statsLanzados={statsLanzados}
        statsRacha={statsRacha}
        statsVelocidad={statsVelocidad}
      />

      {/* ── 4-tab body: Resumen · Misiones · Trofeos · Estadísticas ─────── */}
      <HallTabs
        chains={chains}
        uniques={uniques}
        secrets={secrets}
        readerData={readerData}
        trophiesCount={trophiesCount}
        trophiesTotal={trophiesTotal}
      />
    </PageLayout>
  );
}
