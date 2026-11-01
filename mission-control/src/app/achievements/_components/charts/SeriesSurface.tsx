import type { ReactNode } from "react";
import styles from "./charts.module.css";

/** Container-relative labels keep their screen size before hydration and after resizing. */
export function SeriesSurface({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.seriesFrame}>
      <svg
        role="img"
        aria-label={label}
        className={`${styles.chart} ${styles.series}`}
        viewBox="0 0 480 200"
      >
        {children}
      </svg>
    </div>
  );
}
