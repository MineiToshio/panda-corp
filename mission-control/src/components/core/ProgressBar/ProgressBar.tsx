/**
 * WO-13-007 — ProgressBar (CMP-13-progressbar)
 *
 * Mission-objectives bar: accent fill, var(--ok) at 100%, done/tot · pct%.
 * role=progressbar with full ARIA (aria-valuenow/min/max/label).
 * tabular-nums on all numerals.
 *
 * Tokens only. Light+dark first-class.
 * Traceability: CMP-13-progressbar, AC-13-006.x.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { Tone } from "@/components/core/Chip/vocabulary";
import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  /** Órbita hue: sets the 6 px bar hue; omitted keeps the labelled presentation. */
  tone?: Tone;
  /** Number of completed items. */
  done: number;
  /** Total items. */
  total: number;
  /** Optional accessible label. Defaults to "Progreso". */
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// ProgressBar component
// ---------------------------------------------------------------------------

/**
 * ProgressBar — mission-objectives progress bar.
 *
 * Usage: `<ProgressBar done={3} total={10} />`
 *
 * Shows "done/total · pct%" label. Fill switches to ok-color at 100%.
 * Both presentations use the Órbita track and hue tokens.
 */
export function ProgressBar({
  done,
  total,
  ariaLabel = "Progreso",
  tone,
}: ProgressBarProps): React.JSX.Element {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
  const isComplete = total > 0 && done >= total;

  if (tone) {
    return (
      <div
        data-testid="progress-bar"
        data-complete={String(isComplete)}
        data-tone={isComplete ? "green" : tone}
        className={`bar ${styles.bar}`}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    );
  }

  const trackStyle: React.CSSProperties = {
    position: "relative",
    height: "6px",
    borderRadius: "var(--r-pill)",
    border: 0,
    background: "var(--surface-3)",
    overflow: "hidden",
  };

  const fillStyle: React.CSSProperties = {
    display: "block",
    height: "100%",
    width: `${pct}%`,
    background: isComplete ? "var(--green)" : "var(--violet)",
    transition: "width var(--dur) var(--ease)",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "var(--fs-xs)",
    color: "var(--text-2)",
    marginTop: "var(--s1)",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div
      data-testid="progress-bar"
      data-complete={String(isComplete)}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div style={trackStyle}>
        <i data-testid="progress-bar-fill" style={fillStyle} />
      </div>
      <div aria-hidden="true" style={labelStyle}>
        <span>
          {done}/{total}
        </span>
        <span> {pct}%</span>
      </div>
    </div>
  );
}
