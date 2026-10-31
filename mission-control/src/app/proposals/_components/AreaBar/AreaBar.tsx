import type { BacklogAreaKey } from "@/lib/backlog/areas";
import { t } from "@/lib/copy/copy";
import styles from "./AreaBar.module.css";
/** Merged-topic filter with a proportional count bar. */
export function AreaBar({
  area,
  count,
  pressed,
  max,
  onClick,
}: {
  readonly area: BacklogAreaKey;
  readonly count: number;
  readonly pressed: boolean;
  readonly max: number;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`area-bar ${styles.bar}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span>{t(`propuestas.backlog.areas.${area}`)}</span>
      <span className={styles.track} aria-hidden="true">
        <span style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
      </span>
      <b>{count}</b>
    </button>
  );
}
