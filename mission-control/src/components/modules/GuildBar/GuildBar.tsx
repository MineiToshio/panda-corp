/**
 * CMP-09-guild-bar — Guild top-bar block (WO-09-003, re-anchored to prototype topbar())
 *
 * Cross-cutting component mounted in app/layout.tsx.
 * Shows: Pandacorp logo crest · app title · NV level pill · guild title · compact XpBar
 *
 * Prototype anchor (FDD-09 §1, topbar() ~L646):
 *   .rpgpanel .rpggrid container → logo img (44px, rounded) → app title (display font) →
 *   NV pill (px font, 10px, canvas-on-accent) → guild title (11px, text2) →
 *   inline compact .xpbar (90px, 9px, vertical-align:middle, title attr)
 *
 * Consumes:
 *   - IF-09-guild-xp: computeGuildLevel(outcomes) → GuildLevel (lib/gamification.ts, WO-09-001)
 *   - CMP-09-xp-bar: XpBar primitive with size="compact" (WO-09-003)
 *
 * Design constraints (FRD-09 / FRD-13):
 *   - Rationed accent: accent color on the level pill fill + XP bar fill only.
 *   - Not color-alone: level number + rank title text present alongside the bar shape.
 *   - Numbers use the pixel font family (rpgSkin.xpbar, typography.families.pixel).
 *   - tabular-nums applied globally via html{} in globals.css.
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
 * Faithfully reproduces prototype topbar() structure:
 *   logo crest → app title → NV pill (pixel font, accent fill) → guild title → compact XpBar
 *
 * Derives level, title, xp, next, pctToNext via computeGuildLevel() (IF-09-guild-xp).
 * Delegates bar rendering to XpBar compact (CMP-09-xp-bar, AC-09-004.5).
 *
 * Server Component: all data is derived from the outcomes prop.
 */
export function GuildBar({ outcomes }: GuildBarProps): React.JSX.Element {
  // IF-09-guild-xp: pure derivation — same outcomes always yields same result.
  const { level, title, xp, next, pctToNext } = computeGuildLevel(outcomes);

  // Determine the next rank title for the XpBar subtitle.
  // level is 1-based; RANKS is 0-based → RANKS[level] = next rank entry.
  const nextRankEntry = RANKS[level];
  const nextTitle = nextRankEntry?.title ?? title;

  return (
    <div
      data-testid="guild-bar"
      style={{
        // rpgSkin.rpgpanel + rpggrid: the embossed panel skin
        position: "relative",
        background: "var(--color-card)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "10px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
        // rpggrid 22px texture overlay (via backgroundImage)
        backgroundImage:
          "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        padding: "11px 15px",
        marginBottom: "16px",
      }}
    >
      {/* Left side: logo + title + level pill + guild title + compact XpBar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        {/* Pandacorp logo crest (44px, pixel-art, accent glow) */}
        {/* biome-ignore lint/performance/noImgElement: logo crest — fixed asset, no Next.js Image needed */}
        <img
          src="/prototype/assets/pandacorp.png"
          alt="Pandacorp"
          data-testid="guild-bar-logo"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            border: "1px solid var(--color-border-strong)",
            boxShadow: "0 0 16px -8px var(--color-accent)",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />

        {/* App title + level pill row */}
        <div>
          {/* App title (display font, 17px) */}
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "17px",
              lineHeight: 1.05,
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            Pandacorp Mission Control
          </div>

          {/* Level pill row: NV pill · guild title · compact XpBar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px",
              flexWrap: "wrap",
            }}
          >
            {/* NV {n} pill — pixel font, accent fill, canvas text (AC-09-004.1/2) */}
            <span
              data-testid="guild-bar-level-pill"
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "10px",
                color: "var(--color-on-accent)",
                background: "var(--color-accent)",
                padding: "1px 6px",
                borderRadius: "4px",
                // tabular-nums via globals.css html{}; re-asserted for explicitness
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {/* guild-bar-level kept for backward compat with existing tests */}
              NV{" "}
              <span data-testid="guild-bar-level" style={{ display: "inline" }}>
                {level}
              </span>
            </span>

            {/* Guild title (11px, text2) */}
            <span
              data-testid="guild-bar-title"
              style={{
                fontSize: "11px",
                color: "var(--color-text2)",
                lineHeight: 1,
              }}
            >
              {title}
            </span>

            {/* Compact XpBar (90px, 9px) — reuses XpBar primitive (AC-09-004.5) */}
            <XpBar
              xp={xp}
              next={next}
              pctToNext={pctToNext}
              label={title}
              nextTitle={nextTitle}
              size="compact"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
