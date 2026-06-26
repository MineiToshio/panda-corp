"use client";

/**
 * Modal — reusable overlay dialog (core primitive, DR-057).
 *
 * Extracted from IntakeModal so every modal surface shares ONE implementation:
 * fixed overlay + dimmed/blurred backdrop + centered panel, with the accessibility
 * contract baked in (role="dialog", aria-modal, focus-on-open, Escape closes,
 * Tab/Shift+Tab trapped, backdrop click closes, panel click does not).
 *
 * The owner's rule: we do NOT use inline expand-that-pushes-content; surfaces that
 * reveal more detail open in a modal. This is the shared component for that.
 *
 * Design rules (FRD-13, AGENTS.md): zero hardcoded colors (CSS custom properties),
 * data-testid on key nodes (derived from `testIdBase`), Spanish copy at the call site.
 *
 * Usage:
 *   <Modal open={open} onClose={close} title="…" testIdBase="intake" badge={…}>
 *     …body…
 *   </Modal>
 */

import { useEffect, useRef } from "react";

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

const PANEL_BASE_STYLE: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: "var(--color-panel)",
  border: "0.5px solid var(--color-border-strong)",
  borderRadius: "var(--radius-lg, 16px)",
  padding: "22px 24px",
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

const HEADER_LEFT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  flexWrap: "wrap",
  minWidth: 0,
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

export interface ModalProps {
  /** Whether the modal is open and visible. */
  open: boolean;
  /** Invoked on backdrop click, the ✕ button, or Escape. */
  onClose: () => void;
  /** The dialog heading (also the default accessible name). */
  title: string;
  /**
   * Base for the data-testids: the panel is `${testIdBase}-modal`, the backdrop
   * `${testIdBase}-backdrop`, the close button `${testIdBase}-close`.
   */
  testIdBase: string;
  /** Optional accessible name override (defaults to `title`). */
  ariaLabel?: string;
  /** Optional node rendered before the title (e.g. a "TABLERO" badge). */
  badge?: React.ReactNode;
  /** Panel width (default 540px). */
  width?: number | string;
  /** Modal body. */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  testIdBase,
  ariaLabel,
  badge,
  width = 540,
  children,
}: ModalProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the panel when the modal opens so keyboard users can interact with it.
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  // Escape dismisses + Tab/Shift+Tab focus trap (a11y).
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
      {/* Backdrop — clickable, separate from the panel (clicking the panel must NOT close) */}
      <div
        data-testid={`${testIdBase}-backdrop`}
        aria-hidden="true"
        style={BACKDROP_STYLE}
        onClick={onClose}
      />

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled via the document keydown useEffect above */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        data-testid={`${testIdBase}-modal`}
        style={{ ...PANEL_BASE_STYLE, width }}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: optional badge + title (left) · icon ✕ (right) */}
        <div style={HEADER_STYLE}>
          <div style={HEADER_LEFT_STYLE}>
            {badge}
            <h2 style={HEADING_STYLE}>{title}</h2>
          </div>

          <button
            type="button"
            data-testid={`${testIdBase}-close`}
            aria-label="Cerrar modal"
            style={CLOSE_BTN_STYLE}
            onClick={onClose}
          >
            <i className="ti ti-x" aria-hidden="true" style={{ fontSize: "13px" }} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
