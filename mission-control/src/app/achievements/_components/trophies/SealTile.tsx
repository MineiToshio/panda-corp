import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { Icon } from "@/components/core/Icon/Icon";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import type { Seal } from "@/lib/achievements/achievements";
import { categoryLabel } from "../../_utils/presentation";
import styles from "./trophies.module.css";

/** One derived seal; the summary adds its axis and earned/total progress. */
export function SealTile({
  seal,
  progress = true,
  variant = "tile",
}: {
  seal: Seal;
  progress?: boolean;
  variant?: "tile" | "row";
}): React.JSX.Element {
  return (
    <div
      className={variant === "row" ? styles.sealRow : `seal ${styles.seal}`}
      data-tone={variant === "tile" || seal.unlocked ? "gold" : "slate"}
    >
      {variant === "row" ? (
        <BadgeIcon icon={seal.unlocked ? "shield" : "lock"} size="sm" />
      ) : (
        <Icon name={seal.unlocked ? "shield" : "lock"} size="sm" />
      )}
      <div>
        <div className={styles.sealHead}>
          <b>{seal.name}</b>
          {variant === "row" && (
            <small>
              {seal.earned}/{seal.total}
            </small>
          )}
        </div>
        <small>
          {categoryLabel(seal.axis)}
          {variant === "tile" && ` · ${seal.earned}/${seal.total}`}
        </small>
        {progress ? (
          <ProgressBar
            done={seal.earned}
            total={seal.total}
            tone={variant === "tile" || seal.unlocked ? "gold" : "slate"}
            ariaLabel={seal.name}
          />
        ) : null}
      </div>
    </div>
  );
}
