/**
 * Styles for ArchitectureDigest — the native "Arquitectura" tab. The hero, the full-bleed tinted
 * bands, the label|content rows and the FRD cards REUSE SpecDigest's exported style constants
 * (DR-062: a shared style over a copied one — the two tabs must read as one app). This file holds
 * only the architecture-specific primitives: the stack table, the data-model list, the env grid,
 * the ADR rows and the implementation-plan (DAG) panel.
 */

// --- Full-bleed tinted bands (same BLEED rhythm as SpecDigest, architecture tints) ----------
const BLEED = {
  marginInline: "calc(50% - 50vw)",
  paddingTop: "24px",
  paddingBottom: "24px",
  paddingInline: "calc(50vw - 50%)",
  borderBottom: "1px solid var(--color-border)",
} as const;
const STACK_TINT = "color-mix(in oklab, var(--color-accent-bg) 26%, var(--color-base))";
const DATA_TINT = "color-mix(in oklab, var(--color-ok-bg) 22%, var(--color-base))";
export const BLOCK_STACK_STYLE: React.CSSProperties = { ...BLEED, background: STACK_TINT };
export const BLOCK_DATA_STYLE: React.CSSProperties = { ...BLEED, background: DATA_TINT };

/** Section label (mono eyebrow), coloured per section. Mirrors SpecDigest's blabel. */
export function blockLabel(color: string): React.CSSProperties {
  return {
    margin: "0 0 16px",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    fontWeight: 700,
    color,
  };
}

// --- Stack matrix (Capa · Elección · Por qué) -------------------------------
export const STACK_TABLE_STYLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13.5px",
};
export const STACK_TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "var(--color-text3)",
  fontWeight: 700,
  padding: "0 14px 8px 0",
  borderBottom: "1px solid var(--color-border)",
};
export const STACK_TD_STYLE: React.CSSProperties = {
  padding: "9px 14px 9px 0",
  borderBottom: "1px solid var(--color-border)",
  color: "var(--color-text2)",
  lineHeight: 1.45,
  verticalAlign: "top",
};
export const STACK_CAPA_STYLE: React.CSSProperties = {
  ...STACK_TD_STYLE,
  color: "var(--color-text3)",
  whiteSpace: "nowrap",
};
export const STACK_PICK_STYLE: React.CSSProperties = {
  ...STACK_TD_STYLE,
  color: "var(--color-text)",
  fontWeight: 600,
};

// --- Data model -------------------------------------------------------------
/** "Sin BD" callout (calm, ok-toned) — the conditional content-as-code branch. */
export const NODB_CALLOUT_STYLE: React.CSSProperties = {
  margin: "0 0 14px",
  padding: "11px 14px",
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  background: "color-mix(in oklab, var(--color-ok-bg) 40%, var(--color-card))",
  borderLeft: "3px solid var(--color-ok)",
  borderRadius: "10px",
  fontSize: "14px",
  lineHeight: 1.5,
  color: "var(--color-text)",
};
export const NODB_ICON_STYLE: React.CSSProperties = {
  fontSize: "16px",
  color: "var(--color-ok)",
  flexShrink: 0,
  marginTop: "1px",
};
/** The lead prose when there IS a database (no callout). */
export const DATA_NOTE_STYLE: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: "14px",
  lineHeight: 1.5,
  color: "var(--color-text2)",
};
export const ENTITY_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "10px",
};
export const ENTITY_CARD_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "11px 14px",
};
export const ENTITY_NAME_STYLE: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "12.5px",
  fontWeight: 700,
  color: "var(--color-ok)",
  marginBottom: "3px",
};
export const ENTITY_DESC_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "12.5px",
  lineHeight: 1.45,
  color: "var(--color-text2)",
};

// --- Two-up row (Comunicación & servicios | Variables de entorno) -----------
export const TWO_UP_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "22px",
  padding: "24px 0",
  borderBottom: "1px solid var(--color-border)",
};
export const SUBHEAD_STYLE: React.CSSProperties = {
  margin: "0 0 12px",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--color-text2)",
};

// --- Env vars ---------------------------------------------------------------
export const ENV_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
export const ENV_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};
export const ENV_NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--color-accent-text)",
  wordBreak: "break-all",
};
export const ENV_COMMENT_STYLE: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.4,
  color: "var(--color-text3)",
};
export const EMPTY_NOTE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "var(--color-text3)",
};

// --- ADR rows (clickable → modal) -------------------------------------------
export const ADR_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "24px 0",
  borderBottom: "1px solid var(--color-border)",
};
export const ADR_ROW_STYLE: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  font: "inherit",
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  background: "var(--color-panel)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "12px 14px",
  cursor: "pointer",
  transition: "border-color 0.15s ease, background 0.15s ease",
};
export const ADR_ID_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "7px",
  background: "var(--color-info-bg)",
  color: "var(--color-info)",
  flexShrink: 0,
};
export const ADR_TEXT_WRAP_STYLE: React.CSSProperties = { minWidth: 0 };
export const ADR_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "13.5px",
  fontWeight: 700,
  color: "var(--color-text)",
  lineHeight: 1.3,
};
export const ADR_DECISION_STYLE: React.CSSProperties = {
  margin: "3px 0 0",
  fontSize: "12.5px",
  lineHeight: 1.45,
  color: "var(--color-text2)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

// --- Implementation plan (DAG) — the centerpiece ----------------------------
export const PLAN_BLOCK_STYLE: React.CSSProperties = {
  padding: "26px 0",
  borderBottom: "1px solid var(--color-border)",
};
export const PLAN_HEAD_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "10px",
  marginBottom: "6px",
};
export const PLAN_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
  letterSpacing: "-0.2px",
  color: "var(--color-text)",
};
export const PLAN_SUB_STYLE: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: "13px",
  lineHeight: 1.5,
  color: "var(--color-text2)",
  maxWidth: "640px",
};

// --- FRD work-orders list (inside the modal) --------------------------------
export const FRD_MODAL_BP_STYLE: React.CSSProperties = {
  margin: 0,
  padding: "11px 14px",
  background: "color-mix(in oklab, var(--color-accent-bg) 32%, var(--color-card))",
  borderLeft: "3px solid var(--color-accent)",
  borderRadius: "10px",
  fontSize: "14px",
  lineHeight: 1.5,
  color: "var(--color-text)",
};
export const FRD_MODAL_WO_LABEL_STYLE: React.CSSProperties = {
  margin: "16px 0 9px",
  display: "flex",
  alignItems: "center",
  gap: "7px",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--color-info)",
};
export const WO_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "baseline",
  padding: "8px 0",
  borderBottom: "1px dashed var(--color-border)",
  fontSize: "13px",
  lineHeight: 1.45,
};
export const WO_ID_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--color-accent-text)",
  flexShrink: 0,
};
export const WO_DESC_STYLE: React.CSSProperties = { color: "var(--color-text2)" };
/** WO count pill on the FRD card. */
export const WO_COUNT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "10px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  padding: "2px 7px",
  borderRadius: "6px",
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-text3)",
  marginLeft: "auto",
  flexShrink: 0,
};
