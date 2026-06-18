/**
 * CMP-10-stats-panel — Statistics character sheet (WO-10-005)
 *
 * Renders the only-grow counters from computeStats(), each with a tier medal.
 * Numbers use tabular-nums (FRD-13 AC-10-005.3).
 * Styling uses design tokens only — zero hardcoded colors.
 * Spanish labels and aria-labels (AC-10-005.5).
 *
 * Traceability:
 *   AC-10-005.2 — stats panel with computeStats() counters + tier medal
 *   AC-10-005.3 — tabular-nums on all numbers
 *   AC-10-005.5 — tokens only; Spanish labels/aria; not color-alone (medal has text)
 *
 * Blueprint: CMP-10-stats-panel (FRD-10 blueprint §4)
 */

import {
  computeChains,
  computeStats,
  type ReaderData,
  type Stat,
} from "@/lib/achievements/achievements";

// ── Tier medal config ─────────────────────────────────────────────────────────

/**
 * Returns the medal label for a given chain tier index.
 * -1 = no tier yet (no medal earned).
 * Uses text labels only (not color alone) — AC-10-005.5.
 */
function getMedalLabel(tierIndex: number): string {
  switch (tierIndex) {
    case 0:
      return "Bronce";
    case 1:
      return "Plata";
    case 2:
      return "Oro";
    case 3:
      return "Platino";
    case 4:
      return "Leyenda";
    default:
      return "—";
  }
}

/**
 * Returns the CSS color token for a given chain tier index.
 * Uses design token CSS variables (FRD-13 tier color tokens).
 * -1 = dimmed (no tier).
 */
function getMedalColor(tierIndex: number): string {
  switch (tierIndex) {
    case 0:
      return "var(--color-tier-1, var(--color-agent-researcher))";
    case 1:
      return "var(--color-tier-2, var(--color-agent-frontend-dev))";
    case 2:
      return "var(--color-tier-3, var(--color-accent))";
    case 3:
      return "var(--color-tier-4, var(--color-agent-reviewer))";
    case 4:
      return "var(--color-tier-5, var(--color-agent-guild))";
    default:
      return "var(--color-text)";
  }
}

// ── StatItem ──────────────────────────────────────────────────────────────────

type StatItemProps = {
  stat: Stat;
  tierIndex: number;
};

function StatItem({ stat, tierIndex }: StatItemProps): React.JSX.Element {
  const medalLabel = getMedalLabel(tierIndex);
  const medalColor = getMedalColor(tierIndex);
  const hasTier = tierIndex >= 0;

  return (
    <li
      data-testid="stat-item"
      data-stat-key={stat.key}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "calc(var(--space-base) * 0.5)",
        padding: "calc(var(--space-base) * 0.5) calc(var(--space-base) * 0.75)",
        borderRadius: "var(--radius)",
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-1)",
        borderBottom: `var(--hairline) solid var(--color-base)`,
      }}
    >
      {/* Stat label */}
      <span
        data-testid="stat-label"
        style={{
          color: "var(--color-text)",
          fontSize: "0.875rem",
          flexShrink: 0,
        }}
      >
        {stat.label}
      </span>

      {/* Right side: value + medal */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--space-base) * 0.375)",
        }}
      >
        {/* Numeric value — tabular-nums applied via class + globals.css html{} */}
        <span
          data-testid="stat-value"
          className="tabular-nums"
          style={{
            color: "var(--color-text)",
            fontSize: "1rem",
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {stat.value}
        </span>

        {/* Tier medal — text label + role=img + aria-label (not color alone — AC-10-005.5) */}
        <span
          data-testid="stat-medal"
          role="img"
          aria-label={hasTier ? `Nivel: ${medalLabel}` : "Sin nivel aún"}
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: medalColor,
            minWidth: "3.5rem",
            textAlign: "right",
            opacity: hasTier ? 1 : 0.4,
          }}
        >
          {medalLabel}
        </span>
      </span>
    </li>
  );
}

// ── StatsPanel ────────────────────────────────────────────────────────────────

export type StatsPanelProps = {
  readerData: ReaderData;
};

/**
 * CMP-10-stats-panel — the achievements character sheet.
 *
 * Server Component: receives pre-read ReaderData and renders purely.
 * No I/O, no state, no client hooks — safe to render on the server.
 */
export function StatsPanel({ readerData }: StatsPanelProps): React.JSX.Element {
  const stats = computeStats(readerData);
  const chains = computeChains(stats);

  // Build a lookup from statKey → currentTierIndex for medal display
  const tierByKey = new Map<string, number>(chains.map((c) => [c.statKey, c.currentTierIndex]));

  return (
    <section
      data-testid="stats-panel"
      data-tabular-nums="true"
      aria-label="Panel de estadísticas del gremio"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        boxShadow: "var(--shadow-1)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        border: `var(--hairline) solid var(--color-base)`,
      }}
    >
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {stats.map((stat) => {
          const tierIndex = tierByKey.get(stat.key) ?? -1;
          return <StatItem key={stat.key} stat={stat} tierIndex={tierIndex} />;
        })}
      </ul>
    </section>
  );
}
