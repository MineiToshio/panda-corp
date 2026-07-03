"use client";

/**
 * ChangesPanel — the project's change-queue surface (CMP-04-changes-panel, FRD-04).
 *
 * Renders a project's `.pandacorp/inbox/changes/` (+ archived `done/`), grouped by
 * status. Only **Listos (ready)** and **Borradores (draft)** show by default — Hechos
 * and Descartados are hidden behind "Ver hechos (N)" / "Ver descartados (N)" toggles
 * (REQ-04-009), so a project's history doesn't clutter the actionable view as it grows
 * over months. "Listo" heads the default view because it's the most actionable right
 * now — the build drains it next.
 *
 * Fail-loud (DR-078): if the reader could not interpret one or more files, an error
 * banner names them — the panel never renders a misleadingly-empty queue.
 *
 * Client Component: clicking a card opens a detail Modal (shared `Modal` primitive)
 * showing the item's full body + the targeted `/pandacorp:implement change:<id>`
 * command + (for ready/draft items) a discard action. The passed ChangeQueueReadResult
 * is read server-side.
 *
 * Traceability:
 *   CMP-04-changes-panel → REQ-04-006 (grouped items), REQ-04-007 (fail-loud error state),
 *                          REQ-04-008 (detail modal + targeted command + discard),
 *                          REQ-04-009 (default-hidden Hechos/Descartados)
 */

import { useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { Modal } from "@/components/core/Modal/Modal";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import type {
  ChangeQueueItem,
  ChangeQueueReadResult,
  ChangeQueueStatus,
} from "@/lib/changes/changes";
import { ChangeCard } from "./ChangeCard";
import { ChangeDetail } from "./ChangeDetail";

// ---------------------------------------------------------------------------
// Status groups — always-visible (default view) vs toggleable (opt-in reveal)
// ---------------------------------------------------------------------------

const DEFAULT_GROUPS: readonly { status: ChangeQueueStatus; label: string; icon: string }[] = [
  { status: "ready", label: "Listos", icon: "ti-circle-check" },
  { status: "draft", label: "Borradores", icon: "ti-file-dots" },
];

const TOGGLEABLE_GROUPS: readonly {
  status: ChangeQueueStatus;
  label: string;
  icon: string;
  toggleLabel: string;
}[] = [
  { status: "done", label: "Hechos", icon: "ti-archive", toggleLabel: "hechos" },
  { status: "discarded", label: "Descartados", icon: "ti-trash", toggleLabel: "descartados" },
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only
// ---------------------------------------------------------------------------

const NOTE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text2)",
  margin: "0 2px 18px",
};

const CARDS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text3)",
  fontStyle: "italic",
  padding: "0.75rem 2px",
};

const ERROR_BANNER_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-danger)",
  background: "var(--color-danger-bg)",
  border: "1px solid var(--color-danger)",
  borderRadius: "var(--radius-md, 12px)",
  padding: "10px 12px",
  margin: "0 2px 14px",
};

const TOGGLES_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  margin: "0 2px 14px",
};

const TOGGLE_BTN_STYLE: React.CSSProperties = {
  fontSize: "11px",
  padding: "4px 10px",
  borderRadius: "var(--radius-sm, 8px)",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  color: "var(--color-text2)",
  cursor: "pointer",
  fontFamily: "var(--font-display, inherit)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Group items by status, preserving file order within each group. */
function byStatus(items: ChangeQueueItem[], status: ChangeQueueStatus): ChangeQueueItem[] {
  return items.filter((item) => item.status === status);
}

export interface ChangesPanelProps {
  result: ChangeQueueReadResult;
  /** Absolute path to the project root — threaded to the discard Server Action. */
  projectPath: string;
  /** The project's URL slug — threaded to the discard Server Action for revalidation. */
  slug: string;
}

export function ChangesPanel({ result, projectPath, slug }: ChangesPanelProps): React.JSX.Element {
  const { items, errors } = result;
  const hasItems = items.length > 0;

  // Selected item → detail modal (null = closed).
  const [selected, setSelected] = useState<ChangeQueueItem | null>(null);
  // Toggleable groups (Hechos, Descartados) — hidden by default (REQ-04-009) so the
  // active queue doesn't grow unboundedly cluttered as a project ages.
  const [openToggles, setOpenToggles] = useState<ReadonlySet<ChangeQueueStatus>>(new Set());

  function toggleGroup(status: ChangeQueueStatus): void {
    setOpenToggles((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function handleDiscarded(): void {
    setSelected(null);
  }

  return (
    <section data-testid="changes-panel" aria-label="Cola de cambios del proyecto">
      <p style={NOTE_STYLE}>
        Lo que el dueño pidió vía <code>/pandacorp:change</code> (o que reportó como bug): el build
        lo drena en su próximo punto seguro. Haz clic en una tarjeta para ver el detalle completo.
      </p>

      {/* Fail-loud error banner (DR-078) — a malformed item is surfaced, not hidden */}
      {errors.length > 0 && (
        <div data-testid="changes-error-banner" role="alert" style={ERROR_BANNER_STYLE}>
          <i className="ti ti-alert-triangle" style={{ marginRight: "6px" }} aria-hidden="true" />
          No se pudieron leer {errors.length} archivo(s) de la cola de cambios:{" "}
          {errors.map((e) => `${e.file} (${e.reason})`).join("; ")}
        </div>
      )}

      {!hasItems ? (
        <p data-testid="changes-empty" style={EMPTY_STYLE}>
          No hay cambios en la cola. Cuando pidas algo con <code>/pandacorp:change</code> (o
          reportes un bug), aparecerá aquí.
        </p>
      ) : (
        <>
          {DEFAULT_GROUPS.map(({ status, label, icon }) => {
            const group = byStatus(items, status);
            if (group.length === 0) return null;
            return (
              <div key={status} data-testid={`changes-group-${status}`}>
                <SectionHead icon={icon} label={label} count={group.length} />
                <div style={CARDS_STYLE}>
                  {group.map((item) => (
                    <ChangeCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Toggle row — Hechos/Descartados stay hidden until asked for (REQ-04-009),
              so a project's history doesn't clutter the default view over months. */}
          <div style={TOGGLES_ROW_STYLE}>
            {TOGGLEABLE_GROUPS.map(({ status, toggleLabel }) => {
              const count = byStatus(items, status).length;
              if (count === 0) return null;
              const open = openToggles.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  data-testid={`changes-toggle-${status}`}
                  onClick={() => toggleGroup(status)}
                  aria-pressed={open}
                  style={TOGGLE_BTN_STYLE}
                >
                  {open ? "Ocultar" : "Ver"} {toggleLabel} ({count})
                </button>
              );
            })}
          </div>

          {TOGGLEABLE_GROUPS.map(({ status, label, icon }) => {
            if (!openToggles.has(status)) return null;
            const group = byStatus(items, status);
            if (group.length === 0) return null;
            return (
              <div key={status} data-testid={`changes-group-${status}`}>
                <SectionHead icon={icon} label={label} count={group.length} />
                <div style={CARDS_STYLE}>
                  {group.map((item) => (
                    <ChangeCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Detail modal — the shared Modal primitive + ChangeDetail. */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        testIdBase="change-detail-modal"
        badge={selected != null ? <Chip tone="accent">{selected.id}</Chip> : undefined}
        width={620}
      >
        {selected != null && (
          <ChangeDetail
            item={selected}
            projectPath={projectPath}
            slug={slug}
            onDiscarded={handleDiscarded}
          />
        )}
      </Modal>
    </section>
  );
}
