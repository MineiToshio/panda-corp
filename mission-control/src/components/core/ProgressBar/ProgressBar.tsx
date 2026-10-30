/**
 * WO-13-007 — ProgressBar (CMP-13-progressbar)
 *
 * Mission-objectives bar: accent fill, var(--ok) at 100%, done/tot · pct%.
 * role=progressbar with full ARIA (aria-valuenow/min/max/label).
 * tabular-nums on all numerals.
 *
 * Prototype reference (re-anchor, DR-054):
 *   .xpbar → height:18px; border-radius:7px; border:1px solid var(--bd2);
 *             background:var(--canvas); overflow:hidden
 *   .xpbar > i → display:block; height:100%; background:var(--accent); transition:width .6s
 *   Stripe overlay: repeating-linear-gradient(90deg, transparent 0 16px, var(--canvas) 16px 18px)
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
  /** Órbita hue: renders the 6 px bar in that hue instead of the v1 striped bar. */
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
 * Stripe overlay matches the XpBar aesthetic from the prototype.
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
    height: "18px",
    borderRadius: "7px",
    border: "1px solid var(--color-border-strong)",
    background: "var(--color-base)",
    overflow: "hidden",
  };

  const fillStyle: React.CSSProperties = {
    display: "block",
    height: "100%",
    width: `${pct}%`,
    background: isComplete ? "var(--color-ok)" : "var(--color-accent)",
    transition: "width var(--duration-expressive, 280ms) var(--easing-standard, ease)",
  };

  // Stripe overlay (matches .xpbar::after in the prototype)
  const stripeStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "repeating-linear-gradient(90deg, transparent 0 16px, var(--color-base) 16px 18px)",
    opacity: 0.5,
    pointerEvents: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "var(--color-text2)",
    marginTop: "4px",
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
        <div aria-hidden="true" style={stripeStyle} />
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
