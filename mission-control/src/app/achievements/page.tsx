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
import { getGuildState } from "@/lib/gamification/guildState";
import { readIdeas } from "@/lib/ideas/ideas";
import { HallTabs } from "./_components/HallTabs";

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
  const { statuses, eventsSnapshot, level: guildLevel } = getGuildState();
  const ideas = readIdeas();

  // The hero's XP bar reads toward the next LEVEL now (rank = a band of levels),
  // so the subtitle is just the current rank title (aria/flavor).
  const nextTitle = guildLevel.title;

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
