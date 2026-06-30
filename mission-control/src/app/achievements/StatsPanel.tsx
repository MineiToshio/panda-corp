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

import { computeChains, metricLevel } from "@/lib/achievements/achievements";
import type { ReportScalars } from "@/lib/achievements/report/types";
import { computeStats, type ReaderData, type Stat } from "@/lib/achievements/stats";
import { tierColor } from "@/lib/achievements/tiers";

/** A "no cableado" placeholder for a ledger value with no wired source (honesty contract). */
const NO_CABLEADO_LABEL = "no cableado";

// ── Level helpers (UNBOUNDED character-sheet level — FRD-09 phase 3) ──────────────
// The displayed value is "Nv N" with NO 5-cap; the dot keeps a 5-hue band so it
// stays visually graded while the number climbs forever. `level` is 0 = sin nivel,
// 1+ = the metric's level (from metricLevel).

function getMedalLabel(level: number): string {
  return level >= 1 ? `Nv ${level}` : "—";
}

function getMedalColor(level: number): string {
  return tierColor(Math.min(Math.max(level - 1, 0), 4));
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
  const hasTier = tierIndex >= 1; // tierIndex prop now carries the unbounded level (0 = sin nivel)
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

      {/* Icon + label row — icon is accent-text (blue) like the radar header (prototype) */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <i
          className={`ti ${iconClass}`}
          aria-hidden="true"
          style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
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
          // Always the default text color (white) — the tier is shown by the badge,
          // not by recoloring the numeral (prototype heroStat .big has no color).
          color: "var(--color-text)",
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
  const hasTier = tierIndex >= 1; // tierIndex prop now carries the unbounded level (0 = sin nivel)
  const tierColor = getMedalColor(tierIndex);
  const tierLabel = getMedalLabel(tierIndex);

  return (
    <li
      data-testid="stat-ledger-row"
      data-stat-key={stat.key}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 11px",
        // The divider line between rows (prototype .ledrow border-top).
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {/* Icon — neutral gray (prototype .ledrow icon, color: text3) */}
      <i
        className={`ti ${iconClass}`}
        aria-hidden="true"
        style={{
          fontSize: "15px",
          color: "var(--color-text3)",
          flexShrink: 0,
        }}
      />

      {/* Label */}
      <span
        style={{
          fontSize: "12px",
          color: "var(--color-text2)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {stat.label}
      </span>

      {/* Unbounded level chip "Nv N" (FRD-09 phase 3) — only when the metric has a level. */}
      {hasTier && (
        <span
          data-testid="stat-ledger-level"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "9px",
            color: "var(--color-accent-text)",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {tierLabel}
        </span>
      )}

      {/* Tier node pip — 9px. Band-colored WITH glow when a level is reached; a dim
          neutral placeholder when not (every row carries a pip, for column consistency). */}
      <span
        role="img"
        aria-label={hasTier ? `Nivel: ${tierLabel}` : "Sin nivel aún"}
        title={hasTier ? tierLabel : "Sin nivel aún"}
        style={{
          width: "9px",
          height: "9px",
          borderRadius: "50%",
          background: hasTier ? tierColor : "var(--color-border-strong)",
          boxShadow: hasTier ? `0 0 7px -2px ${tierColor}` : "none",
          opacity: hasTier ? 1 : 0.4,
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
          color: "var(--color-text)",
          minWidth: "36px",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {stat.value}
      </span>
    </li>
  );
}

// ── StaticLedgerRow (scalar rows: FRDs, Commits, Tests… — no per-metric level) ──

type StaticLedgerRowProps = {
  label: string;
  iconClass: string;
  /** The numeric value, or null → "no cableado" (honesty contract, AC-10-015.7). */
  value: number | null;
};

/**
 * StaticLedgerRow — a ledger row for a wired scalar (FRDs/Commits/Projects/Tests/DR).
 *
 * Same shape as StatLedgerRow but with no tier node (these are factory totals, not
 * levelled metrics). A `null` value renders "no cableado" instead of a fabricated 0.
 * Tokens only. Server Component.
 */
function StaticLedgerRow({ label, iconClass, value }: StaticLedgerRowProps): React.JSX.Element {
  const wired = value !== null;
  return (
    <li
      data-testid="stat-ledger-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 11px",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <i
        className={`ti ${iconClass}`}
        aria-hidden="true"
        style={{ fontSize: "15px", color: "var(--color-text3)", flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: "12px",
          color: "var(--color-text2)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        data-testid="stat-ledger-value"
        className={wired ? "tabular-nums" : undefined}
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: wired ? "18px" : "11px",
          lineHeight: 1,
          color: wired ? "var(--color-text)" : "var(--color-text3)",
          minWidth: "36px",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {wired ? value : NO_CABLEADO_LABEL}
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
  const hasTier = tierIndex >= 1; // tierIndex prop now carries the unbounded level (0 = sin nivel)

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
const LEDGER_COLUMNS: Array<{ title: string; icon: string; keys: string[] }> = [
  {
    title: "Producción",
    icon: "ti-hammer",
    keys: ["shipped", "workorders", "phases", "builds", "subagents"],
  },
  {
    title: "Calidad",
    icon: "ti-shield-check",
    keys: ["flawless", "gates", "reviews", "findings", "prds", "adrs"],
  },
  {
    title: "Ritmo & alcance",
    icon: "ti-arrows-right",
    keys: ["streak", "activedays", "speed", "ideas", "agents", "modes", "discarded", "iterations"],
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
  // v2 new chains (FRD-10 §6)
  builds: "ti-building-factory-2",
  subagents: "ti-robot",
  gates: "ti-shield-check",
  reviews: "ti-checks",
  findings: "ti-bug",
  modes: "ti-adjustments",
  activedays: "ti-calendar-stats",
};

/** Hero stat config for the three record tiles (labels + subs from prototype heroStat). */
const HERO_STAT_KEYS: Array<{ key: string; label: string; iconClass: string; sub: string }> = [
  {
    key: "shipped",
    label: "Productos lanzados",
    iconClass: "ti-rocket",
    sub: "tu marca del gremio",
  },
  { key: "streak", label: "Racha récord", iconClass: "ti-flame", sub: "semanas seguidas" },
  { key: "speed", label: "Récord idea→launch", iconClass: "ti-bolt", sub: "días, lo más rápido" },
];

/**
 * The wired scalar rows appended to each ledger column so all three columns end at
 * exactly 8 rows (AC-10-015.7 — aligned, no staircase). `scalarKey` picks the value
 * from `ReportScalars` (`null` testsPassing → "no cableado"). Producción += 3, Calidad
 * += 2; Ritmo & alcance already supplies 8 keys so it has no scalar extras.
 */
const LEDGER_SCALAR_ROWS: Record<
  string,
  Array<{ label: string; iconClass: string; scalarKey: keyof ReportScalars }>
> = {
  Producción: [
    { label: "FRDs completados", iconClass: "ti-file-text", scalarKey: "frds" },
    { label: "Commits", iconClass: "ti-git-commit", scalarKey: "commits" },
    { label: "Proyectos creados", iconClass: "ti-folder", scalarKey: "projects" },
  ],
  Calidad: [
    { label: "Tests en verde", iconClass: "ti-test-pipe", scalarKey: "testsPassing" },
    { label: "Decisiones / DR", iconClass: "ti-gavel", scalarKey: "decisions" },
  ],
};

/** The three extra record tiles (2×3 grid) added by WO-10-015 (REQ-10-027). */
const EXTRA_RECORD_TILES: Array<{
  label: string;
  iconClass: string;
  sub: string;
  tierIndex: number;
}> = [
  { label: "Pico semanal", iconClass: "ti-trophy", sub: "WO en la mejor semana", tierIndex: 4 },
  { label: "Lecciones", iconClass: "ti-book-2", sub: "capturadas en memoria", tierIndex: 4 },
  { label: "Subagentes", iconClass: "ti-users-group", sub: "coordinados en total", tierIndex: 5 },
];

// ── StatsPanel props ──────────────────────────────────────────────────────────

/** The extra record-tile values (2×3 grid) — REQ-10-027. */
export type StatsRecords = {
  /** Peak WO-verified week count. */
  readonly peakWeek: number;
  /** Captured lessons in memory. */
  readonly capturedLessons: number;
  /** Subagents coordinated in total. */
  readonly subagents: number;
};

export type StatsPanelProps = {
  readerData: ReaderData;
  /** Wired scalar counts for the expanded 8-row ledger (WO-10-015). Optional → ledger
   *  shows only the levelled-metric rows (backward-compatible with WO-10-005 callers). */
  scalars?: ReportScalars;
  /** The three extra record tiles for the 2×3 grid (WO-10-015). Optional → 3 records. */
  records?: StatsRecords;
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
export function StatsPanel({ readerData, scalars, records }: StatsPanelProps): React.JSX.Element {
  const stats = computeStats(readerData);
  const chains = computeChains(stats); // radar axes only (normalized 0–100)

  // Build lookups
  const statByKey = new Map<string, Stat>(stats.map((s) => [s.key, s]));
  // UNBOUNDED per-metric level (FRD-09 phase 3) — climbs with the value, no 5-cap.
  const levelByKey = new Map<string, number>(
    stats.map((s) => [s.key, metricLevel(s.key, s.value)]),
  );

  // Hero stat values (the 3 base record tiles)
  const baseHeroStats = HERO_STAT_KEYS.map((h) => ({
    ...h,
    value: statByKey.get(h.key)?.value ?? 0,
    tierIndex: levelByKey.get(h.key) ?? 0,
  }));

  // The 2×3 records grid (WO-10-015): the 3 base tiles + Peak week / Lessons / Subagents.
  // When `records` is absent (WO-10-005 caller), only the 3 base tiles render.
  const extraValues =
    records === undefined ? [] : [records.peakWeek, records.capturedLessons, records.subagents];
  const extraHeroStats = EXTRA_RECORD_TILES.slice(0, extraValues.length).map((tile, i) => ({
    ...tile,
    value: extraValues[i] ?? 0,
  }));
  const heroStats = [...baseHeroStats, ...extraHeroStats];

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
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {/* Top row: radar (330px) + hero stat tiles (flex-1).
          align-items: stretch → the radar panel matches the hero stack height (prototype). */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "stretch" }}>
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

        {/* HeroStat tiles — a 2×3 grid when the 6 records are wired (WO-10-015),
            else the legacy 3-tile flex column (WO-10-005 callers). */}
        <div
          style={{
            flex: 1,
            minWidth: "220px",
            display: "grid",
            gridTemplateColumns: records === undefined ? "1fr" : "1fr 1fr",
            gap: "10px",
          }}
        >
          {heroStats.map((h) => (
            <HeroStat
              key={h.label}
              label={h.label}
              iconClass={h.iconClass}
              value={h.value}
              sub={h.sub}
              tierIndex={h.tierIndex}
            />
          ))}
        </div>
      </div>

      {/* Ledger grid — 3 EQUAL full-width columns. auto-fit (not auto-fill) collapses
          empty tracks so the 3 cards stretch to fill the row (prototype logrosStats). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(255px, 1fr))",
          gap: "10px",
          alignItems: "start",
        }}
      >
        {LEDGER_COLUMNS.map((col) => {
          const colStats = col.keys
            .map((k) => ({ stat: statByKey.get(k), tierIndex: levelByKey.get(k) ?? 0, key: k }))
            .filter(
              (x): x is { stat: Stat; tierIndex: number; key: string } => x.stat !== undefined,
            );

          // Wired scalar rows appended so all 3 columns end at exactly 8 rows
          // (AC-10-015.7). Only when `scalars` is provided (WO-10-015 caller).
          const scalarRows = scalars === undefined ? [] : (LEDGER_SCALAR_ROWS[col.title] ?? []);

          if (colStats.length === 0 && scalarRows.length === 0) return null;

          return (
            <div
              key={col.title}
              data-testid="stat-ledger-column"
              style={{
                ...RPGPANEL,
                padding: "5px 4px 7px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Column heading — accent-text icon (blue, like the radar header) + label */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 11px 7px",
                  fontFamily: "var(--font-pixel)",
                  fontSize: "11px",
                  color: "var(--color-text3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <i
                  className={`ti ${col.icon}`}
                  aria-hidden="true"
                  style={{ fontSize: "13px", color: "var(--color-accent-text)" }}
                />
                {col.title}
              </div>

              {/* Ledger rows — levelled metrics, then the wired scalar rows (8 total). */}
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {colStats.map(({ stat, tierIndex, key }) => (
                  <StatLedgerRow
                    key={key}
                    stat={stat}
                    tierIndex={tierIndex}
                    iconClass={STAT_ICONS[key] ?? "ti-star"}
                  />
                ))}
                {scalarRows.map((row) => (
                  <StaticLedgerRow
                    key={row.scalarKey}
                    label={row.label}
                    iconClass={row.iconClass}
                    value={scalars === undefined ? null : scalars[row.scalarKey]}
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
          const tierIndex = levelByKey.get(stat.key) ?? 0;
          return <StatItem key={stat.key} stat={stat} tierIndex={tierIndex} />;
        })}
      </ul>
    </section>
  );
}
