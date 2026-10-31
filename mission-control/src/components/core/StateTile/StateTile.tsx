import type { Tone } from "@/components/core/Chip/vocabulary";
import styles from "./StateTile.module.css";
/** Public state tile props contract. */
export interface StateTileProps {
  readonly label: string;
  readonly count: number;
  readonly hint?: string;
  readonly tone: Tone;
  readonly pressed: boolean;
  readonly onClick: () => void;
  readonly progress?: number;
}
/** Count tile with a labelled priority filter and optional progress. */
export function StateTile({
  label,
  count,
  hint,
  tone,
  pressed,
  onClick,
  progress,
}: StateTileProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`state-tile ${styles.tile}`}
      data-tone={tone}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className={styles.label}>
        <span className={styles.dot} />
        {label}
      </span>
      <b>{count}</b>
      {hint && <small>{hint}</small>}
      {progress !== undefined && <progress max={100} value={progress} aria-label={label} />}
    </button>
  );
}
