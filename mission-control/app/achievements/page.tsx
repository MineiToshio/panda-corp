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

import type { AgentRole } from "@/app/_design/tokens";
import { Avatar } from "@/components/rpg/Avatar";
import { XpBar } from "@/components/rpg/XpBar";
import type { ReaderData } from "@/lib/achievements";
import { readEvents } from "@/lib/events";
import { computeGuildLevel, deriveGuildOutcomes } from "@/lib/gamification";
import { readIdeas } from "@/lib/ideas";
import { readPortfolio } from "@/lib/portfolio";
import { readStatus } from "@/lib/status";
import { StatsPanel } from "./StatsPanel";

// ── Party roster ─────────────────────────────────────────────────────────────
// The canonical party shown in the Hall hero.
// Uses a fixed representative subset of agent roles (all unique — no duplicates).
const HALL_PARTY_ROLES: readonly AgentRole[] = [
  "researcher",
  "backend-dev",
  "frontend-dev",
  "test-writer",
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

  // ── Build ReaderData for the achievements engine ──────────────────────────
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
      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: "calc(var(--space-base) * 1.5)",
        }}
      >
        Salón del Gremio
      </h1>

      {/* ── Hero (AC-10-005.1) ──────────────────────────────────────────── */}
      <section
        data-testid="hall-hero"
        aria-label="Héroe del Salón del Gremio"
        style={{
          background: "var(--color-base)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-2)",
          padding: "calc(var(--space-base) * 1.5)",
          marginBottom: "calc(var(--space-base) * 1.5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-base)",
        }}
      >
        {/* Guild level badge + XP bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "calc(var(--space-base) * 0.5)",
          }}
        >
          {/* Guild level + title (AC-10-005.1) */}
          <div
            data-testid="hall-guild-level"
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "calc(var(--space-base) * 0.5)",
            }}
          >
            <span
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                color: "var(--color-accent)",
                lineHeight: 1,
              }}
            >
              {/* tabular-nums applied via html {} in globals.css */}
              Nv {guildLevel.level}
            </span>
            <span
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "var(--color-text)",
                opacity: 0.85,
              }}
            >
              {guildLevel.title}
            </span>
          </div>

          {/* XP bar — reuses CMP-09-xp-bar (honest, no fake fill — AC-10-005.3) */}
          <XpBar
            xp={guildLevel.xp}
            next={guildLevel.next}
            pctToNext={guildLevel.pctToNext}
            label={guildLevel.title}
            nextTitle={guildLevel.title}
          />
        </div>

        {/* Party avatars (CMP-09-avatar — AC-10-005.1) */}
        <ul
          data-testid="hall-party-avatars"
          aria-label="Agentes del gremio"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "calc(var(--space-base) * 0.5)",
            alignItems: "center",
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {HALL_PARTY_ROLES.map((role) => (
            <li key={role} style={{ display: "contents" }}>
              <Avatar agentId={role} size="md" />
            </li>
          ))}
        </ul>

        {/* Tabs — Resumen · Misiones · Trofeos · Estadísticas (AC-10-005.1) */}
        <div
          data-testid="hall-tabs"
          role="tablist"
          aria-label="Secciones del Salón del Gremio"
          style={{
            display: "flex",
            gap: "calc(var(--space-base) * 0.25)",
            borderTop: `var(--hairline) solid var(--color-base)`,
            paddingTop: "calc(var(--space-base) * 0.75)",
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
                padding: "calc(var(--space-base) * 0.375) calc(var(--space-base) * 0.75)",
                borderRadius: "var(--radius)",
                border:
                  idx === 0
                    ? `var(--hairline) solid var(--color-accent)`
                    : `var(--hairline) solid var(--color-base)`,
                background: idx === 0 ? "var(--color-accent)" : "transparent",
                color: idx === 0 ? "var(--color-surface)" : "var(--color-text)",
                fontSize: "0.875rem",
                fontWeight: idx === 0 ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Stats panel (AC-10-005.2) ────────────────────────────────────── */}
      <section
        style={{
          maxWidth: "48rem",
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
          Estadísticas
        </h2>
        <StatsPanel readerData={readerData} />
      </section>
    </main>
  );
}
