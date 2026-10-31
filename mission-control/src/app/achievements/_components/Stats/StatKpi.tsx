import type { Tone } from "@/components/core/Chip/vocabulary";
import styles from "./Stats.module.css";

/** Executive KPI with an explicit unit and textual change or unavailable state. */
export function StatKpi({
  label,
  value,
  unit,
  foot,
  tone,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly unit?: string;
  readonly foot?: React.ReactNode;
  readonly tone: Tone;
}): React.JSX.Element {
  return (
    <article aria-label={label} className={`kpi ${styles.kpi}`} data-tone={tone}>
      <span className={styles.kpiLabel}>{label}</span>
      <b>
        {value}
        <small>{unit}</small>
      </b>
      {foot ? <span className={styles.foot}>{foot}</span> : null}
    </article>
  );
}
