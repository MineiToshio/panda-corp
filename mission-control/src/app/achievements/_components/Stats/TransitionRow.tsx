import { Chip } from "@/components/core/Chip/Chip";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import type { PhaseTransition } from "@/lib/achievements/report/types";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import styles from "./Stats.module.css";

/** Phase observation with textual, symbolic and amber reopening cues. */
export function TransitionRow({
  transition,
}: {
  readonly transition: PhaseTransition;
}): React.JSX.Element {
  return (
    <li className={styles.transition}>
      <time dateTime={transition.date}>{formatDate(transition.date)}</time>
      <span className={`tr-p ${styles.project}`}>{transition.project}</span>
      <span className="tr-f">
        {t(phasePresentation(transition.from).labelKey)} {transition.isReopen ? "↺" : "→"}{" "}
        {t(phasePresentation(transition.to).labelKey)}
      </span>
      {transition.isReopen ? (
        <Chip tone="amber" icon="rotate">
          {t("logros.stats.reopening")}
        </Chip>
      ) : null}
    </li>
  );
}
