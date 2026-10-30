import { statePresentation } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import type { RepoState } from "@/lib/pendingMerge/repoState";
import styles from "./StateDot.module.css";

/** State vocabulary: work-order states by default, repository cleanup states when selected. */
export type StateDotProps =
  | { readonly variant?: "workOrder"; readonly state: string | undefined }
  | { readonly variant: "repository"; readonly state: RepoState };

const repositoryTones = {
  cleanNow: "coral",
  reviewSoon: "amber",
  upToDate: "green",
  clean: "green",
} as const;

/** 7 px dot plus the state word: the state is never carried by colour alone (REQ-13-007). */
export function StateDot(props: StateDotProps): React.JSX.Element {
  const { state } = props;
  const { tone, labelKey } =
    props.variant === "repository"
      ? {
          tone: repositoryTones[props.state],
          labelKey: `inicio.worktrees.states.${props.state}` as const,
        }
      : statePresentation(state);
  return (
    <span
      className={`state-dot ${styles.dot}`}
      data-tone={tone}
      data-state={state ?? "none"}
      data-variant={props.variant ?? "workOrder"}
    >
      <span className={styles.mark} aria-hidden="true" />
      {t(labelKey)}
    </span>
  );
}
