"use client";

/**
 * WO-06-005 — FraguaScene (CMP-06-scene, La Fragua faithful model)
 *
 * Client component: receives a `FraguaSnapshot` from the RSC `PartyTab` and
 * renders the La Fragua living-world scene (Sala de Forja → Tribunal del Juez
 * → Bóveda rooms, sprites per running WO, trophy shelf, gate state).
 *
 * This component is the client boundary for the Party tab's scene. It is
 * intentionally observation-only (REQ-06-009): zero control affordances
 * (no mode selector, no pause/reset). The mode is displayed as data only.
 *
 * Stub implementation for WO-06-005 (composition layer). The full room
 * rendering, animations, and RAF loop are delivered by WO-06-006
 * (FraguaScene full implementation). This stub:
 *   - Renders `data-testid="fragua-scene"` (integration anchor).
 *   - Shows the FRD tracker (id + title) and the global counter.
 *   - Shows the mode as plain text (read-only data, never a selector).
 *   - Lists running WOs and trophy count — enough for acceptance tests.
 *   - Provides the structural anchor for the full scene (WO-06-006).
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - `data-testid` on every significant element.
 *   - Spanish aria-labels.
 *   - Observation-only: NO mode selector, NO pause button, NO reset button.
 *
 * Traceability:
 *   CMP-06-scene → REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004,
 *                  REQ-06-005, REQ-06-009, REQ-06-010
 */

import { DeepRelay } from "../DeepRelay/DeepRelay";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

// ---------------------------------------------------------------------------
// Style constants (CSS custom properties only — zero hardcoded colors)
// ---------------------------------------------------------------------------

const SCENE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, Canvas)",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  minWidth: "320px",
};

const FRD_TRACKER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const FRD_ID_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
};

const FRD_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

const COUNTER_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-muted, currentColor)",
};

const MODE_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 500,
  color: "var(--color-text-muted, currentColor)",
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const ROOMS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const ROOM_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const ROOM_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted, currentColor)",
  marginBottom: "calc(var(--spacing, 0.25rem) * 1)",
};

const RUNNING_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const WO_CHIP_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-agent-implementer-bg, var(--color-card))",
  color: "var(--color-agent-implementer, var(--color-text))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const QUEUED_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--color-text-muted, currentColor)",
  fontStyle: "italic",
};

const TROPHY_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, currentColor)",
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  flexWrap: "wrap",
};

const GATE_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FraguaSceneProps {
  /** The server-derived snapshot (blueprint §3). */
  snapshot: FraguaSnapshot;
}

// ---------------------------------------------------------------------------
// FraguaScene component
// ---------------------------------------------------------------------------

/**
 * Renders the La Fragua scene (rooms, sprites, trophies, gate, FRD tracker).
 * Observation-only: no mode selector, no pause/reset controls.
 *
 * @param props.snapshot - The FraguaSnapshot from the RSC PartyTab.
 */
export function FraguaScene({ snapshot }: FraguaSceneProps): React.JSX.Element {
  const { frd, mode, running, queuedCount, gate, trophies, archivedCount, project } = snapshot;

  return (
    <section
      data-testid="fragua-scene"
      aria-label="La Fragua — vista de construcción en vivo"
      style={SCENE_STYLE}
    >
      {/* FRD tracker: id + title (AC-06-002.1) */}
      {frd !== null && (
        <div data-testid="fragua-frd-tracker" style={FRD_TRACKER_STYLE}>
          <span data-testid="fragua-frd-id" style={FRD_ID_STYLE}>
            {frd.id}
          </span>
          <h3 data-testid="fragua-frd-title" style={FRD_TITLE_STYLE}>
            {frd.title}
          </h3>
        </div>
      )}

      {/* Global project counter (AC-06-002.2) — read-only data display */}
      <div data-testid="fragua-global-counter" style={COUNTER_STYLE}>
        <span data-testid="fragua-counter-done">{project.done}</span>
        {" / "}
        <span data-testid="fragua-counter-total">{project.total}</span>
        {" WO"}
      </div>

      {/* Mode display — read-only data, never a selector (AC-06-009.1) */}
      <div data-testid="fragua-mode-display" style={MODE_STYLE}>
        <span aria-hidden="true">⚙</span>
        <span data-testid="fragua-mode-value">{mode}</span>
      </div>

      {/* Rooms: Sala de Forja → Tribunal del Juez → Bóveda */}
      <div data-testid="fragua-rooms" style={ROOMS_STYLE}>
        {/* Sala de Forja — running WOs (REQ-06-001) */}
        <div data-testid="fragua-room-forja" style={ROOM_STYLE}>
          <div style={ROOM_LABEL_STYLE}>Sala de Forja</div>
          <div data-testid="fragua-running-list" style={RUNNING_LIST_STYLE}>
            {running.map(({ wo, relay }) =>
              // Deep mode renders each running WO as a relay (frontend → 3-step;
              // no-frontend → single implementer); other modes render a chip.
              mode === "deep" ? (
                <DeepRelay
                  key={wo}
                  wo={wo}
                  relay={relay ?? { step: "test", contractPublished: false }}
                  hasFrontend={relay !== undefined}
                />
              ) : (
                <span key={wo} data-testid={`fragua-wo-chip-${wo}`} style={WO_CHIP_STYLE}>
                  {wo}
                </span>
              ),
            )}
            {running.length === 0 && (
              <span data-testid="fragua-forja-empty" style={QUEUED_STYLE}>
                Sin órdenes en forja
              </span>
            )}
          </div>
          {queuedCount > 0 && (
            <div data-testid="fragua-queued-count" style={QUEUED_STYLE}>
              +{queuedCount} en cola
            </div>
          )}
        </div>

        {/* Tribunal del Juez — reviewer gate (REQ-06-004) */}
        <div data-testid="fragua-room-tribunal" style={ROOM_STYLE}>
          <div style={ROOM_LABEL_STYLE}>Tribunal del Juez</div>
          <div data-testid="fragua-gate" style={GATE_STYLE}>
            {gate.open ? (
              <span data-testid="fragua-gate-open">⚖ Tribunal abierto</span>
            ) : (
              <span data-testid="fragua-gate-closed">⚖ Tribunal en espera</span>
            )}
          </div>
        </div>

        {/* Bóveda — VERIFIED trophies (REQ-06-005) */}
        <div data-testid="fragua-room-boveda" style={ROOM_STYLE}>
          <div style={ROOM_LABEL_STYLE}>Bóveda</div>
          <div data-testid="fragua-trophies" style={TROPHY_STYLE}>
            {trophies.map(({ wo }) => (
              <span key={wo} data-testid={`fragua-trophy-${wo}`} title={wo}>
                🏆
              </span>
            ))}
            {trophies.length === 0 && (
              <span data-testid="fragua-boveda-empty" style={QUEUED_STYLE}>
                Sin trofeos aún
              </span>
            )}
          </div>
          {archivedCount > 0 && (
            <div data-testid="fragua-archived-count" style={QUEUED_STYLE}>
              +{archivedCount} archivados
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
