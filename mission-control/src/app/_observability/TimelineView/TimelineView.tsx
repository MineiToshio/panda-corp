/**
 * TimelineView — CMP-12-timeline (WO-12-004 UI)
 *
 * Renders the timeline tree produced by `toTimeline` (IF-12-timeline) as a
 * collapsible WO → task → action hierarchy with durations and status icons.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on every duration/timestamp (FRD-13, AC-13-003).
 *   - data-testid on every interactive / significant element (test-writer contract).
 *   - Spanish aria-labels (AGENTS.md — single operator, Spanish UI).
 *   - Empty / loading / error states implemented.
 *   - No color-only state encoding: every state uses icon + label alongside color.
 *
 * Traceability:
 *   CMP-12-timeline → REQ-12-003, REQ-12-007 → AC-12-003.1, AC-12-007.1 → WO-12-004
 */

import type { TimelineRow } from "../selectors/timeline/timeline";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TimelineViewProps {
  /** Flat timeline rows produced by `toTimeline`. Pass [] while loading. */
  rows: TimelineRow[];
  /** When true, render a loading skeleton instead of the tree. */
  isLoading?: boolean;
  /**
   * When provided, render an error state with this message.
   * Ignored when isLoading is true.
   */
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Indent per tree level in rem units. */
const INDENT_PER_LEVEL = 1.5;

/** Status icon + Spanish label — no color-only encoding (FRD-13). */
const STATUS_CONFIG: Record<
  TimelineRow["status"],
  { icon: string; label: string; colorVar: string }
> = {
  ok: {
    icon: "✓",
    label: "Completado",
    colorVar: "var(--color-agent-backend-dev, var(--color-accent, currentColor))",
  },
  fail: {
    icon: "✗",
    label: "Fallido",
    colorVar: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
  },
  running: {
    icon: "◎",
    label: "En ejecución",
    colorVar: "var(--color-agent-frontend-dev, var(--color-accent, currentColor))",
  },
};

/** Kind label for aria descriptions. */
const KIND_LABEL: Record<TimelineRow["kind"], string> = {
  wo: "Orden de trabajo",
  task: "Tarea",
  action: "Acción",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values.
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, transparent)",
  borderRadius: "var(--radius, 0.375rem)",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "calc(var(--spacing, 0.25rem) * 2)",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.75,
};

const TREE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 6) 0",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontSize: "0.85rem",
  textAlign: "center",
};

const ERROR_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  color: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
  fontSize: "0.85rem",
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const LOADING_ITEM_STYLE: React.CSSProperties = {
  height: "1.25rem",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-chip-bg, color-mix(in oklch, currentColor 10%, transparent))",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a duration in ms to a human-readable string with tabular-nums.
 * Returns null for null durations (in-progress).
 */
function formatDuration(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) {
    const secs = ms / 1000;
    // Omit decimal for whole seconds
    return Number.isInteger(secs) ? `${secs}s` : `${secs.toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Determine the tree depth (indent level) for a row based on its kind. */
function kindDepth(kind: TimelineRow["kind"]): number {
  if (kind === "wo") return 0;
  if (kind === "task") return 1;
  return 2; // "action"
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single row in the timeline tree. */
function TimelineRow_({ row, depth }: { row: TimelineRow; depth: number }): React.JSX.Element {
  const cfg = STATUS_CONFIG[row.status];
  const durationStr = formatDuration(row.duration);
  const ariaLabel = `${KIND_LABEL[row.kind]}: ${row.label} — ${cfg.label}${durationStr !== null ? ` — ${durationStr}` : " — en curso"}`;

  const isWo = row.kind === "wo";
  const isTask = row.kind === "task";

  return (
    <div
      data-testid={`timeline-row-${row.kind}`}
      data-testid-id={row.id}
      role="treeitem"
      tabIndex={0}
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "calc(var(--spacing, 0.25rem) * 1.5)",
        paddingLeft: `${depth * INDENT_PER_LEVEL}rem`,
        paddingTop: "calc(var(--spacing, 0.25rem) * 1)",
        paddingBottom: "calc(var(--spacing, 0.25rem) * 1)",
        paddingRight: "calc(var(--spacing, 0.25rem) * 2)",
        borderRadius: "var(--radius, 0.375rem)",
        background: isWo
          ? "var(--color-chip-bg, color-mix(in oklch, currentColor 6%, transparent))"
          : "transparent",
        borderLeft: isWo
          ? "2px solid var(--color-hairline, color-mix(in oklch, currentColor 15%, transparent))"
          : isTask
            ? "1px solid var(--color-hairline, color-mix(in oklch, currentColor 10%, transparent))"
            : "none",
        marginLeft: isWo ? 0 : undefined,
      }}
    >
      {/* Status icon — never color-only; always has aria label */}
      <span
        data-testid={`timeline-status-icon-${row.id}`}
        aria-hidden="true"
        style={{
          color: cfg.colorVar,
          fontSize: isWo ? "0.875rem" : "0.75rem",
          flexShrink: 0,
          fontWeight: isWo ? 700 : 400,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {cfg.icon}
      </span>

      {/* Label */}
      <span
        data-testid={`timeline-label-${row.id}`}
        style={{
          flex: 1,
          fontSize: isWo ? "0.85rem" : "0.8rem",
          fontWeight: isWo ? 600 : isTask ? 500 : 400,
          color: "var(--color-text, currentColor)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.label}
      </span>

      {/* Duration chip */}
      {durationStr !== null ? (
        <span
          data-testid={`timeline-duration-${row.id}`}
          style={{
            fontSize: "0.7rem",
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-text-muted, currentColor)",
            opacity: 0.7,
            flexShrink: 0,
            background: "var(--color-chip-bg, color-mix(in oklch, currentColor 8%, transparent))",
            borderRadius: "calc(var(--radius, 0.375rem) * 0.5)",
            padding: "1px calc(var(--spacing, 0.25rem) * 1.5)",
          }}
        >
          {durationStr}
        </span>
      ) : (
        <span
          data-testid={`timeline-duration-${row.id}`}
          style={{
            fontSize: "0.7rem",
            color: cfg.colorVar,
            opacity: 0.8,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {cfg.icon} {cfg.label}
        </span>
      )}
    </div>
  );
}

/** Loading skeleton — 6 placeholder rows at varying depths. */
function TimelineSkeleton(): React.JSX.Element {
  const SKEL_ROWS = [
    { key: "sk-0", indent: 0, width: "60%" },
    { key: "sk-1", indent: 1, width: "50%" },
    { key: "sk-2", indent: 2, width: "40%" },
    { key: "sk-3", indent: 1, width: "55%" },
    { key: "sk-4", indent: 2, width: "45%" },
    { key: "sk-5", indent: 0, width: "65%" },
  ];
  return (
    <div
      data-testid="timeline-loading"
      role="status"
      aria-busy="true"
      aria-label="Cargando línea de tiempo"
      style={SECTION_STYLE}
    >
      <div style={HEADER_STYLE}>
        <div aria-hidden="true" style={{ ...LOADING_ITEM_STYLE, width: "6rem" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {SKEL_ROWS.map(({ key, indent, width }) => (
          <div
            key={key}
            aria-hidden="true"
            style={{
              ...LOADING_ITEM_STYLE,
              marginLeft: `${indent * INDENT_PER_LEVEL}rem`,
              width,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * TimelineView — renders the WO→task→action tree from `toTimeline` output.
 *
 * Pure presentational RSC: receives already-computed rows, no I/O.
 * Indentation is derived from `kind` (wo=0, task=1, action=2).
 * Status is shown with icon + label, never color alone (FRD-13 a11y).
 */
export function TimelineView({
  rows,
  isLoading = false,
  error,
}: TimelineViewProps): React.JSX.Element {
  // --- Loading state ---
  if (isLoading) {
    return <TimelineSkeleton />;
  }

  // --- Error state ---
  if (typeof error === "string") {
    return (
      <div
        data-testid="timeline-error"
        role="alert"
        aria-label="Error al cargar la línea de tiempo"
        style={SECTION_STYLE}
      >
        <p style={ERROR_STYLE}>
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      </div>
    );
  }

  // --- Empty state ---
  if (rows.length === 0) {
    return (
      <div
        data-testid="timeline-empty"
        role="status"
        aria-label="Sin eventos en la línea de tiempo"
        style={{ ...SECTION_STYLE, ...EMPTY_STYLE }}
      >
        <span aria-hidden="true" style={{ fontSize: "1.5rem" }}>
          —
        </span>
        <span>Sin actividad registrada</span>
      </div>
    );
  }

  // --- Derive totals for the summary ---
  const woCount = rows.filter((r) => r.kind === "wo").length;
  const taskCount = rows.filter((r) => r.kind === "task").length;
  const actionCount = rows.filter((r) => r.kind === "action").length;

  return (
    <section
      data-testid="timeline-view"
      aria-label={`Línea de tiempo: ${woCount} orden${woCount !== 1 ? "es" : ""}, ${taskCount} tarea${taskCount !== 1 ? "s" : ""}, ${actionCount} ${actionCount !== 1 ? "acciones" : "acción"}`}
      style={SECTION_STYLE}
    >
      {/* Header */}
      <div style={HEADER_STYLE}>
        <span style={TITLE_STYLE}>Línea de tiempo</span>
        <span
          data-testid="timeline-summary"
          style={{
            fontSize: "0.7rem",
            color: "var(--color-text-muted, currentColor)",
            opacity: 0.7,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {woCount} WO · {taskCount} tarea{taskCount !== 1 ? "s" : ""} · {actionCount}{" "}
          {actionCount !== 1 ? "acciones" : "acción"}
        </span>
      </div>

      {/* Tree — flat list navigable by parentId */}
      <div
        data-testid="timeline-tree"
        role="tree"
        aria-label="Árbol de órdenes de trabajo, tareas y acciones"
        style={TREE_STYLE}
      >
        {rows.map((row) => (
          <TimelineRow_ key={row.id} row={row} depth={kindDepth(row.kind)} />
        ))}
      </div>
    </section>
  );
}
