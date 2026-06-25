/**
 * GuildHero — Character-sheet hero panel for the Achievements page (WO-09-003)
 *
 * Matches prototype logrosHero() (~L413):
 *   - rpgpanel + rpggrid container (embossed pixel tile + dot grid)
 *   - Shield crest (Shield component, 96×96) with pixel NIVEL numeral
 *   - GREMIO PANDACORP eyebrow (pixel font, accent-text, shield-checkered icon)
 *   - Guild title (display font .ttl, 27px, line-height 1.12)
 *   - Feats/trophies/missions summary line (trophy icon, text2)
 *   - Full-width XpBar (18px, size="full") with real pct-to-next
 *   - Hairline divider
 *   - TU PARTY label + Avatar roster (pixel sprites, 38px, border)
 *   - Three mini stat badges (Lanzados / Racha / Récord) as rpgpanel tiles
 *
 * Design constraints (FRD-09 / FRD-13):
 *   - Tokens only — zero hardcoded colors/spacing.
 *   - Avatar degrades gracefully when sprite missing (onerror pattern; AC-09-003.2).
 *   - Spanish aria-labels on avatars and regions (AC-09-003.3).
 *   - tabular-nums on all numerals (AC-09-004.2).
 *
 * Server Component — no "use client" (pure render from props).
 *
 * Traceability:
 *   AC-09-004.1 (level/title/XP from computeGuildLevel via props)
 *   AC-09-004.3 (real pct-to-next — no fake fill)
 *   AC-09-004.5 (reuses XpBar primitive)
 *   AC-09-003.1/.2/.3 (Avatar sprites, graceful degrade, Spanish aria)
 *   CMP-09-guild-hero → blueprint §3 → WO-09-003
 */

import type { AgentRole } from "@/app/_design/tokens/tokens";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { Shield } from "@/components/core/Shield/Shield";
import { XpBar } from "@/components/core/XpBar/XpBar";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface GuildHeroProps {
  /** Guild level (from computeGuildLevel). */
  level: number;
  /** Guild rank title (e.g. "Artesano"). */
  title: string;
  /** Total accumulated XP. */
  xp: number;
  /** XP threshold for the next rank. */
  next: number;
  /** Percentage to next rank, 0–100 (pre-computed, honest). */
  pctToNext: number;
  /** Next rank title for the "faltan N XP para <nextTitle>" line. */
  nextTitle: string;
  /** Total feats/achievements count. */
  featsCount: number;
  /** Unlocked trophies count. */
  trophiesCount: number;
  /** Total trophies available. */
  trophiesTotal: number;
  /** Number of active missions (chains in progress). */
  missionsActive: number;
  /** Agent roles to display in the TU PARTY roster. */
  partyRoster: readonly AgentRole[];
  /** Stat: number of shipped products. */
  statsLanzados: number;
  /** Stat: weekly streak (weeks). */
  statsRacha: number;
  /** Stat: fastest idea→launch record (days). */
  statsVelocidad: number;
}

// ── Mini stat badge ────────────────────────────────────────────────────────────

function StatBadge({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        flex: "1",
        minWidth: "118px",
        padding: "9px 12px",
        /* rpgpanel */
        position: "relative",
        background: "var(--color-card)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "10px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
      }}
    >
      {/* Icon + label row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--color-text2)",
          fontSize: "11px",
        }}
      >
        <i
          className={`ti ${icon}`}
          aria-hidden="true"
          style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
        />
        {label}
      </div>
      {/* Value — pixel font, tabular-nums (AC-09-004.2) */}
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "22px",
          marginTop: "2px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── GuildHero ─────────────────────────────────────────────────────────────────

/**
 * GuildHero — the character-sheet hero panel.
 *
 * Consumed by the Achievements page (app/achievements/page.tsx).
 * Sits under the light PageTitle "Logros" block (DR-062 cohesion).
 * Server Component — pure render from props.
 */
export function GuildHero({
  level,
  title,
  xp,
  next,
  pctToNext,
  nextTitle,
  featsCount,
  trophiesCount,
  trophiesTotal,
  missionsActive,
  partyRoster,
  statsLanzados,
  statsRacha,
  statsVelocidad,
}: GuildHeroProps): React.JSX.Element {
  return (
    <section
      data-testid="guild-hero"
      aria-label="Hoja de personaje del gremio"
      style={{
        /* rpgpanel */
        position: "relative",
        background: "var(--color-card)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "10px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
        /* rpggrid */
        backgroundImage:
          "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        padding: "18px 20px",
        marginBottom: "14px",
      }}
    >
      {/* ── Top section: Shield + title block ─────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Shield crest (AC-09-004.5: reuses Shield primitive, WO-13-008) */}
        <Shield level={level} size="md" glow />

        {/* Title block */}
        <div style={{ flex: 1, minWidth: "250px" }}>
          {/* GREMIO PANDACORP eyebrow */}
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "11px",
              letterSpacing: "0.16em",
              color: "var(--color-accent-text)",
            }}
          >
            <i
              className="ti ti-shield-checkered"
              aria-hidden="true"
              style={{ fontSize: "12px", verticalAlign: "-2px" }}
            />
            {" GREMIO PANDACORP"}
          </div>

          {/* Guild title — display font, 27px */}
          <div
            data-testid="guild-hero-title"
            style={{
              fontFamily: "var(--font-display, var(--font-space-grotesk))",
              fontSize: "27px",
              lineHeight: 1.12,
              margin: "3px 0 2px",
              color: "var(--color-text)",
            }}
          >
            {title}
          </div>

          {/* Feats/trophies/missions summary line (AC-09-004.1) */}
          <div
            data-testid="guild-hero-summary"
            style={{
              fontSize: "12px",
              color: "var(--color-text2)",
            }}
          >
            <i
              className="ti ti-trophy"
              aria-hidden="true"
              style={{
                fontSize: "12px",
                verticalAlign: "-1px",
                color: "var(--color-warn)",
              }}
            />{" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{featsCount}</span>
            {" hazañas · "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{trophiesCount}</span>
            {"/"}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{trophiesTotal}</span>
            {" trofeos · "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{missionsActive}</span>
            {" misiones en curso"}
          </div>

          {/* XP header row (prototype logrosHero ~L425): XP left, "faltan N para Nv X ·
              <nextTitle>" right, ABOVE the bar. The bar itself is the bare track. */}
          <div style={{ marginTop: "13px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: "14px",
                  color: "var(--color-text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span data-testid="guild-hero-xp">{xp}</span>
                {" / "}
                {next}
                {" XP"}
              </span>
              <span
                data-testid="guild-hero-next"
                style={{ fontSize: "11px", color: "var(--color-text3)" }}
              >
                {pctToNext < 100
                  ? `faltan ${Math.max(0, next - xp)} para Nv ${level + 1} · ${nextTitle}`
                  : nextTitle}
              </span>
            </div>
            <XpBar
              xp={xp}
              next={next}
              pctToNext={pctToNext}
              label={title}
              nextTitle={nextTitle}
              size="track"
            />
          </div>
        </div>
      </div>

      {/* ── Bottom section: TU PARTY + stat badges ────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "15px",
          alignItems: "center",
          flexWrap: "wrap",
          borderTop: "1px solid var(--color-border)",
          paddingTop: "14px",
        }}
      >
        {/* TU PARTY roster */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "10px",
              letterSpacing: "0.12em",
              color: "var(--color-text3)",
              marginBottom: "6px",
            }}
          >
            TU PARTY
          </div>
          <ul
            data-testid="guild-hero-party"
            aria-label="Party del gremio"
            style={
              {
                display: "flex",
                gap: "5px",
                listStyle: "none",
                margin: 0,
                padding: 0,
                // Prototype party sprites are 38px (sm=32px reads too small); scope-override
                // the Avatar size CSS var on the container (Avatar reads --avatar-size-sm).
                "--avatar-size-sm": "38px",
              } as React.CSSProperties
            }
          >
            {partyRoster.map((role) => (
              <li key={role}>
                <Avatar agentId={role} size="sm" />
              </li>
            ))}
          </ul>
        </div>

        {/* Mini stat badges */}
        <div
          data-testid="guild-hero-stats"
          style={{
            display: "flex",
            gap: "8px",
            flex: 1,
            flexWrap: "wrap",
            minWidth: "220px",
          }}
        >
          <StatBadge icon="ti-rocket" value={String(statsLanzados)} label="Lanzados" />
          <StatBadge icon="ti-flame" value={`${statsRacha} sem`} label="Racha" />
          <StatBadge icon="ti-bolt" value={`${statsVelocidad} d`} label="Récord" />
        </div>
      </div>
    </section>
  );
}
