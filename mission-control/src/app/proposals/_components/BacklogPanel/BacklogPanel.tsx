"use client";

/**
 * BacklogPanel — the factory backlog surface (CMP-22-panel, FRD-22, DR-103).
 *
 * Renders the factory's actionable work queue (`factory/backlog/BL-*`) grouped by
 * status: Abiertos (open) → En curso (doing) always visible, ordered by priority then
 * id (REQ-22-008, an invariant of `readBacklog`'s sort — see `lib/backlog/backlog.ts`).
 * Hechos (done) and Descartados (discarded) are hidden behind "Ver hechos (N)" /
 * "Ver descartados (N)" toggles (REQ-22-006, REQ-22-007) so the closed-item history
 * doesn't clutter the actionable view as the backlog accumulates over months.
 *
 * Fail-loud (DR-078): if the reader could not interpret one or more BL files, an
 * error banner names them — the panel never renders a misleadingly-empty backlog.
 *
 * Client Component: clicking a card opens a detail Modal (the shared `Modal` +
 * `Markdown` primitives) showing the item's full, formatted body (REQ-22-005) and,
 * for open/doing items, a discard action (REQ-22-007). The passed BacklogReadResult
 * (incl. each item's markdown `body`) is read server-side. When there is at least
 * one open/doing item, a `/pandacorp:implement-backlog` `CmdRow` renders below the
 * list (REQ-22-009) — the generic, drain-the-whole-queue form of the command the
 * item detail also offers targeted at one id (see `BacklogDetail`).
 *
 * Traceability:
 *   CMP-22-panel → REQ-22-001 (grouped items), REQ-22-003 (read-only note),
 *                  REQ-22-004 (fail-loud error state), REQ-22-005 (detail modal),
 *                  REQ-22-006 (default-hidden Hechos), REQ-22-007 (discard),
 *                  REQ-22-008 (priority ordering), REQ-22-009 (implement command)
 */

import { useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Modal } from "@/components/core/Modal/Modal";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import type { BacklogItem, BacklogReadResult, BacklogStatus } from "@/lib/backlog/backlog";
import { BacklogCard } from "./BacklogCard";
import { BacklogDetail } from "./BacklogDetail";

// ---------------------------------------------------------------------------
// Status groups — always-visible (default view) vs toggleable (opt-in reveal)
// ---------------------------------------------------------------------------

const DEFAULT_GROUPS: readonly { status: BacklogStatus; label: string; icon: string }[] = [
  { status: "open", label: "Abiertos", icon: "ti-circle-dashed" },
  { status: "doing", label: "En curso", icon: "ti-progress" },
];

const TOGGLEABLE_GROUPS: readonly {
  status: BacklogStatus;
  label: string;
  icon: string;
  toggleLabel: string;
}[] = [
  { status: "done", label: "Hechos", icon: "ti-circle-check", toggleLabel: "hechos" },
  { status: "discarded", label: "Descartados", icon: "ti-trash", toggleLabel: "descartados" },
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only
// ---------------------------------------------------------------------------

const NOTE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text2)",
  margin: "14px 2px 18px",
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
  margin: "14px 2px 14px",
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

const CMD_SECTION_STYLE: React.CSSProperties = { margin: "0 2px 18px" };

const CMD_NOTE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  margin: "4px 0 0",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Group items by status, preserving file order within each group. */
function byStatus(items: BacklogItem[], status: BacklogStatus): BacklogItem[] {
  return items.filter((item) => item.status === status);
}

export function BacklogPanel({ result }: { result: BacklogReadResult }): React.JSX.Element {
  const { items, errors } = result;
  const hasItems = items.length > 0;
  const actionableCount = byStatus(items, "open").length + byStatus(items, "doing").length;

  // Selected item → detail modal (null = closed).
  const [selected, setSelected] = useState<BacklogItem | null>(null);
  // Toggleable groups (Hechos, Descartados) — hidden by default (REQ-22-006, REQ-22-007)
  // so the active backlog doesn't grow unboundedly cluttered as the factory ages.
  const [openToggles, setOpenToggles] = useState<ReadonlySet<BacklogStatus>>(new Set());

  function toggleGroup(status: BacklogStatus): void {
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
    <section data-testid="backlog-panel" aria-label="Backlog de la fábrica">
      {/* Read-only note — how these get worked (REQ-22-003) */}
      <p style={NOTE_STYLE}>
        La cola accionable de la fábrica: defectos y cambios a su propio tooling (plugin, motor de
        build, plantillas). Se trabajan pidiéndoselo a un agente — Mission Control solo los muestra
        (y te deja descartarlos).
      </p>

      {/* Generic implement-backlog command — drains the WHOLE open/doing queue (REQ-22-009) */}
      {actionableCount > 0 && (
        <div style={CMD_SECTION_STYLE}>
          <CmdRow command="/pandacorp:implement-backlog" />
          <p style={CMD_NOTE_STYLE}>
            Sin id: resuelve todo el backlog abierto/en curso, un subagente por item.
          </p>
        </div>
      )}

      {/* Fail-loud error banner (DR-078) — a malformed item is surfaced, not hidden */}
      {errors.length > 0 && (
        <div data-testid="backlog-error-banner" role="alert" style={ERROR_BANNER_STYLE}>
          <i className="ti ti-alert-triangle" style={{ marginRight: "6px" }} aria-hidden="true" />
          No se pudieron leer {errors.length} item(s) del backlog:{" "}
          {errors.map((e) => `${e.file} (${e.reason})`).join("; ")}
        </div>
      )}

      {!hasItems ? (
        <p data-testid="backlog-empty" style={EMPTY_STYLE}>
          No hay items en el backlog. Cuando surja un defecto o cambio del tooling de la fábrica, se
          archiva aquí como un BL-*.
        </p>
      ) : (
        <>
          {DEFAULT_GROUPS.map(({ status, label, icon }) => {
            const group = byStatus(items, status);
            if (group.length === 0) return null;
            return (
              <div key={status} data-testid={`backlog-group-${status}`}>
                <SectionHead icon={icon} label={label} count={group.length} />
                <div style={CARDS_STYLE}>
                  {group.map((item) => (
                    <BacklogCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Toggle row — Hechos/Descartados stay hidden until asked for (REQ-22-006,
              REQ-22-007), so the backlog's history doesn't clutter the default view
              over months. */}
          <div style={TOGGLES_ROW_STYLE}>
            {TOGGLEABLE_GROUPS.map(({ status, toggleLabel }) => {
              const count = byStatus(items, status).length;
              if (count === 0) return null;
              const open = openToggles.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  data-testid={`backlog-toggle-${status}`}
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
              <div key={status} data-testid={`backlog-group-${status}`}>
                <SectionHead icon={icon} label={label} count={group.length} />
                <div style={CARDS_STYLE}>
                  {group.map((item) => (
                    <BacklogCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Detail modal — the shared Modal + Markdown primitives (REQ-22-005). */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.id ?? ""}
        testIdBase="backlog-detail"
        badge={selected != null ? <Chip tone="accent">{selected.type}</Chip> : undefined}
        width={620}
      >
        {selected != null && <BacklogDetail item={selected} onDiscarded={handleDiscarded} />}
      </Modal>
    </section>
  );
}
