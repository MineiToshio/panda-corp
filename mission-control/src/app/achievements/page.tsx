/**
 * CMP-10-hall-page — Achievements Hall page (WO-10-005)
 *
 * Server Component: the Guild Hall hero (guild level/XP via IF-09-guild-xp +
 * party avatars via CMP-09-avatar), the tabs (Resumen · Misiones · Trofeos ·
 * Estadísticas) and the stats panel (only-grow counters with tier medals).
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
 *
 * Blueprint: CMP-10-hall-page, CMP-10-stats-panel
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { GuildHero } from "@/components/modules/GuildHero/GuildHero";
import { computeUniques } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { computeStats } from "@/lib/achievements/stats";
import { readEvents } from "@/lib/events/events";
import { computeGuildLevel, deriveGuildOutcomes, RANKS } from "@/lib/gamification/gamification";
import { readIdeas } from "@/lib/ideas/ideas";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatus } from "@/lib/status/status";
import { StatRadar, StatsPanel } from "./StatsPanel";
import { UniquesSection } from "./UniquesSection/UniquesSection";

// ── Party roster ─────────────────────────────────────────────────────────────
// The canonical party shown in the GuildHero.
// Uses a fixed representative subset of agent roles (all unique — no duplicates).
const HALL_PARTY_ROLES: readonly AgentRole[] = [
  "researcher",
  "backend-dev",
  "frontend-dev",
  "test-writer",
  "reviewer",
] as const;

// ── Page (Server Component) ───────────────────────────────────────────────────

/**
 * HallPage — The Guild Hall: hero + tabs + stats panel.
 *
 * Reads from the factory filesystem (read-only), derives all display data,
 * and renders. No client state, no Claude calls.
 *
 * Empty factory guard (AC-10-005.4): every reader tolerates missing data
 * and returns empty/zero states — the page never crashes or fabricates trophies.
 */
export default async function HallPage(): Promise<React.JSX.Element> {
  // ── Read phase (fail-soft, read-only) ────────────────────────────────────
  const portfolioEntries = readPortfolio();
  const statuses = portfolioEntries.map((entry) => readStatus(entry.path));
  const eventsSnapshot = readEvents();
  const ideas = readIdeas();

  // ── Derive guild level (IF-09-guild-xp) ──────────────────────────────────
  const guildOutcomes = deriveGuildOutcomes({ statuses, eventsSnapshot });
  const guildLevel = computeGuildLevel(guildOutcomes);

  // ── Next rank title (for XpBar subtitle in GuildHero) ────────────────────
  const nextRankEntry = RANKS[guildLevel.level]; // 1-based level; RANKS[level] = next rank
  const nextTitle = nextRankEntry?.title ?? guildLevel.title;

  // ── Build ReaderData for the achievements engine ──────────────────────────
  const readerData: ReaderData = {
    ideas,
    statuses,
    eventsSnapshot,
  };

  // ── Derive GuildHero stats from ReaderData ────────────────────────────────
  const statsRows = computeStats(readerData);
  const shippedStat = statsRows.find((s) => s.key === "shipped");
  const streakStat = statsRows.find((s) => s.key === "streak");
  const statsLanzados = shippedStat?.value ?? 0;
  const statsRacha = streakStat?.value ?? 0;
  // Fastest idea→launch record: derive from shipped projects (minimum WO count proxy)
  // Currently the stat engine doesn't track velocity; default to 0 until WO-XX adds it.
  const statsVelocidad = 0;

  // Trophies: count unlocked uniques vs total defined
  const uniques = computeUniques(readerData);
  const trophiesCount = uniques.filter((u) => u.unlocked).length;
  const trophiesTotal = uniques.length;

  // Feats: total result events (WO completions + phases + releases)
  // Guard: eventsSnapshot may be null in tests/empty factory
  const featsCount = (eventsSnapshot?.events ?? []).filter(
    (e) => e.event === "achievement" || e.event === "end",
  ).length;

  // Active missions: statuses in build/implementation phase (not yet operation/shipped)
  const missionsActive = statuses.filter((s) => {
    if (!s.present || s.status === null) return false;
    return ["implementation", "build"].includes(s.status.phase ?? "");
  }).length;

  // StatRadar axes — derived from real stats (0–100 scale)
  // Cap at 100; these are illustrative scale mappings for the radar
  const radarAxes = {
    produccion: Math.min(100, statsLanzados * 20), // 5 launched = 100%
    velocidad: Math.min(100, statsVelocidad > 0 ? Math.round(100 - statsVelocidad) : 0),
    calidad: Math.min(100, featsCount * 5), // 20 feats = 100%
    constancia: Math.min(100, statsRacha * 10), // 10 weeks = 100%
    ideacion: Math.min(100, ideas.length * 10), // 10 ideas = 100%
    alcance: Math.min(100, trophiesCount * 5), // 20 trophies = 100%
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        padding: "var(--space-base)",
      }}
    >
      {/* ── Page heading (DR-062: light PageTitle sits above GuildHero) ───── */}
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: "calc(var(--space-base) * 1)",
        }}
      >
        Logros
      </h1>

      {/* ── GuildHero character-sheet (AC-09-003.1..3, AC-09-004.1..5) ─────
           Replaces the old bespoke hall-hero section (WO-09-003 re-anchor). */}
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

      {/* ── Stats panel + radar side-by-side (AC-10-005.2) ──────────────── */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-base)",
          flexWrap: "wrap",
          maxWidth: "72rem",
          marginBottom: "calc(var(--space-base) * 1.5)",
        }}
      >
        <section style={{ flex: "2", minWidth: "280px" }}>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--color-text)",
              opacity: 0.7,
              marginBottom: "calc(var(--space-base) * 0.75)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Estadísticas
          </h2>
          <StatsPanel readerData={readerData} />
        </section>

        {/* StatRadar — Atributos del gremio (WO-09-003) */}
        <section
          style={{
            flex: "1",
            minWidth: "260px",
            background: "var(--color-card)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "10px",
            padding: "14px",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
          }}
        >
          <StatRadar axes={radarAxes} />
        </section>
      </div>

      {/* ── Unique achievements by category (AC-10-007.1) ─────────────── */}
      <section
        style={{
          maxWidth: "48rem",
          marginTop: "calc(var(--space-base) * 1.5)",
        }}
      >
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-text)",
            opacity: 0.7,
            marginBottom: "calc(var(--space-base) * 0.75)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Trofeos únicos
        </h2>
        <UniquesSection uniques={uniques} />
      </section>
    </main>
  );
}
