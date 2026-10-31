import { type Phase, phasePresentation } from "@/components/core/Chip/vocabulary";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { t } from "@/lib/copy/copy";
import styles from "./Home.module.css";
/** Shared funnel row, also consumed by the achievement report. */
export function FunnelRow({
  phase,
  count,
  max,
}: {
  readonly phase: Phase;
  readonly count: number;
  readonly max: number;
}): React.JSX.Element {
  const presentation = phasePresentation(phase);
  return (
    <div className={`frow ${styles.funnelRow}`}>
      <span>{t(presentation.labelKey)}</span>
      <ProgressBar
        done={count}
        total={max}
        tone={presentation.tone}
        ariaLabel={t(presentation.labelKey)}
      />
      <b>{count}</b>
    </div>
  );
}
