import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import { tierColor } from "@/lib/achievements/tiers";
import { t } from "@/lib/copy/copy";
import styles from "./Stats.module.css";

/** Observed record, never-recorded event or unavailable source, kept as distinct states. */
export function RecordTile({
  label,
  value,
  sub,
  level,
  noData = false,
  icon,
}: {
  readonly icon?: IconName;
  readonly label: string;
  readonly value: number | null;
  readonly sub: string;
  readonly level?: number;
  readonly noData?: boolean;
}): React.JSX.Element {
  return (
    <article
      aria-label={label}
      className={`hstat ${noData ? "nodata" : ""} ${styles.record}`}
      data-testid="hero-stat"
      data-tone="gold"
      data-no-data={noData}
    >
      <div className={styles.recordHeader}>
        <span className={styles.recordLabel}>
          {icon ? <Icon name={icon} size="sm" /> : null}
          {label}
        </span>
        {level !== undefined && !noData ? (
          <span className={`nv ${styles.level}`}>
            <span
              className={styles.pip}
              data-band={Math.floor(level / 5)}
              style={{ background: tierColor(Math.min(4, Math.floor(level / 5))) }}
              aria-hidden="true"
            />
            {level === 0 ? t("logros.stats.noLevel") : t("logros.stats.level", { level })}
          </span>
        ) : null}
      </div>
      <b>{value === null || noData ? "—" : value}</b>
      {value === null ? <span>{t("logros.stats.notWired")}</span> : null}
      <small>{noData ? t("logros.stats.noData") : sub} </small>
    </article>
  );
}
