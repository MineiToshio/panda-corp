"use client";

/**
 * IntakeModal — Intake command overlay (CMP-02-intake-modal).
 *
 * Modal overlay (dark backdrop + blur) with the four `/pandacorp:*` intake
 * commands. Opens when the owner clicks "Capturar ideas / oportunidades" on
 * the board page; the board stays mounted behind the modal (overlay, not
 * replacement).
 *
 * Acceptance criteria (FRD-02):
 *   AC-02-003.1 — WHEN open=true THEN show modal overlay with four intake
 *                 commands — /pandacorp:explore, :new-idea, :discover,
 *                 :recommend — each with icon, title, description and copy row.
 *   AC-02-003.2 — Clicking backdrop OR ✕ button OR pressing Escape SHALL
 *                 call onClose.
 *   AC-02-003.3 — The board SHALL remain visible behind the modal (overlay).
 *
 * Accessibility:
 *   - role="dialog" + aria-modal="true" + aria-label
 *   - Focus placed on modal panel on open
 *   - Escape key fires onClose
 *   - ✕ button is a <button> with Spanish aria-label
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded color values — all via CSS custom properties.
 *   - data-testid on every significant element (test-writer contract).
 *   - Spanish copy (AGENTS.md — single operator, Spanish UI).
 *   - Uses <CopyButton> for each command (CMP-02-copy-button).
 *
 * Traceability:
 *   CMP-02-intake-modal → REQ-02-003
 *   Depends on WO-02-002 (CopyButton)
 */

import { useEffect, useRef } from "react";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";

// ---------------------------------------------------------------------------
// Static data — the four intake commands
// ---------------------------------------------------------------------------

interface CommandDef {
  slug: string;
  command: string;
  icon: string;
  title: string;
  description: string;
}

const INTAKE_COMMANDS: CommandDef[] = [
  {
    slug: "explore",
    command: "/pandacorp:explore",
    icon: "🔭",
    title: "Explorar una idea",
    description:
      "Abre una conversación guiada para clarificar y expandir una idea difusa antes de capturarla.",
  },
  {
    slug: "new-idea",
    command: "/pandacorp:new-idea",
    icon: "💡",
    title: "Capturar idea",
    description:
      "Cristaliza y guarda una idea (de la conversación o de un concepto propio) en la base de ideas.",
  },
  {
    slug: "discover",
    command: "/pandacorp:discover",
    icon: "🌐",
    title: "Descubrir oportunidades",
    description:
      "Busca en internet dolores monetizables y los sugiere como nuevas ideas para la base.",
  },
  {
    slug: "recommend",
    command: "/pandacorp:recommend",
    icon: "⭐",
    title: "Recomendar idea",
    description:
      "Analiza la base de ideas y recomienda la mejor candidata según el perfil del propietario.",
  },
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values.
// ---------------------------------------------------------------------------

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "var(--color-backdrop, color-mix(in oklch, var(--color-canvas, #000) 70%, transparent))",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};

const PANEL_STYLE: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius-lg, 0.75rem)",
  padding: "calc(var(--spacing, 0.25rem) * 6)",
  maxWidth: "min(90vw, 560px)",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "var(--shadow-overlay, 0 8px 40px rgba(0,0,0,0.5))",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  outline: "none",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const HEADING_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "1.125rem",
  fontWeight: 700,
  color: "var(--color-text, currentColor)",
};

const CLOSE_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--color-text-muted, currentColor)",
  fontSize: "1.25rem",
  lineHeight: 1,
  padding: "0.375rem",
  borderRadius: "var(--radius, 0.5rem)",
  minHeight: "44px", // a11y touch target
  minWidth: "44px",
};

const COMMANDS_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background:
    "var(--color-surface-elevated, var(--color-surface, color-mix(in oklch, currentColor 3%, Canvas)))",
};

const COMMAND_ROW_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const COMMAND_ICON_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  lineHeight: 1,
  flexShrink: 0,
};

const COMMAND_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
};

const COMMAND_DESC_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  lineHeight: 1.5,
};

const COMMAND_COPY_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
};

const COMMAND_VALUE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  color: "var(--color-accent, currentColor)",
  opacity: 0.85,
};

// ---------------------------------------------------------------------------
// Focus-trap helper — keeps Tab/Shift+Tab inside the dialog panel (a11y).
// Module-scope so the keydown handler stays small (one responsibility each).
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Wrap focus inside `panel` when Tab/Shift+Tab would otherwise escape it.
 * No-op when the panel has no focusable descendants.
 */
function trapFocus(event: KeyboardEvent, panel: HTMLDivElement): void {
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return;

  if (event.shiftKey) {
    // Shift+Tab: if on first, wrap to last
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  // Tab: if on last (or the panel container itself), wrap to first
  if (document.activeElement === last || document.activeElement === panel) {
    event.preventDefault();
    first.focus();
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IntakeModalProps {
  /** Whether the modal is currently open and visible. */
  open: boolean;
  /** Callback invoked when the user requests to close the modal. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Client overlay component — renders the four intake commands when `open=true`.
 * The component is rendered alongside the board (not replacing it), so toggling
 * `open` never unmounts the board (AC-02-003.3).
 */
export function IntakeModal({ open, onClose }: IntakeModalProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the panel when the modal opens so keyboard users can interact with it.
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  // Escape key dismisses the modal + focus trap (AC-02-003.2 — a11y).
  // aria-modal="true" contracts that focus never leaves the dialog; the trap
  // enforces this by intercepting Tab/Shift+Tab and wrapping focus.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap — keep Tab/Shift+Tab inside the dialog panel.
      if (event.key === "Tab" && panelRef.current) {
        trapFocus(event, panelRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={OVERLAY_STYLE}>
      {/* Backdrop — clickable, separate from panel (clicking the panel must NOT close) */}
      <div
        data-testid="intake-backdrop"
        aria-hidden="true"
        style={BACKDROP_STYLE}
        onClick={onClose}
      />

      {/* Dialog panel — clicking here must NOT propagate to the backdrop.
          onKeyDown is a no-op here because keyboard (Escape) is handled by
          the document-level listener in the useEffect above; the handler is
          required to satisfy the a11y rule (useKeyWithClickEvents). */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled via document keydown useEffect above */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Capturar ideas y oportunidades"
        data-testid="intake-modal"
        style={PANEL_STYLE}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={HEADER_STYLE}>
          <h2 style={HEADING_STYLE}>Capturar ideas / oportunidades</h2>

          {/* ✕ close button (AC-02-003.2) */}
          <button
            type="button"
            data-testid="intake-close"
            aria-label="Cerrar modal de captura de ideas"
            style={CLOSE_BTN_STYLE}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Four command rows (AC-02-003.1) */}
        <ul style={COMMANDS_LIST_STYLE}>
          {INTAKE_COMMANDS.map((cmd) => (
            <li key={cmd.slug} data-testid={`intake-command-${cmd.slug}`} style={COMMAND_ROW_STYLE}>
              {/* Row header: icon + title */}
              <div style={COMMAND_ROW_HEADER_STYLE}>
                <span
                  data-testid={`intake-command-${cmd.slug}-icon`}
                  style={COMMAND_ICON_STYLE}
                  role="img"
                  aria-hidden="true"
                >
                  {cmd.icon}
                </span>
                <h3 data-testid={`intake-command-${cmd.slug}-title`} style={COMMAND_TITLE_STYLE}>
                  {cmd.title}
                </h3>
              </div>

              {/* Description */}
              <p data-testid={`intake-command-${cmd.slug}-description`} style={COMMAND_DESC_STYLE}>
                {cmd.description}
              </p>

              {/* Copy row: command value + CopyButton */}
              <div style={COMMAND_COPY_ROW_STYLE}>
                <code style={COMMAND_VALUE_STYLE}>{cmd.command}</code>
                <CopyButton value={cmd.command} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
