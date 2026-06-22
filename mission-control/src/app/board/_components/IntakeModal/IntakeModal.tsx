"use client";

/**
 * IntakeModal — Intake command overlay (CMP-02-intake-modal).
 *
 * Modal overlay with the four `/pandacorp:*` intake commands. Opens from the board's
 * "Capturar ideas / oportunidades" button; the board stays mounted behind (overlay).
 *
 * Faithful to the prototype `intakePanel()` (index.html ~L768): panel on `--color-panel`
 * with a `bd2` hairline + `radius-lg`; header carries the celeste **"TABLERO"** badge +
 * the title and an **icon** ✕ (`ti-x`); a one-line description; then one card per command
 * with a **Tabler icon** (never an emoji) in a tinted slot + the shared `CmdRow`.
 *
 * Acceptance criteria (FRD-02):
 *   AC-02-003.1 — open=true → modal with the four intake commands (icon, title, desc, copy row).
 *   AC-02-003.2 — backdrop / ✕ / Escape → onClose.
 *   AC-02-003.3 — the board stays visible behind (overlay).
 *
 * Accessibility: role="dialog" + aria-modal + aria-label; focus on open; Escape closes;
 * Tab/Shift+Tab trapped; ✕ is a <button> with a Spanish aria-label.
 *
 * Design rules: zero hardcoded colors (CSS custom properties), data-testid on key nodes,
 * Spanish copy, reuses `CmdRow` (CMP-13-cmdrow) for the copy affordance (DR-057).
 *
 * Traceability: CMP-02-intake-modal → REQ-02-003.
 */

import { useEffect, useRef } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";

// ---------------------------------------------------------------------------
// Static data — the four intake commands (icons + accent per prototype intakePanel)
// ---------------------------------------------------------------------------

interface CommandDef {
  slug: string;
  command: string;
  /** Tabler icon class (prototype ICONS) — never an emoji. */
  icon: string;
  /** Category-accent color token for the icon slot (prototype ACCS). */
  accent: string;
  title: string;
  description: string;
}

const INTAKE_COMMANDS: CommandDef[] = [
  {
    slug: "explore",
    command: "/pandacorp:explore",
    icon: "ti-compass",
    accent: "var(--color-cat-8)",
    title: "Explorar una idea",
    description:
      "Abre una conversación guiada para clarificar y expandir una idea difusa antes de capturarla.",
  },
  {
    slug: "new-idea",
    command: "/pandacorp:new-idea",
    icon: "ti-bulb",
    accent: "var(--color-cat-4)",
    title: "Capturar idea",
    description:
      "Cristaliza y guarda una idea (de la conversación o de un concepto propio) en la base de ideas.",
  },
  {
    slug: "discover",
    command: "/pandacorp:discover",
    icon: "ti-world-search",
    accent: "var(--color-cat-5)",
    title: "Descubrir oportunidades",
    description:
      "Busca en internet dolores monetizables y los sugiere como nuevas ideas para la base.",
  },
  {
    slug: "recommend",
    command: "/pandacorp:recommend",
    icon: "ti-chart-bar",
    accent: "var(--color-cat-7)",
    title: "Recomendar idea",
    description:
      "Analiza la base de ideas y recomienda la mejor candidata según el perfil del propietario.",
  },
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only.
// ---------------------------------------------------------------------------

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "var(--color-backdrop, color-mix(in oklch, var(--color-base, black) 60%, transparent))",
  backdropFilter: "blur(3px)",
  WebkitBackdropFilter: "blur(3px)",
};

const PANEL_STYLE: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: "var(--color-panel)",
  border: "0.5px solid var(--color-border-strong)",
  borderRadius: "var(--radius-lg, 16px)",
  padding: "22px 24px",
  width: "540px",
  maxWidth: "calc(100vw - 32px)",
  maxHeight: "85vh",
  overflowY: "auto",
  boxShadow: "var(--shadow-pop, var(--shadow-overlay, 0 18px 50px rgba(0,0,0,0.5)))",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  outline: "none",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
};

/** Left side of the header: the celeste "TABLERO" badge + the title. */
const HEADER_LEFT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  flexWrap: "wrap",
  minWidth: 0,
};

const TABLERO_BADGE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-pixel, ui-monospace, monospace)",
  fontSize: "10px",
  letterSpacing: "0.08em",
  color: "var(--color-accent-text)",
  whiteSpace: "nowrap",
};

const HEADING_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display, inherit)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--color-text)",
};

const CLOSE_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  cursor: "pointer",
  color: "var(--color-text)",
  padding: "5px 10px",
  borderRadius: "8px",
  flexShrink: 0,
};

const DESC_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3)",
  margin: 0,
  lineHeight: 1.5,
};

const COMMANDS_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "9px",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm, 8px)",
  padding: "14px 15px",
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};

const COMMAND_HEAD_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
};

/** Tinted 36×36 icon slot (prototype: secondary bg + category-accent glyph). */
const COMMAND_ICON_SLOT_STYLE: React.CSSProperties = {
  flex: "0 0 auto",
  width: "36px",
  height: "36px",
  background: "var(--color-panel)",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const COMMAND_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.2,
  color: "var(--color-text)",
};

const COMMAND_DESC_STYLE: React.CSSProperties = {
  margin: "3px 0 0",
  fontSize: "11px",
  color: "var(--color-text2)",
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Focus-trap helper — keeps Tab/Shift+Tab inside the dialog panel (a11y).
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Wrap focus inside `panel` when Tab/Shift+Tab would otherwise escape it. */
function trapFocus(event: KeyboardEvent, panel: HTMLDivElement): void {
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return;

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

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

export function IntakeModal({ open, onClose }: IntakeModalProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the panel when the modal opens so keyboard users can interact with it.
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  // Escape dismisses + Tab/Shift+Tab focus trap (AC-02-003.2, a11y).
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
        return;
      }
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
        {/* Header: celeste TABLERO badge + title (left) · icon ✕ (right) */}
        <div style={HEADER_STYLE}>
          <div style={HEADER_LEFT_STYLE}>
            <span className="px" style={TABLERO_BADGE_STYLE}>
              <i
                className="ti ti-sparkles"
                aria-hidden="true"
                style={{ fontSize: "11px", verticalAlign: "-1px", marginRight: "3px" }}
              />
              TABLERO
            </span>
            <h2 style={HEADING_STYLE}>Capturar ideas y oportunidades</h2>
          </div>

          <button
            type="button"
            data-testid="intake-close"
            aria-label="Cerrar modal de captura de ideas"
            style={CLOSE_BTN_STYLE}
            onClick={onClose}
          >
            <i className="ti ti-x" aria-hidden="true" style={{ fontSize: "13px" }} />
          </button>
        </div>

        {/* One-line description (prototype) */}
        <p data-testid="intake-description" style={DESC_STYLE}>
          <i
            className="ti ti-info-circle"
            aria-hidden="true"
            style={{ fontSize: "12px", verticalAlign: "-1px", marginRight: "4px" }}
          />
          Así llenas y priorizas la columna «Descubierta». Copia el comando y pégalo en Claude Code
          (en la fábrica).
        </p>

        {/* Four command cards (AC-02-003.1) */}
        <ul style={COMMANDS_LIST_STYLE}>
          {INTAKE_COMMANDS.map((cmd) => (
            <li key={cmd.slug} data-testid={`intake-command-${cmd.slug}`} style={COMMAND_ROW_STYLE}>
              <div style={COMMAND_HEAD_STYLE}>
                {/* Tinted icon slot — Tabler glyph in the category-accent color (never an emoji) */}
                <span
                  data-testid={`intake-command-${cmd.slug}-icon`}
                  style={{ ...COMMAND_ICON_SLOT_STYLE, color: cmd.accent }}
                  aria-hidden="true"
                >
                  <i className={`ti ${cmd.icon}`} style={{ fontSize: "18px" }} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 data-testid={`intake-command-${cmd.slug}-title`} style={COMMAND_TITLE_STYLE}>
                    {cmd.title}
                  </h3>
                  <p
                    data-testid={`intake-command-${cmd.slug}-description`}
                    style={COMMAND_DESC_STYLE}
                  >
                    {cmd.description}
                  </p>
                </div>
              </div>

              {/* Copy affordance — the shared CmdRow (terminal glyph + mono + copy icon) */}
              <CmdRow command={cmd.command} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
