import styles from "./MoreBar.module.css";

export interface RevealState {
  /** How many items are visible now. */
  readonly visible: number;
  /** Items still hidden before the press (M of «quedan M»). */
  readonly remaining: number;
  /** Items the next press reveals (N of «Mostrar N más»). */
  readonly next: number;
}

/**
 * Paged reveal arithmetic: the first view shows `pageSize`; each press reveals `step` more
 * (default `2 × pageSize`, the prototype's `moreList`).
 */
export function pagedReveal(
  total: number,
  pressed: number,
  pageSize: number,
  step: number = pageSize * 2,
): RevealState {
  const visible = Math.min(total, pageSize + pressed * step);
  const remaining = total - visible;
  return { visible, remaining, next: Math.min(step, remaining) };
}

/** Reveal-all arithmetic: one press shows the whole remainder; `expanded` shows everything. */
export function allReveal(total: number, pageSize: number, expanded: boolean): RevealState {
  const visible = expanded ? total : Math.min(total, pageSize);
  const remaining = total - visible;
  return { visible, remaining, next: remaining };
}

export interface MoreBarProps {
  /** The already-resolved catalogue label («Mostrar 14 más · quedan 14», «Mostrar menos»). */
  readonly label: string;
  readonly onClick: () => void;
}

/** Full-width dashed 40 px button that reveals more of a list. It holds no copy: the caller passes the label. */
export function MoreBar({ label, onClick }: MoreBarProps): React.JSX.Element {
  return (
    <button type="button" className={`morebtn ${styles.more}`} onClick={onClick}>
      {label}
    </button>
  );
}
