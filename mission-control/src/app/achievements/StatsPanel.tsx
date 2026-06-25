/**
 * CMP-10-stats-panel — Statistics character sheet (WO-10-005 re-styled)
 * CMP-09-stat-radar — "Atributos del gremio" 6-axis SVG radar (WO-09-003)
 *
 * Renders the Estadísticas tab content:
 *   - 3 HeroStat hero-record tiles (Lanzados · Racha · Récord velocidad)
 *   - StatRadar 6-axis SVG
 *   - StatLedgerRow entries in 3 columns (Producción · Calidad · Ritmo & alcance)
 *
 * Visual reference:
 *   - prototype heroStat() → rpgpanel + absolute TierBadge + 40px pixel numeral + sub
 *   - prototype statLedgerRow() → .ledrow flex + icon + label + 9px tier node pip + 18px numeral
 *   - prototype logrosStats() → info + top-row (radar 330px + heroes flex-1) + ledger grid
 *
 * Styling: design tokens only — zero hardcoded colors.
 * Numbers: tabular-nums (global via globals.css + explicit class).
 * Spanish labels and aria-labels (AC-10-005.5).
 *
 * Traceability:
 *   AC-10-005.2 — stats panel with computeStats() counters + tier medal
 *   AC-10-005.3 — tabular-nums on all numbers
 *   AC-10-005.5 — tokens only; Spanish labels/aria; not color-alone (medal has text)
 *
 * Blueprint: CMP-10-stats-panel (FRD-10 blueprint §4)
 */

import { computeChains } from "@/lib/achievements/achievements";
import { computeStats, type ReaderData, type Stat } from "@/lib/achievements/stats";
import { tierColor, tierRarityName } from "@/lib/achievements/tiers";

// ── Tier helpers (shared rarity names + colors — Común → Leyenda, 0-indexed) ─────

function getMedalLabel(tierIndex: number): string {
  return tierIndex < 0 ? "—" : tierRarityName(tierIndex);
}

function getMedalColor(tierIndex: number): string {
  return tierColor(tierIndex);
}

// ── RPGPanel style ────────────────────────────────────────────────────────────

const RPGPANEL: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
};

// ── HeroStat ──────────────────────────────────────────────────────────────────

type HeroStatProps = {
  /** Stat label (e.g. "Lanzados"). */
  label: string;
  /** Tabler icon class (e.g. "ti-rocket"). */
  iconClass: string;
  /** The big pixel numeral to display. */
  value: number;
  /** Subtitle / context line (e.g. "proyectos en producción"). */
  sub: string;
  /** Tier index (-1 = no tier). */
  tierIndex: number;
};

/**
 * HeroStat — record tile (prototype heroStat()).
 *
 * rpgpanel + absolute TierBadge (top-right) + icon+label row + 40px pixel numeral + sub.
 * State not by color alone: TierBadge carries text label + data-tier.
 * Tokens only. Server Component.
 */
function HeroStat({ label, iconClass, value, sub, tierIndex }: HeroStatProps): React.JSX.Element {
  const hasTier = tierIndex >= 0;
  const tierColor = getMedalColor(tierIndex);
  const tierLabel = getMedalLabel(tierIndex);

  return (
    <section
      data-testid="hero-stat"
      aria-label={`Estadística: ${label} — ${value}`}
      style={{
        ...RPGPANEL,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "12px 14px",
        flex: 1,
        minWidth: "120px",
      }}
    >
      {/* Tier badge (absolute top-right — prototype heroStat TierBadge) */}
      {hasTier && (
        <span
          role="img"
          aria-label={`Rango ${tierLabel}`}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            fontFamily: "var(--font-pixel)",
            fontSize: "9px",
            background: tierColor,
            color: "var(--color-base)",
            padding: "1px 5px",
            borderRadius: "3px",
          }}
        >
          {tierLabel}
        </span>
      )}

      {/* Icon + label row */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <i
          className={`ti ${iconClass}`}
          aria-hidden="true"
          style={{ fontSize: "14px", color: hasTier ? tierColor : "var(--color-text3)" }}
        />
        <span
          style={{ fontSize: "11px", color: "var(--color-text3)", fontFamily: "var(--font-pixel)" }}
        >
          {label}
        </span>
      </div>

      {/* Big 40px pixel numeral (AC-10-005.3 tabular-nums) */}
      <span
        data-testid="hero-stat-value"
        aria-hidden="true"
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "40px",
          lineHeight: 1,
          color: hasTier ? tierColor : "var(--color-text)",
          letterSpacing: "-1px",
        }}
      >
        {value}
      </span>

      {/* Sub label */}
      <span style={{ fontSize: "10px", color: "var(--color-text3)", opacity: 0.7 }}>{sub}</span>
    </section>
  );
}

// ── StatLedgerRow ─────────────────────────────────────────────────────────────

type StatLedgerRowProps = {
  stat: Stat;
  tierIndex: number;
  iconClass: string;
};

/**
 * StatLedgerRow — one row in the stat ledger (prototype statLedgerRow()).
 *
 * .ledrow flex + icon + label + 9px tier node pip + 18px pixel numeral.
 * Tier node pip: small circle colored by tier token.
 * State not by color alone: pip has aria-label + medal color.
 * Tokens only. Server Component.
 */
function StatLedgerRow({ stat, tierIndex, iconClass }: StatLedgerRowProps): React.JSX.Element {
  const hasTier = tierIndex >= 0;
  const tierColor = getMedalColor(tierIndex);
  const tierLabel = getMedalLabel(tierIndex);

  return (
    <li
      data-testid="stat-ledger-row"
      data-stat-key={stat.key}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 0",
      }}
    >
      {/* Icon */}
      <i
        className={`ti ${iconClass}`}
        aria-hidden="true"
        style={{
          fontSize: "13px",
          color: hasTier ? tierColor : "var(--color-text3)",
          flexShrink: 0,
          width: "16px",
          textAlign: "center",
        }}
      />

      {/* Label */}
      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {stat.label}
      </span>

      {/* Tier node pip (9px — prototype .node) */}
      <span
        role="img"
        aria-label={hasTier ? `Nivel: ${tierLabel}` : "Sin nivel"}
        title={hasTier ? tierLabel : "Sin nivel aún"}
        style={{
          width: "9px",
          height: "9px",
          borderRadius: "50%",
          background: hasTier ? tierColor : "var(--color-border-strong)",
          border: `1.5px solid ${hasTier ? tierColor : "var(--color-text3)"}`,
          opacity: hasTier ? 1 : 0.3,
          flexShrink: 0,
        }}
      />

      {/* 18px pixel numeral (prototype statLedgerRow) */}
      <span
        data-testid="stat-ledger-value"
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "18px",
          lineHeight: 1,
          color: hasTier ? tierColor : "var(--color-text)",
          minWidth: "28px",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {stat.value}
      </span>
    </li>
  );
}

// ── StatItem (legacy list view — kept for backward compat) ────────────────────

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
        borderBottom: "var(--hairline) solid var(--color-base)",
      }}
    >
      <span
        data-testid="stat-label"
        style={{ color: "var(--color-text)", fontSize: "0.875rem", flexShrink: 0 }}
      >
        {stat.label}
      </span>
      <span
        style={{ display: "flex", alignItems: "center", gap: "calc(var(--space-base) * 0.375)" }}
      >
        <span
          data-testid="stat-value"
          className="tabular-nums"
          style={{ color: "var(--color-text)", fontSize: "1rem", fontWeight: 600, lineHeight: 1 }}
        >
          {stat.value}
        </span>
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

// ── StatRadar ─────────────────────────────────────────────────────────────────

/**
 * StatRadar axes — the 6 guild attribute dimensions.
 */
interface StatRadarAxes {
  produccion: number;
  velocidad: number;
  calidad: number;
  constancia: number;
  ideacion: number;
  alcance: number;
}

export interface StatRadarProps {
  axes: StatRadarAxes;
}

/**
 * StatRadar — "Atributos del gremio" 6-axis SVG radar chart (WO-09-003).
 *
 * Matches prototype statRadar() (~L459):
 *   - SVG viewBox 330×280, cx=165, cy=140, R=90
 *   - 4 grid ring polygons (25/50/75/100%)
 *   - 6 spoke lines
 *   - Base (background) polygon
 *   - Data polygon: accent fill (.2 opacity) + accent stroke + glow filter
 *   - 6 accent dots on data points
 *   - Pixel-font axis labels (text-anchor per quadrant)
 *
 * Server Component — pure SVG derivation from axes prop.
 */
export function StatRadar({ axes }: StatRadarProps): React.JSX.Element {
  const AX: Array<{ label: string; value: number }> = [
    { label: "Producción", value: axes.produccion },
    { label: "Velocidad", value: axes.velocidad },
    { label: "Calidad", value: axes.calidad },
    { label: "Constancia", value: axes.constancia },
    { label: "Ideación", value: axes.ideacion },
    { label: "Alcance", value: axes.alcance },
  ];

  const cx = 165;
  const cy = 140;
  const R = 90;
  const n = AX.length;

  function pt(i: number, r: number): [number, number] {
    const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function ringPoints(f: number): string {
    return AX.map((_, i) => {
      const [x, y] = pt(i, R * f);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  const dataPoints = AX.map((ax, i) => {
    const pct = Math.max(8, Math.min(100, ax.value));
    const [x, y] = pt(i, R * (pct / 100));
    return { x, y };
  });

  const dataPts = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const basePts = AX.map((_, i) => {
    const [x, y] = pt(i, R);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div data-testid="stat-radar">
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "11px",
          color: "var(--color-text3)",
          letterSpacing: "0.05em",
          padding: "0 3px 2px",
        }}
      >
        <i
          className="ti ti-chart-radar"
          aria-hidden="true"
          style={{ fontSize: "13px", verticalAlign: "-2px", color: "var(--color-accent-text)" }}
        />
        {" ATRIBUTOS DEL GREMIO"}
      </div>

      <svg
        viewBox="0 0 330 280"
        width="100%"
        aria-label="Radar de atributos del gremio"
        role="img"
        style={{ display: "block", maxWidth: "340px", margin: "2px auto 0" }}
      >
        <polygon points={basePts} style={{ fill: "var(--color-panel)", opacity: 0.45 }} />

        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            data-testid="radar-ring"
            points={ringPoints(f)}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}

        {AX.map((ax, i) => {
          const [x2, y2] = pt(i, R);
          return (
            <line
              key={`spoke-${ax.label}`}
              x1={cx}
              y1={cy}
              x2={x2.toFixed(1)}
              y2={y2.toFixed(1)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          );
        })}

        <polygon
          data-testid="radar-data-polygon"
          points={dataPts}
          fill="var(--color-accent)"
          fillOpacity={0.2}
          stroke="var(--color-accent)"
          strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 5px var(--color-accent))" }}
        />

        {dataPoints.map((p, i) => (
          <circle
            key={`dot-${AX[i]?.label ?? i}`}
            data-testid="radar-dot"
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r="3"
            fill="var(--color-accent)"
          />
        ))}

        {AX.map((ax, i) => {
          const [lx, ly] = pt(i, R + 17);
          const anchorX = Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end";
          return (
            <text
              key={`label-${ax.label}`}
              x={lx.toFixed(1)}
              y={ly.toFixed(1)}
              textAnchor={anchorX}
              dominantBaseline="middle"
              style={{
                fill: "var(--color-text2)",
                fontFamily: "var(--font-pixel)",
                fontSize: "9.5px",
              }}
            >
              {ax.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Ledger column config ──────────────────────────────────────────────────────

/** Stat keys per ledger column (matches prototype logrosStats() structure). */
const LEDGER_COLUMNS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Producción",
    keys: ["shipped", "workorders", "phases", "iterations"],
  },
  {
    title: "Calidad",
    keys: ["flawless", "prds", "adrs"],
  },
  {
    title: "Ritmo & alcance",
    keys: ["streak", "speed", "ideas", "agents", "discarded"],
  },
];

/** Tabler icon per statKey. */
const STAT_ICONS: Record<string, string> = {
  shipped: "ti-rocket",
  ideas: "ti-bulb",
  workorders: "ti-checkbox",
  phases: "ti-stairs-up",
  iterations: "ti-refresh",
  flawless: "ti-diamond",
  discarded: "ti-trash",
  prds: "ti-file-text",
  adrs: "ti-notebook",
  agents: "ti-users-group",
  streak: "ti-flame",
  speed: "ti-bolt",
};

/** Hero stat config for the three record tiles. */
const HERO_STAT_KEYS: Array<{ key: string; label: string; iconClass: string; sub: string }> = [
  { key: "shipped", label: "Lanzados", iconClass: "ti-rocket", sub: "productos en producción" },
  { key: "streak", label: "Racha", iconClass: "ti-flame", sub: "semanas seguidas" },
  { key: "speed", label: "Récord", iconClass: "ti-bolt", sub: "días idea→launch" },
];

// ── StatsPanel props ──────────────────────────────────────────────────────────

export type StatsPanelProps = {
  readerData: ReaderData;
};

// ── StatsPanel ────────────────────────────────────────────────────────────────

/**
 * CMP-10-stats-panel — the Estadísticas tab character sheet.
 *
 * Renders:
 *   1. 3 HeroStat hero-record tiles (Lanzados · Racha · Récord)
 *   2. StatRadar — 6-axis guild attributes
 *   3. StatLedgerRow grid in 3 columns (Producción · Calidad · Ritmo & alcance)
 *
 * Server Component: receives pre-read ReaderData and renders purely.
 * No I/O, no state, no client hooks.
 */
export function StatsPanel({ readerData }: StatsPanelProps): React.JSX.Element {
  const stats = computeStats(readerData);
  const chains = computeChains(stats);

  // Build lookups
  const statByKey = new Map<string, Stat>(stats.map((s) => [s.key, s]));
  const tierByKey = new Map<string, number>(chains.map((c) => [c.statKey, c.currentTierIndex]));

  // Hero stat values
  const heroStats = HERO_STAT_KEYS.map((h) => ({
    ...h,
    value: statByKey.get(h.key)?.value ?? 0,
    tierIndex: tierByKey.get(h.key) ?? -1,
  }));

  // Radar axes (derived from real stats, capped at 100)
  const shippedVal = statByKey.get("shipped")?.value ?? 0;
  const speedVal = statByKey.get("speed")?.value ?? 0;
  const streakVal = statByKey.get("streak")?.value ?? 0;
  const flawlessVal = statByKey.get("flawless")?.value ?? 0;
  const ideasVal = statByKey.get("ideas")?.value ?? 0;
  const shippedTrophies = chains.filter((c) => c.currentTierIndex >= 0).length;

  const radarAxes = {
    produccion: Math.min(100, shippedVal * 20),
    velocidad: Math.min(100, speedVal > 0 ? Math.round(100 - (speedVal / 30) * 100) : 0),
    calidad: Math.min(100, flawlessVal * 33),
    constancia: Math.min(100, streakVal * 10),
    ideacion: Math.min(100, ideasVal * 10),
    alcance: Math.min(100, shippedTrophies * 8),
  };

  return (
    <section
      data-testid="stats-panel"
      data-tabular-nums="true"
      aria-label="Panel de estadísticas del gremio"
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      {/* Top row: radar (330px) + hero stat tiles (flex-1) */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* StatRadar */}
        <div
          style={{
            ...RPGPANEL,
            flexShrink: 0,
            width: "330px",
            maxWidth: "100%",
            padding: "14px",
          }}
        >
          <StatRadar axes={radarAxes} />
        </div>

        {/* HeroStat tiles — flex column */}
        <div
          style={{
            flex: 1,
            minWidth: "220px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {heroStats.map((h) => (
            <HeroStat
              key={h.key}
              label={h.label}
              iconClass={h.iconClass}
              value={h.value}
              sub={h.sub}
              tierIndex={h.tierIndex}
            />
          ))}
        </div>
      </div>

      {/* Ledger grid — 3 columns (minmax 255px) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))",
          gap: "12px",
        }}
      >
        {LEDGER_COLUMNS.map((col) => {
          const colStats = col.keys
            .map((k) => ({ stat: statByKey.get(k), tierIndex: tierByKey.get(k) ?? -1, key: k }))
            .filter(
              (x): x is { stat: Stat; tierIndex: number; key: string } => x.stat !== undefined,
            );

          if (colStats.length === 0) return null;

          return (
            <div
              key={col.title}
              style={{
                ...RPGPANEL,
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {/* Column heading */}
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "var(--font-pixel)",
                  color: "var(--color-text3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "4px",
                }}
              >
                {col.title}
              </span>

              {/* Ledger rows */}
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {colStats.map(({ stat, tierIndex, key }) => (
                  <StatLedgerRow
                    key={key}
                    stat={stat}
                    tierIndex={tierIndex}
                    iconClass={STAT_ICONS[key] ?? "ti-star"}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Legacy stat list (hidden visually, kept for backward compat with existing tests) */}
      <ul aria-hidden="true" style={{ listStyle: "none", margin: 0, padding: 0, display: "none" }}>
        {stats.map((stat) => {
          const tierIndex = tierByKey.get(stat.key) ?? -1;
          return <StatItem key={stat.key} stat={stat} tierIndex={tierIndex} />;
        })}
      </ul>
    </section>
  );
}
