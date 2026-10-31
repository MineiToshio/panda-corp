import { Card, CardHeader } from "@/components/core/Card/Card";
import { Icon } from "@/components/core/Icon/Icon";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { RankEmblem } from "@/components/core/RankEmblem/RankEmblem";
import { t, tRich } from "@/lib/copy/copy";
import { type GuildLevel, RANKS, rankForLevel, xpForLevel } from "@/lib/gamification/gamification";
import styles from "./summary.module.css";

/** Current/next rank thresholds from the engine's single rank table. */
export function NextRankCard({ level }: { level: GuildLevel }): React.JSX.Element | null {
  const index = rankForLevel(level.level);
  const current = RANKS[index];
  const next = RANKS[index + 1];
  if (!current) return null;
  const base = xpForLevel(current.minLevel);
  const target = next ? xpForLevel(next.minLevel) : level.xp;
  const left = Math.max(0, target - level.xp);
  const pct =
    target > base ? Math.min(100, Math.max(0, ((level.xp - base) / (target - base)) * 100)) : 100;
  return (
    <Card tone="gold">
      <CardHeader title={t("logros.nextRank.title")} icon="crown" />
      <div className={styles.rankPair}>
        <div>
          <span className={styles.emblem}>
            <RankEmblem sprite={current.sprite} icon={current.icon} size={56} alt={current.title} />
          </span>
          <b>{current.title}</b>
          <small>{t("logros.nextRank.now", { level: level.level })}</small>
        </div>
        {next ? (
          <>
            <span aria-hidden="true" className={styles.rankArrow}>
              <Icon name="arrow" />
            </span>
            <div>
              <span className={`${styles.emblem} ${styles.nextEmblem}`}>
                <RankEmblem sprite={next.sprite} icon={next.icon} size={56} alt={next.title} />
              </span>
              <b>{next.title}</b>
              <small>{t("logros.nextRank.from", { level: next.minLevel })}</small>
            </div>
          </>
        ) : null}
      </div>
      <ProgressBar
        tone="gold"
        done={pct}
        total={100}
        ariaLabel={t("logros.nextRank.progressAria", { name: next?.title ?? current.title })}
      />
      <p className={styles.rankNote}>
        {next ? tRich("logros.nextRank.left", { xp: left }) : t("logros.nextRank.highest")}
      </p>
      <a className={styles.link} href="/achievements/ranks">
        {t("logros.nextRank.ladder")}
        <Icon name="arrow" size="sm" />
      </a>
    </Card>
  );
}
