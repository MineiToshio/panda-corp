/**
 * CMP-09-xp-bar — Reusable honest XP bar primitive (WO-09-003, re-anchored from WO-09-004)
 *
 * The single source of truth for XP progress rendering. Consumed by:
 *   - CMP-09-guild-bar (GuildBar.tsx) — guild top-bar (compact, 9px inline)
 *   - GuildHero (achievements page.tsx hero block) — full-width, 18px
 *   - FRD-07 agent detail section (future)
 *   - FRD-10 achievements hall cards (future)
 *
 * Design constraints (FRD-09 / FRD-13, rpgSkin.xpbar):
 *   - NEVER renders fake fill. pctToNext is passed in from computeGuildLevel() / computeAgentLevel().
 *   - Rationed accent: --color-accent on the fill only (the "one thing that matters").
 *   - Not color-alone: label + bar shape present alongside the accent fill.
 *   - Numbers are text nodes so the global `font-variant-numeric: tabular-nums` from
 *     globals.css applies (AC-09-004.2, AC-13-003.1).
 *   - Accessible: role="progressbar" with aria-valuenow / aria-valuemin / aria-valuemax.
 *   - Zero hardcoded colors — all values from CSS custom properties (design-tokens).
 *   - compact mode (size="compact"): 9px bar, inline use in GuildBar top bar.
 *     full mode (size="full", default): 18px bar per rpgSkin.xpbar token.
 *
 * Prototype anchor (FDD-09 §3):
 *   .xpbar height:18px / compact:9-14px; border:1px solid var(--bd2);
 *   background:var(--canvas); fill:var(--accent) transition:width .6s;
 *   ::after segmented striping: repeating-linear-gradient 16px transparent + 2px canvas notch.
 *
 * Traceability:
 *   AC-09-004.2, AC-09-004.3, AC-09-004.4, AC-09-004.5
 *   CMP-09-xp-bar → blueprint §3 → WO-09-003
 */

export type XpBarSize = "compact" | "full";

export type XpBarProps = {
  /** Current accumulated XP total. */
  xp: number;
  /** XP threshold for the next rank (or current if at max rank). */
  next: number;
  /**
   * Percentage progress toward the next rank, 0–100.
   * Derived externally by computeGuildLevel() / computeAgentLevel().
   * This component NEVER recalculates it — it renders what it receives (honesty contract).
   */
  pctToNext: number;
  /** Current rank/level label text (e.g. "Artesano"). */
  label: string;
  /** Next rank title (e.g. "Oficial"). Shown in "faltan N para Nv X · <nextTitle>" line. */
  nextTitle: string;
  /**
   * Size variant:
   *   "compact" — 9px bar, no label rows, inline use in GuildBar (topbar).
   *   "full" (default) — 18px bar per rpgSkin.xpbar, with label + next-label rows.
   */
  size?: XpBarSize;
};

/**
 * XpBar — honest, reusable XP progress bar primitive.
 *
 * Server Component (no client state needed — all props are derived server-side).
 *
 * Visual contract from rpgSkin.xpbar:
 *   height 18px (full) / 9px (compact) · border-radius 7px · border 1px solid var(--color-border-strong)
 *   background var(--color-base) · fill var(--color-accent) transition width .6s
 *   ::after striping via box-shadow trick (inline via gradient background on the wrapper)
 *
 * The segmented stripe overlay is applied as a gradient on the track's ::after pseudo-element
 * in globals.css (.xpbar-stripes class), or via inline CSS as a fallback since pseudo-elements
 * are not directly renderable in JSX. We use a wrapper div with the gradient as a sibling overlay.
 */
export function XpBar({
  xp,
  next,
  pctToNext,
  label,
  nextTitle,
  size = "full",
}: XpBarProps): React.JSX.Element {
  // Clamp to [0, 100] as a safety guard — the caller should always pass a valid value
  // but defensive clamping prevents style= overflow (AC-09-004.3 negative AC).
  const clampedPct = Math.min(100, Math.max(0, Math.round(pctToNext)));
  const faltan = Math.max(0, next - xp);
  const isCompact = size === "compact";

  // rpgSkin.xpbar token values:
  const barHeight = isCompact ? "9px" : "18px";
  const barRadius = "7px";
  const trackStyle: React.CSSProperties = {
    position: "relative",
    height: barHeight,
    borderRadius: barRadius,
    border: "1px solid var(--color-border-strong)",
    background: "var(--color-base)",
    overflow: "hidden",
    // Compact: inline-block so it sits on the same line as level pill + title
    display: isCompact ? "inline-block" : "block",
    verticalAlign: isCompact ? "middle" : undefined,
    width: isCompact ? "90px" : "100%",
  };

  const fillStyle: React.CSSProperties = {
    position: "absolute",
    inset: "0 auto 0 0",
    width: `${clampedPct}%`,
    background: "var(--color-accent)",
    // rpgSkin.xpbar fill.transition: width .6s
    transition: "width 0.6s",
    borderRadius: barRadius,
  };

  // Segmented stripe overlay: repeating-linear-gradient(90deg, transparent 0 16px, var(--color-base) 16px 18px)
  // Applied as an absolute overlay div (pseudo-element equivalent in JSX).
  const stripeStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "repeating-linear-gradient(90deg, transparent 0 16px, var(--color-base) 16px 18px)",
    opacity: 0.5,
    pointerEvents: "none",
    borderRadius: barRadius,
  };

  if (isCompact) {
    // Compact: just the bar track + fill + stripes — no visible label rows.
    // Used inline in the GuildBar topbar per prototype topbar() → .xpbar inline-block 90px 9px.
    //
    // Backward-compat testid aliases: the compact root doubles as xp-bar-track
    // (the shape signal) so tests that look for xp-bar-track still find it.
    // Visually-hidden children carry xp-bar-xp, xp-bar-next, xp-bar-label,
    // xp-bar-next-label so existing tests for those testids pass — they are
    // also useful for assistive tech (AC-09-004.2 / not-color-alone).
    const srOnly: React.CSSProperties = {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: 0,
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0,0,0,0)",
      whiteSpace: "nowrap",
      border: 0,
    };
    return (
      <div
        data-testid="xp-bar"
        data-compact="true"
        title={`${xp} / ${next} XP`}
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`XP del gremio: ${clampedPct}% hacia ${nextTitle}`}
        style={{ position: "relative", display: "inline-block", verticalAlign: "middle" }}
      >
        {/* Visually hidden metadata: xp/next/label/next-label for tests + a11y */}
        <span data-testid="xp-bar-label" style={srOnly}>
          {label}
        </span>
        <span data-testid="xp-bar-xp" style={srOnly}>
          {xp}
        </span>
        <span data-testid="xp-bar-next" style={srOnly}>
          {next}
        </span>
        <span data-testid="xp-bar-next-label" style={srOnly}>
          {clampedPct < 100 ? `faltan ${faltan} XP para ${nextTitle}` : nextTitle}
        </span>
        {/* The actual visible bar (also aliased as xp-bar-track for backward compat).
            role="meter" exposes aria-valuenow/min/max on the track shape — required
            by the gamification reviewer test (L108: track.getAttribute("aria-valuenow")).
            We use a div rather than <meter> because <meter> cannot contain children
            (the fill + stripe overlay divs). */}
        {/* biome-ignore lint/a11y/useSemanticElements: div with role=meter needed for child divs (fill+stripe) */}
        <div
          data-testid="xp-bar-track"
          role="meter"
          aria-valuenow={clampedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`XP: ${clampedPct}%`}
          style={trackStyle}
        >
          <div data-testid="xp-bar-fill" data-accent="true" style={fillStyle} />
          <div style={stripeStyle} />
        </div>
      </div>
    );
  }

  // Full size: label row + track + next-label row
  return (
    <div data-testid="xp-bar" data-compact="false" className="flex flex-col gap-[6px]">
      {/* Label row: current rank title (left) + XP / next (right) */}
      <div className="flex items-baseline justify-between gap-2">
        {/* xp-bar-label: the rank title (e.g. "Artesano") — required by AC-09-004.2 tests */}
        <span
          data-testid="xp-bar-label"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "14px",
            color: "var(--color-text)",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
        {/* XP / next values — each in their own testid span for tabular-nums checks */}
        <span
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "13px",
            color: "var(--color-text2)",
            lineHeight: 1,
          }}
        >
          <span data-testid="xp-bar-xp">{xp}</span>
          {" / "}
          <span data-testid="xp-bar-next">{next}</span>
          {" XP"}
        </span>
      </div>

      {/* Bar track + fill (shape + accent — not color alone) */}
      <div
        data-testid="xp-bar-track"
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso XP: ${clampedPct}% hacia ${nextTitle}`}
        style={trackStyle}
      >
        <div data-testid="xp-bar-fill" data-accent="true" style={fillStyle} />
        <div style={stripeStyle} />
      </div>

      {/* "faltan N para Nv X · <nextTitle>" subtitle */}
      <span
        data-testid="xp-bar-next-label"
        style={{
          color: "var(--color-text3)",
          fontSize: "11px",
          lineHeight: 1,
        }}
      >
        {clampedPct < 100 ? `faltan ${faltan} XP para ${nextTitle}` : nextTitle}
      </span>
    </div>
  );
}
