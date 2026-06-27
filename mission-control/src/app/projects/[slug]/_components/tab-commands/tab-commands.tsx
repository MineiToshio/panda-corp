/**
 * WO-11-002 — TabCommands (CMP-04-tab-commands) + CommandsBox
 *
 * Server Component: Commands tab for the project workspace.
 * Mirrors prototype `projComandos()` = `buildModePanel()` + `commandsBox()`.
 *
 * Visual structure (prototype projComandos / commandsBox ~L808):
 *   <BuildModeSelector slug={slug} />    ← WO-11-002 (CMP-11-mode-selector)
 *   Panel "Comandos a la mano"           ← commandsBox()
 *     CmdRow × N (stage-relevant rows from workspaceCommands)
 *
 * Reuses shared primitives (DR-057):
 *   Panel  → data-testid="panel" (commandsBox wrapper)
 *   CmdRow → data-testid="cmd-row" (each command row)
 *
 * No "use client" — Server Component. CmdRow's CopyButton manages its own
 * client state. ModeSelector (below) is "use client".
 *
 * Traceability:
 *   CMP-04-tab-commands → REQ-04-005
 *   AC-04-005.1 — stage command rows with copy button + description
 *   AC-04-005.2 — FRD-11 mode selector slot
 *   IF-04-next-step (lib/next-step.ts, docs/api.md WO-04-003)
 *   DR-057 — Panel + CmdRow reused; no bespoke forks
 *   DR-056 — matches commandsBox() + projComandos() prototype structure
 */

import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Panel } from "@/components/core/Panel/Panel";
import { workspaceCommands } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";
import { ModeSelector } from "../mode-selector/mode-selector";

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
   * per-project build-mode memory (FRD-11).
   */
  slug: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const COMMANDS_BOX_HEADING_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  margin: "0 0 2px",
  color: "var(--color-text2)",
};

const COMMANDS_ROWS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginTop: "6px",
};

// ---------------------------------------------------------------------------
// CommandsBox — "Comandos a la mano" section (mirrors prototype commandsBox())
// ---------------------------------------------------------------------------

/**
 * CommandsBox — the stage-relevant commands panel.
 *
 * Prototype: `commandsBox(i)` ~L808
 *   '<div class="panel" style="margin-top:14px">
 *     <p ...>Comandos a la mano</p>
 *     [cmdRow items]
 *   </div>'
 *
 * Each row uses the shared CmdRow primitive (DR-057).
 * The description ("when to use") is preserved in data-testid="command-row-description"
 * alongside the CmdRow for backward compatibility with existing tests.
 */
function CommandsBox({ phase }: { phase: Phase }): React.JSX.Element {
  const rows = workspaceCommands(phase);

  return (
    <Panel>
      <p style={COMMANDS_BOX_HEADING_STYLE} data-testid="tab-commands-heading">
        Comandos a la mano
      </p>

      <ul
        data-testid="commands-list"
        aria-label="Lista de comandos disponibles para esta fase"
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {rows.map((row) => (
          <li key={row.command} data-testid="command-row" style={COMMANDS_ROWS_STYLE}>
            {/* Shared CmdRow primitive (DR-057, AC-04-005.1) */}
            <CmdRow command={row.command} />

            {/* "When to use" description below the command row (AC-04-005.1) */}
            <p
              data-testid="command-row-description"
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text2)",
                opacity: 0.8,
                lineHeight: 1.5,
                margin: 0,
                paddingLeft: "2px",
              }}
            >
              {row.when}
            </p>

            {/* Preserve the command-row-command testid for backward compatibility */}
            <span data-testid="command-row-command" style={{ display: "none" }} aria-hidden="true">
              {row.command}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// TabCommands — main export (CMP-04-tab-commands)
// ---------------------------------------------------------------------------

/**
 * Commands tab — build mode selector (FRD-11) + stage-relevant command rows.
 *
 * Mirrors prototype `projComandos(i)` = `buildModePanel(i)` + `commandsBox(i)`.
 *
 * Server Component (no "use client"). All data derived from workspaceCommands(phase)
 * (pure, no I/O). ModeSelector is a "use client" child that manages mode selection.
 */
export function TabCommands({ phase, slug }: TabCommandsProps): React.JSX.Element {
  return (
    <main data-testid="tab-commands-body" aria-label="Comandos del proyecto" style={ROOT_STYLE}>
      {/* AC-04-005.2 — FRD-11 mode selector (CMP-11-mode-selector, WO-11-002)
          Mirrors prototype buildModePanel() */}
      <ModeSelector slug={slug} phase={phase} />

      {/* AC-04-005.1 — stage-relevant command rows (mirrors prototype commandsBox()) */}
      <CommandsBox phase={phase} />
    </main>
  );
}
