/**
 * CMP-09-guild-bar — Guild top-bar block (WO-09-004)
 *
 * Cross-cutting component mounted in app/layout.tsx.
 * Shows: guild level · rank title · XP bar to next rank · "faltan N para Nv X · <nextTitle>"
 *
 * Consumes:
 *   - IF-09-guild-xp: computeGuildLevel(outcomes) → GuildLevel (lib/gamification.ts, WO-09-001)
 *   - CMP-09-xp-bar: XpBar primitive (WO-09-004)
 *
 * Design constraints (FRD-09 / FRD-13):
 *   - Rationed accent: accent color only on the XP bar fill (delegated to XpBar).
 *   - Not color-alone: level number + rank title text present alongside the bar shape.
 *   - Numbers are text nodes → tabular-nums applied globally via globals.css.
 *   - Zero hardcoded colors — only CSS custom properties from @theme in globals.css.
 *   - Server Component (no interactivity needed; data is derived from outcomes).
 *
 * Traceability:
 *   AC-09-004.1 (level + title + XP bar + subtitle)
 *   AC-09-004.2 (tabular-nums via text nodes + globals.css)
 *   AC-09-004.3 (real pct-to-next from computeGuildLevel — never fake)
 *   AC-09-004.4 (rationed accent, not color-alone)
 *   AC-09-004.5 (reuses XpBar primitive)
 *   CMP-09-guild-bar → blueprint §3 → WO-09-004
 */

import { XpBar } from "@/components/core/XpBar/XpBar";
import { computeGuildLevel, type GuildOutcomes, RANKS } from "@/lib/gamification/gamification";

export type GuildBarProps = {
  /** Verifiable outcomes that drive guild XP (from status.yaml + events — read server-side). */
  outcomes: GuildOutcomes;
};

/**
 * GuildBar — guild level/XP top bar block.
 *
 * Derives level, title, xp, next, pctToNext via computeGuildLevel() (IF-09-guild-xp).
 * Delegates bar rendering to XpBar (CMP-09-xp-bar, AC-09-004.5).
 *
 * Server Component: all data is derived from the outcomes prop.
 */
export function GuildBar({ outcomes }: GuildBarProps): React.JSX.Element {
  // IF-09-guild-xp: pure derivation — same outcomes always yields same result.
  const { level, title, xp, next, pctToNext } = computeGuildLevel(outcomes);

  // Determine the next rank title for the "faltan N para Nv X · <nextTitle>" line.
  // At max rank (pctToNext === 100), nextTitle mirrors current title (no higher rank).
  const nextRankEntry = RANKS[level]; // level is 1-based; RANKS is 0-based → RANKS[level] = next rank
  const nextTitle = nextRankEntry?.title ?? title;

  return (
    <div
      data-testid="guild-bar"
      className="flex items-center gap-[var(--space-base)] px-[var(--space-base)] py-[calc(var(--space-base)*0.5)]"
      style={{
        borderBottom:
          "var(--hairline) solid color-mix(in oklch, var(--color-text) 15%, transparent)",
      }}
    >
      {/* Guild level badge (AC-09-004.1: level number; AC-09-004.2: text node for tabular-nums) */}
      <div className="flex flex-col items-center shrink-0">
        <span className="text-[var(--color-text)] text-xs opacity-60 leading-none uppercase tracking-wide">
          Nv
        </span>
        <span
          data-testid="guild-bar-level"
          className="text-[var(--color-accent)] text-xl font-bold leading-none"
        >
          {level}
        </span>
      </div>

      {/* Rank title + XP bar (AC-09-004.1, AC-09-004.4: label alongside bar) */}
      <div className="flex flex-col gap-[calc(var(--space-base)*0.25)] min-w-0 flex-1">
        <span
          data-testid="guild-bar-title"
          className="text-[var(--color-text)] text-sm font-semibold leading-none truncate"
        >
          {title}
        </span>

        {/* CMP-09-xp-bar (AC-09-004.5: reusable primitive, not inlined) */}
        <XpBar xp={xp} next={next} pctToNext={pctToNext} label={title} nextTitle={nextTitle} />
      </div>
    </div>
  );
}
