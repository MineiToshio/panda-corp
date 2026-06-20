/**
 * CMP-10-stats-panel + StatRadar — Statistics character sheet (WO-09-003 + WO-10-005)
 *
 * Renders two surfaces:
 *   1. StatRadar — the 6-axis SVG "Atributos del gremio" radar (FRD-09, AC-09-003-guild-surfaces)
 *      Faithful to prototype statRadar() ~L459. SVG viewBox "0 0 330 280".
 *   2. Stat ledger — the only-grow counters from computeStats(), each with a tier medal.
 *
 * Numbers use tabular-nums (FRD-13 AC-10-005.3).
 * Styling uses design tokens only — zero hardcoded colors.
 * Spanish labels and aria-labels (AC-10-005.5).
 *
 * Traceability:
 *   WO-09-003 / AC-09: StatRadar — prototype statRadar() re-anchored
 *   AC-10-005.2 — stats panel with computeStats() counters + tier medal
 *   AC-10-005.3 — tabular-nums on all numbers
 *   AC-10-005.5 — tokens only; Spanish labels/aria; not color-alone (medal has text)
 *
 * Blueprint: CMP-10-stats-panel (FRD-10 blueprint §4), CMP-09-radar (FRD-09 WO-09-003)
 */

import { computeChains } from "@/lib/achievements/achievements";
import { computeStats, type ReaderData, type Stat } from "@/lib/achievements/stats";

// ── StatRadar ─────────────────────────────────────────────────────────────────
// Faithful to prototype statRadar() ~L459: 6-axis SVG, accent polygon + glow,
// bd ring lines, pixel-font axis labels.
// ViewBox "0 0 330 280", cx=165, cy=140, R=90 (matches prototype).

/**
 * The 6 radar axes (prototype AX array, L460).
 * Mapped to stat keys to compute the axis percentage from chain completion.
 */
const RADAR_AXES: ReadonlyArray<{ label: string; statKey: string }> = [
  { label: "Producción", statKey: "workorders" },
  { label: "Velocidad", statKey: "speed" },
  { label: "Calidad", statKey: "flawless" },
  { label: "Constancia", statKey: "streak" },
  { label: "Ideación", statKey: "ideas" },
  { label: "Alcance", statKey: "shipped" },
] as const;

/** Number of axes */
const N_AXES = RADAR_AXES.length;

/**
 * Compute [x, y] for a radar axis point at radius r and axis index i.
 * Starts from the top (-90 degrees) and goes clockwise (matching prototype pt()).
 */
function radarPoint(i: number, r: number, cx: number, cy: number): [number, number] {
  const angle = ((-90 + (i * 360) / N_AXES) * Math.PI) / 180;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/** Format a number to 1 decimal place for SVG point strings */
function fmt(n: number): string {
  return n.toFixed(1);
}

/** Compute axis percentage (0–100) from chain completion state. */
function axisPercent(statKey: string, tierByKey: Map<string, number>, totalTiers: number): number {
  const tierIndex = tierByKey.get(statKey) ?? -1;
  if (tierIndex < 0 || totalTiers <= 0) return 8; // minimum visual, matches prototype (8%)
  const pct = Math.round(((tierIndex + 1) / totalTiers) * 100);
  return Math.max(8, Math.min(100, pct));
}

type StatRadarProps = {
  /** Map from statKey → current tier index (-1 = none) */
  tierByKey: Map<string, number>;
  /** Total number of tier levels (for % calculation) */
  totalTiers: number;
};

/**
 * StatRadar — "Atributos del gremio" SVG radar.
 *
 * Server Component. Matches prototype statRadar() ~L459 faithfully:
 *   - 6 axes, 4 background rings at 25/50/75/100% of R
 *   - Accent fill polygon + glow (drop-shadow)
 *   - Axis labels in pixel font (var(--font-pixel))
 *   - Dot on each axis vertex of the data polygon
 *
 * Tokens: --color-accent (fill + stroke), --color-border (rings/spokes), --color-text2 (labels)
 * Accessible: aria-label in Spanish, role="img"
 */
export function StatRadar({ tierByKey, totalTiers }: StatRadarProps): React.JSX.Element {
  const cx = 165;
  const cy = 140;
  const R = 90;

  // Background rings at 25 / 50 / 75 / 100% of R (prototype rings array, L463)
  const ringFractions = [0.25, 0.5, 0.75, 1.0];
  const rings = ringFractions.map((f) => {
    const pts = RADAR_AXES.map((_, i) => {
      const [x, y] = radarPoint(i, R * f, cx, cy);
      return `${fmt(x)},${fmt(y)}`;
    }).join(" ");
    return pts;
  });

  // Spoke lines from center to each axis vertex (L464)
  const spokeEnds = RADAR_AXES.map((_, i) => radarPoint(i, R, cx, cy));

  // Data polygon (one point per axis, at pct % of R) (L465)
  const dataPoints = RADAR_AXES.map((ax, i) => {
    const pct = axisPercent(ax.statKey, tierByKey, totalTiers);
    const [x, y] = radarPoint(i, R * (pct / 100), cx, cy);
    return { x, y };
  });
  const dataPolyPoints = dataPoints.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");

  // Background base polygon (full R — faint fill, L468)
  const basePts = RADAR_AXES.map((_, i) => {
    const [x, y] = radarPoint(i, R, cx, cy);
    return `${fmt(x)},${fmt(y)}`;
  }).join(" ");

  // Axis labels (L468 prototype labels — pixel font, positioned outside R+17)
  const labels = RADAR_AXES.map((ax, i) => {
    const [x, y] = radarPoint(i, R + 17, cx, cy);
    // text-anchor: "middle" when near center-x, "start" right side, "end" left side
    const anchor: "middle" | "start" | "end" =
      Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end";
    return { label: ax.label, x, y, anchor };
  });

  return (
    <div
      style={{
        position: "relative",
        background: "var(--color-card)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 10,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
        flex: "0 0 auto",
        width: 330,
        maxWidth: "100%",
        padding: "13px 12px 7px",
      }}
    >
      {/* "ATRIBUTOS DEL GREMIO" header (prototype radarwrap L536) */}
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: 11,
          color: "var(--color-text3)",
          letterSpacing: "0.05em",
          padding: "0 3px 2px",
        }}
      >
        <i
          className="ti ti-chart-radar"
          style={{
            fontSize: 13,
            verticalAlign: "-2px",
            color: "var(--color-accent-text)",
            marginRight: 4,
          }}
          aria-hidden="true"
        />
        ATRIBUTOS DEL GREMIO
      </div>

      {/* SVG radar (prototype statRadar() output, ~L469) */}
      <svg
        data-testid="stat-radar"
        role="img"
        aria-label="Radar de atributos del gremio — 6 ejes: Producción, Velocidad, Calidad, Constancia, Ideación, Alcance"
        viewBox="0 0 330 280"
        width="100%"
        style={{ display: "block", maxWidth: 340, margin: "2px auto 0" }}
      >
        {/* Background base polygon (faint fill at full R) */}
        <polygon points={basePts} style={{ fill: "var(--color-panel)", opacity: 0.45 }} />

        {/* Ring lines (grid at 25/50/75/100%) — key on fraction (stable identity) */}
        {rings.map((pts, idx) => (
          <polygon
            key={ringFractions[idx]}
            points={pts}
            style={{ fill: "none", stroke: "var(--color-border)", strokeWidth: 1 }}
          />
        ))}

        {/* Spoke lines (center → axis vertex) — key on axis label (stable) */}
        {spokeEnds.map(([x, y], idx) => (
          <line
            key={RADAR_AXES[idx]?.label ?? idx}
            x1={cx}
            y1={cy}
            x2={fmt(x)}
            y2={fmt(y)}
            style={{ stroke: "var(--color-border)", strokeWidth: 1 }}
          />
        ))}

        {/* Data polygon (accent fill + glow) */}
        <polygon
          points={dataPolyPoints}
          style={{
            fill: "var(--color-accent)",
            fillOpacity: 0.2,
            stroke: "var(--color-accent)",
            strokeWidth: 2,
            filter: "drop-shadow(0 0 5px var(--color-accent))",
          }}
        />

        {/* Data dots at each axis vertex — key on axis label (stable) */}
        {dataPoints.map((p, idx) => (
          <circle
            key={RADAR_AXES[idx]?.label ?? idx}
            cx={fmt(p.x)}
            cy={fmt(p.y)}
            r={3}
            style={{ fill: "var(--color-accent)" }}
          />
        ))}

        {/* Axis labels (pixel font, outside R+17) */}
        {labels.map((l) => (
          <text
            key={l.label}
            x={fmt(l.x)}
            y={fmt(l.y)}
            textAnchor={l.anchor}
            dominantBaseline="middle"
            style={{
              fill: "var(--color-text2)",
              fontFamily: "var(--font-pixel)",
              fontSize: 9.5,
            }}
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Tier medal helpers ────────────────────────────────────────────────────────

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
      return "var(--color-tier-1)";
    case 1:
      return "var(--color-tier-2)";
    case 2:
      return "var(--color-tier-3)";
    case 3:
      return "var(--color-tier-4)";
    case 4:
      return "var(--color-tier-5)";
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
        borderBottom: "var(--hairline) solid var(--color-base)",
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
 * StatsPanel — the achievements character sheet.
 *
 * Renders the StatRadar (6-axis SVG) + the stat ledger (counters + tier medals).
 * Server Component: receives pre-read ReaderData and renders purely.
 * No I/O, no state, no client hooks — safe to render on the server.
 */
export function StatsPanel({ readerData }: StatsPanelProps): React.JSX.Element {
  const stats = computeStats(readerData);
  const chains = computeChains(stats);

  // Build a lookup from statKey → currentTierIndex for medal display
  const tierByKey = new Map<string, number>(chains.map((c) => [c.statKey, c.currentTierIndex]));

  // Total tiers for radar percentage calculation (all chains use 5 tiers: 0..4)
  const totalTiers = 5;

  return (
    <section
      data-testid="stats-panel"
      data-tabular-nums="true"
      aria-label="Panel de estadísticas del gremio"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "calc(var(--space-base) * 1)",
      }}
    >
      {/* StatRadar — "Atributos del gremio" SVG (FRD-09 WO-09-003, prototype statRadar()) */}
      <StatRadar tierByKey={tierByKey} totalTiers={totalTiers} />

      {/* Stat ledger — counters + tier medals */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          boxShadow: "var(--shadow-1)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          border: "var(--hairline) solid var(--color-base)",
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
      </div>
    </section>
  );
}
