/**
 * BoardLegend — compact one-line legend for categories, return types and score
 * (CMP-02-legend). Faithful to the prototype `boardView()` footer (index.html ~L805):
 * a single small `<p>` (text3, bold labels), NOT a heavy multi-section panel.
 *
 * Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-02-legend → AC-02-008.3, REQ-02-008 — category / return / score explained.
 *
 * Contract:
 *   - data-testid="board-legend" on the root (accessible landmark with aria-label).
 *
 * Design rules: zero hardcoded colors (CSS custom properties); Spanish copy.
 */

const ROOT_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text2, currentColor))",
  margin: "12px 2px 0",
  lineHeight: 1.6,
};

const LABEL_STYLE: React.CSSProperties = { fontWeight: 500, color: "var(--color-text2)" };

/**
 * BoardLegend — static, accessible one-line legend for the ideas board.
 */
export function BoardLegend(): React.JSX.Element {
  return (
    <section data-testid="board-legend" aria-label="Leyenda del tablero">
      <p style={ROOT_STYLE}>
        <span style={LABEL_STYLE}>Categoría:</span> web / mobile / desktop / IA / claude-code /
        prompts / automatización / CLI / rework. <span style={LABEL_STYLE}>Retorno:</span> monetario
        / oportunidad / personal / mixto. <span style={LABEL_STYLE}>Score</span> 0-100.{" "}
        <i
          className="ti ti-player-play"
          aria-hidden="true"
          style={{ fontSize: "12px", color: "var(--color-ok)", verticalAlign: "-1px" }}
        />{" "}
        = construyéndose ahora.
      </p>
    </section>
  );
}
