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
      <polygon points={`20,180 ${coords} 460,180`} className={styles.lineArea} />
      <polyline points={coords} className={styles.line} />
      {points.map((point, index) => {
        const x = 20 + (index / Math.max(1, points.length - 1)) * 440;
        const y = 180 - (Math.max(0, point.value) / max) * 160;
        return (
          <g key={point.label}>
            <circle cx={x} cy={y} r={4} className={styles.linePoint} />
            <text x={x} y={y - 10} textAnchor="middle">
              {point.value}
            </text>
            <text x={x} y={198} textAnchor="middle">
              {point.label.replace(/\b\d{4}-(?:W)?/, "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
