/**
 * CMP-09-rank-ladder — the "Rangos" tab: the full 40-rung guild rank ladder.
 *
 * An ENRICHED, era-sectioned vertical climb (UI/UX research 2026-06-25: for an
 * ordered 40-tier ladder the list beats a grid — it preserves the climb metaphor;
 * the dead space is killed by enriching each row, not by switching to cards). Each
 * rank shows a LARGE pixel-art emblem (the art is the hero), its name, a one-line
 * flavor caption, the level band, the XP threshold, and a state marker (earned /
 * current / locked) with an icon + text label (never color alone — WCAG 1.4.1).
 * The current rank pops (glow + progress to the next rank); the summit gets a
 * distinct full-width treatment so the top reads as deliberately distant.
 *
 * Reads the single source `RANKS` (lib/gamification). Tokens only; Spanish copy.
 *
 * Traceability: FRD-09 (rank ladder) · FRD-10 (Rangos tab) — owner-authored 2026-06-25.
 */

import { RankEmblem } from "@/components/core/RankEmblem/RankEmblem";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { RANKS, rankForLevel, xpForLevel } from "@/lib/gamification/gamification";
import { ERAS, flavorFor } from "./ladderMeta";

const RPGPANEL: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
};

const EMBLEM_SIZE = { done: 88, current: 104, summit: 124 } as const;

type RankState = "done" | "current" | "locked";

/** Format an XP threshold for the right column ("Inicio" at 0, else "1.040 XP"). */
function thresholdLabel(minLevel: number): string {
  const xp = xpForLevel(minLevel);
  return xp <= 0 ? "Inicio" : `${xp.toLocaleString("es")} XP`;
}

// ── State marker (icon + text label — redundant cues, not color alone) ──────────

function RankMarker({
  state,
  minLevel,
}: {
  state: RankState;
  minLevel: number;
}): React.JSX.Element {
  if (state === "done")
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <i
          className="ti ti-circle-check-filled"
          aria-hidden="true"
          style={{ fontSize: "14px", color: "var(--color-ok)" }}
        />
        <span style={{ fontSize: "11px", color: "var(--color-ok)" }}>Conseguido</span>
      </span>
    );
  if (state === "current")
    return (
      <span
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "10px",
          color: "var(--color-accent-text)",
          letterSpacing: "0.04em",
        }}
      >
        ESTÁS AQUÍ
      </span>
    );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <i
        className="ti ti-lock"
        aria-hidden="true"
        style={{ fontSize: "12px", color: "var(--color-text3)" }}
      />
      <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--color-text3)" }}>
        Nv {minLevel}
      </span>
    </span>
  );
}

// ── Current-rank progress bar ───────────────────────────────────────────────────

function RankProgress({
  pctToNext,
  faltanXp,
  nextRankName,
}: {
  pctToNext: number;
  faltanXp: number;
  nextRankName: string;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>
      <div
        style={{
          position: "relative",
          height: "10px",
          borderRadius: "5px",
          border: "1px solid var(--color-border-strong)",
          background: "var(--color-base)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: `${Math.min(100, Math.max(0, pctToNext))}%`,
            background: "var(--color-accent)",
          }}
        />
      </div>
      <span style={{ fontSize: "11px", color: "var(--color-text3)" }}>
        faltan <span className="tabular-nums">{faltanXp.toLocaleString("es")}</span> XP para{" "}
        {nextRankName}
      </span>
    </div>
  );
}

// ── A single rank row ───────────────────────────────────────────────────────────

type RankRowProps = {
  rankIndex: number;
  name: string;
  icon: string;
  sprite?: string;
  grade?: number;
  flavor: string;
  rangeLabel: string;
  minLevel: number;
  state: RankState;
  dim: number;
  pctToNext?: number;
  faltanXp?: number;
  nextRankName?: string;
};

function RankRow({
  rankIndex,
  name,
  icon,
  sprite,
  grade,
  flavor,
  rangeLabel,
  minLevel,
  state,
  dim,
  pctToNext = 0,
  faltanXp = 0,
  nextRankName,
}: RankRowProps): React.JSX.Element {
  const isCurrent = state === "current";
  const isLocked = state === "locked";
  const size = isCurrent ? EMBLEM_SIZE.current : EMBLEM_SIZE.done;

  return (
    <li
      data-testid="rank-row"
      data-rank={rankIndex + 1}
      data-state={state}
      aria-current={isCurrent ? "true" : undefined}
      style={{
        ...RPGPANEL,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: isCurrent ? "16px 18px" : "12px 16px",
        // Locked rows dim toward the summit but keep a 0.5 floor so the icon+text
        // state cues stay legible (research: dimming must not be the only signal).
        opacity: isLocked ? 0.5 + 0.5 * dim : 1,
        ...(isCurrent
          ? {
              border: "1.5px solid var(--color-accent)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 0 22px -6px var(--color-accent)",
            }
          : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <RankEmblem sprite={sprite} icon={icon} grade={grade} size={size} alt={name} />

        {/* Name + flavor + level band — fills the row's horizontal space. */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
          <span
            style={{
              fontSize: isCurrent ? "1.05rem" : "0.95rem",
              fontWeight: isCurrent ? 700 : 600,
              color: isLocked ? "var(--color-text2)" : "var(--color-text)",
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--color-text3)", lineHeight: 1.3 }}>
            {flavor}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: "10px",
              color: isCurrent ? "var(--color-accent-text)" : "var(--color-text3)",
              fontFamily: "var(--font-pixel)",
            }}
          >
            {rangeLabel}
          </span>
        </div>

        {/* Right column: state marker + XP threshold (consistent on every row). */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
            flexShrink: 0,
            textAlign: "right",
          }}
        >
          <RankMarker state={state} minLevel={minLevel} />
          <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--color-text3)" }}>
            {thresholdLabel(minLevel)}
          </span>
        </div>
      </div>

      {isCurrent && nextRankName !== undefined && (
        <RankProgress pctToNext={pctToNext} faltanXp={faltanXp} nextRankName={nextRankName} />
      )}
    </li>
  );
}

// ── The summit rank (rank 40) — a distinct, centered destination ────────────────

function SummitRow({
  rankIndex,
  name,
  icon,
  sprite,
  flavor,
  rangeLabel,
}: {
  rankIndex: number;
  name: string;
  icon: string;
  sprite?: string;
  flavor: string;
  rangeLabel: string;
}): React.JSX.Element {
  return (
    <li
      data-testid="rank-row"
      data-rank={rankIndex + 1}
      data-state="locked"
      style={{
        ...RPGPANEL,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "8px",
        padding: "20px 18px",
        border: "1.5px solid var(--color-warn)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 0 26px -8px var(--color-warn)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "10px",
          letterSpacing: "0.16em",
          color: "var(--color-warn)",
        }}
      >
        <i
          className="ti ti-trophy"
          aria-hidden="true"
          style={{ fontSize: "12px", verticalAlign: "-2px" }}
        />{" "}
        LA CIMA
      </span>
      <RankEmblem sprite={sprite} icon={icon} size={EMBLEM_SIZE.summit} alt={name} />
      <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text)" }}>
        {name}
      </span>
      <span style={{ fontSize: "0.82rem", color: "var(--color-text2)", maxWidth: "36ch" }}>
        {flavor}
      </span>
      <span
        className="tabular-nums"
        style={{ fontSize: "10px", color: "var(--color-text3)", fontFamily: "var(--font-pixel)" }}
      >
        {rangeLabel}
      </span>
    </li>
  );
}

// ── Era section header ──────────────────────────────────────────────────────────

function EraHeader({
  name,
  tagline,
  rangeLabel,
}: {
  name: string;
  tagline: string;
  rangeLabel: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "10px",
        flexWrap: "wrap",
        marginTop: "10px",
        paddingBottom: "6px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <span
          style={{
            fontFamily: "var(--font-display, var(--font-space-grotesk))",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          {name}
        </span>
        <span style={{ fontSize: "0.78rem", color: "var(--color-text3)" }}>{tagline}</span>
      </div>
      <span
        className="tabular-nums"
        style={{ fontSize: "10px", color: "var(--color-text3)", fontFamily: "var(--font-pixel)" }}
      >
        {rangeLabel}
      </span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Level-band label for a rank ("Nv 13–16" or open-ended "Nv 289+" at the summit). */
function bandLabel(rankIndex: number): string {
  const rank = RANKS[rankIndex];
  const above = RANKS[rankIndex + 1];
  if (rank === undefined) return "";
  return above === undefined ? `Nv ${rank.minLevel}+` : `Nv ${rank.minLevel}–${above.minLevel - 1}`;
}

// ── RankLadder ──────────────────────────────────────────────────────────────────

export type RankLadderProps = {
  /** The guild level (single source — getGuildState). */
  level: GuildLevel;
};

/**
 * RankLadder — the full guild rank ladder for the "Rangos" tab.
 * Server Component (pure render from the level prop).
 */
export function RankLadder({ level }: RankLadderProps): React.JSX.Element {
  const currentRankIndex = rankForLevel(level.level);
  const lastIndex = RANKS.length - 1;
  const topMinLevel = RANKS[lastIndex]?.minLevel ?? 1;

  // Progress within the current rank band toward the NEXT rank (by XP).
  const curRank = RANKS[currentRankIndex];
  const nextRank = RANKS[currentRankIndex + 1];
  const rankBaseXp = xpForLevel(curRank?.minLevel ?? 1);
  const rankNextXp = nextRank ? xpForLevel(nextRank.minLevel) : rankBaseXp;
  const rankSpan = rankNextXp - rankBaseXp;
  const rankPct =
    rankSpan > 0
      ? Math.min(100, Math.max(0, Math.floor(((level.xp - rankBaseXp) / rankSpan) * 100)))
      : 100;
  const rankFaltan = Math.max(0, rankNextXp - level.xp);

  const stateOf = (i: number): RankState =>
    i < currentRankIndex ? "done" : i === currentRankIndex ? "current" : "locked";

  return (
    <section
      data-testid="rank-ladder"
      aria-label="Escalafón de rangos del gremio"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxWidth: "860px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <p style={{ fontSize: "0.8rem", color: "var(--color-text3)", margin: 0 }}>
        <i
          className="ti ti-stairs-up"
          aria-hidden="true"
          style={{ fontSize: "13px", verticalAlign: "-2px" }}
        />{" "}
        El escalafón del gremio — tu nivel sube con XP y cada rango cubre un tramo de niveles. Cada
        nivel cuesta más que el anterior; la cima (Nv {topMinLevel}+) está lejos a propósito.
      </p>

      {ERAS.map((era) => (
        <div key={era.name} style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          <EraHeader
            name={era.name}
            tagline={era.tagline}
            rangeLabel={
              era.to >= lastIndex
                ? `Nv ${RANKS[era.from]?.minLevel ?? 1}+`
                : `Nv ${RANKS[era.from]?.minLevel ?? 1}–${(RANKS[era.to + 1]?.minLevel ?? 1) - 1}`
            }
          />
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "7px",
            }}
          >
            {RANKS.slice(era.from, era.to + 1).map((rank, offset) => {
              const i = era.from + offset;
              const state = stateOf(i);
              if (i === lastIndex) {
                return (
                  <SummitRow
                    key={rank.title}
                    rankIndex={i}
                    name={rank.title}
                    icon={rank.icon}
                    sprite={rank.sprite}
                    flavor={flavorFor(rank.sprite)}
                    rangeLabel={bandLabel(i)}
                  />
                );
              }
              const ahead = i - currentRankIndex;
              const dim = state === "locked" ? Math.max(0, 1 - (ahead - 1) / 28) : 1;
              return (
                <RankRow
                  key={rank.title}
                  rankIndex={i}
                  name={rank.title}
                  icon={rank.icon}
                  sprite={rank.sprite}
                  grade={rank.grade}
                  flavor={flavorFor(rank.sprite)}
                  rangeLabel={bandLabel(i)}
                  minLevel={rank.minLevel}
                  state={state}
                  dim={dim}
                  {...(state === "current" && nextRank
                    ? { pctToNext: rankPct, faltanXp: rankFaltan, nextRankName: nextRank.title }
                    : {})}
                />
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
