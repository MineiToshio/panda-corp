"use client";

/**
 * DiscardChangeButton — discard action for a change-queue item (CMP-04-discard-change, FRD-04).
 *
 * Mirrors the board's `DiscardButton` state machine (idle → confirming → pending → done/error,
 * `useTransition`, prop-injected Server Action) but WITHOUT its own `Modal`: `ChangeDetail` (the
 * caller) already renders inside the shared `Modal` from `ChangesPanel`, so a second, nested modal
 * would be confusing (modal-on-modal). Instead, confirmation is an inline "¿Seguro? Sí / No" swap —
 * a tiny state change in place, not the "reveal-more" content expansion the owner rule forbids.
 *
 * On success, calls `onDiscarded` so the caller can close the parent modal (the item no longer
 * shows in the default Listos/Borradores view once discarded).
 *
 * Traceability:
 *   CMP-04-discard-change → REQ-04-008
 *   AC-04-008.1 — WHEN the owner discards a ready/draft change, the system SHALL rewrite
 *                 `status: discarded` in the `.md` frontmatter.
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/core/Button/Button";
import type { DiscardChangeResult } from "@/lib/changes/discard-change";

export interface DiscardChangeButtonProps {
  /** Absolute path to the project root. */
  projectPath: string;
  /** The change's slug (filename without `.md`). */
  id: string;
  /** The project's URL slug — passed through to the Server Action for revalidation. */
  slug: string;
  /**
   * The Server Action to call on confirmation. Injected as a prop so tests can pass a
   * vi.fn() without Next.js infrastructure. Production callers pass `discardChangeAction`.
   */
  discardAction: (projectPath: string, id: string, slug: string) => Promise<DiscardChangeResult>;
  /** Called after a successful discard (e.g. so the caller closes the detail modal). */
  onDiscarded?: () => void;
}

type UIState = "idle" | "confirming" | "done";

const WRAPPER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "6px",
};

const CONFIRM_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const CONFIRM_LABEL_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
};

const ERROR_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--color-danger)",
  opacity: 0.85,
};

const DONE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
};

/**
 * Client component: "Descartar" button with an inline (non-modal) confirm step.
 * Uses useTransition for React 19 concurrent-safe pending state.
 */
export function DiscardChangeButton({
  projectPath,
  id,
  slug,
  discardAction,
  onDiscarded,
}: DiscardChangeButtonProps): React.JSX.Element {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTrigger() {
    setErrorMsg(null);
    setUiState("confirming");
  }

  function handleCancel() {
    setUiState("idle");
    setErrorMsg(null);
  }

  function handleConfirm() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await discardAction(projectPath, id, slug);
      if (result.ok) {
        setUiState("done");
        onDiscarded?.();
      } else {
        setUiState("idle");
        const reasons: Record<string, string> = {
          "not-found": "El cambio no fue encontrado.",
          "parse-error": "No se pudo procesar el archivo del cambio.",
          "not-discardable": "Este cambio ya no se puede descartar.",
        };
        setErrorMsg(reasons[result.reason] ?? "Error al descartar el cambio.");
      }
    });
  }

  if (uiState === "done") {
    return (
      <div data-testid="discard-change-done" role="status" style={DONE_STYLE} aria-live="polite">
        Descartado
      </div>
    );
  }

  if (uiState === "confirming" || isPending) {
    return (
      <div style={WRAPPER_STYLE}>
        <div style={CONFIRM_ROW_STYLE}>
          <span style={CONFIRM_LABEL_STYLE}>¿Descartar este cambio?</span>
          <Button
            variant="primary"
            tone="danger"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            ariaLabel="Confirmar descarte del cambio"
            data-testid="discard-change-confirm-button"
          >
            {isPending ? "Descartando…" : "Sí, descartar"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
            ariaLabel="Cancelar descarte"
            data-testid="discard-change-cancel-button"
          >
            Cancelar
          </Button>
        </div>
        {errorMsg !== null && (
          <p
            data-testid="discard-change-error"
            style={ERROR_STYLE}
            role="alert"
            aria-live="assertive"
          >
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={WRAPPER_STYLE}>
      <Button
        variant="secondary"
        tone="danger"
        size="sm"
        onClick={handleTrigger}
        ariaLabel="Descartar cambio"
        data-testid="discard-change-button"
      >
        <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: "14px" }} />
        Descartar
      </Button>
      {errorMsg !== null && (
        <p
          data-testid="discard-change-error"
          style={ERROR_STYLE}
          role="alert"
          aria-live="assertive"
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}
