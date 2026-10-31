import Link from "next/link";
import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import type { LastAchievementData } from "@/lib/inicio/achievement";
import styles from "./Home.module.css";
/** One last-unlock notice; freshness comes from the shared resolver. */
export function LastAchievement({
  achievement,
}: {
  readonly achievement: LastAchievementData | null;
}): React.JSX.Element | null {
  if (!achievement) return null;
  return (
    <Link
      href="/achievements/trophies"
      data-fresh={achievement.fresh}
      className={`last-ach ${achievement.fresh ? "fresh" : ""} ${styles.lastAchievement}`}
    >
      <Icon name="trophy" />
      <div>
        <small>
          {t("logros.lastAchievement.line", {
            label: t(
              achievement.fresh ? "logros.lastAchievement.fresh" : "logros.lastAchievement.last",
            ),
            date: achievement.unlockedAt ? formatDate(achievement.unlockedAt) : t("common.noDate"),
          })}
        </small>
        <b>{achievement.title}</b>
      </div>
      {achievement.fresh ? <Chip tone="gold">{t("logros.lastAchievement.newChip")}</Chip> : null}
    </Link>
  );
}
