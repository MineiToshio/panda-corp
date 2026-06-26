/**
 * Styles for IdeaPitch — the native "Propuesta" memo, faithful to the owner-approved HTML
 * (docs/proposals/10b-sample-idea-memo.html) but RE-THEMED to the Atelier tokens: teal accent,
 * ok/warn/danger/info status, the dark surface ladder. Token-based only (no hardcoded colors).
 */

import type { BadgeTone, ScoreLevel } from "@/lib/pitch/pitch";

export const CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: "var(--measure, 72ch)",
  margin: "0 auto",
};

// --- Hero ---------------------------------------------------------------
export const HERO_STYLE: React.CSSProperties = {
  padding: "8px 0 22px",
  borderBottom: "1px solid var(--color-border)",
};

export const EYEBROW_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.72rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--color-accent-text)",
};

export const TITLE_STYLE: React.CSSProperties = {
  margin: "10px 0 8px",
  fontSize: "1.9rem",
  lineHeight: 1.12,
  fontWeight: 800,
  letterSpacing: "-0.01em",
  color: "var(--color-text)",
};

export const ONE_LINER_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  color: "var(--color-text2)",
};

export const BADGES_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "16px",
};

const BADGE_TONE_BG: Record<BadgeTone, string> = {
  build: "var(--color-ok-bg)",
  warn: "var(--color-warn-bg)",
  info: "var(--color-info-bg)",
  neutral: "var(--color-card)",
};
const BADGE_TONE_FG: Record<BadgeTone, string> = {
  build: "var(--color-ok)",
  warn: "var(--color-warn)",
  info: "var(--color-info)",
  neutral: "var(--color-text2)",
};

export function badgeStyle(tone: BadgeTone): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "0.72rem",
    padding: "5px 12px",
    borderRadius: "999px",
    border: "1px solid var(--color-border)",
    background: BADGE_TONE_BG[tone],
    color: BADGE_TONE_FG[tone],
    whiteSpace: "nowrap",
  };
}

// --- Blocks (hot / cold) -----------------------------------------------
export const BLOCK_HOT_STYLE: React.CSSProperties = {
  padding: "22px 0",
  borderBottom: "1px solid var(--color-border)",
};
export const BLOCK_COLD_STYLE: React.CSSProperties = {
  padding: "22px 0",
  borderBottom: "1px solid var(--color-border)",
};

function blabel(color: string): React.CSSProperties {
  return {
    margin: "0 0 16px",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "0.72rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 700,
    color,
  };
}
export const BLABEL_HOT_STYLE = blabel("var(--color-warn)");
export const BLABEL_COLD_STYLE = blabel("var(--color-info)");

// --- Rows (label | value), faithful to the HTML .mrow ------------------
export const ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "132px 1fr",
  gap: "16px",
  padding: "11px 0",
  borderBottom: "1px dashed var(--color-border)",
  fontSize: "0.95rem",
};

function rowKey(color: string): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color,
    paddingTop: "2px",
  };
}
export const ROW_KEY_HOT_STYLE = rowKey("var(--color-warn)");

// Problema → quote callout
export const QUOTE_STYLE: React.CSSProperties = {
  borderLeft: "3px solid var(--color-accent)",
  padding: "8px 14px",
  background: "var(--color-panel)",
  borderRadius: "0 10px 10px 0",
  color: "var(--color-text)",
};

// La visión → framed prize
export const VISION_FRAME_STYLE: React.CSSProperties = {
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  borderRadius: "12px",
  padding: "14px 16px",
};

// --- Deep-dive cards (Profundizar) -------------------------------------
export function deepCardStyle(danger: boolean): React.CSSProperties {
  return {
    background: "var(--color-panel)",
    border: "1px solid var(--color-border)",
    borderLeft: danger ? "3px solid var(--color-danger)" : "1px solid var(--color-border)",
    borderRadius: "12px",
    padding: "14px 18px",
    marginBottom: "12px",
  };
}
export const DEEP_HEADING_STYLE: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "var(--color-accent-text)",
};

// --- Scorecard bars ----------------------------------------------------
export const BOARD_STYLE: React.CSSProperties = { padding: "22px 0 4px" };
export const SCORE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "8px",
};
export const SCORE_NAME_STYLE: React.CSSProperties = {
  width: "88px",
  flexShrink: 0,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.7rem",
  color: "var(--color-text3)",
};
export const SCORE_TRACK_STYLE: React.CSSProperties = {
  flex: 1,
  height: "12px",
  background: "var(--color-card)",
  borderRadius: "6px",
  overflow: "hidden",
};
const SCORE_FILL_COLOR: Record<ScoreLevel, string> = {
  high: "var(--color-ok)",
  mid: "var(--color-warn)",
  low: "var(--color-info)",
};
const SCORE_FILL_WIDTH: Record<ScoreLevel, string> = {
  high: "92%",
  mid: "56%",
  low: "28%",
};
export function scoreFillStyle(level: ScoreLevel): React.CSSProperties {
  return {
    display: "block",
    height: "100%",
    width: SCORE_FILL_WIDTH[level],
    background: SCORE_FILL_COLOR[level],
  };
}
export const SCORE_VAL_STYLE: React.CSSProperties = {
  minWidth: "92px",
  textAlign: "right",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.7rem",
  color: "var(--color-text2)",
};
