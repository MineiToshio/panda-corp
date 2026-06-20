/**
 * CMP-13-shield — Shield crest medallion (WO-13-008, FND-3)
 *
 * The hero-level crest: 96×96 accent-bordered glowing medallion with
 * "NIVEL" label + pixel numeral.  Factored out of the inline GuildHero block.
 *
 * Design contract (rpgSkin.shield, design-tokens.json):
 *   96×96 · border-radius 14px · 2px solid var(--color-accent) border ·
 *   var(--color-accent-bg) background · glow 0 0 22px -6px var(--color-accent) ·
 *   image-rendering:pixelated · font-family:var(--font-pixel)
 *   NIVEL label: 9px pixel font, letter-spacing .14em, accent-text color
 *   Level numeral: 42px pixel font, line-height .85, accent-text color
 *
 * Rules:
 *   - Tokens only — zero hardcoded colors/spacing/radii.
 *   - glow prop: when false the box-shadow drops the outer glow (keeps the inset
 *     ring so the shape stays visible — a11y: not color-alone).
 *   - prefers-reduced-motion: the glow pulse animation (if any) is controlled by
 *     the global reduced-motion rule in globals.css (.anim disabled) — no per-
 *     component @media needed here; the static glow remains.
 *   - aria-label in Spanish (REQ-13-008).
 *   - tabular-nums: applied globally via html{} in globals.css; re-asserted on
 *     the numeral for explicitness.
 *
 * Server Component — no "use client" needed (no state, no effects).
 *
 * Traceability:
 *   AC-WO-13-008: Shield · tokens only · tabular-nums · aria-label · glow opt-out
 *   CMP-13-shield → WO-13-008 → FRD-13 REQ-13-002,003,008
 */

import type React from "react";

// ── Size scale ────────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: { outer: 64, borderRadius: 10, nivelSize: 8, levelSize: 28 },
  md: { outer: 96, borderRadius: 14, nivelSize: 9, levelSize: 42 },
  lg: { outer: 120, borderRadius: 16, nivelSize: 10, levelSize: 52 },
} as const;

export type ShieldSize = keyof typeof SIZE_MAP;

// ── Props ──────────────────────────────────────────────────────────────────────

export type ShieldProps = {
  /** Guild / operator level numeral displayed on the crest. */
  level: number;
  /**
   * Visual size of the medallion.
   * sm = 64px · md = 96px (default) · lg = 120px
   */
  size?: ShieldSize;
  /**
   * When true (default), the outer accent glow is applied.
   * Set to false to suppress the glow (e.g. in a list context to reduce noise).
   */
  glow?: boolean;
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Shield — the crest medallion that displays the operator's level.
 *
 * Consumed by GuildHero (FRD-09/10) and the achievements header (FRD-10).
 * Server Component: pure, deterministic, no I/O.
 */
export function Shield({ level, size = "md", glow = true }: ShieldProps): React.JSX.Element {
  const { outer, borderRadius, nivelSize, levelSize } = SIZE_MAP[size];

  // Glow box-shadow: outer accent glow + inset inner ring (structural — always present).
  // When glow=false we keep the inset ring (shape cue) but drop the outer glow.
  const boxShadow = glow
    ? "0 0 22px -6px var(--color-accent), inset 0 0 0 2px var(--color-card)"
    : "inset 0 0 0 2px var(--color-card)";

  return (
    <div
      data-testid="shield-root"
      data-glow={glow ? "true" : "false"}
      aria-label={`Escudo del gremio · Nivel ${level}`}
      role="img"
      style={{
        position: "relative",
        flexShrink: 0,
        width: outer,
        height: outer,
        borderRadius,
        border: "2px solid var(--color-accent)",
        background: "var(--color-accent-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow,
        imageRendering: "pixelated",
        overflow: "hidden",
      }}
    >
      {/* NIVEL label — 9px pixel font */}
      <span
        data-testid="shield-nivel-label"
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: nivelSize,
          color: "var(--color-accent-text)",
          letterSpacing: "0.14em",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        NIVEL
      </span>

      {/* Level numeral — pixel font, tabular-nums */}
      <span
        data-testid="shield-level"
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: levelSize,
          lineHeight: 0.85,
          color: "var(--color-accent-text)",
          fontVariantNumeric: "tabular-nums",
          userSelect: "none",
        }}
      >
        {level}
      </span>
    </div>
  );
}
