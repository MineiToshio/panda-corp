import styles from "./Chip.module.css";

export interface FilterChipProps {
  readonly pressed: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

/** 34 px filter toggle: state is `aria-pressed`; the selected look is neutral, never a hue. */
export function FilterChip({ pressed, onClick, children }: FilterChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`chip ${styles.chip} ${styles.filter}`}
    >
      {children}
    </button>
  );
}
