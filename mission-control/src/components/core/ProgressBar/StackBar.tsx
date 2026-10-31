import type { Tone } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import styles from "./ProgressBar.module.css";

interface StackSegment {
  /** Spanish state word, shown in the text alternative. */
  readonly label: string;
  readonly count: number;
  readonly tone: Tone;
}

export interface StackBarProps {
  readonly segments: readonly StackSegment[];
}

/** 8 px stack of states: widths follow the counts; the text alternative lists «N estado» per segment. */
export function StackBar({ segments }: StackBarProps): React.JSX.Element {
  const shown = segments.filter((segment) => segment.count > 0);
  const total = shown.reduce((sum, segment) => sum + segment.count, 0);
  const summary = shown
    .map((segment) => t("common.stackbar.item", { count: segment.count, state: segment.label }))
    .join(", ");
  return (
    <div
      className={`stackbar ${styles.stack}`}
      role="img"
      aria-label={summary || t("common.stackbar.empty")}
    >
      {shown.map((segment) => (
        <span
          key={segment.label}
          data-tone={segment.tone}
          style={{ flexGrow: segment.count / total }}
        />
      ))}
    </div>
  );
}
