"use client";

/**
 * IntakeModal — Intake command overlay (CMP-02-intake-modal).
 *
 * The four `/pandacorp:*` intake commands. Opens from the board's "Capturar ideas /
 * oportunidades" button; the board stays mounted behind (overlay). The overlay/backdrop/
 * panel/focus-trap/Escape chrome now comes from the shared `Modal` core (DR-057); this
 * component only owns the intake-specific content.
 *
 * Acceptance criteria (FRD-02):
 *   AC-02-003.1 — open=true → modal with the four intake commands (icon, title, desc, copy row).
 *   AC-02-003.2 — backdrop / ✕ / Escape → onClose (handled by Modal).
 *   AC-02-003.3 — the board stays visible behind (overlay).
 *
 * Design rules: zero hardcoded colors (CSS custom properties), data-testid on key nodes,
 * Spanish copy, reuses `CmdRow` (CMP-13-cmdrow) for the copy affordance (DR-057).
 *
 * Traceability: CMP-02-intake-modal → REQ-02-003.
 */

import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Modal } from "@/components/core/Modal/Modal";

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
// Styles — CSS custom properties only (intake-specific content; chrome is in Modal).
// ---------------------------------------------------------------------------

const TABLERO_BADGE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-pixel, ui-monospace, monospace)",
  fontSize: "10px",
  letterSpacing: "0.08em",
  color: "var(--color-accent-text)",
  whiteSpace: "nowrap",
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Capturar ideas y oportunidades"
      testIdBase="intake"
      badge={
        <span className="px" style={TABLERO_BADGE_STYLE}>
          <i
            className="ti ti-sparkles"
            aria-hidden="true"
            style={{ fontSize: "11px", verticalAlign: "-1px", marginRight: "3px" }}
          />
          TABLERO
        </span>
      }
    >
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
    </Modal>
  );
}
