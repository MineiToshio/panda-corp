"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/core/Button/IconButton";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import styles from "./AchievementToast.module.css";

export interface AchievementNotice {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly fresh: boolean;
}
const seenInView = new Set<string>();
function hasSeen(id: string): boolean {
  if (seenInView.has(id)) return true;
  try {
    return (localStorage.getItem("orbita-ach-seen") ?? "").split("|").includes(id);
  } catch {
    return false;
  }
}
function remember(id: string): void {
  seenInView.add(id);
  try {
    const ids = (localStorage.getItem("orbita-ach-seen") ?? "").split("|").filter(Boolean);
    localStorage.setItem("orbita-ach-seen", [...new Set([...ids, id])].join("|"));
  } catch {
    /* The in-view set keeps the dismissal when storage is unavailable. */
  }
}
export function AchievementToast({
  achievement: singleAchievement,
  achievements,
}: {
  readonly achievement?: AchievementNotice | null;
  readonly achievements?: readonly AchievementNotice[];
}): React.JSX.Element | null {
  const [visibleId, setVisibleId] = useState<string | null>(null);
  useEffect(() => {
    const achievement = (achievements ?? (singleAchievement ? [singleAchievement] : [])).find(
      (item) => item.fresh && !hasSeen(item.id),
    );
    if (!achievement) {
      setVisibleId(null);
      return;
    }
    const id = achievement.id;
    setVisibleId(id);
    const timer = window.setTimeout(() => {
      remember(id);
      setVisibleId(null);
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [achievements, singleAchievement]);
  const achievement = achievements?.find((item) => item.id === visibleId) ?? singleAchievement;
  if (!achievement || visibleId !== achievement.id) return null;
  function handleClose(): void {
    if (achievement) remember(achievement.id);
    setVisibleId(null);
  }
  return (
    <div className={`ach-toast ${styles.toast}`} role="status" aria-live="polite">
      <span className={styles.tile}>
        <Icon name="trophy" />
      </span>
      <div className={styles.text}>
        <span className={styles.eyebrow}>{t("logros.notice.title")}</span>
        <strong>{achievement.title}</strong>
        <small>{achievement.description}</small>
      </div>
      <Link href="/achievements/trophies" onClick={handleClose}>
        {t("logros.notice.view")}
      </Link>
      <IconButton icon="x" label={t("logros.notice.closeAria")} onClick={handleClose} />
    </div>
  );
}
