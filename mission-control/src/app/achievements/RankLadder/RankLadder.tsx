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
import { RANKS } from "@/lib/gamification/gamification";

const RPGPANEL: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
};

type RankState = "done" | "current" | "locked";

type RankRowProps = {
  level: number;
  name: string;
  icon: string;
  sprite?: string;
  threshold: number;
  state: RankState;
  /** % progress to the next rank (current row only). */
  pctToNext?: number;
  /** XP remaining to the next rank (current row only). */
  faltan?: number;
  nextName?: string;
  /** Far-ahead ranks fade more, to make the summit read as distant. */
  dim?: number;
};

/** The rank medal — the self-framed emblem sprite. */
function RankMedal({
  sprite,
  icon,
  isCurrent,
  name,
}: {
  sprite?: string;
  icon: string;
  isCurrent: boolean;
  name: string;
}): React.JSX.Element {
  return <RankEmblem sprite={sprite} icon={icon} size={isCurrent ? 42 : 34} alt={name} />;
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

/** The current rank's progress bar + "faltan N para Nv n+1" line. */
function RankProgress({
  level,
  pctToNext,
  faltan,
  nextName,
}: {
  level: number;
  pctToNext: number;
  faltan: number;
  nextName: string;
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
        faltan <span className="tabular-nums">{faltan.toLocaleString("es")}</span> XP para Nv{" "}
        {level + 1} · {nextName}
      </span>
    </div>
  );
}

function RankRow({
  level,
  name,
  icon,
  sprite,
  threshold,
  state,
  pctToNext = 0,
  faltan = 0,
  nextName,
  dim = 1,
}: RankRowProps): React.JSX.Element {
  const isCurrent = state === "current";
  const isLocked = state === "locked";

  return (
    <li
      data-testid="rank-row"
      data-level={level}
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
        <RankMedal sprite={sprite} icon={icon} isCurrent={isCurrent} name={name} />

        {/* Level chip */}
        <span
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "10px",
            color: isCurrent ? "var(--color-on-accent)" : "var(--color-text3)",
            background: isCurrent ? "var(--color-accent)" : "var(--color-base)",
            border: isCurrent ? "none" : "1px solid var(--color-border-strong)",
            padding: "1px 6px",
            borderRadius: "4px",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          NV {level}
        </span>

        {/* Name */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
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

        {/* Right: state marker + threshold */}
        <span style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <RankMarker state={state} />
          <span
            className="tabular-nums"
            style={{
              fontSize: "11px",
              color: "var(--color-text3)",
              minWidth: "62px",
              textAlign: "right",
            }}
          >
            {threshold.toLocaleString("es")} XP
          </span>
        </span>
      </div>

      {isCurrent && nextName !== undefined && (
        <RankProgress level={level} pctToNext={pctToNext} faltan={faltan} nextName={nextName} />
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
  const current = level.level;
  const faltan = Math.max(0, level.next - level.xp);
  const nextRank = RANKS[current]; // 0-based array, current is 1-based → RANKS[current] = next rank

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
        El escalafón del gremio — subes de rango con tu nivel. Cada peldaño cuesta más que el
        anterior; la cima (Nv {RANKS.length}) está lejos a propósito.
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
          const lvl = i + 1;
          const state: RankState = lvl < current ? "done" : lvl === current ? "current" : "locked";
          // Fade ranks further ahead more (summit reads as distant); clamp 0..1.
          const ahead = lvl - current;
          const dim = state === "locked" ? Math.max(0, 1 - (ahead - 1) / 24) : 1;
          return (
            <RankRow
              key={rank.title}
              level={lvl}
              name={rank.title}
              icon={rank.icon}
              sprite={rank.sprite}
              threshold={rank.threshold}
              state={state}
              dim={dim}
              {...(state === "current"
                ? {
                    pctToNext: level.pctToNext,
                    faltan,
                    nextName: nextRank?.title,
                  }
                : {})}
            />
          );
        })}
      </ol>
    </section>
  );
}
