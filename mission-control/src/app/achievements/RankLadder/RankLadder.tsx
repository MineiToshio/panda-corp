/**
 * CMP-09-rank-ladder — the "Rangos" tab: the full 40-rung guild rank ladder.
 *
 * Renders every rank (icon + level + Spanish name + XP threshold) as a vertical
 * climb. The current rank is highlighted ("ESTÁS AQUÍ" + progress to the next);
 * ranks already earned read as done; ranks ahead are dimmed/locked so the top
 * (Portador del Juramento Eterno) feels deliberately far away.
 *
 * Reads the single source `RANKS` (lib/gamification). Tokens only; Spanish copy.
 *
 * Traceability: FRD-09 — guild rank ladder (40 ranks, owner-authored 2026-06-25).
 */

import { RankEmblem } from "@/components/core/RankEmblem/RankEmblem";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { RANKS, rankForLevel, xpForLevel } from "@/lib/gamification/gamification";

const RPGPANEL: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
};

type RankState = "done" | "current" | "locked";

type RankRowProps = {
  /** Rank index (0-based) — for data-level + key. */
  rankIndex: number;
  name: string;
  icon: string;
  sprite?: string;
  grade?: number;
  /** Level band, e.g. "Nv 13–16" or "Nv 289+". */
  rangeLabel: string;
  state: RankState;
  /** % progress to the next RANK (current row only). */
  pctToNext?: number;
  /** XP remaining to the next rank (current row only). */
  faltanXp?: number;
  nextRankName?: string;
  /** Far-ahead ranks fade more, to make the summit read as distant. */
  dim?: number;
};

/** The rank medal — the self-framed emblem sprite. */
function RankMedal({
  sprite,
  icon,
  grade,
  isCurrent,
  name,
}: {
  sprite?: string;
  icon: string;
  grade?: number;
  isCurrent: boolean;
  name: string;
}): React.JSX.Element {
  return (
    <RankEmblem sprite={sprite} icon={icon} grade={grade} size={isCurrent ? 42 : 34} alt={name} />
  );
}

/** The per-state right-side marker (check / "ESTÁS AQUÍ" / lock). */
function RankMarker({ state }: { state: RankState }): React.JSX.Element | null {
  if (state === "done")
    return (
      <i
        className="ti ti-check"
        aria-label="Alcanzado"
        role="img"
        style={{ fontSize: "14px", color: "var(--color-ok)" }}
      />
    );
  if (state === "current")
    return (
      <span
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "9px",
          color: "var(--color-accent-text)",
          letterSpacing: "0.04em",
        }}
      >
        ESTÁS AQUÍ
      </span>
    );
  return (
    <i
      className="ti ti-lock"
      aria-label="Bloqueado"
      role="img"
      style={{ fontSize: "12px", color: "var(--color-text3)" }}
    />
  );
}

/** The current rank's progress bar + "faltan N XP para <next rank>" line. */
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
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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

function RankRow({
  rankIndex,
  name,
  icon,
  sprite,
  grade,
  rangeLabel,
  state,
  pctToNext = 0,
  faltanXp = 0,
  nextRankName,
  dim = 1,
}: RankRowProps): React.JSX.Element {
  const isCurrent = state === "current";
  const isLocked = state === "locked";

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
        padding: isCurrent ? "13px 14px" : "9px 12px",
        opacity: isLocked ? 0.34 + 0.66 * dim : 1,
        ...(isCurrent
          ? {
              border: "1.5px solid var(--color-accent)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 0 18px -7px var(--color-accent)",
            }
          : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
        <RankMedal sprite={sprite} icon={icon} grade={grade} isCurrent={isCurrent} name={name} />

        {/* Name + level-band */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
          <span
            style={{
              fontSize: isCurrent ? "0.95rem" : "0.85rem",
              fontWeight: isCurrent ? 700 : 500,
              color: isLocked ? "var(--color-text2)" : "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
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

        {/* Right: state marker */}
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <RankMarker state={state} />
        </span>
      </div>

      {isCurrent && nextRankName !== undefined && (
        <RankProgress pctToNext={pctToNext} faltanXp={faltanXp} nextRankName={nextRankName} />
      )}
    </li>
  );
}

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
  const topMinLevel = RANKS[RANKS.length - 1]?.minLevel ?? 1;

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

  return (
    <section
      data-testid="rank-ladder"
      aria-label="Escalafón de rangos del gremio"
      style={{ display: "flex", flexDirection: "column", gap: "14px" }}
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

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {RANKS.map((rank, i) => {
          const state: RankState =
            i < currentRankIndex ? "done" : i === currentRankIndex ? "current" : "locked";
          const above = RANKS[i + 1];
          const rangeLabel =
            above === undefined
              ? `Nv ${rank.minLevel}+`
              : `Nv ${rank.minLevel}–${above.minLevel - 1}`;
          // Fade ranks further ahead more (summit reads as distant); clamp 0..1.
          const ahead = i - currentRankIndex;
          const dim = state === "locked" ? Math.max(0, 1 - (ahead - 1) / 24) : 1;
          return (
            <RankRow
              key={rank.title}
              rankIndex={i}
              name={rank.title}
              icon={rank.icon}
              sprite={rank.sprite}
              grade={rank.grade}
              rangeLabel={rangeLabel}
              state={state}
              dim={dim}
              {...(state === "current" && nextRank
                ? {
                    pctToNext: rankPct,
                    faltanXp: rankFaltan,
                    nextRankName: nextRank.title,
                  }
                : {})}
            />
          );
        })}
      </ol>
    </section>
  );
}
