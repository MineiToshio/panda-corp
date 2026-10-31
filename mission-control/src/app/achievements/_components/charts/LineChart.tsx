import type { ChartPoint } from "./ColumnChart";
import styles from "./charts.module.css";
/** Observed time series with a full text alternative, including empty series. */
export function LineChart({
  points,
  label,
}: {
  points: readonly ChartPoint[];
  label: string;
}): React.JSX.Element {
  const max = Math.max(1, ...points.map((point) => point.value));
  const coords = points
    .map(
      (point, index) =>
        `${20 + (index / Math.max(1, points.length - 1)) * 440},${180 - (Math.max(0, point.value) / max) * 160}`,
    )
    .join(" ");
  return (
    <svg role="img" aria-label={label} className={styles.chart} viewBox="0 0 480 200">
      <title>{label}</title>
      <desc>{points.map((point) => `${point.label}: ${point.value}`).join(" · ")}</desc>
      <polyline points={coords} className={styles.line} />
    </svg>
  );
}
