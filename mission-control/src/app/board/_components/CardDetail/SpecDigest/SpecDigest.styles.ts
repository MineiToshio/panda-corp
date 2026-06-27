/**
 * Styles for SpecDigest — the native "Spec" tab (high-level Spanish summary of the
 * PRD, the research and the FRDs). Token-based colours only (Atelier), mirroring the
 * IdeaPitch visual language: a full-bleed hero + tinted blocks, with spec-specific
 * primitives (chips, stat cards, role cards, a decisions box and FRD cards).
 */

// --- Layout (full-width bands, centred content) -----------------------------
export const CONTAINER_STYLE: React.CSSProperties = { width: "100%" };
export const INNER_STYLE: React.CSSProperties = { maxWidth: "920px", margin: "0 auto" };

// --- Hero -------------------------------------------------------------------
export const HERO_STYLE: React.CSSProperties = {
  marginInline: "calc(50% - 50vw)",
  paddingTop: "8px",
  paddingBottom: "24px",
  paddingInline: "calc(50vw - 50%)",
  borderBottom: "1px solid var(--color-border)",
};
export const EYEBROW_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "12px",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--color-accent-text)",
};
export const TITLE_STYLE: React.CSSProperties = {
  margin: "12px 0 8px",
  fontSize: "32px",
  lineHeight: 1.12,
  fontWeight: 800,
  letterSpacing: "-0.4px",
  color: "var(--color-text)",
};
export const INTRO_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  maxWidth: "720px",
  color: "var(--color-text2)",
};
export const PHASE_CHIP_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "12px",
  padding: "5px 12px",
  borderRadius: "999px",
  border: "1px solid var(--color-border)",
  background: "var(--color-info-bg)",
  color: "var(--color-info)",
};
// The hero chip row: phase + the "qué es" meta chips (app type · platform), wrapping on small widths.
export const HERO_CHIPS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "16px",
  alignItems: "center",
};
// A neutral "qué es" chip (app type / platform) — distinct from the info-toned phase chip.
export const META_CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "12px",
  padding: "5px 12px",
  borderRadius: "999px",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  color: "var(--color-text)",
};
export const META_ICON_STYLE: React.CSSProperties = { fontSize: "13px", lineHeight: 1 };

// --- Blocks (full-bleed tinted bands) ---------------------------------------
const PRD_TINT = "color-mix(in oklab, var(--color-info-bg) 36%, var(--color-base))";
const RESEARCH_TINT = "color-mix(in oklab, var(--color-accent-bg) 30%, var(--color-base))";
const BLEED = {
  marginInline: "calc(50% - 50vw)",
  paddingTop: "24px",
  paddingBottom: "24px",
  paddingInline: "calc(50vw - 50%)",
  borderBottom: "1px solid var(--color-border)",
} as const;
export const BLOCK_PRD_STYLE: React.CSSProperties = { ...BLEED, background: PRD_TINT };
export const BLOCK_RESEARCH_STYLE: React.CSSProperties = { ...BLEED, background: RESEARCH_TINT };
export const BLOCK_FRD_STYLE: React.CSSProperties = { padding: "26px 0 8px" };

function blabel(color: string): React.CSSProperties {
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
export const BLABEL_PRD_STYLE = blabel("var(--color-info)");
export const BLABEL_RESEARCH_STYLE = blabel("var(--color-accent-text)");
export const BLABEL_FRD_STYLE = blabel("var(--color-text2)");

// --- Subsection rows (label | content) --------------------------------------
export const ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "150px 1fr",
  gap: "18px",
  padding: "13px 0",
  fontSize: "15px",
  alignItems: "start",
};
export const ROW_KEY_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "var(--color-text3)",
  paddingTop: "3px",
  lineHeight: 1.4,
};

// --- Chips (alcance / fuera del v1) ------------------------------------------
export const CHIPS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};
export const CHIP_STYLE: React.CSSProperties = {
  fontSize: "13px",
  padding: "6px 12px",
  borderRadius: "999px",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  color: "var(--color-text)",
};
// Muted (out-of-scope) chips — dashed + dimmed to read as "not in v1", WITHOUT a strike-through
// (the strike hurt legibility; the dashed border + muted colour already signal "excluded").
export const CHIP_MUTED_STYLE: React.CSSProperties = {
  fontSize: "13px",
  padding: "6px 12px",
  borderRadius: "999px",
  border: "1px dashed var(--color-border)",
  background: "transparent",
  color: "var(--color-text3)",
};

// --- Highlight callout (hipótesis / la apuesta) — one short, scannable statement ----
export const HIGHLIGHT_STYLE: React.CSSProperties = {
  margin: 0,
  padding: "13px 16px",
  background: "color-mix(in oklab, var(--color-info-bg) 45%, var(--color-card))",
  borderLeft: "3px solid var(--color-info)",
  borderRadius: "12px",
  fontSize: "15px",
  lineHeight: 1.5,
  color: "var(--color-text)",
};

// --- Bullet list (el problema) — clean vertical list, scannable, no paragraph wall ----
export const BULLET_LIST_STYLE: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};
export const BULLET_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  fontSize: "14px",
  lineHeight: 1.5,
  color: "var(--color-text2)",
};
export const BULLET_DOT_STYLE: React.CSSProperties = {
  flexShrink: 0,
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  marginTop: "8px",
  background: "var(--color-info)",
};
export const BULLET_STRONG_STYLE: React.CSSProperties = {
  fontWeight: 700,
  color: "var(--color-text)",
};

// --- Scope checklist (alcance v1) — a roomy vertical checklist, NOT cramped pills ----
export const SCOPE_LIST_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "7px 18px",
};
export const SCOPE_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "9px",
  alignItems: "flex-start",
  fontSize: "13.5px",
  lineHeight: 1.4,
  color: "var(--color-text2)",
};
export const SCOPE_CHECK_STYLE: React.CSSProperties = {
  flexShrink: 0,
  marginTop: "1px",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--color-ok)",
};
export const SCOPE_STRONG_STYLE: React.CSSProperties = {
  fontWeight: 700,
  color: "var(--color-text)",
};

// --- Role cards (usuarios) --------------------------------------------------
export const CARDS_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "10px",
};
export const ROLE_CARD_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "12px 14px",
};
export const ROLE_TITLE_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 700,
  color: "var(--color-info)",
  marginBottom: "4px",
};
export const ROLE_DESC_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  lineHeight: 1.45,
  color: "var(--color-text2)",
};

// --- Stat cards (métricas) --------------------------------------------------
export const STATS_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px",
};
export const STAT_CARD_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};
export const STAT_TITLE_STYLE: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--color-ok)",
  lineHeight: 1.2,
};
export const STAT_DESC_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "12.5px",
  color: "var(--color-text2)",
};

// --- Reference cards (referentes) -------------------------------------------
export const REF_CARD_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "10px",
  padding: "10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};
export const REF_TITLE_STYLE: React.CSSProperties = {
  fontSize: "13.5px",
  fontWeight: 700,
  color: "var(--color-accent-text)",
};
export const REF_DESC_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "12.5px",
  color: "var(--color-text2)",
};

// --- Decisions box (decisiones abiertas) — a calm callout, not a loud alert -----
export const DECISIONS_BOX_STYLE: React.CSSProperties = {
  background: "color-mix(in oklab, var(--color-warn-bg) 20%, var(--color-card))",
  border: "1px solid var(--color-border-strong)",
  borderLeft: "3px solid var(--color-warn)",
  borderRadius: "12px",
  padding: "2px 16px",
};
export const DECISION_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "11px",
  alignItems: "flex-start",
  padding: "11px 0",
  fontSize: "14px",
  borderBottom: "1px dashed var(--color-border)",
};
// The marker is a small rounded badge so each item reads as a structured row.
export const DECISION_MARK_STYLE: React.CSSProperties = {
  flexShrink: 0,
  marginTop: "1px",
  width: "18px",
  height: "18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "6px",
  background: "var(--color-warn-bg)",
  color: "var(--color-warn)",
  fontSize: "9px",
};
export const DECISION_TITLE_STYLE: React.CSSProperties = {
  fontWeight: 700,
  color: "var(--color-text)",
};
export const DECISION_DESC_STYLE: React.CSSProperties = { color: "var(--color-text2)" };

// --- FRD cards (compact, uniform, static — no expand) -----------------------
export const FRD_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))",
  gap: "12px",
  alignItems: "stretch",
};
// The card is a <button> (clickable → opens the FRD detail modal); these are its resets +
// the hover/focus affordance lives in globals.css `.spec-frd-card`.
export const FRD_CARD_STYLE: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  font: "inherit",
  background: "var(--color-panel)",
  border: "1px solid var(--color-border)",
  borderRadius: "14px",
  padding: "13px 15px",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  cursor: "pointer",
  transition: "border-color 0.15s ease, background 0.15s ease",
};
/** Top row: id badge on the left, tag pushed to the right. */
export const FRD_HEAD_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};
export const FRD_ID_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "7px",
  background: "var(--color-accent-bg)",
  color: "var(--color-accent-text)",
  flexShrink: 0,
};
export const FRD_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1.25,
  color: "var(--color-text)",
};
const TAG_UI = "var(--color-ok)";
const TAG_OTHER = "var(--color-text3)";
export function frdTagStyle(tag: string): React.CSSProperties {
  const isUi = /ui/i.test(tag);
  return {
    marginLeft: "auto",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "10px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    padding: "2px 7px",
    borderRadius: "6px",
    border: "1px solid var(--color-border)",
    background: "var(--color-card)",
    color: isUi ? TAG_UI : TAG_OTHER,
    flexShrink: 0,
  };
}
export const FRD_SUMMARY_TEXT_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "12.5px",
  lineHeight: 1.45,
  color: "var(--color-text2)",
};
// "Ver detalle →" affordance at the foot of each card (also signals it's clickable).
export const FRD_MORE_STYLE: React.CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "11px",
  color: "var(--color-accent-text)",
};

// --- FRD detail modal (reuses the core Modal; colour-coded like the Spec page) ---
// Per-section accent colours so titles ≠ content and the modal reads with colour, not flat.
export const MODAL_INFO = "var(--color-info)";
export const MODAL_ACCENT = "var(--color-accent-text)";
export const MODAL_OK = "var(--color-ok)";
export const MODAL_SCOPE = "var(--color-danger)"; // "Fuera de alcance" — distinct from body text
export const MODAL_WARN = "var(--color-warn)";

// The summary as a tinted callout (accent) — the modal opens with colour, not a flat line.
export const FRD_MODAL_LEAD_STYLE: React.CSSProperties = {
  margin: 0,
  padding: "11px 14px",
  background: "color-mix(in oklab, var(--color-accent-bg) 32%, var(--color-card))",
  borderLeft: "3px solid var(--color-accent)",
  borderRadius: "10px",
  fontSize: "14.5px",
  lineHeight: 1.5,
  color: "var(--color-text)",
};
export const FRD_MODAL_SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};
/** Section label, coloured per section (so the title stands apart from its content). */
export function modalLabelStyle(color: string): React.CSSProperties {
  return {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    fontSize: "11px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontWeight: 700,
    color,
  };
}
/** A small coloured square before the label, for extra visual weight. */
export function modalLabelTick(color: string): React.CSSProperties {
  return { width: "8px", height: "8px", borderRadius: "2px", background: color, flexShrink: 0 };
}
export const FRD_MODAL_PROSE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "13.5px",
  lineHeight: 1.5,
  color: "var(--color-text2)",
};
// The list draws its OWN dot (the global `ul` reset removes native markers — that's why
// bullets weren't showing); a per-section colour gives each list its accent.
export const FRD_MODAL_LIST_STYLE: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};
export const FRD_MODAL_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
};
// Bullet dot — NEUTRAL on purpose (coloured dots distracted; the section colour lives in the label).
export const FRD_MODAL_DOT_STYLE: React.CSSProperties = {
  width: "5px",
  height: "5px",
  borderRadius: "50%",
  background: "var(--color-text3)",
  marginTop: "7px",
  flexShrink: 0,
};
export const FRD_MODAL_LI_TEXT_STYLE: React.CSSProperties = {
  fontSize: "13.5px",
  lineHeight: 1.45,
  color: "var(--color-text2)",
};
