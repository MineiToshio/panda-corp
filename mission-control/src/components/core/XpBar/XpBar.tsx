/**
 * CMP-09-xp-bar — Reusable honest XP bar primitive (WO-09-004)
 *
 * The single source of truth for XP progress rendering. Consumed by:
 *   - CMP-09-guild-bar (GuildBar.tsx) — guild top-bar
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
 * Traceability:
 *   AC-09-004.2, AC-09-004.3, AC-09-004.4, AC-09-004.5
 *   CMP-09-xp-bar → blueprint §3 → WO-09-004
 */

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
};

/**
 * XpBar — honest, reusable XP progress bar primitive.
 *
 * Server Component (no client state needed — all props are derived server-side).
 */
export function XpBar({ xp, next, pctToNext, label, nextTitle }: XpBarProps): React.JSX.Element {
  // Clamp to [0, 100] as a safety guard — the caller should always pass a valid value
  // but defensive clamping prevents style= overflow (AC-09-004.3 negative AC).
  const clampedPct = Math.min(100, Math.max(0, Math.round(pctToNext)));
  const faltan = Math.max(0, next - xp);

  return (
    <div data-testid="xp-bar" className="flex flex-col gap-[calc(var(--space-base)*0.25)]">
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
      <div
        data-testid="xp-bar-track"
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso XP: ${clampedPct}% hacia ${nextTitle}`}
        className="relative h-[calc(var(--space-base)*0.375)] w-full overflow-hidden rounded-[var(--radius)] bg-[var(--color-surface)]"
        style={{ boxShadow: "var(--shadow-1)" }}
      >
        <div
          data-testid="xp-bar-fill"
          data-accent="true"
          className="absolute inset-y-0 left-0 rounded-[var(--radius)] transition-[width] duration-[var(--duration-base)] ease-[var(--easing-standard)]"
          style={{
            width: `${clampedPct}%`,
            backgroundColor: "var(--color-accent)",
          }}
        />
      </div>

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
