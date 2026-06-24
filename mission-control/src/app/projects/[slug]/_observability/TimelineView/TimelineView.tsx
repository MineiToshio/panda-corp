/**
 * Observability Timeline v2 — TimelineView (FRD-12, CMP-12-timeline).
 *
 * Honest, durable timeline driven by the build engine's `.pandacorp/track.jsonl`
 * (read server-side into a BuildTimeline). Three modes:
 *   - empty:      no build data yet — an honest status, no fake bars.
 *   - structural: a historical build with no recorded durations — FRD rows with
 *                 their work orders as a compact state list (NO duration bars).
 *   - durations:  FRD ▸ work order. The FRD is the top level (collapsible, with a
 *                 summary bar = the sum of its work orders); each work order nests
 *                 under it as a smaller, lighter bar whose WIDTH IS PROPORTIONAL to
 *                 its duration (per-FRD local axis, so 8m and 23m differ visibly).
 *                 The same layout serves the estimated (git-reconstructed) timeline.
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

/** Shared two-column grid (label column · bar track) so FRD + WO bars line up vertically. */
const ROW_GRID = "minmax(0, 240px) 1fr";

/** Collapse chrome for the <details> FRD rows: hide the native marker, rotate our chevron. */
const FRD_DETAILS_CSS =
  ".tl-frd>summary{list-style:none;cursor:pointer}" +
  ".tl-frd>summary::-webkit-details-marker{display:none}" +
  ".tl-frd .tl-chevron{transition:transform .15s ease}" +
  ".tl-frd[open]>summary .tl-chevron{transform:rotate(90deg)}";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a percent into [0, 100]. */
function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Prettify an FRD slug into a readable name: "frd-01-data-reading" → "Data reading". */
function prettyFrdName(slug: string): string {
  const rest = slug
    .replace(/^frd-\d+-?/i, "")
    .replace(/-/g, " ")
    .trim();
  if (rest === "") return "";
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Sum of an FRD's work-order durations (minutes; unknown durations count as 0). */
function woSum(frd: TLFrd): number {
  return frd.workOrders.reduce((acc, w) => acc + (w.durationMin ?? 0), 0);
}

/** Total minutes laid out in an FRD row: its work orders plus the review tail. */
function frdAxisTotal(frd: TLFrd): number {
  return woSum(frd) + (frd.review?.durationMin ?? 0);
}

/** Find the first failed WO across all FRDs (in render order) for the jump note. */
function findFirstError(timeline: BuildTimeline): TLWorkOrder | undefined {
  for (const frd of timeline.frds) {
    const fail = frd.workOrders.find((w) => w.state === "fail");
    if (fail !== undefined) return fail;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Small shared pieces
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

// ---------------------------------------------------------------------------
// Structural mode — FRD rows, WOs as a compact state list. No durations, no bars.
// ---------------------------------------------------------------------------

/** FRD heading panel (label + name + rollup state) wrapping its children. */
function FrdHeader({
  frd,
  children,
}: {
  frd: TLFrd;
  children: React.ReactNode;
}): React.JSX.Element {
  const name = prettyFrdName(frd.id);
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
          <span style={{ fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>{frd.label}</span>
          {name !== "" && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-text2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              · {name}
            </span>
          )}
        </div>
        <StateChip state={frd.state} />
      </div>
      {children}
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Durations / estimated mode — FRD ▸ work order, bar width ∝ duration
// ---------------------------------------------------------------------------

/** A nested work-order row: a lighter, smaller bar positioned on the FRD-local axis. */
function WoNestedRow({
  wo,
  leftPct,
  widthPct,
}: {
  wo: TLWorkOrder;
  leftPct: number;
  widthPct: number;
}): React.JSX.Element {
  const color = WO_COLOR_VAR[wo.state];
  const durPrefix = wo.durationMin !== null ? `${wo.durationMin}m · ` : "";
  return (
    <div
      data-testid={`timeline-gantt-wo-${wo.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: ROW_GRID,
        gap: "8px",
        alignItems: "center",
        marginTop: "4px",
      }}
    >
      <div style={{ minWidth: 0, paddingLeft: "16px" }}>
        <div
          style={{
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true" style={{ color: "var(--color-text3)", flexShrink: 0 }}>
            ↳
          </span>
          <i
            data-testid={`timeline-gantt-icon-${wo.id}`}
            className={WO_ICON[wo.state]}
            aria-hidden="true"
            style={{ fontSize: "11px", color, flexShrink: 0 }}
          />
          <span
            data-testid={`timeline-gantt-label-${wo.id}`}
            title={wo.title}
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
            paddingLeft: "16px",
          }}
        >
          {durPrefix}
          {STATE_LABEL[wo.state]}
          {wo.attempts > 1 ? ` · ${wo.attempts} intentos` : ""}
        </div>
      </div>

      <div style={{ position: "relative", height: "12px" }}>
        <div
          data-testid={`timeline-gantt-bar-${wo.id}`}
          title={wo.durationMin !== null ? `${wo.title} · ${wo.durationMin} min` : wo.title}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            minWidth: "3px",
            background: color,
            opacity: 0.55,
            borderRadius: "3px",
          }}
        />
      </div>
    </div>
  );
}

/** The FRD's review/test phase as a nested tail segment on the local axis. */
function ReviewNestedRow({
  frdId,
  verdict,
  durationMin,
  leftPct,
  widthPct,
}: {
  frdId: string;
  verdict: "pass" | "reject" | null;
  durationMin: number;
  leftPct: number;
  widthPct: number;
}): React.JSX.Element {
  const verdictState: TLState = verdict === "reject" ? "fail" : "review";
  const color = WO_COLOR_VAR[verdictState];
  const verdictLabel = verdict === "pass" ? "pass" : verdict === "reject" ? "reject" : "—";
  return (
    <div
      data-testid={`timeline-gantt-review-${frdId}`}
      style={{
        display: "grid",
        gridTemplateColumns: ROW_GRID,
        gap: "8px",
        alignItems: "center",
        marginTop: "4px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "var(--color-text3)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          paddingLeft: "16px",
        }}
      >
        <span aria-hidden="true" style={{ flexShrink: 0 }}>
          ↳
        </span>
        <i className="ti ti-eye" aria-hidden="true" style={{ fontSize: "11px", color }} />
        Revisión · {verdictLabel} · {durationMin}m
      </div>
      <div style={{ position: "relative", height: "12px" }}>
        <div
          title={`Revisión · ${durationMin} min · ${verdictLabel}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            minWidth: "3px",
            background: color,
            opacity: 0.7,
            borderRadius: "3px",
          }}
        />
      </div>
    </div>
  );
}

/** One collapsible FRD: a summary magnitude bar (Σ of its WOs) + nested WO bars. */
function FrdDetails({ frd, maxAxis }: { frd: TLFrd; maxAxis: number }): React.JSX.Element {
  const total = woSum(frd);
  // ONE shared axis across all FRDs (= the largest FRD's total). The FRD's summary bar then
  // equals exactly the sum of its work-order bars laid end-to-end, bars stay comparable across
  // FRDs, and width stays proportional to duration — the fix for the old global-cumulative axis
  // that squished every bar onto the same min-width.
  const frdBarPct = clampPct((total / maxAxis) * 100);
  const name = prettyFrdName(frd.id);

  // Lay the WOs out cumulatively on the shared axis (width ∝ duration).
  let cursor = 0;
  const woRows = frd.workOrders.map((wo) => {
    const dur = wo.durationMin ?? 0;
    const leftPct = clampPct((cursor / maxAxis) * 100);
    const widthPct = clampPct((dur / maxAxis) * 100);
    cursor += dur;
    return <WoNestedRow key={wo.id} wo={wo} leftPct={leftPct} widthPct={widthPct} />;
  });

  const review = frd.review;
  const reviewRow =
    review !== null && review.durationMin !== null ? (
      <ReviewNestedRow
        frdId={frd.id}
        verdict={review.verdict}
        durationMin={review.durationMin}
        leftPct={clampPct((total / maxAxis) * 100)}
        widthPct={clampPct((review.durationMin / maxAxis) * 100)}
      />
    ) : null;

  return (
    <details
      className="tl-frd"
      open
      data-testid={`timeline-gantt-frd-${frd.id}`}
      style={{ marginBottom: "14px" }}
    >
      <summary
        style={{
          display: "grid",
          gridTemplateColumns: ROW_GRID,
          gap: "8px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <i
            className="ti ti-chevron-right tl-chevron"
            aria-hidden="true"
            style={{ fontSize: "13px", color: "var(--color-text3)", flexShrink: 0 }}
          />
          <i
            data-testid={`timeline-gantt-frd-icon-${frd.id}`}
            className={WO_ICON[frd.state]}
            aria-hidden="true"
            title={STATE_LABEL[frd.state]}
            style={{ fontSize: "13px", color: WO_COLOR_VAR[frd.state], flexShrink: 0 }}
          />
          <span style={{ fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>{frd.label}</span>
          {name !== "" && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-text2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              · {name}
            </span>
          )}
        </div>

        <div
          style={{
            position: "relative",
            height: "20px",
            background: "var(--color-card2)",
            borderRadius: "5px",
            border: "0.5px solid var(--color-border)",
          }}
        >
          <div
            data-testid={`timeline-gantt-frd-bar-${frd.id}`}
            title={`${frd.label} · ${STATE_LABEL[frd.state]} · ${total} min en ${frd.workOrders.length} work orders`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${frdBarPct}%`,
              minWidth: "30px",
              background: WO_COLOR_VAR[frd.state],
              borderRadius: "5px",
              display: "flex",
              alignItems: "center",
              padding: "0 6px",
              color: "var(--color-base)",
              fontSize: "10px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {total}m
          </div>
        </div>
      </summary>

      <div style={{ marginTop: "8px" }}>
        {woRows}
        {reviewRow}
      </div>
    </details>
  );
}

/** Durations / estimated mode — collapsible FRD rows with nested WO bars. */
function DurationsTimeline({ timeline }: { timeline: BuildTimeline }): React.JSX.Element {
  const maxAxis = Math.max(1, ...timeline.frds.map(frdAxisTotal));
  const firstErr = findFirstError(timeline);

  return (
    <div
      data-testid="timeline-gantt"
      data-mode={timeline.estimated ? "estimated" : "durations"}
      style={{ width: "100%" }}
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, no user input — collapse chrome only */}
      <style dangerouslySetInnerHTML={{ __html: FRD_DETAILS_CSS }} />

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
        FRD ▸ work orders. La barra del FRD es la suma de sus work orders; el ancho de cada barra es
        proporcional a su duración{timeline.estimated ? " (estimada)" : ""}. Clic en un FRD para
        plegarlo.
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

      {/* Collapsible FRD rows with nested WO bars */}
      {timeline.frds.map((frd) => (
        <FrdDetails key={frd.id} frd={frd} maxAxis={maxAxis} />
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
