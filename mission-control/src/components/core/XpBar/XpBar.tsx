/**
 * CMP-09-xp-bar — Reusable honest XP bar primitive (WO-09-004; extended WO-09-003)
 *
 * The single source of truth for XP progress rendering. Consumed by:
 *   - CMP-09-guild-bar (GuildBar.tsx) — guild top-bar (compact: 90px×9px inline)
 *   - GuildHero (achievements page hero) — full size (18px tall)
 *   - FRD-07 agent detail section (future)
 *   - FRD-10 achievements hall (future)
 *
 * Design constraints (FRD-09 / FRD-13):
 *   - NEVER renders fake fill. pctToNext is passed in from computeGuildLevel() / computeAgentLevel().
 *   - Rationed accent: --color-accent on the fill only (the "one thing that matters").
 *   - Not color-alone: label + bar shape present alongside the accent fill.
 *   - Numbers are text nodes so the global `font-variant-numeric: tabular-nums` from
 *     globals.css applies (AC-09-004.2, AC-13-003.1).
 *   - Accessible: role="progressbar" with aria-valuenow / aria-valuemin / aria-valuemax.
 *   - Zero hardcoded colors — all values from CSS custom properties (design-tokens).
 *
 * size variants (WO-09-003):
 *   "compact" — 9px tall, fixed 90px wide, no labels; used in GuildBar inline (topbar)
 *   "full"    — 18px tall, FULL width, label + subtitle rows; used in GuildHero, FRD-10 (default)
 *   "track"   — 18px tall, FULL width, NO labels (just the bar); for callers that render their
 *               own label row (the dashboard "Tu progreso" foot, prototype index.html ~L741)
 *
 * Traceability:
 *   AC-09-004.2, AC-09-004.3, AC-09-004.4, AC-09-004.5
 *   CMP-09-xp-bar → blueprint §3 → WO-09-004 / WO-09-003
 */

type XpBarSize = "compact" | "full" | "track";

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
   * Visual size variant.
   * "compact" = 9px tall inline (GuildBar topbar); "full" = 18px tall with labels (default).
   */
  size?: XpBarSize;
  /**
   * Fill color (CSS token). Defaults to the rationed accent. Chain cards pass a
   * per-tier color so the bar reads in its tier's hue (prototype TIERC), without
   * forking the bar primitive.
   */
  fillColor?: string;
  /** Track height in px for the "track" variant (default 18). Chain bars use 9–14. */
  trackHeight?: number;
};

/**
 * The full-size bar track (18px tall, full width, 7px radius) — the prototype `.xpbar`.
 * Shared by the "full" and "track" variants (rule-of-three: same track, two callers).
 * Carries the progressbar role + ARIA, the accent fill, and the segmented stripe overlay.
 */
function FullTrack({
  clampedPct,
  nextTitle,
  fillColor = "var(--color-accent)",
  height = 18,
}: {
  clampedPct: number;
  nextTitle: string;
  fillColor?: string;
  height?: number;
}): React.JSX.Element {
  const isAccent = fillColor === "var(--color-accent)";
  return (
    <div
      data-testid="xp-bar-track"
      role="progressbar"
      aria-valuenow={clampedPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso XP: ${clampedPct}% hacia ${nextTitle}`}
      style={{
        position: "relative",
        height: `${height}px`,
        borderRadius: "7px",
        border: "1px solid var(--color-border-strong)",
        background: "var(--color-base)",
        overflow: "hidden",
      }}
    >
      <div
        data-testid="xp-bar-fill"
        data-accent={isAccent ? "true" : undefined}
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: `${clampedPct}%`,
          background: fillColor,
          transition: "width 0.6s",
        }}
      />
      {/* Segmented stripe overlay (prototype .xpbar::after) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(90deg, transparent 0 16px, var(--color-base) 16px 18px)",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/**
 * XpBar — honest, reusable XP progress bar primitive.
 *
 * Server Component (no client state needed — all props are derived server-side).
 *
 * size="compact" — 9px tall, no label/subtitle rows; inline in GuildBar (topbar).
 *   data-size="compact" on root; carries title attribute with "{xp} / {next} XP".
 * size="full" (default) — 18px tall with label + subtitle rows; GuildHero / FRD-10.
 */
export function XpBar({
  xp,
  next,
  pctToNext,
  label,
  nextTitle,
  size = "full",
  fillColor = "var(--color-accent)",
  trackHeight = 18,
}: XpBarProps): React.JSX.Element {
  // Clamp to [0, 100] as a safety guard — the caller should always pass a valid value
  // but defensive clamping prevents style= overflow (AC-09-004.3 negative AC).
  const clampedPct = Math.min(100, Math.max(0, Math.round(pctToNext)));
  const faltan = Math.max(0, next - xp);

  // ── Compact variant: 9px inline bar (topbar guild section) ────────────────
  if (size === "compact") {
    return (
      <div
        data-testid="xp-bar"
        data-size="compact"
        title={`${xp} / ${next} XP`}
        style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
      >
        {/* Hidden XP values for tests (tabular-nums, AC-09-004.2) */}
        <span data-testid="xp-bar-xp" style={{ display: "none" }}>
          {xp}
        </span>
        <span data-testid="xp-bar-next" style={{ display: "none" }}>
          {next}
        </span>

        {/* Bar track */}
        <div
          data-testid="xp-bar-track"
          role="progressbar"
          aria-valuenow={clampedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso XP: ${clampedPct}% hacia ${nextTitle}`}
          style={{
            position: "relative",
            width: "90px",
            // Taller than the prototype's 9px — the thin line read as broken in the topbar.
            height: "14px",
            borderRadius: "6px",
            border: "1px solid var(--color-border-strong)",
            background: "var(--color-base)",
            overflow: "hidden",
          }}
        >
          <div
            data-testid="xp-bar-fill"
            data-accent="true"
            style={{
              position: "absolute",
              inset: "0 auto 0 0",
              width: `${clampedPct}%`,
              background: "var(--color-accent)",
              transition: "width 0.6s",
            }}
          />
          {/* Segmented stripe overlay (prototype .xpbar::after) */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(90deg, transparent 0 16px, var(--color-base) 16px 18px)",
              opacity: 0.5,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Hidden next-label for test compatibility */}
        <span data-testid="xp-bar-next-label" style={{ display: "none" }}>
          {clampedPct < 100 ? `faltan ${faltan} XP para ${nextTitle}` : nextTitle}
        </span>
      </div>
    );
  }

  // ── Track variant: full-width 18px bar only, no label rows ────────────────
  // For callers that render their own label row (the dashboard "Tu progreso" foot).
  if (size === "track") {
    return (
      <div data-testid="xp-bar" data-size="track">
        <FullTrack
          clampedPct={clampedPct}
          nextTitle={nextTitle}
          fillColor={fillColor}
          height={trackHeight}
        />
      </div>
    );
  }

  // ── Full variant (default): 18px bar with label + subtitle ────────────────
  return (
    <div
      data-testid="xp-bar"
      data-size="full"
      className="flex flex-col gap-[calc(var(--space-base)*0.25)]"
    >
      {/* Label row: current rank + numeric XP / next */}
      <div className="flex items-baseline justify-between gap-2">
        <span
          data-testid="xp-bar-label"
          className="font-medium text-[var(--color-text)] text-sm leading-none"
        >
          {label}
        </span>
        <span className="text-[var(--color-text)] text-xs leading-none opacity-70">
          {/* tabular-nums applied via html { font-variant-numeric: tabular-nums } in globals.css */}
          <span data-testid="xp-bar-xp">{xp}</span>
          {" / "}
          <span data-testid="xp-bar-next">{next}</span>
          {" XP"}
        </span>
      </div>

      {/* Bar track + fill (shape + accent — not color alone) */}
      <FullTrack clampedPct={clampedPct} nextTitle={nextTitle} />

      {/* "faltan N para Nv X · <nextTitle>" subtitle */}
      <span
        data-testid="xp-bar-next-label"
        className="text-[var(--color-text)] text-xs leading-none opacity-60"
      >
        {clampedPct < 100 ? `faltan ${faltan} XP para ${nextTitle}` : nextTitle}
      </span>
    </div>
  );
}
