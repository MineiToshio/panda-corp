"use client";

/**
 * WO-12-005 — TimelineView (Gantt-style, project-scoped)
 * CMP-12-timeline — bTimeline() prototype re-paint
 *
 * Renders the Gantt-style timeline matching prototype bTimeline() (~L1156):
 *   - A Panel with a one-line legend
 *   - Optional "saltar al primer error" note (first fail WO)
 *   - Time axis (0 → total/2 → total min)
 *   - One row per work order: 150px label column (icon + title + WO-id·FRD mono)
 *     + horizontal duration bar positioned by start/dur (% of total)
 *   - Nested task sub-bars (opacity 0.55) under each WO
 *   - tabular-nums on durations and axis
 *
 * Design rules (FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only
 *   - State by icon + text + color (never color alone)
 *   - tabular-nums on all numeric values
 *   - data-testid on every interactive/significant element
 *
 * Traceability:
 *   CMP-12-timeline → REQ-12-003 → AC-12-003.1, AC-12-003.2
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GanttTask {
  /** Task title */
  title: string;
  /** Duration in minutes */
  dur: number;
  /** Task state */
  state: "done" | "fail" | "in_progress" | "todo" | "review";
}

export interface GanttWorkOrder {
  /** WO id, e.g. "WO-01-001" */
  id: string;
  /** WO title */
  title: string;
  /** FRD id, e.g. "FRD-01" */
  frd: string;
  /** WO state */
  state: "done" | "fail" | "in_progress" | "todo" | "review";
  /** Start offset in minutes (from build start) */
  start: number;
  /** Duration in minutes */
  dur: number;
  /** Nested task bars */
  tasks: GanttTask[];
}

export interface TimelineViewProps {
  /** Work orders with Gantt positioning (start + dur in minutes) */
  workOrders: GanttWorkOrder[];
  /** Total build duration in minutes (for axis + bar positioning) */
  total: number;
}

// ---------------------------------------------------------------------------
// State → WO icon (Tabler CSS class) + color token
// Prototype: WOICON / WOCOL
// ---------------------------------------------------------------------------

const WO_ICON: Record<GanttWorkOrder["state"], string> = {
  done: "ti ti-circle-check",
  fail: "ti ti-alert-triangle",
  in_progress: "ti ti-loader-2",
  todo: "ti ti-circle",
  review: "ti ti-eye",
};

const WO_COLOR_VAR: Record<GanttWorkOrder["state"], string> = {
  done: "var(--color-ok)",
  fail: "var(--color-danger)",
  in_progress: "var(--color-accent)",
  todo: "var(--color-border-strong)",
  review: "var(--color-info)",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safePercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

// ---------------------------------------------------------------------------
// TimelineView
// ---------------------------------------------------------------------------

/**
 * Gantt-style TimelineView — re-paint of prototype bTimeline() (~L1156).
 * Pure presentational: receives pre-computed GanttWorkOrder[], no I/O.
 * Used by ObservabilidadTab (WO-12-005); live updates driven by the parent.
 */
export function TimelineView({ workOrders, total }: TimelineViewProps): React.JSX.Element {
  // --- Empty state ---
  if (workOrders.length === 0) {
    return (
      <div
        data-testid="timeline-gantt-empty"
        role="status"
        aria-label="Sin work orders para mostrar"
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "var(--color-text3)",
          fontSize: "13px",
        }}
      >
        Los work orders se generan en /pandacorp:blueprint
      </div>
    );
  }

  const effectiveTotal = total > 0 ? total : 1;

  // First failed WO for the jump-to-first-error affordance (AC-12-003.2)
  const firstErr = workOrders.find((w) => w.state === "fail");

  return (
    <div data-testid="timeline-gantt" style={{ width: "100%" }}>
      {/* Legend */}
      <div
        data-testid="timeline-gantt-legend"
        style={{
          fontSize: "12px",
          color: "var(--color-text2)",
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <i
          className="ti ti-timeline"
          aria-hidden="true"
          style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
        />
        Work orders → tareas → acciones, por duración. Las barras tenues son las tareas dentro de
        cada WO.
      </div>

      {/* Jump-to-first-error note (AC-12-003.2) */}
      {firstErr !== undefined && (
        <div
          data-testid="timeline-gantt-first-error"
          role="note"
          style={{
            fontSize: "11px",
            color: "var(--color-danger)",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: "12px" }} />
          Primer error en <strong>{firstErr.id}</strong> ({firstErr.title}) — la barra roja marca
          dónde se rompió la cadena.
        </div>
      )}

      {/* Time axis */}
      <div
        data-testid="timeline-gantt-axis"
        style={{
          display: "grid",
          gridTemplateColumns: "150px 1fr",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        {/* Empty label cell */}
        <span />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10px",
            color: "var(--color-text3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>0 min</span>
          <span>{Math.round(effectiveTotal / 2)}</span>
          <span>{effectiveTotal} min</span>
        </div>
      </div>

      {/* Work order rows */}
      {workOrders.map((wo) => {
        const barLeft = safePercent(wo.start, effectiveTotal);
        const barWidth = safePercent(wo.dur, effectiveTotal);
        const colorVar = WO_COLOR_VAR[wo.state];
        const iconClass = WO_ICON[wo.state];

        // Task cumulative offsets
        let taskOffset = wo.start;

        return (
          <div key={wo.id} style={{ marginBottom: "11px" }}>
            {/* WO row: label column + duration bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr",
                gap: "8px",
                alignItems: "center",
              }}
            >
              {/* Label column: icon + title + WO-id·FRD */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <i
                    data-testid={`timeline-gantt-icon-${wo.id}`}
                    className={iconClass}
                    aria-hidden="true"
                    style={{ fontSize: "12px", color: colorVar, flexShrink: 0 }}
                  />
                  <span
                    data-testid={`timeline-gantt-label-${wo.id}`}
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {wo.title}
                  </span>
                </div>
                {/* WO-id · FRD in mono */}
                <div
                  data-testid={`timeline-gantt-meta-${wo.id}`}
                  style={{
                    fontSize: "9px",
                    color: "var(--color-text3)",
                    fontFamily: "ui-monospace, monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {wo.id} · {wo.frd}
                </div>
              </div>

              {/* Duration bar track */}
              <div
                style={{
                  position: "relative",
                  height: "22px",
                  background: "var(--color-card2)",
                  borderRadius: "5px",
                  border: "0.5px solid var(--color-border)",
                }}
              >
                {/* Duration bar fill */}
                <div
                  data-testid={`timeline-gantt-bar-${wo.id}`}
                  title={`${wo.title} · ${wo.dur} min`}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${barLeft}%`,
                    width: `${barWidth}%`,
                    minWidth: "34px",
                    background: colorVar,
                    borderRadius: "5px",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 6px",
                    color: "var(--color-base)",
                    fontSize: "10px",
                    fontWeight: 600,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {wo.dur}m
                </div>
              </div>
            </div>

            {/* Nested task sub-bars */}
            {wo.tasks.map((task, taskIdx) => {
              const taskWidth = safePercent(task.dur, effectiveTotal);
              const taskColor = WO_COLOR_VAR[task.state];
              const currentOffset = taskOffset;
              taskOffset += task.dur;

              return (
                <div
                  key={`${wo.id}-task-${currentOffset}-${task.title}`}
                  data-testid={`timeline-gantt-task-${wo.id}-${taskIdx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "150px 1fr",
                    gap: "8px",
                    alignItems: "center",
                    marginTop: "3px",
                  }}
                >
                  {/* Task label */}
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--color-text3)",
                      paddingLeft: "14px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ↳ {task.title}
                  </span>

                  {/* Task sub-bar track */}
                  <div style={{ position: "relative", height: "11px" }}>
                    <div
                      data-testid={`timeline-gantt-task-bar-${wo.id}-${taskIdx}`}
                      title={`${task.title} · ${task.dur} min`}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${safePercent(currentOffset, effectiveTotal)}%`,
                        width: `${taskWidth}%`,
                        minWidth: "8px",
                        background: taskColor,
                        opacity: 0.55,
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
