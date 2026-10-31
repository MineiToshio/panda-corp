/** Token-based styles for the approved proposal memo. */

import type { ScoreLevel } from "@/lib/pitch/pitch";

/** The article spans the full panel width so the block tints bleed edge-to-edge. */
export const CONTAINER_STYLE: React.CSSProperties = { width: "100%" };
/** Centres each block's content at a readable measure inside the full-width band. */
export const INNER_STYLE: React.CSSProperties = { width: "100%", minWidth: 0 };

// borderBottom lives in the `.pitch-row` CSS class (globals.css) so `:last-child` can drop it.
export const ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "calc(var(--s10) * 3 + var(--s5)) minmax(0, 1fr)",
  gap: "var(--s6)",
  padding: "var(--s3) 0",
  fontSize: "var(--fs-base)",
  alignItems: "start",
};
function rowKey(color: string): React.CSSProperties {
  return {
    fontFamily: "var(--font-body)",
    fontSize: "var(--fs-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
    color,
    paddingTop: "calc(var(--s1) * 0.75)",
    lineHeight: 1.4,
  };
}
// Labels inherit their report band hue.
export const ROW_KEY_HOT_STYLE = rowKey("color-mix(in srgb, var(--tone) 65%, var(--text-2))");
export const ROW_KEY_COLD_STYLE = rowKey("color-mix(in srgb, var(--tone) 65%, var(--text-2))");

export const QUOTE_STYLE: React.CSSProperties = {
  border: "var(--hairline) solid color-mix(in srgb, var(--teal) 35%, var(--line))",
  padding: "var(--s3) var(--s4)",
  margin: "var(--s3) 0 0",
  background: "var(--surface)",
  borderRadius: "var(--r)",
  fontStyle: "italic",
  fontSize: "var(--fs-md)",
  color: "var(--text-2)",
};

// la visión → feature grid (HTML .feats / .feat)
export const VISION_FRAME_STYLE: React.CSSProperties = {
  border: "var(--hairline) solid var(--line-strong)",
  background: "var(--surface)",
  borderRadius: "var(--r)",
  padding: "var(--s3) var(--s4)",
};
export const FEATS_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "var(--s3)",
};
export const FEAT_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "var(--hairline) solid var(--line)",
  borderRadius: "var(--r)",
  padding: "var(--s3) calc(var(--s3) + var(--s1) / 2)",
};
export const FEAT_TITLE_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "var(--fs-md)",
  fontWeight: 650,
  color: "var(--text)",
  marginBottom: "var(--s1)",
};
export const FEAT_DESC_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-sm)",
  lineHeight: 1.45,
  color: "var(--text-2)",
};

// la visión → mock preview (HTML .mock / .checkitem)
export const MOCK_STYLE: React.CSSProperties = {
  marginTop: "var(--s3)",
  background: "var(--surface-2)",
  border: "var(--hairline) solid var(--line)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s4)",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
};
export const MOCK_BAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--s1) * 1.5)",
  marginBottom: "var(--s3)",
};
export const MOCK_DOT_STYLE: React.CSSProperties = {
  width: "calc(var(--s2) + var(--s1) / 2)",
  height: "calc(var(--s2) + var(--s1) / 2)",
  borderRadius: "50%",
  background: "var(--line-strong)",
  flexShrink: 0,
};
export const MOCK_URL_STYLE: React.CSSProperties = {
  marginLeft: "calc(var(--s1) * 1.5)",
  fontSize: "var(--fs-xs)",
  color: "var(--text-3)",
};
export const CHECKITEM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--s3)",
  padding: "var(--s2) var(--s3)",
  borderRadius: "var(--r-md)",
  marginBottom: "calc(var(--s1) * 1.5)",
  fontSize: "var(--fs-sm)",
  background: "var(--surface)",
  border: "var(--hairline) solid var(--line)",
  color: "var(--text)",
};
function checkIcon(ok: boolean): React.CSSProperties {
  return {
    width: "var(--s4)",
    height: "var(--s4)",
    borderRadius: "var(--r-xs)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "var(--fs-sm)",
    background: "transparent",
    color: ok ? "var(--green)" : "var(--coral)",
  };
}
export const CHECK_OK_ICON_STYLE = checkIcon(true);
export const CHECK_WARN_ICON_STYLE = checkIcon(false);

// red team → pre-mortem box (HTML .premortem)
export const PREMORTEM_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--coral) var(--tint), var(--surface))",
  border: "var(--hairline) solid color-mix(in srgb, var(--coral) 45%, transparent)",
  borderRadius: "var(--r)",
  padding: "var(--s3) var(--s4)",
  marginTop: "calc(var(--s1) / 2)",
  fontSize: "var(--fs-md)",
};
// el ask → highlighted box (HTML .ask)
export const ASK_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--blue) var(--tint), var(--surface))",
  border: "var(--hairline) solid color-mix(in srgb, var(--blue) 45%, transparent)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s3) var(--s4)",
  fontSize: "var(--fs-base)",
  color: "var(--text)",
  marginTop: "calc(var(--s1) / 2)",
};

// risk ↔ mitigation pairs (HTML .rm / .ri red / .mi green)
export const RM_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  borderRadius: "var(--r)",
  overflow: "hidden",
  marginTop: "calc(var(--s2) + var(--s1) / 2)",
};
export const RM_RISK_STYLE: React.CSSProperties = {
  padding: "var(--s3) calc(var(--s3) + var(--s1) / 2)",
  background: "color-mix(in srgb, var(--coral) var(--tint-strong), var(--surface))",
  fontSize: "var(--fs-sm)",
  color: "var(--text)",
};
export const RM_MIT_STYLE: React.CSSProperties = {
  padding: "var(--s3) calc(var(--s3) + var(--s1) / 2)",
  background: "color-mix(in srgb, var(--green) var(--tint-strong), var(--surface))",
  borderLeft: "var(--hairline) solid var(--line)",
  fontSize: "var(--fs-sm)",
  color: "var(--text)",
};

// --- Decision board: scorecard + chart (HTML .twocol / .panel) ---------
export const TWOCOL_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "var(--s4)",
};
export const SUBPANEL_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "var(--hairline) solid var(--line)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s4)",
};
export const SUBPANEL_TITLE_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-md)",
  fontWeight: 700,
  color: "var(--text)",
};

// scorecard bars (HTML .scab)
export const SCORE_LIST_STYLE: React.CSSProperties = { marginTop: "var(--s3)" };
export const SCORE_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "calc(var(--s10) * 2 + var(--s5)) minmax(var(--s12), 1fr) minmax(0, 1.3fr)",
  alignItems: "center",
  gap: "var(--s3)",
  marginBottom: "var(--s2)",
};
export const SCORE_NAME_STYLE: React.CSSProperties = {
  minWidth: 0,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "var(--fs-xs)",
  color: "var(--text-2)",
};
export const SCORE_TRACK_STYLE: React.CSSProperties = {
  flex: 1,
  height: "var(--s2)",
  background: "var(--surface-3)",
  borderRadius: "var(--r-xs)",
  overflow: "hidden",
};
const SCORE_FILL_COLOR: Record<ScoreLevel, string> = {
  high: "var(--green)",
  mid: "var(--amber)",
  low: "var(--coral)",
};
const SCORE_FILL_WIDTH: Record<ScoreLevel, string> = { high: "92%", mid: "55%", low: "25%" };
export function scoreFillStyle(level: ScoreLevel): React.CSSProperties {
  return {
    display: "block",
    height: "100%",
    width: SCORE_FILL_WIDTH[level],
    background: SCORE_FILL_COLOR[level],
  };
}
export const SCORE_VAL_STYLE: React.CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-xs)",
  color: "var(--text-2)",
};

// evidence collapsible (HTML details/summary/.src)
export const DETAILS_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "var(--hairline) solid var(--line)",
  borderRadius: "var(--r)",
  padding: "var(--s2) var(--s4)",
  marginTop: "var(--s2)",
};
export const SUMMARY_STYLE: React.CSSProperties = {
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--fs-md)",
  color: "var(--violet)",
  padding: "var(--s1) 0",
  listStyle: "none",
};
export const EVIDENCE_BODY_STYLE: React.CSSProperties = { padding: "var(--s1) 0 var(--s2)" };
