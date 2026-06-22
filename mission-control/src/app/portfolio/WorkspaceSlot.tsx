/**
 * WorkspaceSlot — right-panel placeholder for the selected project workspace.
 *
 * This component hosts the FRD-04 workspace once it lands. Until FRD-04 is
 * implemented, it renders a placeholder (`data-testid="workspace-slot-placeholder"`)
 * that carries the selected project slug so selection + default-select are
 * testable in isolation now (WO-03-004 design note).
 *
 * Contract:
 *   - data-testid="workspace-slot"       — always present (host element)
 *   - data-slug="<slug>"                 — the selected project name; absent when undefined
 *   - data-testid="workspace-slot-placeholder" — when slug is present (stub for FRD-04)
 *   - data-testid="workspace-slot-empty" — when no project is selected (empty items)
 *
 * Wiring FRD-04: replace the placeholder inner content with the real workspace
 * component; the slot element (`data-testid="workspace-slot"`) and the `data-slug`
 * attribute remain as integration seams.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - Spanish UI copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-03-workspace-slot → REQ-03-004, REQ-03-005
 *   AC-03-004.1, AC-03-005.1
 *   WO-03-004
 */

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// ---------------------------------------------------------------------------

const SLOT_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  minWidth: 0,
  minHeight: 0,
};

const PLACEHOLDER_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  padding: "calc(var(--space-base, 1rem) * 2)",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  textAlign: "center",
};

const EMPTY_STYLE: React.CSSProperties = {
  ...PLACEHOLDER_STYLE,
  opacity: 0.35,
};

const SLUG_STYLE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  fontSize: "0.875rem",
  color: "var(--color-accent, currentColor)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  padding: "0.125rem 0.375rem",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkspaceSlotProps {
  /**
   * The selected project's name (slug). When undefined, no project is selected
   * and the empty state is shown (should not happen after default-select in the page).
   */
  selectedSlug: string | undefined;
  /**
   * The resolved project workspace node (`<ProjectWorkspace>`, FRD-04) for the selected project.
   * When present it is rendered as the slot body (the prototype's projectPane). When absent but a
   * slug is selected, the legacy placeholder is shown (graceful fallback).
   */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkspaceSlot — host for the selected project's workspace (CMP-03-workspace-slot).
 *
 * When FRD-04 lands, replace the placeholder body with the real workspace
 * component; keep this element's `data-testid` and `data-slug` attributes.
 */
export function WorkspaceSlot({ selectedSlug, children }: WorkspaceSlotProps): React.JSX.Element {
  const slotProps: React.HTMLAttributes<HTMLElement> & {
    "data-testid": string;
    "data-slug"?: string;
  } = {
    "data-testid": "workspace-slot",
    style: SLOT_STYLE,
  };
  if (selectedSlug !== undefined) {
    slotProps["data-slug"] = selectedSlug;
  }

  if (selectedSlug === undefined) {
    return (
      <section {...slotProps}>
        <div data-testid="workspace-slot-empty" style={EMPTY_STYLE}>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin proyectos activos.</p>
          <p style={{ margin: 0, fontSize: "0.75rem" }}>
            Usa <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code> para crear uno.
          </p>
        </div>
      </section>
    );
  }

  // FRD-04: render the real project workspace (prototype projectPane) when provided.
  if (children !== undefined && children !== null) {
    return <section {...slotProps}>{children}</section>;
  }

  // Graceful fallback: a project is selected but its workspace could not be resolved.
  return (
    <section {...slotProps}>
      <div data-testid="workspace-slot-placeholder" style={PLACEHOLDER_STYLE}>
        <p style={{ margin: 0, fontSize: "0.75rem" }}>Espacio de trabajo</p>
        <code data-testid="workspace-slot-slug" style={SLUG_STYLE}>
          {selectedSlug}
        </code>
        <p style={{ margin: 0, fontSize: "0.75rem" }}>No se pudo cargar el workspace.</p>
      </div>
    </section>
  );
}
