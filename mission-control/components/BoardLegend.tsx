/**
 * BoardLegend — static legend for categories, return types and score (CMP-02-legend).
 *
 * Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-02-legend → components/BoardLegend.tsx
 *   AC-02-008.3 — Category, return and score are shown with a legend explaining them.
 *   REQ-02-008  — legend explaining category / return / score.
 *   FRD-02 edge case: "Category (web/mobile/desktop/AI/…), return
 *     (monetary/opportunity/personal/mixed) and score are shown with a legend
 *     explaining them."
 *
 * Contract (docs/api.md WO-02-008):
 *   - data-testid="board-legend" on the root element (<section> or <aside>).
 *   - data-testid="board-legend-category-section" — section for project_type entries.
 *   - data-testid="board-legend-return-section" — section for return_type entries.
 *   - data-testid="board-legend-score-section" — section explaining the score field.
 *   - data-testid="board-legend-category-entry" (one per known category).
 *   - data-testid="board-legend-return-entry" (one per return type).
 *   - Root has aria-label (accessible landmark).
 *   - Static: no props required (all data is i18n-static).
 *
 * Design rules:
 *   - Zero hardcoded colors — all visual values via CSS custom properties.
 *   - Spanish user-facing copy (AGENTS.md: single operator, Spanish UI).
 *   - Accessible: <section> landmark + aria-label on root.
 */

// ---------------------------------------------------------------------------
// Static i18n data — single source of truth for categories and return types.
// ---------------------------------------------------------------------------

/** Known project_type values from FRD-02 with Spanish explanations. */
const CATEGORY_ENTRIES: ReadonlyArray<{ key: string; label: string; description: string }> = [
  { key: "web", label: "web", description: "Aplicación o sitio web." },
  { key: "mobile", label: "mobile", description: "Aplicación móvil (iOS/Android)." },
  { key: "desktop", label: "desktop", description: "Aplicación de escritorio nativa." },
  { key: "ai", label: "ai", description: "Producto centrado en inteligencia artificial." },
  { key: "claude-code", label: "claude-code", description: "Skill o agente para Claude Code." },
  {
    key: "prompt-system",
    label: "prompt-system",
    description: "Sistema de prompts estructurados.",
  },
  { key: "automation", label: "automation", description: "Automatización de flujos o procesos." },
  { key: "cli", label: "cli", description: "Herramienta de línea de comandos." },
  {
    key: "rework",
    label: "rework",
    description: "Mejora o rediseño de un proyecto existente.",
  },
];

/** Known return_type values from FRD-02 with Spanish explanations. */
const RETURN_ENTRIES: ReadonlyArray<{ key: string; label: string; description: string }> = [
  { key: "monetary", label: "monetary", description: "Genera ingresos directos (ventas, SaaS…)." },
  {
    key: "opportunity",
    label: "opportunity",
    description: "Abre puertas a oportunidades futuras.",
  },
  {
    key: "personal",
    label: "personal",
    description: "Valor personal: aprendizaje o satisfacción.",
  },
  {
    key: "mixed",
    label: "mixed",
    description: "Combina retorno monetario, de oportunidad y/o personal.",
  },
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only.
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.75)",
  padding: "calc(var(--space-base, 1rem) * 0.75)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
};

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.6875rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

const ENTRY_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  alignItems: "baseline",
};

const ENTRY_KEY_STYLE: React.CSSProperties = {
  fontWeight: 600,
  minWidth: "6rem",
  flexShrink: 0,
  color: "var(--color-accent, currentColor)",
};

const ENTRY_DESC_STYLE: React.CSSProperties = {
  color: "var(--color-text-muted, var(--color-text, currentColor))",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BoardLegend — static, accessible legend for the ideas board.
 * No props; all data is statically defined in the module (i18n).
 */
export function BoardLegend(): React.JSX.Element {
  return (
    <section data-testid="board-legend" style={ROOT_STYLE} aria-label="Leyenda del tablero">
      {/* ------------------------------------------------------------------ */}
      {/* Category section (project_type)                                     */}
      {/* ------------------------------------------------------------------ */}
      <div data-testid="board-legend-category-section" style={SECTION_STYLE}>
        <p style={SECTION_TITLE_STYLE}>Categoría</p>
        {CATEGORY_ENTRIES.map((entry) => (
          <div key={entry.key} data-testid="board-legend-category-entry" style={ENTRY_STYLE}>
            <span style={ENTRY_KEY_STYLE}>{entry.label}</span>
            <span style={ENTRY_DESC_STYLE}>{entry.description}</span>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Return type section (return_type)                                   */}
      {/* ------------------------------------------------------------------ */}
      <div data-testid="board-legend-return-section" style={SECTION_STYLE}>
        <p style={SECTION_TITLE_STYLE}>Retorno</p>
        {RETURN_ENTRIES.map((entry) => (
          <div key={entry.key} data-testid="board-legend-return-entry" style={ENTRY_STYLE}>
            <span style={ENTRY_KEY_STYLE}>{entry.label}</span>
            <span style={ENTRY_DESC_STYLE}>{entry.description}</span>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Score section                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div data-testid="board-legend-score-section" style={SECTION_STYLE}>
        <p style={SECTION_TITLE_STYLE}>Puntuación</p>
        <p style={ENTRY_DESC_STYLE}>
          Valor numérico de 0&nbsp;a&nbsp;100 que refleja el atractivo relativo de la idea según el
          perfil del propietario. Combina factores como potencial de retorno, alineación con
          objetivos y esfuerzo estimado. Es orientativo: no sustituye el juicio del propietario.
        </p>
      </div>
    </section>
  );
}
