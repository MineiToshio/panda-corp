/** Full-width idea tab frame. The host owns the page heading. */
export const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 0,
  minWidth: 0,
};
/** Internal section heading stays available without duplicating the host's visible title. */
export const TITLE_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
};
/** Tab bodies fill the available host width. */
export const PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--s4)",
  minWidth: 0,
};
/** Inactive tab bodies have no focusable or announced content. */
export const PANEL_HIDDEN_STYLE: React.CSSProperties = { display: "none" };
