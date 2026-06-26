"use client";

/**
 * DiscardedModal — the discarded ideas, in a modal (CMP-02-discarded-modal).
 *
 * Replaces the old "Descartada" board column (the owner's rule: discarded ideas are
 * out of the day-to-day board, reachable via a "Ver descartadas" button → this modal).
 * Lists every discarded idea with its title + the discard reason; clicking a row opens
 * that idea's detail (where the full docs + "Volver a agregar" live).
 *
 * Built on the shared `Modal` core (DR-057) — no bespoke overlay.
 *
 * Traceability:
 *   CMP-02-discarded-modal → REQ-02-003 (intake surfaces) / REQ-02-007 (discard lifecycle)
 *   AC-02-007.4 — discarded ideas are listed in a modal, each opening its detail.
 */

import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { Modal } from "@/components/core/Modal/Modal";

export interface DiscardedModalProps {
  open: boolean;
  onClose: () => void;
  /** The discarded cards (already filtered to status === "discarded"). */
  cards: BoardCardEntry[];
  /** Open a card's detail by slug (the host closes this modal + sets the open card). */
  onSelect: (slug: string) => void;
}

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text3, var(--color-text-muted))",
  margin: 0,
  lineHeight: 1.5,
};

const LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const ITEM_BTN_STYLE: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm, 8px)",
  padding: "11px 13px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  color: "var(--color-text)",
  fontFamily: "var(--font-display, inherit)",
};

const ITEM_TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.35,
  display: "flex",
  alignItems: "center",
  gap: "7px",
};

const ITEM_REASON_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted))",
  lineHeight: 1.45,
};

const REASON_LABEL_STYLE: React.CSSProperties = {
  color: "var(--color-text2)",
  fontWeight: 600,
};

export function DiscardedModal({
  open,
  onClose,
  cards,
  onSelect,
}: DiscardedModalProps): React.JSX.Element | null {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ideas descartadas"
      testIdBase="discarded"
      width={560}
    >
      {cards.length === 0 ? (
        <p data-testid="discarded-empty" style={EMPTY_STYLE}>
          No hay ideas descartadas. Cuando descartes una, aparecerá aquí con su motivo — y siempre
          podrás volver a agregarla.
        </p>
      ) : (
        <ul style={LIST_STYLE}>
          {cards.map((card) => (
            <li key={card.slug}>
              <button
                type="button"
                data-testid={`discarded-item-${card.slug}`}
                style={ITEM_BTN_STYLE}
                onClick={() => onSelect(card.slug)}
              >
                <span style={ITEM_TITLE_STYLE}>
                  <i
                    className="ti ti-archive"
                    aria-hidden="true"
                    style={{ fontSize: "13px", color: "var(--color-text3)" }}
                  />
                  {card.title}
                </span>
                {card.discardReason != null && card.discardReason !== "" ? (
                  <span style={ITEM_REASON_STYLE}>
                    <span style={REASON_LABEL_STYLE}>Motivo:</span> {card.discardReason}
                  </span>
                ) : (
                  <span style={ITEM_REASON_STYLE}>Sin motivo registrado.</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
