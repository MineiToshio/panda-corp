import Link from "next/link";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { t } from "@/lib/copy/copy";
import { type GuildLevel, xpForLevel } from "@/lib/gamification/gamification";
import styles from "./GuildCard.module.css";

export function GuildCard({ level }: { readonly level: GuildLevel }): React.JSX.Element {
  const current = level.xp - xpForLevel(level.level);
  const total = xpForLevel(level.level + 1) - xpForLevel(level.level);
  const vars = { level: level.level, rank: level.title, current, total, next: level.level + 1 };
  return (
    <Link
      href="/achievements"
      className={`guildcard ${styles.card}`}
      aria-label={t("shell.guild.aria", vars)}
    >
      <div className={styles.row}>
        <span className={`crest ${styles.crest}`}>{level.level}</span>
        <div className="gtext">
          <b>{level.title}</b>
          <small>{t("shell.guild.progress", vars)}</small>
        </div>
      </div>
      <ProgressBar
        tone="gold"
        done={level.pctToNext}
        total={100}
        ariaLabel={t("shell.guild.progress", vars)}
      />
    </Link>
  );
}
