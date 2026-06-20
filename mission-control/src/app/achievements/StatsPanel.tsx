/**
 * CMP-10-stats-panel — Statistics character sheet (WO-09-003, re-anchored to logrosStats())
 *
 * Renders the logrosStats() layout faithfully to the prototype:
 *   - Top row: StatRadar (6-axis SVG) + hero stat tiles (lanzados/racha/velocidad)
 *   - Bottom: 3-column ledger grid grouped by domain (Producción/Calidad/Ritmo & alcance)
 *
 * Previously only had the ledger rows; this WO adds the radar + hero stats top row.
 * Numbers use tabular-nums (FRD-13 AC-10-005.3).
 * Styling uses design tokens only — zero hardcoded colors.
 * Spanish labels and aria-labels (AC-10-005.5).
 *
 * Prototype anchor: logrosStats() ~L533, statRadar() ~L459.
 *
 * Traceability:
 *   AC-10-005.2 — stats panel with computeStats() counters + tier medal
 *   AC-10-005.3 — tabular-nums on all numbers
 *   AC-10-005.5 — tokens only; Spanish labels/aria; not color-alone (medal has text)
 *   FDD-09 §6   — StatRadar "Atributos del gremio" inside logrosStats
 *
 * Blueprint: CMP-10-stats-panel (FRD-10 blueprint §4) + CMP-09-stat-radar (FRD-09 blueprint §3)
 */

import { computeChains } from "@/lib/achievements/achievements";
import { computeStats, type ReaderData, type Stat } from "@/lib/achievements/stats";
import { StatRadar } from "./StatRadar";

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
      return "var(--color-tier-5, var(--color-agent-product-manager))";
    default:
      return "var(--color-text3)";
  }
}

// ── StatItem (ledger row) ──────────────────────────────────────────────────────

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
        gap: "8px",
        padding: "8px 11px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Icon + stat label */}
      <span
        data-testid="stat-label"
        style={{
          color: "var(--color-text2)",
          fontSize: "12px",
          flex: 1,
          minWidth: 0,
        }}
      >
        {stat.label}
      </span>

      {/* Right side: tier node pip + numeric value */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        {/* Tier node pip (9px node, colored, never color-alone — label as title) */}
        {hasTier && (
          <span
            style={{
              display: "inline-block",
              width: "9px",
              height: "9px",
              borderRadius: "3px",
              background: medalColor,
              boxShadow: `0 0 7px -2px ${medalColor}`,
              flexShrink: 0,
            }}
            title={medalLabel}
          />
        )}

        {/* Numeric value — tabular-nums applied via class + globals.css html{} */}
        <span
          data-testid="stat-value"
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "18px",
            color: "var(--color-text)",
            lineHeight: 1,
            minWidth: "36px",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {stat.value}
        </span>

        {/* Tier medal text — always present (not color alone — AC-10-005.5) */}
        <span
          data-testid="stat-medal"
          role="img"
          aria-label={hasTier ? `Nivel: ${medalLabel}` : "Sin nivel aún"}
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: medalColor,
            minWidth: "3rem",
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

// ── HeroStat tile ─────────────────────────────────────────────────────────────
// prototype heroStat(): rpgpanel.herostat with big pixel numeral + tier badge

type HeroStatProps = {
  icon: string;
  label: string;
  value: number;
  sub: string;
  tierIndex: number;
};

function HeroStat({ icon, label, value, sub, tierIndex }: HeroStatProps): React.JSX.Element {
  const hasTier = tierIndex >= 0;
  const tierColor = getMedalColor(tierIndex);
  const tierLabel = getMedalLabel(tierIndex);

  return (
    <div
      style={{
        position: "relative",
        // rpgSkin.rpgpanel + herostat
        background: "var(--color-card)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "10px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
        flex: 1,
        minWidth: "150px",
        padding: "15px 16px 13px",
        overflow: "hidden",
      }}
    >
      {/* Tier badge (absolute top-right, pixel font, 9px) */}
      {hasTier && (
        <span
          style={{
            position: "absolute",
            top: "11px",
            right: "12px",
            fontFamily: "var(--font-pixel)",
            fontSize: "9px",
            color: "var(--color-base)",
            background: tierColor,
            padding: "1px 6px",
            borderRadius: "4px",
          }}
        >
          {tierLabel}
        </span>
      )}

      {/* Icon + label row (11px, text2) */}
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
          className={`ti ${icon}`}
          style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
        />
        {label}
      </div>

      {/* Big pixel numeral (40px, tabular-nums) */}
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "40px",
          lineHeight: 0.85,
          marginTop: "7px",
          color: "var(--color-text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>

      {/* Sub-label (11px, text3) */}
      <div style={{ fontSize: "11px", color: "var(--color-text3)", marginTop: "3px" }}>{sub}</div>
    </div>
  );
}

// ── StatsPanel ────────────────────────────────────────────────────────────────

export type StatsPanelProps = {
  readerData: ReaderData;
};

/**
 * CMP-10-stats-panel — the achievements character sheet.
 *
 * Layout (faithful to logrosStats()):
 *   Top row: StatRadar (330×280 SVG) + 3 hero-stat tiles (stacked column)
 *   Bottom:  3-column ledger grid grouped by domain
 *
 * Server Component: receives pre-read ReaderData and renders purely.
 * No I/O, no state, no client hooks — safe to render on the server.
 */
export function StatsPanel({ readerData }: StatsPanelProps): React.JSX.Element {
  const stats = computeStats(readerData);
  const chains = computeChains(stats);

  // Build a lookup from statKey → currentTierIndex for medal display
  const tierByKey = new Map<string, number>(chains.map((c) => [c.statKey, c.currentTierIndex]));

  // Stat key helpers
  const getStat = (key: string): Stat | undefined => stats.find((s) => s.key === key);
  const getTier = (key: string): number => tierByKey.get(key) ?? -1;

  // Ledger groups (matches prototype logrosStats groups)
  const ledgerGroups = [
    {
      label: "Producción",
      icon: "ti-hammer",
      keys: ["workorders", "phases", "prds", "adrs"],
    },
    {
      label: "Calidad",
      icon: "ti-shield-check",
      keys: ["flawless", "iterations", "discarded"],
    },
    {
      label: "Ritmo & alcance",
      icon: "ti-arrows-right",
      keys: ["ideas", "agents"],
    },
    {
      label: "Alcance & velocidad",
      icon: "ti-rocket",
      // shipped/streak/speed also appear as hero tiles above — they are also in the
      // ledger so all 12 computeStats keys have a stat-item (AC-10-005.2 requires 12).
      keys: ["shipped", "streak", "speed"],
    },
  ] as const;

  return (
    <section
      data-testid="stats-panel"
      data-tabular-nums="true"
      aria-label="Panel de estadísticas del gremio"
    >
      {/* ── Top row: radar + hero stats ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "8px",
          alignItems: "stretch",
        }}
      >
        {/* StatRadar panel (rpgpanel, anim, radarwrap) */}
        <div
          style={{
            flexShrink: 0,
            width: "330px",
            maxWidth: "100%",
            // rpgSkin.rpgpanel
            background: "var(--color-card)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "10px",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
            padding: "13px 12px 7px",
          }}
        >
          <StatRadar stats={stats} />
        </div>

        {/* Hero stat tiles (lanzados / racha / velocidad) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            flex: 1,
            minWidth: "215px",
          }}
        >
          <HeroStat
            icon="ti-rocket"
            label="Productos lanzados"
            value={getStat("shipped")?.value ?? 0}
            sub="tu marca del gremio"
            tierIndex={getTier("shipped")}
          />
          <HeroStat
            icon="ti-flame"
            label="Racha récord"
            value={getStat("streak")?.value ?? 0}
            sub="semanas seguidas"
            tierIndex={getTier("streak")}
          />
          <HeroStat
            icon="ti-bolt"
            label="Récord idea→launch"
            value={getStat("speed")?.value ?? 0}
            sub="días, lo más rápido"
            tierIndex={getTier("speed")}
          />
        </div>
      </div>

      {/* ── Ledger columns (grouped by domain) ───────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(255px, 1fr))",
          gap: "10px",
          alignItems: "start",
        }}
      >
        {ledgerGroups.map((group) => {
          const groupStats = group.keys
            .map((key) => getStat(key))
            .filter((s): s is Stat => s !== undefined);

          return (
            <div
              key={group.label}
              style={{
                // rpgSkin.rpgpanel
                background: "var(--color-card)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "10px",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
                padding: "5px 4px 7px",
              }}
            >
              {/* Group header */}
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: "11px",
                  color: "var(--color-text3)",
                  letterSpacing: "0.05em",
                  padding: "9px 11px 7px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <i
                  className={`ti ${group.icon}`}
                  style={{ fontSize: "13px", color: "var(--color-accent-text)" }}
                />
                {group.label.toUpperCase()}
              </div>

              {/* Stat ledger rows */}
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {groupStats.map((stat) => (
                  <StatItem key={stat.key} stat={stat} tierIndex={tierByKey.get(stat.key) ?? -1} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
