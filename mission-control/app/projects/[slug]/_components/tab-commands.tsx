/**
 * WO-04-007 — TabCommands (CMP-04-tab-commands)
 *
 * Server Component: Commands tab for the project workspace.
 *   - Renders stage-relevant command rows from workspaceCommands(phase)
 *     (IF-04-next-step, lib/next-step.ts), each with a CopyButton and a
 *     "when to use" description (AC-04-005.1).
 *   - Mounts the FRD-11 build mode selector (CMP-11-mode-selector) at the top
 *     of the tab (AC-04-005.2). Until FRD-11 WO-11-002 lands, a labelled
 *     placeholder slot is rendered so the tab is shippable in isolation.
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on command rows and slot.
 *   - Spanish aria-labels and copy.
 *   - Server Component (no "use client") — CopyButton is its own "use client".
 *
 * Traceability:
 *   CMP-04-tab-commands → REQ-04-005
 *   AC-04-005.1 — stage command rows with copy button + description
 *   AC-04-005.2 — FRD-11 mode selector slot
 *   IF-04-next-step (lib/next-step.ts, docs/api.md WO-04-003)
 */

import { CopyButton } from "@/components/CopyButton";
import type { CommandRow } from "@/lib/next-step";
import { workspaceCommands } from "@/lib/next-step";
import type { Phase } from "@/lib/status";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TabCommandsProps {
  /**
   * The project's current phase from `.pandacorp/status.yaml`.
   * Drives which command rows are shown (IF-04-next-step).
   */
  phase: Phase;
  /**
   * The project slug — passed through to CMP-11-mode-selector for
   * per-project build-mode memory (FRD-11). Not used by the placeholder.
   */
  slug: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 6)",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 8)",
  maxWidth: "72ch",
  color: "var(--color-text, currentColor)",
};

const SECTION_STYLE: React.CSSProperties = {
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  padding: "calc(var(--spacing, 0.25rem) * 5) calc(var(--spacing, 0.25rem) * 6)",
  boxShadow: "var(--shadow-panel, none)",
};

const SECTION_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  marginBottom: "calc(var(--spacing, 0.25rem) * 3)",
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  margin: 0,
};

const COMMANDS_LIST_STYLE: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: "calc(var(--spacing, 0.25rem) * 3) 0",
  borderTop: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const COMMAND_ROW_TOP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const COMMAND_TEXT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  flexGrow: 1,
  wordBreak: "break-all",
};

const COMMAND_DESCRIPTION_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
  lineHeight: 1.5,
  margin: 0,
};

const PLACEHOLDER_SLOT_STYLE: React.CSSProperties = {
  ...SECTION_STYLE,
  border: "var(--hairline, 1px) dashed var(--color-border, currentColor)",
  opacity: 0.7,
};

const PLACEHOLDER_HEADING_STYLE: React.CSSProperties = {
  ...SECTION_TITLE_STYLE,
  marginBottom: "calc(var(--spacing, 0.25rem) * 2)",
};

const PLACEHOLDER_BODY_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  fontStyle: "italic",
  margin: 0,
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * A single command row: command text + copy button + description.
 * (CMP-04-tab-commands / AC-04-005.1)
 */
function CommandRowItem({ row }: { row: CommandRow }): React.JSX.Element {
  return (
    <li data-testid="command-row" style={COMMAND_ROW_STYLE}>
      <div style={COMMAND_ROW_TOP_STYLE}>
        <code data-testid="command-row-command" style={COMMAND_TEXT_STYLE}>
          {row.command}
        </code>
        <CopyButton value={row.command} />
      </div>
      <p data-testid="command-row-description" style={COMMAND_DESCRIPTION_STYLE}>
        {row.when}
      </p>
    </li>
  );
}

/**
 * FRD-11 mode selector slot (CMP-11-mode-selector placeholder).
 *
 * Until WO-11-002 ships, renders a labelled placeholder that:
 *   - Has data-testid="mode-selector-slot" (required by AC-04-005.2 tests).
 *   - Contains visible text (accessible name).
 *   - Is rendered at the top of the tab.
 *
 * When CMP-11-mode-selector is available, replace this with:
 *   <ModeSelector slug={slug} />
 * No other changes to TabCommands are needed (the slot is the seam).
 *
 * @param slug - The project slug passed through to the real selector when available.
 */
function ModeSelectorSlot({
  // slug is intentionally accepted but unused in the placeholder — it is the
  // integration seam for CMP-11-mode-selector (FRD-11/WO-11-002). Replace
  // this function body with <ModeSelector slug={slug} /> when FRD-11 lands.
  slug: _slug,
}: {
  slug: string;
}): React.JSX.Element {
  return (
    <section
      data-testid="mode-selector-slot"
      aria-label="Selector de modo de construcción (próximamente)"
      style={PLACEHOLDER_SLOT_STYLE}
    >
      <h3 style={PLACEHOLDER_HEADING_STYLE}>Modo de construcción</h3>
      <p style={PLACEHOLDER_BODY_STYLE}>
        El selector de modo (Pro / Balanceado / Potente / Profundo) estará disponible en FRD-11. Por
        ahora usa el modo configurado en tu sesión de Claude.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TabCommands — main export (CMP-04-tab-commands)
// ---------------------------------------------------------------------------

/**
 * Commands tab — build mode selector slot + stage-relevant command rows.
 *
 * Server Component (no "use client"). All data is derived from:
 *   workspaceCommands(phase) → CommandRow[] (pure, no I/O)
 * and passed as inline computation. CopyButton manages its own client state.
 */
export function TabCommands({ phase, slug }: TabCommandsProps): React.JSX.Element {
  const rows = workspaceCommands(phase);

  return (
    <main data-testid="tab-commands-body" aria-label="Comandos del proyecto" style={ROOT_STYLE}>
      {/* AC-04-005.2 — FRD-11 mode selector slot (top of tab) */}
      <ModeSelectorSlot slug={slug} />

      {/* AC-04-005.1 — stage-relevant command rows */}
      <section aria-label="Comandos disponibles" style={SECTION_STYLE}>
        <div style={SECTION_HEADER_STYLE}>
          <h2 data-testid="tab-commands-heading" style={SECTION_TITLE_STYLE}>
            Comandos
          </h2>
        </div>

        <ul
          data-testid="commands-list"
          aria-label="Lista de comandos disponibles para esta fase"
          style={COMMANDS_LIST_STYLE}
        >
          {rows.map((row) => (
            <CommandRowItem key={row.command} row={row} />
          ))}
        </ul>
      </section>
    </main>
  );
}
