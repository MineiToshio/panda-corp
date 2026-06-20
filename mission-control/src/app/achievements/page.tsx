/**
 * CMP-10-hall-page — Achievements Hall page (WO-09-003, re-anchored to prototype logrosView())
 *
 * Server Component: the Guild Hall page with:
 *   - PageTitle "Logros" (DR-062, one per page)
 *   - GuildHero (logrosHero): Shield crest + GREMIO PANDACORP eyebrow + guild title +
 *     feats summary + full XpBar + TU PARTY sprite roster + badge stat tiles
 *   - logrosTabs: Resumen · Misiones · Trofeos · Estadísticas
 *   - StatsPanel (logrosStats): radar + hero stats + ledger columns
 *
 * Architecture §11 surface: app/achievements
 * Golden rule (architecture §1): read-only, never calls Claude.
 * Read chain: readPortfolio → readStatus → readEvents → readIdeas →
 *             deriveGuildOutcomes → computeGuildLevel → render.
 *
 * Prototype anchors (FDD-09 §index.html):
 *   logrosHero() ~L413 · logrosView() + logrosTabs() ~L502
 *
 * Traceability:
 *   AC-09-004.1–5  GuildHero uses Shield + XpBar (CMP-09-xp-bar) + Avatar roster
 *   AC-09-003.1–3  Avatar: pixel-art sprites with Spanish aria-label/alt
 *   AC-10-005.1    hero: guild level/XP + party avatars + tabs
 *   AC-10-005.2    stats panel with counters + tier medals
 *   AC-10-005.3    tabular-nums on numbers; XP bar reuses CMP-09-xp-bar (honest)
 *   AC-10-005.4    empty factory → honest zeros, no fabricated trophies (negative AC)
 *   AC-10-005.5    design tokens only; Spanish labels/aria; keyboard nav; focus
 *
 * FRD-09 owns: hero block (GuildHero), GuildBar (in layout.tsx), StatsPanel (radar).
 * FRD-10 owns: ChainCard, UniquesSection, AlmostThere, SecretsPanel sections.
 */

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { Shield } from "@/components/core/Shield/Shield";
import { XpBar } from "@/components/core/XpBar/XpBar";
import { computeUniques } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { computeStats } from "@/lib/achievements/stats";
import { readEvents } from "@/lib/events/events";
import { computeGuildLevel, deriveGuildOutcomes, RANKS } from "@/lib/gamification/gamification";
import { readIdeas } from "@/lib/ideas/ideas";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatus } from "@/lib/status/status";
import { StatsPanel } from "./StatsPanel";
import { UniquesSection } from "./UniquesSection/UniquesSection";

// ── Party roster ─────────────────────────────────────────────────────────────
// Representative subset shown in the Hall hero "TU PARTY" strip.
// Per prototype logrosHero() roster order.
const HALL_PARTY_ROLES: readonly AgentRole[] = [
  "product-manager",
  "architect",
  "backend-dev",
  "frontend-dev",
  "designer",
  "reviewer",
] as const;

// ── Tab definitions ───────────────────────────────────────────────────────────
const HALL_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "misiones", label: "Misiones" },
  { id: "trofeos", label: "Trofeos" },
  { id: "estadisticas", label: "Estadísticas" },
] as const;

// ── Page (Server Component) ───────────────────────────────────────────────────

/**
 * HallPage — The Guild Hall: GuildHero + tabs + stats.
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

  // Next rank title for XpBar subtitle
  const nextRankEntry = RANKS[guildLevel.level];
  const nextTitle = nextRankEntry?.title ?? guildLevel.title;

  // ── Build ReaderData for the achievements engine ──────────────────────────
  const readerData: ReaderData = {
    ideas,
    statuses,
    eventsSnapshot,
  };

  // ── Derive counts for the feats/trophies summary line ────────────────────
  const stats = computeStats(readerData);
  const uniques = computeUniques(readerData);
  const shippedStat = stats.find((s) => s.key === "shipped");
  const workordersStat = stats.find((s) => s.key === "workorders");
  const unlockedTrophies = uniques.filter((u) => u.unlocked).length;

  return (
    <main
      data-testid="achievements-page"
      style={{
        minHeight: "100vh",
        background: "var(--color-base)",
        color: "var(--color-text)",
        padding: "0 var(--space-base) var(--space-base)",
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
      {/* ── Page title (DR-062 — ONE PageTitle per surface) ───────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "18px 0 14px",
        }}
      >
        {/* accent itemslot icon (46px) */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "46px",
            height: "46px",
            borderRadius: "10px",
            background: "var(--color-accent-bg)",
            border: "1.5px solid var(--color-accent)",
            color: "var(--color-accent-text)",
            flexShrink: 0,
          }}
        >
          <i className="ti ti-award" style={{ fontSize: "24px" }} />
        </span>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--color-text)",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Logros
          </h1>
          <div style={{ fontSize: "13px", color: "var(--color-text2)", marginTop: "2px" }}>
            El salón del gremio · tus hazañas, misiones, trofeos y la hoja de personaje de la
            fábrica.
          </div>
        </div>
        {/* Tail: hazañas badge */}
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-pixel)",
            fontSize: "11px",
            background: "var(--color-warn-bg)",
            color: "var(--color-warn)",
            padding: "3px 9px",
            borderRadius: "6px",
          }}
        >
          {(workordersStat?.value ?? 0) + (shippedStat?.value ?? 0)} hazañas
        </span>
      </div>

      {/* ── GuildHero (logrosHero prototype, AC-09-004.1 / AC-10-005.1) ────── */}
      <section
        data-testid="hall-hero"
        aria-label="Héroe del Salón del Gremio"
        style={{
          // rpgSkin.rpgpanel + rpggrid
          position: "relative",
          background: "var(--color-card)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "10px",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          padding: "18px 20px",
          marginBottom: "14px",
        }}
      >
        {/* ── Hero top row: Shield + title block ─────────────────────────── */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Shield crest medallion (rpgSkin.shield, 96px, pixel font NIVEL numeral) */}
          <Shield level={guildLevel.level} size="md" glow />

          {/* Title block */}
          <div style={{ flex: 1, minWidth: "250px" }}>
            {/* hall-guild-level: machine-readable level indicator for tests (AC-10-005.1).
                Uses a <output> element which carries implicit role="status" and supports
                aria-label — semantically correct for a computed value display. */}
            <output
              data-testid="hall-guild-level"
              aria-label={`Nivel del gremio: ${guildLevel.level}`}
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "9px",
                color: "var(--color-text3)",
                marginBottom: "2px",
                display: "inline-block",
              }}
            >
              NV {guildLevel.level}
            </output>

            {/* GREMIO PANDACORP eyebrow */}
            <div
              data-testid="guild-hero-eyebrow"
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "11px",
                letterSpacing: "0.16em",
                color: "var(--color-accent-text)",
              }}
            >
              <i
                className="ti ti-shield-checkered"
                style={{ fontSize: "12px", verticalAlign: "-2px" }}
              />{" "}
              GREMIO PANDACORP
            </div>

            {/* Guild title (display font, 27px, line-height 1.12) */}
            <div
              data-testid="guild-hero-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "27px",
                fontWeight: 700,
                lineHeight: 1.12,
                margin: "3px 0 2px",
                color: "var(--color-text)",
              }}
            >
              {guildLevel.title}
            </div>

            {/* Feats/trophies/missions summary line */}
            <div
              data-testid="guild-hero-summary"
              style={{ fontSize: "12px", color: "var(--color-text2)" }}
            >
              <i
                className="ti ti-trophy"
                style={{
                  fontSize: "12px",
                  verticalAlign: "-1px",
                  color: "var(--color-warn)",
                }}
              />{" "}
              {workordersStat?.value ?? 0} hazañas · {unlockedTrophies} trofeos ·{" "}
              {shippedStat?.value ?? 0} lanzamientos
            </div>

            {/* Full-width XpBar (18px, honest, from computeGuildLevel — AC-09-004.3/5) */}
            <div style={{ marginTop: "13px" }}>
              <XpBar
                xp={guildLevel.xp}
                next={guildLevel.next}
                pctToNext={guildLevel.pctToNext}
                label={guildLevel.title}
                nextTitle={nextTitle}
                size="full"
              />
            </div>
          </div>
        </div>

        {/* ── Hero bottom row: TU PARTY roster + stat badge tiles ──────────── */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "15px",
            alignItems: "center",
            flexWrap: "wrap",
            borderTop: "1px solid var(--color-border)",
            paddingTop: "14px",
          }}
        >
          {/* TU PARTY sprite roster (Avatar, 38px, pixel-art) */}
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "10px",
                letterSpacing: "0.12em",
                color: "var(--color-text3)",
                marginBottom: "6px",
              }}
            >
              TU PARTY
            </div>
            <ul
              data-testid="hall-party-avatars"
              aria-label="Agentes del gremio"
              style={{
                display: "flex",
                gap: "5px",
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {HALL_PARTY_ROLES.map((role) => (
                <li key={role} style={{ display: "contents" }}>
                  {/* Avatar at 38px per prototype logrosHero() roster */}
                  <Avatar agentId={role} size="sm" />
                </li>
              ))}
            </ul>
          </div>

          {/* Badge stat tiles (lanzados / racha / velocidad) */}
          <div
            style={{ display: "flex", gap: "8px", flex: 1, flexWrap: "wrap", minWidth: "220px" }}
          >
            {[
              {
                icon: "ti-rocket",
                value: shippedStat?.value ?? 0,
                label: "Lanzados",
              },
              {
                icon: "ti-flame",
                value: stats.find((s) => s.key === "streak")?.value ?? 0,
                label: "Racha sem",
              },
              {
                icon: "ti-bolt",
                value: stats.find((s) => s.key === "speed")?.value ?? 0,
                label: "Récord d",
              },
            ].map((badge) => (
              <div
                key={badge.label}
                style={{
                  flex: 1,
                  minWidth: "118px",
                  // rpgSkin.rpgpanel badge tile
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "10px",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
                  padding: "9px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "var(--color-text2)",
                    fontSize: "11px",
                  }}
                >
                  <i
                    className={`ti ${badge.icon}`}
                    style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
                  />
                  {badge.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-pixel)",
                    fontSize: "22px",
                    marginTop: "2px",
                    color: "var(--color-text)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {badge.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tabs — Resumen · Misiones · Trofeos · Estadísticas (AC-10-005.1) ── */}
      <div
        data-testid="hall-tabs"
        role="tablist"
        aria-label="Secciones del Salón del Gremio"
        style={{
          display: "flex",
          gap: "6px",
          margin: "0 0 18px",
          flexWrap: "wrap",
        }}
      >
        {HALL_TABS.map((tab, idx) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={idx === 0}
            tabIndex={idx === 0 ? 0 : -1}
            data-testid={`hall-tab-${tab.id}`}
            style={{
              fontFamily: "var(--font-display)",
              padding: "7px 13px",
              borderRadius: "8px",
              border:
                idx === 0
                  ? "1px solid var(--color-accent)"
                  : "1px solid var(--color-border-strong)",
              background: idx === 0 ? "var(--color-accent-bg)" : "transparent",
              color: idx === 0 ? "var(--color-accent-text)" : "var(--color-text2)",
              fontSize: "13px",
              fontWeight: idx === 0 ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Stats panel (logrosStats layout: radar + heroes + ledger cols) ─── */}
      <section style={{ maxWidth: "960px" }} aria-label="Estadísticas del gremio">
        <StatsPanel readerData={readerData} />
      </section>

      {/* ── Unique achievements by category (AC-10-007.1) ─────────────── */}
      <section
        style={{
          maxWidth: "960px",
          marginTop: "calc(var(--space-base) * 1.5)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text2)",
            margin: "22px 2px 11px",
            letterSpacing: "0.04em",
          }}
        >
          Trofeos únicos
        </h2>
        <UniquesSection uniques={computeUniques(readerData)} />
      </section>
    </main>
  );
}
