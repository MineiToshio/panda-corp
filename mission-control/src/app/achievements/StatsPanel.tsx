/**
 * CMP-10-stats-panel — Statistics character sheet (WO-10-005)
 * CMP-09-stat-radar — "Atributos del gremio" 6-axis SVG radar (WO-09-003)
 *
 * Renders the only-grow counters from computeStats(), each with a tier medal.
 * Also exports StatRadar: the 6-axis SVG radar matching prototype statRadar() (~L459).
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

import { computeChains } from "@/lib/achievements/achievements";
import { computeStats, type ReaderData, type Stat } from "@/lib/achievements/stats";

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

// ── StatRadar ─────────────────────────────────────────────────────────────────

/**
 * StatRadar axes — the 6 guild attribute dimensions.
 * Keys match prototype AX array: Producción/velocidad/calidad/constancia/ideacion/lanzados.
 */
export interface StatRadarAxes {
  /** Producción axis value 0–100 */
  produccion: number;
  /** Velocidad axis value 0–100 */
  velocidad: number;
  /** Calidad axis value 0–100 */
  calidad: number;
  /** Constancia axis value 0–100 */
  constancia: number;
  /** Ideación axis value 0–100 */
  ideacion: number;
  /** Alcance axis value 0–100 */
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
 * Token slice: --color-accent, --color-border, --font-pixel, --color-text2
 *
 * Visual reference: prototype statRadar() ~L459
 */
export function StatRadar({ axes }: StatRadarProps): React.JSX.Element {
  // 6 axes in prototype order (top → clockwise)
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

  /** Convert (axis index, radius fraction) → SVG [x, y] */
  function pt(i: number, r: number): [number, number] {
    const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  /** Build a polygon points string for `n` axes at radius fraction `f` */
  function ringPoints(f: number): string {
    return AX.map((_, i) => {
      const [x, y] = pt(i, R * f);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  // Data points: clamp value to [8, 100] (prototype: Math.max(8, Math.min(100, …)))
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
      {/* "ATRIBUTOS DEL GREMIO" header label */}
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
        {/* Base (panel background) polygon */}
        <polygon points={basePts} style={{ fill: "var(--color-panel)", opacity: 0.45 }} />

        {/* 4 grid rings — use SVG presentation attributes so getAttribute("stroke") works in jsdom */}
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

        {/* 6 spoke lines — keyed by axis label (stable, non-index) */}
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

        {/* Data polygon — accent fill + stroke + glow
            Use SVG presentation attributes so getAttribute("stroke"/"fill") works in jsdom */}
        <polygon
          data-testid="radar-data-polygon"
          points={dataPts}
          fill="var(--color-accent)"
          fillOpacity={0.2}
          stroke="var(--color-accent)"
          strokeWidth={2}
          style={{ filter: "drop-shadow(0 0 5px var(--color-accent))" }}
        />

        {/* 6 accent dots — keyed by axis label */}
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

        {/* Axis labels — pixel font, text-anchor per quadrant, keyed by label */}
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

// ── StatsPanel ────────────────────────────────────────────────────────────────

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
