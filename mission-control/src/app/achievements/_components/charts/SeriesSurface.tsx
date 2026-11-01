"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./charts.module.css";

/** Keep labels at the token's screen size when the series coordinate system shrinks. */
export function SeriesSurface({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<SVGSVGElement>(null);
  const [labelScale, setLabelScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setLabelScale(Math.max(1, 480 / width));
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(element);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <svg
      ref={ref}
      role="img"
      aria-label={label}
      className={`${styles.chart} ${styles.series}`}
      viewBox="0 0 480 200"
      style={{ "--series-label-scale": labelScale } as CSSProperties}
    >
      {children}
    </svg>
  );
}
