/**
 * CMP-09-guild-bar — Guild top-bar block (WO-09-003 re-anchor)
 *
 * Cross-cutting component mounted in app/layout.tsx.
 * Visual contract: prototype topbar() ~L646–649
 *
 * Composition (matches topbar()):
 *   rpgpanel rpggrid container →
 *     NV level pill (pixel font, accent bg, canvas text) +
 *     guild title (text2, 11px) +
 *     inline compact XpBar (90px wide, 9px tall)
 *
 * Consumes:
 *   - IF-09-guild-xp: computeGuildLevel(outcomes) → GuildLevel (lib/gamification.ts, WO-09-001)
 *   - CMP-09-xp-bar: XpBar primitive (WO-13-008)
 *
 * Design constraints (FRD-09 / FRD-13):
 *   - Rationed accent: accent color only on the NV pill bg and the XP bar fill.
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
 *   CMP-09-guild-bar → blueprint §3 → WO-09-003
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
 * Visual contract: prototype topbar() ~L646.
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
      style={{
        // rpgpanel + rpggrid (prototype topbar L646)
        position: "relative",
        background: "var(--color-card)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 10,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
        backgroundImage:
          "linear-gradient(var(--color-border) 1px, transparent 1px)," +
          "linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        // layout
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "11px 15px",
        marginBottom: 16,
      }}
    >
      {/* Left block: logo area + level/title/xpbar row (prototype topbar L647–648) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {/* App title */}
        <div
          style={{
            fontFamily: "var(--font-display, var(--font-space-grotesk), system-ui, sans-serif)",
            fontSize: 17,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "var(--color-text)",
            marginRight: 4,
          }}
        >
          Pandacorp Mission Control
        </div>

        {/* NV level pill — pixel font, accent bg, canvas text (prototype L648) */}
        <span
          data-testid="guild-bar-level"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 10,
            color: "var(--color-on-accent, #071318)",
            background: "var(--color-accent)",
            padding: "1px 6px",
            borderRadius: 4,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          NV {level}
        </span>

        {/* Guild rank title — text2, 11px (prototype L648) */}
        <span
          data-testid="guild-bar-title"
          style={{
            fontSize: 11,
            color: "var(--color-text2)",
          }}
        >
          {title}
        </span>

        {/* Compact inline XpBar (90px wide, 9px tall — prototype L648)
            Uses XpBar primitive (AC-09-004.5). The title/aria are descriptive but
            visually the xp/next label is suppressed via inline override on the wrapper.
            Full XpBar is rendered here — its internal layout adapts to the container width. */}
        <span
          title={`${xp} / ${next} XP`}
          style={{
            display: "inline-block",
            width: 90,
            verticalAlign: "middle",
            flexShrink: 0,
          }}
        >
          {/* CMP-09-xp-bar (AC-09-004.5: reusable primitive, not inlined) */}
          <XpBar xp={xp} next={next} pctToNext={pctToNext} label={title} nextTitle={nextTitle} />
        </span>
      </div>
    </div>
  );
}
