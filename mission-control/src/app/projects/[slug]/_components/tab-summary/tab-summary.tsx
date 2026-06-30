/**
 * WO-04-005 — TabSummary (CMP-04-tab-summary, CMP-04-decisions, CMP-04-activity-log)
 *
 * Server Component: Summary tab for the project workspace.
 * Re-painted to prototype on FRD-13 foundation primitives (DR-054/056).
 *
 * Components used (components.md, DR-057):
 *   Panel      → section containers (glow="warn" variant for decisions)
 *   CountBadge → pending-decisions pill (tabular-nums, warn tone)
 *   DocHeading → section titles (accent ledge)
 *   CmdRow     → /pandacorp:decide <id> command row (copy-only, never calls Claude)
 *
 * Acceptance criteria:
 *   AC-04-003.1 Summary tab SHALL render the project summary and key points.
 *   AC-04-003.2 It SHALL render the activity log from .pandacorp/comms/progress.md.
 *   AC-04-003.3 It SHALL render decision points with a total count badge, each labeled with
 *         its stable id and a `/pandacorp:decide <id>` command scoped to that decision.
 *   AC-04-004.1 WHEN pending_decisions > 0 → warn treatment (icon + label, not color alone).
 *   No one-click "approve" affordance — answering goes through the real `/pandacorp:decide
 *         <id>` conversation, which shows full context before recording an answer (owner
 *         decision: a pre-baked approve button skips that context).
 *
 * Prototype reference: projResumen() + decisionesBox() + logBox() in prototype/index.html.
 * Traceability: CMP-04-tab-summary → REQ-04-003, REQ-04-004.
 */

import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { CountBadge } from "@/components/core/CountBadge/CountBadge";
import { DocHeading } from "@/components/core/DocHeading/DocHeading";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { Panel } from "@/components/core/Panel/Panel";
import type { ActivityLog, DecisionPoint } from "@/lib/docs/activity";
import type { OverlayFreshnessState } from "@/lib/overlay-freshness/overlay-freshness";
import type { PendingResult } from "@/lib/pendingMerge/pendingMerge";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";
import type { DeployTarget } from "@/lib/status/status";
import { SnapshotPanel } from "../snapshot-panel/snapshot-panel";
import { VersionFreshness } from "../version-freshness/version-freshness";
import { PendingMergeBlock } from "./PendingMergeBlock";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TabSummaryProps {
  /** Project summary text (from .pandacorp/comms/summary.md or status.yaml). */
  summary: string;
  /** Key points list. Empty array → key-points-list is not rendered. */
  keyPoints: string[];
  /** Parsed activity log from readActivityLog() (WO-04-001). */
  activityLog: ActivityLog;
  /** Parsed decision points from readDecisions() (WO-04-001). */
  decisions: DecisionPoint[];
  /**
   * Number of pending (unresolved) decisions.
   * Derived by caller as decisions.filter(dp => !dp.resolved).length.
   * Used for the warning treatment (AC-04-004.1).
   */
  pendingDecisions: number;
  /** Project slug — for the snapshot panel's worktree command (WS-2, prototype projResumen). */
  slug?: string;
  /** FRD-14 snapshot; null/absent when there is no last_green_sha (panel omitted). */
  snapshot?: SnapshotInfo | null;
  /** Deploy target (DR-085) — internal (in-house tool) vs external (Vercel/AWS). */
  deployTarget?: DeployTarget;
  /** Live URL of the deployment (DR-085). When present, a clickable "Versión desplegada" row shows. */
  deployUrl?: string;
  /**
   * FRD-20 overlay-freshness verdict (getOverlayFreshness). Renders a badge at the top of
   * the tab: "behind" → upgrade prompt, "up-to-date" → quiet confirmation, "unknown" → nothing.
   * Absent → no badge.
   */
  overlayFreshness?: OverlayFreshnessState;
  /** FRD-21 per-project pending-merge state (readPending(projectPath)); renders a section after the
   * decision points, or is omitted when absent. */
  pendingMerge?: PendingResult;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  padding: "14px 16px",
};

// Deployment row — mirrors the snapshot (green-SHA) row, but for the live deployment.
const DEPLOY_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "10px",
  paddingTop: "10px",
  borderTop: "0.5px solid var(--color-border)",
  fontSize: "13px",
  color: "var(--color-text2, var(--color-text))",
};

const DEPLOY_ICON_STYLE: React.CSSProperties = {
  fontSize: "15px",
  color: "var(--color-ok)",
  flexShrink: 0,
};

const DEPLOY_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 500,
};

const DEPLOY_LINK_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "12px",
  color: "var(--color-accent-text, var(--color-accent))",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const KEY_POINTS_HEADING_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--color-text)",
  margin: "14px 0 6px",
};

const KEY_POINTS_LIST_STYLE: React.CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const KEY_POINT_ITEM_STYLE: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.55,
  color: "var(--color-text)",
};

// Decisions section header
const DECISIONS_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  marginBottom: "5px",
};

const DECISIONS_TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text2, var(--color-text-secondary, var(--color-text)))",
  margin: 0,
};

const DECISIONS_SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  margin: "5px 0 0",
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  margin: "6px 0 0",
  fontStyle: "italic",
};

// Decision card (warn-bg treatment) — prototype decisionesBox()
const DECISION_CARD_STYLE: React.CSSProperties = {
  background: "var(--color-warn-bg, var(--color-status-warn-bg, #3a2e18))",
  borderRadius: "var(--radius-sm, 8px)",
  padding: "11px 13px",
  marginTop: "8px",
};

const DECISION_INNER_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "9px",
  alignItems: "flex-start",
};

const DECISION_WARN_ICON_STYLE: React.CSSProperties = {
  fontSize: "16px",
  color: "var(--color-warn, var(--color-status-warn, #ebb25f))",
  marginTop: "1px",
  flexShrink: 0,
  lineHeight: 1,
};

const DECISION_CONTENT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const DECISION_TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-warn, var(--color-status-warn, #ebb25f))",
  fontWeight: 500,
  margin: 0,
};

const DECISION_REC_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-warn, var(--color-status-warn, #ebb25f))",
  marginTop: "6px",
};

const DECISION_REC_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 500,
};

/** Small monospace id label so the owner can SEE which decision a copied command targets. */
const DECISION_ID_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  fontWeight: 400,
};

/** "hace N días" age hint next to a pending decision's id — same muted token, prose (not mono). */
const DECISION_AGE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
};

/** "Obsoleta" tag on a resolved-row decision whose status is "obsolete" (not actually answered). */
const DECISION_OBSOLETE_TAG_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  border: "0.5px solid var(--color-border)",
  borderRadius: "4px",
  padding: "0 4px",
  marginRight: "6px",
};

const DECISION_ACTIONS_STYLE: React.CSSProperties = {
  marginTop: "9px",
  paddingTop: "9px",
  borderTop:
    "0.5px solid color-mix(in srgb, var(--color-warn, var(--color-status-warn, #ebb25f)) 25%, transparent)",
};

const DECISION_ACTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-warn, var(--color-status-warn, #ebb25f))",
  marginBottom: "4px",
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

// Activity log
const ACTIVITY_LOG_TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text2, var(--color-text-secondary, var(--color-text)))",
  margin: "0 0 6px",
};

const ACTIVITY_SUBTITLE_STYLE: React.CSSProperties = {
  fontWeight: 400,
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
};

const ACTIVITY_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "9px",
  alignItems: "flex-start",
  padding: "7px 0",
  borderTop: "0.5px solid var(--color-border)",
};

const ACTIVITY_ICON_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  marginTop: "3px",
  flexShrink: 0,
  lineHeight: 1,
};

const ACTIVITY_TEXT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: "13px",
  lineHeight: 1.55,
  color: "var(--color-text2, var(--color-text-secondary, var(--color-text)))",
};

/** Recent-activity cap: progress.md can hold thousands of lines — the summary shows only the most recent. */
const ACTIVITY_MAX = 15;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * CMP-04-decisions — decision points block.
 *
 * Prototype: decisionesBox(i) → warn-bg cards, AI recommendation,
 * /pandacorp:decide command row, "Aprobar la recomendación" copy button.
 *
 * Warning treatment when pending > 0 (AC-04-004.1).
 * State NOT conveyed by color alone — ti-alert-triangle icon present (FRD-13).
 * "Aprobar" button copies the command only — never writes or calls Claude.
 */
function DecisionsBlock({
  decisions,
  pendingDecisions,
}: {
  decisions: DecisionPoint[];
  pendingDecisions: number;
}): React.JSX.Element {
  const hasPending = pendingDecisions > 0;

  // Empty state: no decisions at all
  if (decisions.length === 0) {
    return (
      <Panel>
        <section
          data-testid="decisions-section"
          data-pending="false"
          aria-label="Puntos de decisión"
        >
          <p style={DECISIONS_TITLE_STYLE}>Puntos de decisión</p>
          <p data-testid="decisions-empty" role="status" style={EMPTY_STATE_STYLE}>
            Sin puntos pendientes. Aquí aparecen las cosas que la IA necesita que decidas, con su
            recomendación.
          </p>
        </section>
      </Panel>
    );
  }

  return (
    <Panel glow={hasPending ? "warn" : undefined}>
      <section
        data-testid="decisions-section"
        data-pending={hasPending ? "true" : "false"}
        aria-label="Puntos de decisión"
      >
        {/* Header row */}
        <div style={DECISIONS_HEADER_STYLE}>
          <p style={DECISIONS_TITLE_STYLE}>Puntos de decisión</p>
          {hasPending && (
            <span data-testid="decisions-count-badge" role="status">
              <CountBadge count={pendingDecisions} tone="warn" />
            </span>
          )}
        </div>

        {hasPending && (
          <p style={DECISIONS_SUBTITLE_STYLE}>
            La IA necesita que decidas esto. Cada tarjeta trae su propio comando{" "}
            <code
              style={{
                fontFamily: "var(--font-mono, monospace)",
                background: "var(--color-panel)",
                padding: "1px 4px",
                borderRadius: "4px",
              }}
            >
              /pandacorp:decide &lt;id&gt;
            </code>{" "}
            — corre ESE comando en la carpeta del proyecto y responde solo sobre esa decisión.
          </p>
        )}

        {/* Decision cards */}
        <ul
          data-testid="decisions-list"
          aria-label="Lista de puntos de decisión"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {decisions.map((dp, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable derived index; no reordering
            <li key={idx} data-testid="decision-item">
              {dp.resolved ? (
                // Resolved or obsolete decision: subdued, no warn styling. The status
                // label distinguishes "actually decided" from "dropped, no answer given".
                <div
                  style={{
                    padding: "7px 0",
                    borderTop: idx > 0 ? "0.5px solid var(--color-border)" : undefined,
                  }}
                >
                  <span
                    data-testid="decision-id"
                    style={{ ...DECISION_ID_STYLE, marginRight: "6px" }}
                  >
                    {dp.id}
                  </span>
                  {dp.status === "obsolete" && (
                    <span data-testid="decision-obsolete-tag" style={DECISION_OBSOLETE_TAG_STYLE}>
                      Obsoleta
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--color-text2, var(--color-text-secondary, var(--color-text)))",
                    }}
                  >
                    {dp.title}
                  </span>
                </div>
              ) : (
                // Pending decision: warn-bg card (prototype decisionesBox())
                <div data-testid="decision-warn-panel" style={DECISION_CARD_STYLE}>
                  {/* Icon + title row — icon ensures state is not color-alone (FRD-13) */}
                  <div style={DECISION_INNER_STYLE}>
                    <span
                      data-testid="decision-warning-icon"
                      aria-hidden="true"
                      style={DECISION_WARN_ICON_STYLE}
                      className="ti ti-alert-triangle"
                    />
                    <div style={DECISION_CONTENT_STYLE}>
                      <span data-testid="decision-id" style={DECISION_ID_STYLE}>
                        {dp.id}
                      </span>
                      {decisionAgeLabel(dp.date) !== null && (
                        <span data-testid="decision-age" style={DECISION_AGE_STYLE}>
                          {" "}
                          · {decisionAgeLabel(dp.date)}
                        </span>
                      )}
                      <p style={DECISION_TITLE_STYLE}>{dp.title}</p>
                      {dp.recommendation !== undefined && (
                        <p style={DECISION_REC_STYLE}>
                          <span style={DECISION_REC_LABEL_STYLE}>Recomendación de la IA: </span>
                          {dp.recommendation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions block — /pandacorp:decide <id> command */}
                  <div style={DECISION_ACTIONS_STYLE}>
                    <p style={DECISION_ACTION_LABEL_STYLE}>
                      <span
                        aria-hidden="true"
                        className="ti ti-arrow-back-up"
                        style={{ fontSize: "12px" }}
                      />
                      Para responder a ESTA decisión, abre Claude Code en la carpeta del proyecto y
                      corre:
                    </p>
                    <CmdRow command={`/pandacorp:decide ${dp.id}`} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Panel>
  );
}

/**
 * "hace N días" age label derived from a decision's `date` (the heading's `YYYY-MM-DD`
 * prefix) — pure presentational hint so the owner can judge whether an old pending
 * decision is still relevant before answering it. Returns `null` for a legacy decision
 * (no date), an unparseable date, or a future date (never invents an age).
 */
function decisionAgeLabel(date: string | null): string | null {
  if (date === null) return null;
  const then = Date.parse(date);
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

/**
 * CMP-04-activity-log — high-level activity log list.
 *
 * Prototype: logBox(i) → dotted-rule rows of high-level activity.
 * "No activity" empty state when entries is [] (AC-04-003.2).
 */
function ActivityLogBlock({ activityLog }: { activityLog: ActivityLog }): React.JSX.Element {
  // progress.md can hold thousands of lines; show a RECENT feed (newest first), not the
  // whole history — rendering every entry made the panel grow unbounded (~40k px).
  const total = activityLog.entries.length;
  const recent = activityLog.entries.slice(-ACTIVITY_MAX).reverse();
  return (
    <Panel>
      <section data-testid="activity-log" aria-label="Registro de actividad">
        <p style={ACTIVITY_LOG_TITLE_STYLE}>
          Actividad{" "}
          <span style={ACTIVITY_SUBTITLE_STYLE}>
            · lo más reciente{total > ACTIVITY_MAX ? ` · últimas ${ACTIVITY_MAX} de ${total}` : ""}
          </span>
        </p>

        {recent.length === 0 ? (
          <p data-testid="activity-log-empty" role="status" style={EMPTY_STATE_STYLE}>
            Aún sin actividad registrada.
          </p>
        ) : (
          <ul
            aria-label="Entradas del registro de actividad"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {recent.map((entry, idx) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: stable derived index; no reordering
                key={idx}
                data-testid="activity-log-item"
                className="pc-activity-entry"
                style={ACTIVITY_ROW_STYLE}
              >
                {/* Icon indicator — decorative, aria-hidden (prototype: ti-point-filled) */}
                <span
                  aria-hidden="true"
                  className="ti ti-point-filled"
                  style={ACTIVITY_ICON_STYLE}
                />
                {/* Entries carry markdown (bold/inline-code/links) — render through the shared
                    <Markdown> so **bold** etc. show styled, not as raw asterisks. The
                    .pc-activity-entry rule (globals.css) collapses the block margins so a
                    single-line entry stays tight in the row. */}
                <Markdown style={ACTIVITY_TEXT_STYLE}>{entry}</Markdown>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}

/**
 * Deployment row (DR-085) — shown inside the Resumen panel when a live URL is known.
 *
 * Mirrors the snapshot (last-verified-commit) row, but for the running deployment: a
 * "Versión desplegada" label, the internal/external target, and the URL as a clickable
 * link that opens in a new tab. Omitted entirely when there is no deployUrl, so a project
 * that isn't launched yet shows nothing here.
 *
 * State is carried by an icon + text (not color alone) — a11y.
 */
function DeployRow({
  deployTarget,
  deployUrl,
}: {
  deployTarget?: DeployTarget;
  deployUrl?: string;
}): React.JSX.Element | null {
  if (deployUrl === undefined || deployUrl.trim() === "") {
    return null;
  }
  const targetLabel = deployTarget === "external" ? "externo" : "interno";
  return (
    <p data-testid="deploy-row" style={DEPLOY_ROW_STYLE}>
      <i className="ti ti-rocket" aria-hidden="true" style={DEPLOY_ICON_STYLE} />
      <span style={DEPLOY_LABEL_STYLE}>Versión desplegada</span>
      {deployTarget !== undefined && (
        <span data-testid="deploy-row-target">
          <Chip tone="info">{targetLabel}</Chip>
        </span>
      )}
      <a
        data-testid="deploy-row-link"
        href={deployUrl}
        target="_blank"
        rel="noreferrer noopener"
        style={DEPLOY_LINK_STYLE}
      >
        {deployUrl}
      </a>
    </p>
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
 *
 * Re-painted to prototype projResumen() on FRD-13 foundation (WO-04-005, DR-054/056).
 */
export function TabSummary({
  summary,
  keyPoints,
  activityLog,
  decisions,
  pendingDecisions,
  slug = "",
  snapshot = null,
  deployTarget,
  deployUrl,
  overlayFreshness,
  pendingMerge,
}: TabSummaryProps): React.JSX.Element {
  return (
    <main data-testid="tab-summary" aria-label="Resumen del proyecto" style={ROOT_STYLE}>
      {/* FRD-20 — overlay-freshness badge: "al día con la fábrica" or the /pandacorp:upgrade
          prompt when this project's overlay is behind. Omitted entirely on the unknown verdict. */}
      {overlayFreshness !== undefined && <VersionFreshness state={overlayFreshness} />}

      {/* AC-04-003.1 — summary + key points (prototype: projResumen() doc .panel).
          The summary is the idea-card markdown body (the SAME content the board card-detail
          shows in Documentos → Resumen), rendered through the shared <Markdown> renderer so
          its headings/lists/bold show with the app's document styling — not as raw text. */}
      <Panel>
        <div data-testid="summary-section" className="doc">
          <DocHeading title="Resumen" level={2} />
          <Markdown data-testid="summary-text">{summary}</Markdown>
          <DeployRow deployTarget={deployTarget} deployUrl={deployUrl} />
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
        </div>
      </Panel>

      {/* FRD-14 snapshot panel — inside Summary (WS-2, prototype projResumen); omitted when null */}
      <SnapshotPanel slug={slug} snapshot={snapshot} />

      {/* AC-04-003.3 + AC-04-004.1 — decision points (prototype: decisionesBox()) */}
      <DecisionsBlock decisions={decisions} pendingDecisions={pendingDecisions} />

      {/* FRD-21 — pending-merge block (right after the decision point): this project's un-merged worktrees */}
      {pendingMerge !== undefined && <PendingMergeBlock result={pendingMerge} />}

      {/* AC-04-003.2 — activity log (prototype: logBox()) */}
      <ActivityLogBlock activityLog={activityLog} />
    </main>
  );
}
