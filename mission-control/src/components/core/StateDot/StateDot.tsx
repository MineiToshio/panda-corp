import { statePresentation } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import styles from "./StateDot.module.css";

export interface StateDotProps {
  /** Work-order state (`todo`, `in_progress`, `review`, `done`, `blocked`); unknown values read «Sin estado». */
  readonly state: string | undefined;
}

/** 7 px dot plus the state word: the state is never carried by colour alone (REQ-13-007). */
export function StateDot({ state }: StateDotProps): React.JSX.Element {
  const { tone, labelKey } = statePresentation(state);
  return (
    <span className={`state-dot ${styles.dot}`} data-tone={tone} data-state={state ?? "none"}>
      <span className={styles.mark} aria-hidden="true" />
      {t(labelKey)}
    </span>
  );
}
