/**
 * WO-06-006 — FraguaScene style constants (CSS custom properties only).
 *
 * Extracted to keep FraguaScene.tsx within the 500-line clean-code limit.
 * All values use CSS custom properties (zero hardcoded colors/spacing/radii).
 */

// ---------------------------------------------------------------------------
// Scene container
// ---------------------------------------------------------------------------

export const SCENE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, Canvas)",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  minWidth: "320px",
};

// ---------------------------------------------------------------------------
// Header block
// ---------------------------------------------------------------------------

export const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
};

export const FRD_TRACKER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 0.5)",
};

export const FRD_ID_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
};

export const FRD_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

export const COUNTER_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-muted, currentColor)",
};

export const MODE_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 500,
  color: "var(--color-text-muted, currentColor)",
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const ROOMS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

export const ROOM_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

export const ROOM_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted, currentColor)",
  marginBottom: "calc(var(--spacing, 0.25rem) * 1)",
};

// ---------------------------------------------------------------------------
// Forge sprites
// ---------------------------------------------------------------------------

export const FORGE_SPRITES_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  alignItems: "flex-start",
};

export const WO_SPRITE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-agent-implementer-bg, var(--color-card))",
  color: "var(--color-agent-implementer, var(--color-text))",
  border: "var(--hairline, 1px) solid var(--color-agent-implementer, var(--color-border))",
  cursor: "default",
};

export const HALO_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: "calc(var(--spacing, 0.25rem) * 1.5)",
  height: "calc(var(--spacing, 0.25rem) * 1.5)",
  borderRadius: "9999px",
  background: "var(--color-agent-implementer, currentColor)",
  flexShrink: 0,
};

export const QUEUED_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--color-text-muted, currentColor)",
  fontStyle: "italic",
};

export const QUEUE_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "0.6875rem",
  fontWeight: 700,
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  color: "var(--color-text-muted, currentColor)",
  fontStyle: "italic",
};

// ---------------------------------------------------------------------------
// Reviewer gate
// ---------------------------------------------------------------------------

const REVIEWER_STYLE_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-agent-reviewer, var(--color-border))",
};

export const REVIEWER_DIMMED_STYLE: React.CSSProperties = {
  ...REVIEWER_STYLE_BASE,
  opacity: 0.4,
  color: "var(--color-agent-reviewer, var(--color-text-muted))",
};

export const REVIEWER_ACTIVE_STYLE: React.CSSProperties = {
  ...REVIEWER_STYLE_BASE,
  opacity: 1,
  color: "var(--color-agent-reviewer, var(--color-text))",
};

export const LENS_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  padding: "0 calc(var(--spacing, 0.25rem) * 0.5)",
};

// ---------------------------------------------------------------------------
// Bóveda / trophy shelf
// ---------------------------------------------------------------------------

export const TROPHY_SHELF_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  flexWrap: "wrap",
  alignItems: "center",
};

export const TROPHY_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, currentColor)",
};

export const ARCHIVED_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 1.5)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  color: "var(--color-text-muted, currentColor)",
};

// ---------------------------------------------------------------------------
// Parchment
// ---------------------------------------------------------------------------

export const PARCHMENT_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.6875rem",
  color: "var(--color-text-muted, currentColor)",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 1)",
  borderRadius: "var(--radius, 0.25rem)",
  // Hidden when inactive (no parchment in flight)
  visibility: "hidden" as const,
  height: 0,
  overflow: "hidden" as const,
};
