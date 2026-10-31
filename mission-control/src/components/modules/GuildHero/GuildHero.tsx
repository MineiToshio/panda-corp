import type { IconName } from "@/components/core/Icon/iconData";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { RankEmblem } from "@/components/core/RankEmblem/RankEmblem";
import { t } from "@/lib/copy/copy";
import styles from "./GuildHero.module.css";

interface GuildHeroProps {
  level: number;
  title: string;
  xp: number;
  next: number;
  pctToNext: number;
  rankIcon?: IconName;
  rankSprite?: string;
  rankGrade?: number;
  trophiesCount: number;
  trophiesTotal: number;
  secretsCount?: number;
  secretsTotal?: number;
  tiersReached?: number;
  tiersTotal?: number;
}
/** Guild rank, honest XP and achieved counts above the Hall's five tabs. */
export function GuildHero({
  level,
  title,
  xp,
  next,
  pctToNext,
  rankIcon,
  rankSprite,
  rankGrade,
  trophiesCount,
  trophiesTotal,
  secretsCount = 0,
  secretsTotal = 0,
  tiersReached = 0,
  tiersTotal,
}: GuildHeroProps): React.JSX.Element {
  return (
    <section
      data-testid="guild-hero"
      className={`guild-hero ${styles.hero}`}
      data-tone="gold"
      aria-label={t("logros.hero.eyebrow", { level })}
    >
      <div className={styles.crest}>
        <div className={styles.crestInner}>
          <RankEmblem sprite={rankSprite} icon={rankIcon} grade={rankGrade} size={64} alt={title} />
        </div>
      </div>
      <div className={styles.body}>
        <p className={styles.kicker}>{t("logros.hero.eyebrow", { level })}</p>
        <h2>{title}</h2>
        <p>{t("logros.hero.xp", { xp, left: Math.max(0, next - xp), next: level + 1 })}</p>
        <ProgressBar
          done={Math.max(0, Math.min(100, pctToNext))}
          total={100}
          tone="gold"
          ariaLabel={t("logros.nextRank.progressAria", { name: title })}
        />
      </div>
      <div className={styles.counts}>
        <div>
          <b>
            {trophiesCount}/{trophiesTotal}
          </b>
          <small>{t("logros.hero.trophies")}</small>
        </div>
        <div>
          <b>
            {secretsCount}/{secretsTotal}
          </b>
          <small>{t("logros.hero.secrets")}</small>
        </div>
        <div>
          <b>
            {tiersReached}
            {tiersTotal === undefined ? "" : `/${tiersTotal}`}
          </b>
          <small>{t("logros.hero.missionTiers")}</small>
        </div>
      </div>
    </section>
  );
}
