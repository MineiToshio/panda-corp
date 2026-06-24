/**
 * Observability Timeline v2 — TimelineView (FRD-12, CMP-12-timeline).
 *
 * Honest, durable timeline driven by the build engine's `.pandacorp/track.jsonl`
 * (read server-side into a BuildTimeline). Three modes:
 *   - empty:      no build data yet — an honest status, no fake bars.
 *   - structural: a historical build with no recorded durations — FRD rows with
 *                 their work orders as a compact state list (NO duration bars).
 *   - durations:  real wall-clock bars — FRD rows with nested WO bars positioned by
 *                 (startMs - buildStartMs) over the total span, a review segment per
 *                 FRD, and a "saltar al primer error" note (AC-12-003.2).
 *
 * Design rules (FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - State by icon + text + color (never color alone).
 *   - tabular-nums on all numeric values.
 *   - data-testid on every significant element.
 *
 * Traceability:
 *   CMP-12-timeline → REQ-12-003 → AC-12-003.1, AC-12-003.2
 */

import type { BuildTimeline, TLFrd, TLState, TLWorkOrder } from "@/lib/build-track/build-track";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TimelineViewProps {
  /** The durable build timeline read from `.pandacorp/track.jsonl` (or its fallbacks). */
  timeline: BuildTimeline;
}

// ---------------------------------------------------------------------------
// State → icon / color / label (state is never conveyed by color alone)
// ---------------------------------------------------------------------------

const WO_ICON: Record<TLState, string> = {
  done: "ti ti-circle-check",
  fail: "ti ti-alert-triangle",
  in_progress: "ti ti-loader-2",
  review: "ti ti-eye",
  todo: "ti ti-circle",
};

const WO_COLOR_VAR: Record<TLState, string> = {
  done: "var(--color-ok)",
  fail: "var(--color-danger)",
  in_progress: "var(--color-accent)",
  review: "var(--color-info)",
  todo: "var(--color-border-strong)",
};

const STATE_LABEL: Record<TLState, string> = {
  done: "Hecho",
  fail: "Falló",
  in_progress: "En curso",
  review: "Revisión",
  todo: "Pendiente",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a percent into [0, 100]. */
function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Position (left %) of a moment within the build span. */
function leftPercent(ms: number | null, buildStartMs: number | null, spanMs: number): number {
  if (ms === null || buildStartMs === null || spanMs <= 0) return 0;
  return clampPct(((ms - buildStartMs) / spanMs) * 100);
}

/** Width (%) of a span within the build span. */
function widthPercent(durationMin: number | null, spanMs: number): number {
  if (durationMin === null || spanMs <= 0) return 0;
  return clampPct(((durationMin * 60_000) / spanMs) * 100);
}

/** Total build span in ms (max FRD end − buildStart), ≥1. */
function buildSpanMs(timeline: BuildTimeline): number {
  const { buildStartMs } = timeline;
  if (buildStartMs === null) return 1;
  let maxEnd = buildStartMs;
  for (const frd of timeline.frds) {
    if (frd.endMs !== null && frd.endMs > maxEnd) maxEnd = frd.endMs;
    if (frd.review?.endMs != null && frd.review.endMs > maxEnd) maxEnd = frd.review.endMs;
    for (const wo of frd.workOrders) {
      if (wo.endMs !== null && wo.endMs > maxEnd) maxEnd = wo.endMs;
    }
  }
  return Math.max(1, maxEnd - buildStartMs);
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function EmptyTimeline(): React.JSX.Element {
  return (
    <div
      data-testid="timeline-gantt-empty"
      role="status"
      style={{
        padding: "32px 16px",
        textAlign: "center",
        color: "var(--color-text3)",
        fontSize: "13px",
      }}
    >
      Sin datos de build todavía — esta vista se llena durante la construcción.
    </div>
  );
}

/** A small state chip: icon + colored label (a11y — never color alone). */
function StateChip({ state }: { state: TLState }): React.JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        color: WO_COLOR_VAR[state],
        fontWeight: 500,
      }}
    >
      <i className={WO_ICON[state]} aria-hidden="true" style={{ fontSize: "12px" }} />
      {STATE_LABEL[state]}
    </span>
  );
}

/** Structural mode — FRD rows, WOs as a compact state list. No durations, no bars. */
function StructuralTimeline({ timeline }: { timeline: BuildTimeline }): React.JSX.Element {
  return (
    <div data-testid="timeline-gantt" data-mode="structural" style={{ width: "100%" }}>
      <div
        data-testid="timeline-gantt-structural-banner"
        role="note"
        style={{
          fontSize: "11px",
          color: "var(--color-text2)",
          background: "var(--color-card2)",
          border: "0.5px solid var(--color-border)",
          borderRadius: "var(--radius-md, 8px)",
          padding: "8px 10px",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <i
          className="ti ti-history"
          aria-hidden="true"
          style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
        />
        Histórico — estructura sin duraciones (se llena con duraciones reales en los builds nuevos).
      </div>

      {timeline.frds.map((frd) => (
        <FrdHeader key={frd.id} frd={frd}>
          <ul
            data-testid={`timeline-gantt-frd-wos-${frd.id}`}
            style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}
          >
            {frd.workOrders.map((wo) => (
              <li
                key={wo.id}
                data-testid={`timeline-gantt-wo-${wo.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 0 4px 14px",
                  borderTop: "0.5px solid var(--color-border)",
                }}
              >
                <span
                  data-testid={`timeline-gantt-label-${wo.id}`}
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    fontSize: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {wo.title}
                </span>
                <span
                  data-testid={`timeline-gantt-meta-${wo.id}`}
                  style={{
                    fontSize: "9px",
                    color: "var(--color-text3)",
                    fontFamily: "ui-monospace, monospace",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {wo.id}
                </span>
                <span data-testid={`timeline-gantt-state-${wo.id}`} style={{ flexShrink: 0 }}>
                  <StateChip state={wo.state} />
                </span>
              </li>
            ))}
          </ul>
        </FrdHeader>
      ))}
    </div>
  );
}

/** Shared FRD heading panel (label + rollup state) wrapping its children. */
function FrdHeader({
  frd,
  children,
}: {
  frd: TLFrd;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-testid={`timeline-gantt-frd-${frd.id}`}
      style={{
        marginBottom: "14px",
        background: "var(--color-panel)",
        border: "0.5px solid var(--color-border)",
        borderRadius: "var(--radius-md, 8px)",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <i
            data-testid={`timeline-gantt-frd-icon-${frd.id}`}
            className={WO_ICON[frd.state]}
            aria-hidden="true"
            style={{ fontSize: "13px", color: WO_COLOR_VAR[frd.state], flexShrink: 0 }}
          />
          <span style={{ fontSize: "12px", fontWeight: 600 }}>{frd.label}</span>
          <span
            style={{
              fontSize: "9px",
              color: "var(--color-text3)",
              fontFamily: "ui-monospace, monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {frd.id}
          </span>
        </div>
        <StateChip state={frd.state} />
      </div>
      {children}
    </div>
  );
}

/** A single WO bar row positioned by real wall-clock within the build span. */
function WoBarRow({
  wo,
  buildStartMs,
  spanMs,
}: {
  wo: TLWorkOrder;
  buildStartMs: number | null;
  spanMs: number;
}): React.JSX.Element {
  const left = leftPercent(wo.startMs, buildStartMs, spanMs);
  const width = widthPercent(wo.durationMin, spanMs);
  const color = WO_COLOR_VAR[wo.state];

  return (
    <div
      data-testid={`timeline-gantt-wo-${wo.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: "8px",
        alignItems: "center",
        marginTop: "6px",
      }}
    >
      {/* Label column */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <i
            data-testid={`timeline-gantt-icon-${wo.id}`}
            className={WO_ICON[wo.state]}
            aria-hidden="true"
            style={{ fontSize: "12px", color, flexShrink: 0 }}
          />
          <span
            data-testid={`timeline-gantt-label-${wo.id}`}
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {wo.title}
          </span>
        </div>
        <div
          data-testid={`timeline-gantt-meta-${wo.id}`}
          style={{
            fontSize: "9px",
            color: "var(--color-text3)",
            fontFamily: "ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {wo.id} · {STATE_LABEL[wo.state]}
          {wo.attempts > 1 ? ` · ${wo.attempts} intentos` : ""}
        </div>
      </div>

      {/* Bar track */}
      <div
        style={{
          position: "relative",
          height: "22px",
          background: "var(--color-card2)",
          borderRadius: "5px",
          border: "0.5px solid var(--color-border)",
        }}
      >
        <div
          data-testid={`timeline-gantt-bar-${wo.id}`}
          title={
            wo.durationMin !== null
              ? `${wo.title} · ${wo.durationMin} min`
              : `${wo.title} · ${STATE_LABEL[wo.state]}`
          }
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${left}%`,
            width: `${width}%`,
            minWidth: "34px",
            background: color,
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
          {wo.durationMin !== null ? `${wo.durationMin}m` : STATE_LABEL[wo.state]}
        </div>
      </div>
    </div>
  );
}

/** The review segment bar for an FRD, positioned at the end of its span. */
function ReviewBarRow({
  frd,
  buildStartMs,
  spanMs,
}: {
  frd: TLFrd;
  buildStartMs: number | null;
  spanMs: number;
}): React.JSX.Element | null {
  const review = frd.review;
  if (review === null || review.startMs === null) return null;

  const left = leftPercent(review.startMs, buildStartMs, spanMs);
  const width = widthPercent(review.durationMin, spanMs);
  const verdictState: TLState = review.verdict === "reject" ? "fail" : "review";
  const color = WO_COLOR_VAR[verdictState];
  const verdictLabel =
    review.verdict === "pass" ? "pass" : review.verdict === "reject" ? "reject" : "—";

  return (
    <div
      data-testid={`timeline-gantt-review-${frd.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: "8px",
        alignItems: "center",
        marginTop: "6px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "var(--color-text3)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          paddingLeft: "14px",
        }}
      >
        <i className="ti ti-eye" aria-hidden="true" style={{ fontSize: "12px", color }} />
        Revisión · {verdictLabel}
      </div>
      <div style={{ position: "relative", height: "14px" }}>
        <div
          title={
            review.durationMin !== null
              ? `Revisión · ${review.durationMin} min · ${verdictLabel}`
              : `Revisión · ${verdictLabel}`
          }
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${left}%`,
            width: `${width}%`,
            minWidth: "10px",
            background: color,
            opacity: 0.7,
            borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
}

/** Find the first failed WO across all FRDs (in render order) for the jump note. */
function findFirstError(timeline: BuildTimeline): TLWorkOrder | undefined {
  for (const frd of timeline.frds) {
    const fail = frd.workOrders.find((w) => w.state === "fail");
    if (fail !== undefined) return fail;
  }
  return undefined;
}

/** Durations mode — FRD rows with nested WO bars + a review segment per FRD. */
function DurationsTimeline({ timeline }: { timeline: BuildTimeline }): React.JSX.Element {
  const spanMs = buildSpanMs(timeline);
  const totalMin = Math.max(1, Math.round(spanMs / 60_000));
  const firstErr = findFirstError(timeline);

  return (
    <div
      data-testid="timeline-gantt"
      data-mode={timeline.estimated ? "estimated" : "durations"}
      style={{ width: "100%" }}
    >
      {/* Estimated banner (git-reconstructed timeline — durations are approximate, AC-12-003.1a) */}
      {timeline.estimated && (
        <div
          data-testid="timeline-gantt-estimated-banner"
          role="note"
          style={{
            fontSize: "11px",
            color: "var(--color-text2)",
            background: "var(--color-card2)",
            border: "0.5px solid var(--color-border)",
            borderRadius: "var(--radius-md, 8px)",
            padding: "8px 10px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <i
            className="ti ti-history"
            aria-hidden="true"
            style={{ fontSize: "14px", color: "var(--color-accent-text)" }}
          />
          ≈ Tiempos estimados (reconstruidos de git): el orden, las fechas y los resultados son
          reales; las duraciones son aproximadas (tiempo entre commits, acotado).
        </div>
      )}

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
        {timeline.estimated
          ? "FRDs → work orders, en su orden real. La duración de cada barra es estimada."
          : "FRDs → work orders, por duración real del build. La barra de revisión cierra cada FRD."}
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
          Saltar al primer error: <strong>{firstErr.id}</strong> ({firstErr.title}) — la barra roja
          marca dónde se rompió la cadena.
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
          <span>{Math.round(totalMin / 2)}</span>
          <span>{totalMin} min</span>
        </div>
      </div>

      {/* FRD rows with nested WO bars + review segment */}
      {timeline.frds.map((frd) => (
        <FrdHeader key={frd.id} frd={frd}>
          {frd.workOrders.map((wo) => (
            <WoBarRow key={wo.id} wo={wo} buildStartMs={timeline.buildStartMs} spanMs={spanMs} />
          ))}
          <ReviewBarRow frd={frd} buildStartMs={timeline.buildStartMs} spanMs={spanMs} />
        </FrdHeader>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineView
// ---------------------------------------------------------------------------

/**
 * TimelineView v2 — honest, durable build timeline.
 * Pure presentational: receives a pre-computed BuildTimeline, no I/O.
 */
export function TimelineView({ timeline }: TimelineViewProps): React.JSX.Element {
  if (timeline.source === "empty" || timeline.frds.length === 0) {
    return <EmptyTimeline />;
  }
  if (!timeline.hasDurations) {
    return <StructuralTimeline timeline={timeline} />;
  }
  return <DurationsTimeline timeline={timeline} />;
}
