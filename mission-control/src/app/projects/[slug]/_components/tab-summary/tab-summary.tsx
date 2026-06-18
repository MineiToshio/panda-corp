/**
 * WO-04-005 — TabSummary (CMP-04-tab-summary, CMP-04-decisions, CMP-04-activity-log)
 *
 * Server Component: Summary tab for the project workspace.
 *   - Summary + key points (AC-04-003.1).
 *   - Activity log from readActivityLog (AC-04-003.2); "no activity" empty state.
 *   - Decision points from readDecisions (AC-04-003.3); count badge; warning highlight.
 *   - WHEN pending_decisions > 0 → warning treatment (AC-04-004.1); ELSE neutral.
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every interactive/significant element.
 *   - State never conveyed by color alone — icon present for warning (FRD-13 a11y).
 *   - Spanish aria-labels and copy.
 *   - tabular-nums on the pending count badge (FRD-13, AC-13-003).
 *
 * Traceability:
 *   CMP-04-tab-summary → REQ-04-003, REQ-04-004
 *   CMP-04-decisions   → REQ-04-003, REQ-04-004
 *   CMP-04-activity-log → REQ-04-003
 *   IF-04-docs (lib/docs.ts, docs/api.md WO-04-002)
 *
 *   AC-04-003.1 — summary + key points
 *   AC-04-003.2 — activity log from .pandacorp/comms/progress.md
 *   AC-04-003.3 — decision points from .pandacorp/inbox/decisions.md with count badge
 *   AC-04-004.1 — warning treatment when pending_decisions > 0
 */

import type { ActivityLog, DecisionPoint } from "@/lib/docs";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TabSummaryProps {
  /** Project summary text (from .pandacorp/comms/summary.md or status.yaml). */
  summary: string;
  /** Key points list. Empty array → key-points-list is not rendered. */
  keyPoints: string[];
  /** Parsed activity log from readActivityLog() (WO-04-002). */
  activityLog: ActivityLog;
  /** Parsed decision points from readDecisions() (WO-04-002). */
  decisions: DecisionPoint[];
  /**
   * Number of pending (unresolved) decisions.
   * Derived by caller as decisions.filter(dp => !dp.resolved).length.
   * Used for the warning treatment (AC-04-004.1).
   */
  pendingDecisions: number;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 5)",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 8)",
  maxWidth: "72ch",
  color: "var(--color-text, currentColor)",
};

const SECTION_STYLE: React.CSSProperties = {
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  padding: "calc(var(--spacing, 0.25rem) * 5) calc(var(--spacing, 0.25rem) * 6)",
  boxShadow: "var(--shadow-panel, none)",
};

const SECTION_WARNING_STYLE: React.CSSProperties = {
  ...SECTION_STYLE,
  background: "var(--color-warn-bg, oklch(0.97 0.03 80 / 0.25))",
  borderColor: "var(--color-warn, oklch(0.70 0.15 60))",
};

const SECTION_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  marginBottom: "calc(var(--spacing, 0.25rem) * 3)",
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  margin: 0,
};

const SECTION_TITLE_WARNING_STYLE: React.CSSProperties = {
  ...SECTION_TITLE_STYLE,
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  opacity: 1,
};

const COUNT_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.25rem",
  height: "1.25rem",
  padding: "0 calc(var(--spacing, 0.25rem) * 1.5)",
  borderRadius: "99px",
  fontSize: "0.6875rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  background: "var(--color-warn, oklch(0.70 0.15 60))",
  color: "var(--color-on-warn, Canvas)",
};

const SUMMARY_TEXT_STYLE: React.CSSProperties = {
  fontSize: "0.9375rem",
  lineHeight: 1.65,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

const KEY_POINTS_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  margin: "calc(var(--spacing, 0.25rem) * 5) 0 calc(var(--spacing, 0.25rem) * 2)",
};

const KEY_POINTS_LIST_STYLE: React.CSSProperties = {
  margin: 0,
  paddingLeft: "calc(var(--spacing, 0.25rem) * 5)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
};

const KEY_POINT_ITEM_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: 1.55,
  color: "var(--color-text, currentColor)",
};

const DECISION_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  alignItems: "flex-start",
  padding: "calc(var(--spacing, 0.25rem) * 3) 0",
  borderTop: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const DECISION_CONTENT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const DECISION_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  margin: 0,
};

const DECISION_RECOMMENDATION_STYLE: React.CSSProperties = {
  marginTop: "calc(var(--spacing, 0.25rem) * 1.5)",
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
};

const DECISION_REC_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--color-warn, oklch(0.70 0.15 60))",
};

const WARNING_ICON_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  flexShrink: 0,
  marginTop: "0.1em",
  lineHeight: 1,
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  fontStyle: "italic",
  margin: 0,
};

const ACTIVITY_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  alignItems: "flex-start",
  padding: "calc(var(--spacing, 0.25rem) * 2) 0",
  borderTop: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const ACTIVITY_BULLET_STYLE: React.CSSProperties = {
  fontSize: "0.5rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.5,
  flexShrink: 0,
  marginTop: "0.45em",
  lineHeight: 1,
};

const ACTIVITY_TEXT_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: 1.55,
  color: "var(--color-text, currentColor)",
};

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 400,
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  marginLeft: "calc(var(--spacing, 0.25rem) * 1)",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * CMP-04-decisions — decision points block.
 * Warning treatment when pending > 0 (AC-04-004.1).
 * State not conveyed by color alone — warning icon present (FRD-13).
 */
function DecisionsBlock({
  decisions,
  pendingDecisions,
}: {
  decisions: DecisionPoint[];
  pendingDecisions: number;
}): React.JSX.Element {
  const hasPending = pendingDecisions > 0;
  const sectionStyle = hasPending ? SECTION_WARNING_STYLE : SECTION_STYLE;
  const titleStyle = hasPending ? SECTION_TITLE_WARNING_STYLE : SECTION_TITLE_STYLE;

  return (
    <section
      data-testid="decisions-section"
      data-pending={hasPending ? "true" : "false"}
      aria-label="Puntos de decisión"
      style={sectionStyle}
    >
      {/* Header row */}
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={titleStyle}>Puntos de decisión</h3>
        {hasPending && (
          <span
            data-testid="decisions-count-badge"
            role="status"
            title={`${pendingDecisions} pendiente${pendingDecisions !== 1 ? "s" : ""}`}
            style={COUNT_BADGE_STYLE}
          >
            {pendingDecisions}
          </span>
        )}
      </div>

      {/* Content */}
      {decisions.length === 0 ? (
        <p data-testid="decisions-empty" role="status" style={EMPTY_STATE_STYLE}>
          Sin puntos pendientes. Aquí aparecen las cosas que la IA necesita que decidas.
        </p>
      ) : (
        <ul
          data-testid="decisions-list"
          aria-label="Lista de puntos de decisión"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {decisions.map((dp, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable derived index; no reordering
            <li key={idx} data-testid="decision-item" style={DECISION_ITEM_STYLE}>
              {/* Warning icon — ensures state is not color-alone (FRD-13) */}
              {!dp.resolved && (
                <span
                  data-testid="decision-warning-icon"
                  aria-hidden="true"
                  style={WARNING_ICON_STYLE}
                >
                  ⚠
                </span>
              )}
              <div style={DECISION_CONTENT_STYLE}>
                <p style={DECISION_TITLE_STYLE}>{dp.title}</p>
                {dp.recommendation !== undefined && (
                  <p style={DECISION_RECOMMENDATION_STYLE}>
                    <span style={DECISION_REC_LABEL_STYLE}>Recomendación de la IA: </span>
                    {dp.recommendation}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * CMP-04-activity-log — high-level activity log list.
 * "No activity" empty state when entries is [] (AC-04-003.2).
 */
function ActivityLogBlock({ activityLog }: { activityLog: ActivityLog }): React.JSX.Element {
  return (
    <section data-testid="activity-log" aria-label="Registro de actividad" style={SECTION_STYLE}>
      {/* Header */}
      <div style={SECTION_HEADER_STYLE}>
        <h3 style={SECTION_TITLE_STYLE}>Actividad</h3>
        <span style={SUBTITLE_STYLE}>· alto nivel, lo que la IA fue haciendo y decidiendo</span>
      </div>

      {/* Content */}
      {activityLog.entries.length === 0 ? (
        <p data-testid="activity-log-empty" role="status" style={EMPTY_STATE_STYLE}>
          Aún sin actividad registrada.
        </p>
      ) : (
        <ul
          aria-label="Entradas del registro de actividad"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {activityLog.entries.map((entry, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable derived index; no reordering
            <li key={idx} data-testid="activity-log-item" style={ACTIVITY_ITEM_STYLE}>
              {/* Bullet indicator — decorative, aria-hidden */}
              <span aria-hidden="true" style={ACTIVITY_BULLET_STYLE}>
                ●
              </span>
              <span style={ACTIVITY_TEXT_STYLE}>{entry}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// TabSummary — main export (CMP-04-tab-summary)
// ---------------------------------------------------------------------------

/**
 * Summary tab — summary + key points + decision points + activity log.
 *
 * Server Component (no "use client"). All data is pre-fetched server-side via:
 *   readActivityLog(projectPath) → activityLog
 *   readDecisions(projectPath)   → decisions
 * and passed as props. This component is purely presentational.
 */
export function TabSummary({
  summary,
  keyPoints,
  activityLog,
  decisions,
  pendingDecisions,
}: TabSummaryProps): React.JSX.Element {
  return (
    <main data-testid="tab-summary" aria-label="Resumen del proyecto" style={ROOT_STYLE}>
      {/* AC-04-003.1 — summary + key points */}
      <section
        data-testid="summary-section"
        aria-label="Resumen y puntos clave"
        style={SECTION_STYLE}
      >
        <div style={SECTION_HEADER_STYLE}>
          <h2 style={SECTION_TITLE_STYLE}>Resumen</h2>
        </div>
        <p data-testid="summary-text" style={SUMMARY_TEXT_STYLE}>
          {summary}
        </p>
        {keyPoints.length > 0 && (
          <>
            <h3 style={KEY_POINTS_HEADING_STYLE}>Puntos clave</h3>
            <ul
              data-testid="key-points-list"
              aria-label="Puntos clave del proyecto"
              style={KEY_POINTS_LIST_STYLE}
            >
              {keyPoints.map((point, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable derived index; no reordering
                <li key={idx} data-testid="key-point-item" style={KEY_POINT_ITEM_STYLE}>
                  {point}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* AC-04-003.3 + AC-04-004.1 — decision points */}
      <DecisionsBlock decisions={decisions} pendingDecisions={pendingDecisions} />

      {/* AC-04-003.2 — activity log */}
      <ActivityLogBlock activityLog={activityLog} />
    </main>
  );
}
