import { t } from "@/lib/copy/copy";
import type { Attributes } from "../../_utils/viewRules";
import styles from "./charts.module.css";

/** Compact six-axis SVG with an equivalent value-bearing accessible name. */
export function RadarChart({ axes }: { axes: Attributes }): React.JSX.Element {
  const entries = Object.entries(axes) as [keyof Attributes, number][];
  const point = (index: number, value: number): string => {
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    const radius = Math.max(4, Math.min(100, value)) * 0.82;
    return `${120 + Math.cos(angle) * radius},${120 + Math.sin(angle) * radius}`;
  };
  const values = entries.map(([key, value]) => `${t(`logros.radar.${key}`)} ${value}`).join(" · ");
  return (
    // SVG end-anchored labels extend left of their text origin, inside the viewBox.
    <svg
      className={`radar ${styles.chart} ${styles.radar}`}
      viewBox="-44 0 328 240"
      data-scroll-x="intentional"
      role="img"
      aria-label={t("logros.radar.aria", { values })}
    >
      {[25, 50, 75, 100].map((radius) => (
        <polygon
          key={radius}
          points={entries.map((_, index) => point(index, radius)).join(" ")}
          className={styles.grid}
        />
      ))}
      {entries.map(([key], index) => {
        const [x, y] = point(index, 100).split(",");
        return <line key={key} x1="120" y1="120" x2={x} y2={y} className={styles.grid} />;
      })}
      <polygon
        points={entries.map(([, value], index) => point(index, value)).join(" ")}
        className={styles.area}
      />
      {entries.map(([key, value], index) => {
        const [x, y] = point(index, value).split(",");
        return <circle key={key} cx={x} cy={y} r="3.5" className={styles.vertex} />;
      })}
      {entries.map(([key], index) => {
        const angle = (index * Math.PI) / 3 - Math.PI / 2;
        return (
          <text
            key={key}
            x={120 + Math.cos(angle) * 104}
            y={120 + Math.sin(angle) * 104}
            textAnchor={Math.cos(angle) < -0.1 ? "end" : Math.cos(angle) > 0.1 ? "start" : "middle"}
            dominantBaseline="middle"
          >
            {t(`logros.radar.${key}`)}
          </text>
        );
      })}
    </svg>
  );
}
