/**
 * Achievements Hall page (WO-09-003 re-anchor + WO-10-005)
 *
 * Server Component: reads factory data → derives guild level → renders the
 * GuildHero (FRD-09: Shield + XpBar + party roster) faithfully to the prototype
 * `logrosHero()` (~L413), then the Hall tabs, StatsPanel, and UniquesSection.
 *
 * Visual contract: docs/design/prototype/index.html logrosHero() ~L413
 * Token contract: rpgSkin.shield, rpgSkin.xpbar, rpgSkin.rpgpanel, rpgSkin.rpggrid
 *
 * Traceability (FRD-09 / WO-09-003):
 *   AC-09-003.1/2/3 — Avatar renders pixel-art per agent id, degrades gracefully, Spanish label/alt
 *   AC-09-004.1     — hero: Shield crest + guild title + XpBar to next + party roster
 *   AC-09-004.2     — tabular-nums on all numeric elements
 *   AC-09-004.3     — real pct-to-next from computeGuildLevel (no fake fill)
 *   AC-09-004.5     — reuses XpBar primitive
 *
 * Traceability (FRD-10 / WO-10-005):
 *   AC-10-005.1     — hero: guild level/XP + party avatars + tabs
 *   AC-10-005.2     — stats panel with counters + tier medals
 *   AC-10-005.3     — tabular-nums; XP bar honest (no fake fill)
 *   AC-10-005.4     — empty factory → honest zeros, no fabricated trophies
 *   AC-10-005.5     — design tokens only; Spanish labels/aria; keyboard nav
 */

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import { Shield } from "@/components/core/Shield/Shield";
import { XpBar } from "@/components/core/XpBar/XpBar";
import { computeUniques } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { readEvents } from "@/lib/events/events";
import { computeGuildLevel, deriveGuildOutcomes, RANKS } from "@/lib/gamification/gamification";
import { readIdeas } from "@/lib/ideas/ideas";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatus } from "@/lib/status/status";
import { StatsPanel } from "./StatsPanel";
import { UniquesSection } from "./UniquesSection/UniquesSection";

// ── Party roster (TU PARTY sprite row) ───────────────────────────────────────
// Faithfully matches the prototype logrosHero() roster (L415).
const HALL_PARTY_ROLES: readonly AgentRole[] = [
  "product-manager",
  "architect",
  "backend-dev",
  "frontend-dev",
  "designer",
  "reviewer",
] as const;

// ── Tab definitions (logrosTabs prototype ~L445) ──────────────────────────────
const HALL_TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "misiones", label: "Misiones" },
  { id: "trofeos", label: "Trofeos" },
  { id: "estadisticas", label: "Estadísticas" },
] as const;

// ── Panel style (rpgpanel rpggrid — prototype logrosHero L419) ────────────────
const RPG_PANEL_STYLE: React.CSSProperties = {
  position: "relative",
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 10,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  // rpggrid: dot-grid overlay
  backgroundImage:
    "linear-gradient(var(--color-border) 1px, transparent 1px)," +
    "linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
  padding: "18px 20px",
  marginBottom: 14,
};

// ── Page (Server Component) ───────────────────────────────────────────────────

/**
 * HallPage — The Guild Hall: GuildHero + tabs + StatsPanel + UniquesSection.
 *
 * Golden rule (architecture §1): read-only, never calls Claude.
 */
export default async function HallPage(): Promise<React.JSX.Element> {
  // ── Read phase (fail-soft, read-only) ──────────────────────────────────────
  const portfolioEntries = readPortfolio();
  const statuses = portfolioEntries.map((entry) => readStatus(entry.path));
  const eventsSnapshot = readEvents();
  const ideas = readIdeas();

  // ── Derive guild level (IF-09-guild-xp) ────────────────────────────────────
  const guildOutcomes = deriveGuildOutcomes({ statuses, eventsSnapshot });
  const guildLevel = computeGuildLevel(guildOutcomes);

  // Next rank title for XpBar "faltan N para …" subtitle
  const nextRankEntry = RANKS[guildLevel.level]; // 1-based level; RANKS is 0-based
  const nextTitle = nextRankEntry?.title ?? guildLevel.title;

  // ── ReaderData for achievements engine ─────────────────────────────────────
  const readerData: ReaderData = {
    ideas,
    statuses,
    eventsSnapshot,
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
      {/* ── Page title (PageTitle primitive — DR-062) ──────────────────────── */}
      <PageTitle icon="ti-trophy" title="Logros" />

      {/* ── GuildHero (AC-09-004.1, AC-10-005.1) — faithful to logrosHero() ── */}
      <section
        data-testid="hall-hero"
        aria-label="Héroe del gremio: nivel, XP y party"
        style={RPG_PANEL_STYLE}
      >
        {/* Top block: Shield crest + title column (L420–L427) */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Shield crest (rpgSkin.shield, WO-13-008 CMP-13-shield) */}
          <Shield level={guildLevel.level} size="md" glow />

          {/* Title + XP column */}
          <div style={{ flex: 1, minWidth: 250 }}>
            {/* "GREMIO PANDACORP" eyebrow (L422) */}
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 11,
                letterSpacing: "0.16em",
                color: "var(--color-accent-text)",
                marginBottom: 2,
              }}
            >
              <i
                className="ti ti-shield-checkered"
                style={{ fontSize: 12, verticalAlign: "-2px", marginRight: 4 }}
                aria-hidden="true"
              />
              GREMIO PANDACORP
            </div>

            {/* Guild title (L423 — .ttl 27px display) */}
            <div
              data-testid="hall-guild-level"
              style={{
                fontFamily: "var(--font-display, var(--font-space-grotesk), system-ui, sans-serif)",
                fontSize: 27,
                fontWeight: 700,
                lineHeight: 1.12,
                color: "var(--color-text)",
                margin: "3px 0 2px",
              }}
            >
              {guildLevel.title}
            </div>

            {/* Feats summary line (L424) */}
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text2)",
              }}
            >
              <i
                className="ti ti-trophy"
                style={{
                  fontSize: 12,
                  verticalAlign: "-1px",
                  color: "var(--color-warn)",
                  marginRight: 4,
                }}
                aria-hidden="true"
              />
              Nivel {guildLevel.level} · {guildLevel.xp} XP acumulados
            </div>

            {/* XP bar (L425–L426) — reuses CMP-09-xp-bar (AC-09-004.5, AC-10-005.3) */}
            <div style={{ marginTop: 13 }}>
              <XpBar
                xp={guildLevel.xp}
                next={guildLevel.next}
                pctToNext={guildLevel.pctToNext}
                label={guildLevel.title}
                nextTitle={nextTitle}
              />
            </div>
          </div>
        </div>

        {/* Bottom block: TU PARTY roster + stat mini-badges (L428–L430) */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 15,
            alignItems: "center",
            flexWrap: "wrap",
            borderTop: "1px solid var(--color-border)",
            paddingTop: 14,
          }}
        >
          {/* TU PARTY sprite roster (L429) */}
          <div style={{ flex: "0 0 auto" }}>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "var(--color-text3)",
                marginBottom: 6,
              }}
            >
              TU PARTY
            </div>
            <ul
              data-testid="hall-party-avatars"
              aria-label="Agentes del gremio"
              style={{
                display: "flex",
                gap: 5,
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {HALL_PARTY_ROLES.map((role) => (
                <li key={role} style={{ display: "contents" }}>
                  <Avatar agentId={role} size="sm" />
                </li>
              ))}
            </ul>
          </div>

          {/* Mini stat badges (NV badge group — L430) */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flex: 1,
              flexWrap: "wrap",
              minWidth: 220,
            }}
          >
            {/* Level badge */}
            <div
              style={{
                flex: 1,
                minWidth: 118,
                background: "var(--color-card)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 10,
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
                padding: "9px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--color-text2)",
                  fontSize: 11,
                  marginBottom: 2,
                }}
              >
                <i
                  className="ti ti-bolt"
                  style={{ fontSize: 14, color: "var(--color-accent-text)" }}
                  aria-hidden="true"
                />
                Nivel
              </div>
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 22,
                  color: "var(--color-accent-text)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                }}
              >
                {guildLevel.level}
              </div>
            </div>

            {/* XP total badge */}
            <div
              style={{
                flex: 1,
                minWidth: 118,
                background: "var(--color-card)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 10,
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
                padding: "9px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--color-text2)",
                  fontSize: 11,
                  marginBottom: 2,
                }}
              >
                <i
                  className="ti ti-flame"
                  style={{ fontSize: 14, color: "var(--color-accent-text)" }}
                  aria-hidden="true"
                />
                XP Total
              </div>
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 22,
                  color: "var(--color-accent-text)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                }}
              >
                {guildLevel.xp}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs (logrosTabs prototype ~L445–L447) ──────────────────────── */}
        <div
          data-testid="hall-tabs"
          role="tablist"
          aria-label="Secciones del Salón del Gremio"
          style={{
            display: "flex",
            gap: 6,
            margin: "18px 0 0",
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
                fontFamily: "var(--font-pixel)",
                fontSize: 13,
                padding: "5px 12px",
                borderRadius: "var(--radius, 8px)",
                border:
                  idx === 0
                    ? "1px solid var(--color-accent)"
                    : "1px solid var(--color-border-strong)",
                background: idx === 0 ? "var(--color-accent-bg)" : "transparent",
                color: idx === 0 ? "var(--color-accent-text)" : "var(--color-text2)",
                cursor: "pointer",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Stats panel with SVG radar (AC-10-005.2, WO-09-003 StatRadar) ─── */}
      <section style={{ maxWidth: "48rem" }}>
        <StatsPanel readerData={readerData} />
      </section>

      {/* ── Unique achievements by category (AC-10-007.1) ──────────────────── */}
      <section style={{ maxWidth: "48rem", marginTop: "calc(var(--space-base) * 1.5)" }}>
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
        <UniquesSection uniques={computeUniques(readerData)} />
      </section>
    </main>
  );
}
