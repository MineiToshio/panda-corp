import { t } from "@/lib/copy/copy";
import type { Attributes } from "../../_utils/viewRules";
import styles from "./charts.module.css";

/** Compact six-axis SVG with an equivalent value-bearing accessible name. */
export function RadarChart({ axes }: { axes: Attributes }): React.JSX.Element {
  const entries = Object.entries(axes) as [keyof Attributes, number][];
  const point = (index: number, value: number): string => {
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    const radius = Math.max(0, Math.min(100, value)) * 0.7;
    return `${120 + Math.cos(angle) * radius},${110 + Math.sin(angle) * radius}`;
  };
  const values = entries.map(([key, value]) => `${t(`logros.radar.${key}`)} ${value}`).join(" · ");
  return (
    <svg
      className={`radar ${styles.chart}`}
      viewBox="0 0 240 220"
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
      <polygon
        points={entries.map(([, value], index) => point(index, value)).join(" ")}
        className={styles.area}
      />
      {entries.map(([key], index) => {
        const angle = (index * Math.PI) / 3 - Math.PI / 2;
        return (
          <text
            key={key}
            x={120 + Math.cos(angle) * 95}
            y={113 + Math.sin(angle) * 95}
            textAnchor="middle"
          >
            {t(`logros.radar.${key}`)}
          </text>
        );
      })}
    </svg>
  );
}
