import styles from "./Chip.module.css";

export interface CountPillProps {
  /** The number shown; tabular figures. */
  readonly count: number;
}

/** Count beside a title: a chip that inherits the container's `--tone` (the number is its text). */
export function CountPill({ count }: CountPillProps): React.JSX.Element {
  return (
    <span data-testid="count-pill" className={`chip num ${styles.chip} ${styles.count}`}>
      {count}
    </span>
  );
}
