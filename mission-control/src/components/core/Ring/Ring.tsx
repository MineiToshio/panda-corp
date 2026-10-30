import type { Tone } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import styles from "./Ring.module.css";

export interface RingProps {
  /** 0 to 100; clamped. */
  readonly percent: number;
  readonly size?: "md" | "lg";
  /** Hue of the arc; green by default and at 100 %. */
  readonly tone?: Tone;
  /** Full sentence naming the value. It is the accessible name and the tooltip; with it the ring is focusable. */
  readonly tip?: string;
}

/** Conic progress ring; the percentage is text, so the value never rests on the arc colour alone. */
export function Ring({ percent, size = "md", tone, tip }: RingProps): React.JSX.Element {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  const name = tip ?? t("common.ring.defaultAria", { pct: value });
  return (
    <span
      role="img"
      aria-label={name}
      tabIndex={tip ? 0 : undefined}
      data-tip={tip}
      data-tone={value >= 100 ? "green" : tone}
      className={`ring ${size === "lg" ? `lg ${styles.lg} ` : ""}${styles.ring}`}
      style={{ "--p": value } as React.CSSProperties}
    >
      <span className="num" aria-hidden="true">
        {value}%
      </span>
    </span>
  );
}
