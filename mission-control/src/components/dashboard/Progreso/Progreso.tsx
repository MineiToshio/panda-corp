/**
 * CMP-18-progress — `Tu progreso` gamification strip (WO-18-005, REQ-18-021)
 *
 * The honest gamification strip for the dashboard "Inicio" page.
 * Shows: guild level/XP, most recent achievement, next milestone with progress.
 *
 * Design constraints (FRD-09 / FRD-13 / REQ-18-021):
 *   - All values passed as pre-computed props (Server Component or parent derives the data).
 *   - No streaks, no false urgency, no leaderboards (FRD-09 White-Hat / AC-18-005.3).
 *   - All values from real outcomes only (AC-18-005.2: no synthetic metrics).
 *   - Fresh factory (no achievements): honest "Tu primer logro te espera" state (AC-18-005.4).
 *   - XP rendered as text nodes → tabular-nums applied via globals.css (AC-18-005.5).
 *   - Zero hardcoded colors — only CSS custom properties from @theme in globals.css (FRD-13).
 *
 * Props:
 *   guildLevel     — computed by computeGuildLevel(outcomes) from lib/gamification/gamification
 *   recentAchievement — most recent unlocked Unique (null for fresh factory)
 *   nextMilestone  — best-progress ChainState (null if all maxed or no chains)
 *
 * Consumes:
 *   CMP-09-xp-bar  — XpBar primitive (honest fill, tabular-nums, accessible)
 *
 * Traceability:
 *   AC-18-005.1 — level/XP, recent achievement, next milestone rendered
 *   AC-18-005.2 — values are exactly the props passed in (no re-derivation, no inflation)
 *   AC-18-005.3 — no streak/timer/false-urgency elements
 *   AC-18-005.4 — honest empty state when recentAchievement and nextMilestone are null
 *   AC-18-005.5 — tabular-nums via text nodes; Spanish; aria-label; no interactive nesting
 *
 * Blueprint: CMP-18-progress → FRD-18 blueprint §3 → WO-18-005
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { XpBar } from "@/components/core/XpBar/XpBar";
import type { ChainState, Unique } from "@/lib/achievements/achievements";
import { type GuildLevel, RANKS } from "@/lib/gamification/gamification";

export type ProgresoProps = {
  /** Guild level derived by computeGuildLevel (IF-09-guild-xp). */
  guildLevel: GuildLevel;
  /**
   * The most recently unlocked unique achievement (sorted by date, newest first).
   * Null for a fresh factory with no earned achievements yet.
   */
  recentAchievement: Unique | null;
  /**
   * The chain closest to its next tier threshold (best honest progress).
   * Null when all chains are maxed OR when there are no chain definitions.
   */
  nextMilestone: ChainState | null;
};

/**
 * Progreso — honest gamification strip for the dashboard.
 *
 * Server Component (no client state, no I/O — all data derived and passed as props).
 * The parent (dashboard page) calls lib/* readers and computations, then passes results here.
 */
export function Progreso({
  guildLevel,
  recentAchievement,
  nextMilestone,
}: ProgresoProps): React.JSX.Element {
  // ── Milestone display ─────────────────────────────────────────────────────
  // Determine what to show for the "next milestone" slot.
  // Cases:
  //   - nextMilestone === null                 → no chains or all maxed
  //   - nextMilestone.nextTier === null        → this chain is maxed
  //   - nextMilestone.nextTier !== null        → show name + threshold
  const hasMilestone = nextMilestone !== null && nextMilestone.nextTier !== null;
  const milestoneText = hasMilestone
    ? `${nextMilestone.nextTier?.name} (${nextMilestone.nextTier?.threshold})`
    : null;

  // ── Determine the next rank title for XpBar subtitle ──────────────────────
  // XpBar shows "faltan N XP para <nextTitle>". level is 1-based; RANKS is 0-based,
  // so RANKS[level] is the next rank (same pattern as GuildBar).
  const nextRankEntry = RANKS[guildLevel.level]; // undefined at max rank
  const nextRankTitle = nextRankEntry?.title ?? guildLevel.title;

  return (
    <section
      data-testid="progreso-strip"
      aria-label="Tu progreso en el gremio"
      style={{
        background: "var(--color-base)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-1)",
        padding: "calc(var(--space-base) * 0.875) var(--space-base)",
        display: "flex",
        gap: "var(--space-base)",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {/* ── Left: recent achievement icon + text ──────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--space-base) * 0.75)",
          flex: "1",
          minWidth: "240px",
        }}
      >
        {/* Trophy icon badge (uses accent-adjacent warm tone from design tokens) */}
        <div
          style={{
            width: "42px",
            height: "42px",
            flexShrink: 0,
            borderRadius: "calc(var(--radius) * 1.125)",
            background: "color-mix(in oklch, var(--color-accent) 18%, var(--color-surface))",
            color: "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.375rem",
            userSelect: "none",
            // AC-18-005.3: no false urgency — just a static icon
          }}
          aria-hidden="true"
        >
          {recentAchievement ? "🏆" : "🎯"}
        </div>

        {/* Achievement text */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            data-testid="progreso-recent-achievement"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--color-text)",
              lineHeight: 1.3,
            }}
          >
            {recentAchievement
              ? `Logro reciente: ${recentAchievement.name}`
              : "Tu primer logro te espera"}
          </span>

          {/* Next milestone line (AC-18-005.1) */}
          {hasMilestone ? (
            <span
              data-testid="progreso-next-milestone"
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-text)",
                opacity: 0.65,
                lineHeight: 1.3,
              }}
            >
              {`Próximo hito: ${milestoneText}`}
            </span>
          ) : (
            <span
              data-testid="progreso-next-milestone"
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-text)",
                opacity: 0.65,
                lineHeight: 1.3,
              }}
            >
              Cadenas al máximo
            </span>
          )}
        </div>
      </div>

      {/* ── Right: guild level badge + XP bar ─────────────────────────── */}
      <div
        style={{
          flex: "1",
          minWidth: "200px",
          display: "flex",
          flexDirection: "column",
          gap: "calc(var(--space-base) * 0.375)",
        }}
      >
        {/* Guild level + title header (AC-18-005.1, AC-18-005.5: tabular-nums via text nodes) */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "calc(var(--space-base) * 0.5)",
          }}
        >
          <span style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-text)",
                opacity: 0.6,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Nv
            </span>
            <span
              data-testid="progreso-guild-level"
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--color-accent)",
                lineHeight: 1,
              }}
            >
              {/* tabular-nums applied via html { font-variant-numeric: tabular-nums } in globals.css */}
              {guildLevel.level}
            </span>
            <span
              data-testid="progreso-guild-title"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--color-text)",
                opacity: 0.85,
              }}
            >
              {guildLevel.title}
            </span>
          </span>

          {/* XP / next XP (AC-18-005.5: tabular-nums via text nodes) */}
          <span
            style={{
              fontSize: "0.6875rem",
              color: "var(--color-text)",
              opacity: 0.6,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            <span data-testid="progreso-xp">{guildLevel.xp}</span>
            {" / "}
            {guildLevel.next}
            {" XP"}
          </span>
        </div>

        {/* CMP-09-xp-bar: reusable honest XP bar (AC-18-005.1, AC-18-005.5) */}
        <XpBar
          xp={guildLevel.xp}
          next={guildLevel.next}
          pctToNext={guildLevel.pctToNext}
          label={guildLevel.title}
          nextTitle={nextRankTitle}
        />
      </div>
    </section>
  );
}
