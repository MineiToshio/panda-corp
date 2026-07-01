/**
 * BacklogPanel — the factory backlog surface (CMP-22-panel, FRD-22, DR-103).
 *
 * Renders the factory's actionable work queue (`factory/backlog/BL-*`) grouped by
 * status: Abiertos (open) → En curso (doing) → Hechos (done). Read-only: these are
 * closeable items worked by asking an agent, not from this UI.
 *
 * Fail-loud (DR-078): if the reader could not interpret one or more BL files, an
 * error banner names them — the panel never renders a misleadingly-empty backlog.
 *
 * Server Component: pure display of the passed BacklogReadResult (page reads it).
 *
 * Traceability:
 *   CMP-22-panel → REQ-22-001 (grouped items), REQ-22-003 (read-only note),
 *                  REQ-22-004 (fail-loud error state)
 */

import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import type { BacklogItem, BacklogReadResult, BacklogStatus } from "@/lib/backlog/backlog";
import { BacklogCard } from "./BacklogCard";

// ---------------------------------------------------------------------------
// Status groups (order + labels + icons)
// ---------------------------------------------------------------------------

const STATUS_GROUPS: readonly { status: BacklogStatus; label: string; icon: string }[] = [
  { status: "open", label: "Abiertos", icon: "ti-circle-dashed" },
  { status: "doing", label: "En curso", icon: "ti-progress" },
  { status: "done", label: "Hechos", icon: "ti-circle-check" },
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

  return (
    <section data-testid="backlog-panel" aria-label="Backlog de la fábrica">
      {/* Read-only note — how these get worked (REQ-22-003) */}
      <p style={NOTE_STYLE}>
        La cola accionable de la fábrica: defectos y cambios a su propio tooling (plugin, motor de
        build, plantillas). Se trabajan pidiéndoselo a un agente (p. ej. «implementa BL-0007») —
        Mission Control solo los muestra.
      </p>

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
        STATUS_GROUPS.map(({ status, label, icon }) => {
          const group = byStatus(items, status);
          if (group.length === 0) return null;
          return (
            <div key={status} data-testid={`backlog-group-${status}`}>
              <SectionHead icon={icon} label={label} count={group.length} />
              <div style={CARDS_STYLE}>
                {group.map((item) => (
                  <BacklogCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
