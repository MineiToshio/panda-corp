/**
 * CMP-09-guild-bar — Guild top-bar block (WO-09-003 re-anchor, originally WO-09-004)
 *
 * Cross-cutting component mounted in app/layout.tsx.
 * Matches prototype topbar() guild section (~L646):
 *   - rpgpanel + rpggrid container (embossed pixel tile + dot grid)
 *   - NV level pill: pixel font, accent bg, canvas text
 *   - Guild title: text2 color, 11px
 *   - Compact inline XpBar: 90px × 9px, vertically centred
 *
 * Consumes:
 *   - IF-09-guild-xp: computeGuildLevel(outcomes) → GuildLevel (lib/gamification.ts)
 *   - CMP-09-xp-bar: XpBar primitive in size="compact" (WO-09-003)
 *
 * Design constraints (FRD-09 / FRD-13):
 *   - Rationed accent: accent color ONLY on the NV pill bg + XP bar fill.
 *   - Not color-alone: level number text + rank title text + bar shape.
 *   - Numbers are text nodes → tabular-nums applied globally via globals.css.
 *   - Zero hardcoded colors — only CSS custom properties from @theme in globals.css.
 *   - Server Component (no interactivity; data derived from outcomes).
 *
 * Traceability:
 *   AC-09-004.1 (level + title + XP bar + subtitle)
 *   AC-09-004.2 (tabular-nums via text nodes + globals.css)
 *   AC-09-004.3 (real pct-to-next from computeGuildLevel — never fake)
 *   AC-09-004.4 (rationed accent, not color-alone)
 *   AC-09-004.5 (reuses XpBar primitive, size="compact")
 *   CMP-09-guild-bar → blueprint §3 → WO-09-003
 *
 * Visual reference: prototype topbar() ~L646
 */

import { XpBar } from "@/components/core/XpBar/XpBar";
import { computeGuildLevel, type GuildOutcomes, RANKS } from "@/lib/gamification/gamification";

export type GuildBarProps = {
  /** Verifiable outcomes that drive guild XP (from status.yaml + events — read server-side). */
  outcomes: GuildOutcomes;
  /**
   * Embedded variant (DR-057 extend, FRD-19): render only the inner level/XP row WITHOUT the
   * standalone rpgpanel chrome + bottom margin, so GuildBar can sit inside the app shell's own
   * surface (the persistent topbar) instead of being its own panel. Default `false` keeps the
   * original standalone block (existing usages + tests unchanged).
   */
  embedded?: boolean;
};

/** Standalone rpgpanel block style (default) — the embossed pixel tile + dot grid + bottom margin. */
const STANDALONE_STYLE: React.CSSProperties = {
  /* rpgpanel: embossed pixel tile — matches prototype .rpgpanel */
  position: "relative",
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  /* rpggrid: dot grid overlay — matches prototype .rpggrid */
  backgroundImage:
    "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
  /* Layout */
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "4px 8px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

/** Embedded variant style — bare inner row, no panel chrome / no margin (the shell owns the surface). */
const EMBEDDED_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  minWidth: 0,
};

/**
 * GuildBar — guild level/XP top bar block.
 *
 * Renders the guild section of the persistent topbar:
 *   NV pill · guild title · compact XpBar
 *
 * Mounted inside the app shell's persistent topbar (FRD-19) via the `embedded` variant; the
 * default (standalone) variant keeps the original rpgpanel block. Server Component: all data is
 * derived from the outcomes prop.
 */
export function GuildBar({ outcomes, embedded = false }: GuildBarProps): React.JSX.Element {
  // IF-09-guild-xp: pure derivation — same outcomes always yields same result.
  const { level, title, icon, xp, next, pctToNext } = computeGuildLevel(outcomes);

  // Determine the next rank title for the "faltan N para Nv X · <nextTitle>" line.
  // At max rank (pctToNext === 100), nextTitle mirrors current title.
  const nextRankEntry = RANKS[level]; // level is 1-based; RANKS is 0-based → RANKS[level] = next rank
  const nextTitle = nextRankEntry?.title ?? title;

  return (
    <div
      data-testid="guild-bar"
      data-variant={embedded ? "embedded" : "rpgpanel"}
      data-embedded={embedded ? "true" : undefined}
      style={embedded ? EMBEDDED_STYLE : STANDALONE_STYLE}
    >
      {/* NV level pill — accent bg, pixel font, canvas text (AC-09-004.1/4.4) */}
      {/* data-px="true" = pixel-font marker for tests */}
      <span
        data-testid="guild-bar-level-pill"
        data-px="true"
        data-accent="true"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "10px",
          color: "var(--color-on-accent)",
          background: "var(--color-accent)",
          padding: "1px 6px",
          borderRadius: "4px",
          lineHeight: 1.4,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {"NV "}
        {/* Level numeral in its own text node for tabular-nums (AC-09-004.2) */}
        <span data-testid="guild-bar-level">{level}</span>
      </span>

      {/* Guild rank title — icon + name, text2, 11px (AC-09-004.1) */}
      <span
        data-testid="guild-bar-title"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "11px",
          color: "var(--color-text2)",
          lineHeight: 1.2,
          flexShrink: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {icon !== undefined && (
          <i
            className={`ti ${icon}`}
            aria-hidden="true"
            style={{ fontSize: "13px", color: "var(--color-accent-text)", flexShrink: 0 }}
          />
        )}
        {title}
      </span>

      {/* Compact inline XpBar — 90px × 9px (AC-09-004.5: reuses XpBar primitive) */}
      <XpBar
        xp={xp}
        next={next}
        pctToNext={pctToNext}
        label={title}
        nextTitle={nextTitle}
        size="compact"
      />
    </div>
  );
}
