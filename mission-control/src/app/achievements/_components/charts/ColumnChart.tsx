import styles from "./charts.module.css";
/** One observed chart value; the label is its textual alternative. */
export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}
/** Token-coloured bars with an accessible label per observed value. */
export function ColumnChart({
  points,
  label,
}: {
  points: readonly ChartPoint[];
  label: string;
}): React.JSX.Element {
  const max = Math.max(1, ...points.map((point) => point.value));
  const width = 480 / Math.max(1, points.length);
  return (
    <svg role="img" aria-label={label} className={styles.chart} viewBox="0 0 480 200">
      <title>{label}</title>
      {points.map((point, index) => (
        <rect
          key={point.label}
          x={index * width}
          y={180 - (Math.max(0, point.value) / max) * 160}
          width={width * 0.7}
          height={(Math.max(0, point.value) / max) * 160}
          className={styles.column}
        >
          <title>
            {point.label}: {point.value}
          </title>
        </rect>
      ))}
    </svg>
  );
}
