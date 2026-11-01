"use client";
import { notFound } from "next/navigation";
import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { RankEmblem } from "@/components/core/RankEmblem/RankEmblem";
import { t } from "@/lib/copy/copy";
import { type GuildLevel, RANKS, rankForLevel, xpForLevel } from "@/lib/gamification/gamification";
import { useUrlState } from "@/lib/navigation/useUrlState";
import { eraCollapsed } from "../_utils/viewRules";
import { ERAS, flavorFor } from "./ladderMeta";
import styles from "./RankLadder.module.css";

/** Era grouping and expansion live in the URL; no distinct summit treatment. */
export function RankLadder({ level }: { level: GuildLevel }): React.JSX.Element {
  const [eras, setEras] = useUrlState("eras", "");
  const opened = eras.split(",").filter(Boolean);
  if (opened.some((id) => !ERAS.some((era) => era.id === id))) return notFound();
  const current = rankForLevel(level.level);
  const currentEra = ERAS.findIndex((era) => current >= era.from && current <= era.to);
  function handleEra(id: string): void {
    setEras(
      ERAS.filter((era) => (era.id === id ? !opened.includes(id) : opened.includes(era.id)))
        .map((era) => era.id)
        .join(","),
    );
  }
  return (
    <section className={styles.stack} aria-label={t("logros.tabs.rangos")}>
      <p className={styles.muted}>{t("logros.ranks.intro")}</p>
      {ERAS.map((era, index) => {
        const collapsible = eraCollapsed(index, currentEra);
        const collapsed = collapsible && !opened.includes(era.id);
        const rangeKey = eraRangeKey(current > era.to, collapsible);
        const first = RANKS[era.from];
        const after = RANKS[era.to + 1];
        const levels = `${t("logros.stats.level", { level: first?.minLevel ?? 1 })}${after ? `–${after.minLevel - 1}` : "+"}`;
        const name = t(`logros.ranks.eras.${era.id}.name`);
        return (
          <section className={`rank-era ${styles.era}`} key={era.id} aria-label={name}>
            <EraHeading
              collapsible={collapsible}
              className={styles.eraHeader}
              expanded={!collapsed}
              onClick={() => handleEra(era.id)}
            >
              <b>{name}</b>
              <span className={styles.line} />
              <span>
                {t(rangeKey, {
                  levels,
                  count: era.to - era.from + 1,
                })}
              </span>
              {collapsible ? (
                <span className={collapsed ? undefined : styles.expanded}>
                  <Icon name="chevD" size="sm" />
                </span>
              ) : null}
            </EraHeading>
            {collapsed ? null : (
              <>
                <p className={styles.tag}>{t(`logros.ranks.eras.${era.id}.tag`)}</p>
                <ol className={styles.list}>
                  {RANKS.slice(era.from, era.to + 1).map((rank, offset) => (
                    <RankRow
                      key={rank.title}
                      index={era.from + offset}
                      current={current}
                      level={level}
                    />
                  ))}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </section>
  );
}
function RankRow({
  index,
  current,
  level,
}: {
  index: number;
  current: number;
  level: GuildLevel;
}): React.JSX.Element | null {
  const rank = RANKS[index];
  if (!rank) return null;
  const next = RANKS[index + 1];
  const isCurrent = index === current;
  const state = isCurrent ? "current" : index < current ? "done" : "locked";
  const threshold = xpForLevel(rank.minLevel);
  const nextXp = next ? xpForLevel(next.minLevel) : level.xp;
  const progress =
    nextXp > threshold
      ? Math.max(0, Math.min(100, ((level.xp - threshold) / (nextXp - threshold)) * 100))
      : 100;
  return (
    <li
      className={`rank-row ${styles.row}`}
      data-testid="rank-row"
      data-rank={index + 1}
      data-state={state}
      aria-current={isCurrent ? "true" : undefined}
    >
      <span className={styles.emblem}>
        <RankEmblem
          sprite={rank.sprite}
          icon={rank.icon}
          grade={rank.grade}
          size={56}
          alt={rank.title}
        />
      </span>
      <div className={styles.grow}>
        <b>{rank.title}</b>
        <small className={styles.flavor}>{flavorFor(rank.sprite)}</small>
        <small>
          {t("logros.stats.level", { level: rank.minLevel })}
          {next ? `–${next.minLevel - 1}` : "+"}
        </small>
        {isCurrent && next ? (
          <>
            <ProgressBar
              tone="gold"
              done={progress}
              total={100}
              ariaLabel={t("logros.nextRank.progressAria", { name: next.title })}
            />
            <small>
              {t("logros.ranks.left", { xp: Math.max(0, nextXp - level.xp), name: next.title })}
            </small>
          </>
        ) : null}
      </div>
      <div className={styles.state}>
        {state === "locked" ? (
          <span>
            <Icon name="lock" size="sm" />
            {t("logros.stats.level", { level: rank.minLevel })}
          </span>
        ) : (
          <Chip tone={isCurrent ? "gold" : "green"} icon="check">
            {t(isCurrent ? "logros.ranks.here" : "logros.ranks.achieved")}
          </Chip>
        )}
        <small>{`${threshold.toLocaleString("es")} XP`}</small>
      </div>
    </li>
  );
}

function EraHeading({
  collapsible,
  expanded,
  onClick,
  className,
  children,
}: {
  collapsible: boolean;
  expanded: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return collapsible ? (
    <button type="button" className={className} aria-expanded={expanded} onClick={onClick}>
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

function eraRangeKey(done: boolean, collapsible: boolean) {
  if (done) return "logros.ranks.eraDone";
  return collapsible ? "logros.ranks.eraRange" : "logros.ranks.eraLevels";
}
