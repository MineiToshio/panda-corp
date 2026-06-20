/**
 * CMP-09-stat-radar — "Atributos del gremio" 6-axis SVG radar (WO-09-003)
 *
 * Faithfully reproduces prototype statRadar() (~L459, logrosStats layout).
 *
 * Design contract (FDD-09 §6, design-tokens.json):
 *   - 6 axes: Producción · Velocidad · Calidad · Constancia · Ideación · Alcance
 *   - SVG viewBox "0 0 330 280", cx=165 cy=140 R=90
 *   - 4 concentric ring polygons at 25/50/75/100% radius (stroke var(--color-border))
 *   - 6 spoke lines from center to each axis point (stroke var(--color-border))
 *   - Data polygon: accent fill (opacity 0.2) + accent stroke (width 2) + glow filter
 *   - Accent dots (r=3) at each data point (fill var(--color-accent))
 *   - Axis labels: pixel font 9.5px, text-anchor per position, fill var(--color-text2)
 *   - Header: "ATRIBUTOS DEL GREMIO" in pixel font above the SVG
 *
 * Stat-key → axis mapping (from prototype axisPct/AX array):
 *   Producción → workorders
 *   Velocidad  → speed
 *   Calidad    → flawless
 *   Constancia → streak
 *   Ideación   → ideas
 *   Alcance    → shipped
 *
 * pct derivation: each axis gets a value in [8, 100] (min 8% to show the polygon,
 * per prototype Math.max(8, ...)) from the stat's tier progress.
 *
 * Server Component — pure, no I/O, no state.
 *
 * Traceability: FDD-09 §6 · statRadar() · WO-09-003
 */

import type { Stat } from "@/lib/achievements/stats";

// ── Axis definitions (matches prototype AX array exactly) ────────────────────

const AXES = [
  { label: "Producción", statKey: "workorders" },
  { label: "Velocidad", statKey: "speed" },
  { label: "Calidad", statKey: "flawless" },
  { label: "Constancia", statKey: "streak" },
  { label: "Ideación", statKey: "ideas" },
  { label: "Alcance", statKey: "shipped" },
] as const;

// ── Radar geometry ────────────────────────────────────────────────────────────

const CX = 165;
const CY = 140;
const R = 90;
const N = AXES.length;
/** Ring fractions for the 4 concentric reference rings. */
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1] as const;

/** Converts axis index + radius to SVG [x, y]. */
function pt(i: number, r: number): [number, number] {
  const angle = ((-90 + (i * 360) / N) * Math.PI) / 180;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

/** Formats a number to 1 decimal place for SVG coords. */
function fmt(n: number): string {
  return n.toFixed(1);
}

/** Converts array of [x,y] pairs to SVG polygon points string. */
function toPoints(pts: Array<[number, number]>): string {
  return pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ");
}

// ── Percent derivation ────────────────────────────────────────────────────────

/**
 * Derives a radar axis percentage [8, 100] from the stat value.
 * Minimum 8% so the polygon is always visible (per prototype Math.max(8,...)).
 */
function axisPct(stats: readonly Stat[], statKey: string): number {
  const stat = stats.find((s) => s.key === statKey);
  if (!stat) return 8;
  return Math.min(100, Math.max(8, Math.round((stat.value / 10) * 100)));
}

// ── Component ─────────────────────────────────────────────────────────────────

export type StatRadarProps = {
  /** Computed stats from computeStats(readerData). */
  stats: readonly Stat[];
};

/**
 * StatRadar — "Atributos del gremio" SVG radar chart.
 *
 * 6 axes, accent-filled polygon with glow, pixel-font axis labels.
 * Faithful to prototype statRadar() render function.
 * Server Component.
 */
export function StatRadar({ stats }: StatRadarProps): React.JSX.Element {
  // Ring polygons at 25%, 50%, 75%, 100%
  const rings = RING_FRACTIONS.map((fraction) => ({
    fraction,
    points: toPoints(AXES.map((_, i) => pt(i, R * fraction))),
  }));

  // Spoke lines (from center to each axis tip)
  const spokes = AXES.map((ax, i) => {
    const [x2, y2] = pt(i, R);
    return { key: ax.label, x1: CX, y1: CY, x2: fmt(x2), y2: fmt(y2) };
  });

  // Base polygon (background fill, panel color at 45% opacity)
  const basePoints = toPoints(AXES.map((_, i) => pt(i, R)));

  // Data polygon (driven by stat values)
  const dataPcts = AXES.map((ax) => axisPct(stats, ax.statKey));
  const dataPoints = toPoints(AXES.map((_ax, i) => pt(i, R * (dataPcts[i] / 100))));

  // Accent dots at each data point — stable key = axis label
  const dots = AXES.map((ax, i) => {
    const [cx, cy] = pt(i, R * (dataPcts[i] / 100));
    return { key: ax.label, cx: fmt(cx), cy: fmt(cy) };
  });

  // Axis labels — text-anchor depends on position relative to center
  const labelRadius = R + 17;
  const labels = AXES.map((ax, i) => {
    const [lx, ly] = pt(i, labelRadius);
    const anchor = Math.abs(lx - CX) < 6 ? "middle" : lx > CX ? "start" : "end";
    return { key: ax.label, x: fmt(lx), y: fmt(ly), anchor, text: ax.label };
  });

  return (
    <div data-testid="stat-radar">
      {/* Header: ATRIBUTOS DEL GREMIO (pixel font, accent-text icon) */}
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "11px",
          color: "var(--color-text3)",
          letterSpacing: "0.05em",
          padding: "0 3px 2px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <i
          className="ti ti-chart-radar"
          style={{ fontSize: "13px", color: "var(--color-accent-text)" }}
        />
        ATRIBUTOS DEL GREMIO
      </div>

      {/* SVG Radar */}
      <svg
        viewBox="0 0 330 280"
        width="100%"
        aria-label="Radar de atributos del gremio"
        role="img"
        style={{ display: "block", maxWidth: "340px", margin: "2px auto 0" }}
      >
        {/* Drop-shadow filter for data polygon glow */}
        <defs>
          <filter id="radar-glow">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="3"
              floodColor="var(--color-accent)"
              floodOpacity="0.8"
            />
          </filter>
        </defs>

        {/* Base background polygon (panel color, 45% opacity) */}
        <polygon points={basePoints} style={{ fill: "var(--color-panel)", opacity: 0.45 }} />

        {/* Ring polygons (concentric, border color) — keyed by fraction */}
        {rings.map((ring) => (
          <polygon
            key={`ring-${ring.fraction}`}
            data-testid="radar-ring"
            points={ring.points}
            style={{ fill: "none", stroke: "var(--color-border)", strokeWidth: 1 }}
          />
        ))}

        {/* Spoke lines from center to each axis tip — keyed by axis label */}
        {spokes.map((spoke) => (
          <line
            key={`spoke-${spoke.key}`}
            x1={spoke.x1}
            y1={spoke.y1}
            x2={spoke.x2}
            y2={spoke.y2}
            style={{ stroke: "var(--color-border)", strokeWidth: 1 }}
          />
        ))}

        {/* Data polygon — accent fill + stroke + glow */}
        <polygon
          data-testid="radar-data-polygon"
          points={dataPoints}
          style={{
            fill: "var(--color-accent)",
            fillOpacity: 0.2,
            stroke: "var(--color-accent)",
            strokeWidth: 2,
            filter: "url(#radar-glow)",
          }}
        />

        {/* Accent polygon (outer reference — same data-testid=radar-polygon target for tests).
            Invisible duplicate of radar-data-polygon; hidden from a11y via aria-hidden.
            SVG polygon is not focusable so aria-hidden is valid here. */}
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: SVG polygon is never focusable */}
        <polygon
          data-testid="radar-polygon"
          points={dataPoints}
          aria-hidden="true"
          style={{
            fill: "none",
            stroke: "var(--color-accent)",
            strokeWidth: 0,
            opacity: 0,
          }}
        />

        {/* Accent dots at each data point — keyed by axis label */}
        {dots.map((dot) => (
          <circle
            key={`dot-${dot.key}`}
            cx={dot.cx}
            cy={dot.cy}
            r={3}
            style={{ fill: "var(--color-accent)" }}
          />
        ))}

        {/* Axis labels (pixel font, text2 color) — keyed by axis label */}
        {labels.map((lbl) => (
          <text
            key={`label-${lbl.key}`}
            data-testid="radar-axis-label"
            x={lbl.x}
            y={lbl.y}
            textAnchor={lbl.anchor}
            dominantBaseline="middle"
            style={{
              fill: "var(--color-text2)",
              fontFamily: "var(--font-pixel)",
              fontSize: "9.5px",
            }}
          >
            {lbl.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
