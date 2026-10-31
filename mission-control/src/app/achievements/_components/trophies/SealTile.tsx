import { Icon } from "@/components/core/Icon/Icon";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import type { Seal } from "@/lib/achievements/achievements";
import { categoryLabel } from "../../_utils/presentation";
import styles from "./trophies.module.css";

/** One derived seal; the summary adds its axis and earned/total progress. */
export function SealTile({
  seal,
  progress = true,
}: {
  seal: Seal;
  progress?: boolean;
}): React.JSX.Element {
  return (
    <div className={`seal ${styles.seal}`} data-tone={seal.unlocked ? "gold" : "slate"}>
      <Icon name={seal.unlocked ? "shield" : "lock"} />
      <div>
        <b>{seal.name}</b>
        <small>
          {seal.earned}/{seal.total} · {categoryLabel(seal.axis)}
        </small>
        {progress ? (
          <ProgressBar
            done={seal.earned}
            total={seal.total}
            tone={seal.unlocked ? "gold" : "slate"}
            ariaLabel={seal.name}
          />
        ) : null}
      </div>
    </div>
  );
}
