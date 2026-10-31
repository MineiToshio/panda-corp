/**
 * Styles for IdeaPitch — a FAITHFUL port of the owner-approved HTML
 * (docs/proposals/10b-sample-idea-memo.html), RE-THEMED to the Atelier tokens. Token-based colours
 * only. The hot/cold blocks are FULL-WIDTH tinted bands (content centred via INNER_STYLE); the
 * inline-coloured emphasis (red/green/amber bold) lives in globals.css `.pitch-*` helpers, since the
 * shared <Markdown> renders bold white and can't be styled inline.
 */

import type { ScoreLevel } from "@/lib/pitch/pitch";

/** The article spans the full panel width so the block tints bleed edge-to-edge. */
export const CONTAINER_STYLE: React.CSSProperties = { width: "100%" };
/** Centres each block's content at a readable measure inside the full-width band. */
export const INNER_STYLE: React.CSSProperties = { width: "100%", minWidth: 0 };

// --- Rows (HTML: .row 138px|1fr, gap 18, dashed, 15px) -----------------
// borderBottom lives in the `.pitch-row` CSS class (globals.css) so `:last-child` can drop it.
export const ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "138px 1fr",
  gap: "18px",
  padding: "12px 0",
  fontSize: "15px",
  alignItems: "start",
};
function rowKey(color: string): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color,
    paddingTop: "3px",
    lineHeight: 1.4,
  };
}
// Row labels muted to the Spec tab's grey (was warn/info) — owner request.
export const ROW_KEY_HOT_STYLE = rowKey("var(--text-3)");
export const ROW_KEY_COLD_STYLE = rowKey("var(--text-3)");

// problema → quote callout (accent border, not grey)
export const QUOTE_STYLE: React.CSSProperties = {
  borderLeft: "3px solid var(--violet)",
  padding: "8px 14px",
  margin: "10px 0 0",
  background: "var(--surface-2)",
  borderRadius: "0 10px 10px 0",
  fontStyle: "italic",
  fontSize: "14px",
  color: "var(--text-2)",
};

// la visión → feature grid (HTML .feats / .feat)
export const VISION_FRAME_STYLE: React.CSSProperties = {
  border: "1px solid var(--line-strong)",
  background: "var(--surface-2)",
  borderRadius: "12px",
  padding: "12px 16px",
};
// "La visión" feature cards mirror the Spec tab's "Usuarios" role cards (SpecDigest.styles
// ROLE_CARD/ROLE_TITLE/ROLE_DESC) — same grid, padding, title colour (info) and desc — for
// cross-section visual coherence (factory/standards/design.md).
export const FEATS_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "10px",
};
export const FEAT_STYLE: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  padding: "12px 14px",
};
export const FEAT_TITLE_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 700,
  color: "var(--blue)",
  marginBottom: "4px",
};
export const FEAT_DESC_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  lineHeight: 1.45,
  color: "var(--text-2)",
};

// la visión → mock preview (HTML .mock / .checkitem)
export const MOCK_STYLE: React.CSSProperties = {
  marginTop: "12px",
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: "14px",
  padding: "16px",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
};
export const MOCK_BAR_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginBottom: "12px",
};
export const MOCK_DOT_STYLE: React.CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "var(--line-strong)",
  flexShrink: 0,
};
export const MOCK_URL_STYLE: React.CSSProperties = {
  marginLeft: "6px",
  fontSize: "11px",
  color: "var(--text-3)",
};
export const CHECKITEM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 10px",
  borderRadius: "9px",
  marginBottom: "6px",
  fontSize: "13px",
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  color: "var(--text)",
};
function checkIcon(ok: boolean): React.CSSProperties {
  return {
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "13px",
    background: ok
      ? "color-mix(in srgb, var(--green) var(--tint), transparent)"
      : "color-mix(in srgb, var(--coral) var(--tint), transparent)",
    color: ok ? "var(--green)" : "var(--coral)",
  };
}
export const CHECK_OK_ICON_STYLE = checkIcon(true);
export const CHECK_WARN_ICON_STYLE = checkIcon(false);

// red team → pre-mortem box (HTML .premortem)
export const PREMORTEM_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--coral) var(--tint), transparent)",
  border: "1px solid var(--coral)",
  borderRadius: "12px",
  padding: "14px 16px",
  marginTop: "2px",
  fontSize: "14px",
};
// el ask → highlighted box (HTML .ask)
export const ASK_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--violet) var(--tint-strong), transparent)",
  border: "1px solid var(--violet)",
  borderRadius: "14px",
  padding: "16px 20px",
  fontSize: "15px",
  color: "var(--text)",
  marginTop: "2px",
};

// risk ↔ mitigation pairs (HTML .rm / .ri red / .mi green)
export const RM_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  border: "1px solid var(--line)",
  borderRadius: "11px",
  overflow: "hidden",
  marginTop: "10px",
};
export const RM_RISK_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  background: "color-mix(in srgb, var(--coral) var(--tint), transparent)",
  fontSize: "13px",
  color: "var(--text)",
};
export const RM_MIT_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  background: "color-mix(in srgb, var(--green) var(--tint), transparent)",
  borderLeft: "1px solid var(--line)",
  fontSize: "13px",
  color: "var(--text)",
};

// --- Decision board: scorecard + chart (HTML .twocol / .panel) ---------
export const TWOCOL_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
};
export const SUBPANEL_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "14px",
  padding: "18px",
};
export const SUBPANEL_TITLE_STYLE: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: "var(--text)",
};

// scorecard bars (HTML .scab)
export const SCORE_LIST_STYLE: React.CSSProperties = { marginTop: "14px" };
export const SCORE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "7px",
};
export const SCORE_NAME_STYLE: React.CSSProperties = {
  width: "84px",
  flexShrink: 0,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  color: "var(--text-3)",
};
export const SCORE_TRACK_STYLE: React.CSSProperties = {
  flex: 1,
  height: "12px",
  background: "var(--surface-3)",
  borderRadius: "6px",
  overflow: "hidden",
};
const SCORE_FILL_COLOR: Record<ScoreLevel, string> = {
  high: "var(--green)",
  mid: "var(--amber)",
  low: "var(--blue)",
};
const SCORE_FILL_WIDTH: Record<ScoreLevel, string> = { high: "92%", mid: "56%", low: "28%" };
export function scoreFillStyle(level: ScoreLevel): React.CSSProperties {
  return {
    display: "block",
    height: "100%",
    width: SCORE_FILL_WIDTH[level],
    background: SCORE_FILL_COLOR[level],
  };
}
export const SCORE_VAL_STYLE: React.CSSProperties = {
  minWidth: "84px",
  textAlign: "right",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  color: "var(--text-2)",
};

// evidence collapsible (HTML details/summary/.src)
export const DETAILS_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  padding: "4px 16px",
  marginTop: "8px",
};
export const SUMMARY_STYLE: React.CSSProperties = {
  cursor: "pointer",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "12.5px",
  color: "var(--violet)",
  padding: "8px 0",
};
export const EVIDENCE_BODY_STYLE: React.CSSProperties = { padding: "4px 0 6px" };
// each source row: plain "descripción — link" (NO Markdown wrapper → no <p> margin, tight & small).
// the dashed separator lives in the `.pitch-src` class so :last-child drops it.
export const EVIDENCE_SRC_STYLE: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.5,
  color: "var(--text-2)",
  padding: "5px 0",
};
export const EVIDENCE_LINK_STYLE: React.CSSProperties = {
  color: "var(--violet)",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};
