import Link from "next/link";
import { LastAchievement } from "@/app/(dashboard)/_components/LastAchievement";
import { Card, CardFoot, CardHeader } from "@/components/core/Card/Card";
import { Icon } from "@/components/core/Icon/Icon";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { RankEmblem } from "@/components/core/RankEmblem/RankEmblem";
import { t } from "@/lib/copy/copy";
import type { GuildLevel } from "@/lib/gamification/gamification";
import type { LastAchievementData } from "@/lib/inicio/achievement";
import styles from "./Progreso.module.css";
/** Honest guild card, using the shared level and last-achievement resolver. */
export function Progreso({
  level,
  achievement,
  trophies,
}: {
  readonly level: GuildLevel;
  readonly achievement: LastAchievementData | null;
  readonly trophies: number;
}): React.JSX.Element {
  return (
    <Card tone="gold">
      <CardHeader title={t("inicio.guild.title")} icon="trophy" />
      <div className={styles.identity}>
        <RankEmblem sprite={level.sprite} grade={level.grade} icon={level.icon} size={56} />
        <div>
          <strong>{level.title}</strong>
          <p>{t("inicio.guild.level", { level: level.level, xp: level.xp })}</p>
        </div>
      </div>
      <ProgressBar
        done={level.pctToNext}
        total={100}
        tone="gold"
        ariaLabel={t("inicio.guild.title")}
      />
      <p className={styles.next}>
        {t("inicio.guild.toNext", {
          xp: Math.max(0, level.next - level.xp),
          next: level.level + 1,
          trophies,
        })}
      </p>
      <LastAchievement achievement={achievement} />
      <CardFoot>
        <span />
        <Link className="link" data-tone="gold" href="/achievements">
          {t("inicio.guild.seeAchievements")} <Icon name="arrow" size="sm" />
        </Link>
      </CardFoot>
    </Card>
  );
}
