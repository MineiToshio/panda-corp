import { type Phase, phasePresentation, type Tone } from "@/components/core/Chip/vocabulary";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import { t } from "@/lib/copy/copy";
import reportStyles from "./FunnelRow.module.css";
import styles from "./Home.module.css";
/** Shared funnel row, also consumed by the achievement report. */
export function FunnelRow({
  phase,
  count,
  max,
  report,
}: {
  readonly phase: Phase;
  readonly count: number;
  readonly max: number;
  /** Report variant: count-caption bars; Inicio retains its phase-progress rows. */
  readonly report?: { readonly caption: string; readonly tone: Tone };
}): React.JSX.Element {
  const presentation = phasePresentation(phase);
  if (report) {
    const width = Math.max(4, Math.min(100, Math.round((count / Math.max(1, max)) * 100)));
    return (
      <div className={reportStyles.report} data-tone={report.tone}>
        <div className={reportStyles.track} aria-hidden="true">
          <span className={reportStyles.fill} style={{ width: `${width}%` }} />
        </div>
        <span className={reportStyles.caption}>
          <b>{count}</b> <span>{report.caption}</span>
        </span>
      </div>
    );
  }
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
