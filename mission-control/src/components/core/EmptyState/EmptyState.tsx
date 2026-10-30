import { Icon } from "@/components/core/Icon/Icon";
import type { IconName } from "@/components/core/Icon/iconData";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  readonly icon: IconName;
  /** One sentence from the catalogue. */
  readonly children: React.ReactNode;
}

/** Dashed empty box: icon plus one sentence, so "nothing here" is never silent or colour-only. */
export function EmptyState({ icon, children }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={`empty ${styles.empty}`}>
      <Icon name={icon} size="lg" />
      <p>{children}</p>
    </div>
  );
}
