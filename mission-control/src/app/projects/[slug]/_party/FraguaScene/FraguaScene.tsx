"use client";

/**
 * WO-06-006 — FraguaScene full implementation (CMP-06-scene, La Fragua faithful model)
 *
 * Client component: receives a `FraguaSnapshot` from the RSC `PartyTab` and
 * renders the La Fragua living-world scene (Sala de Forja → Tribunal del Juez
 * → Bóveda rooms, sprites per running WO, trophy shelf, reviewer gate, parchment).
 *
 * Architecture (blueprint §2, CMP-06-scene):
 *   - Mounts `createFraguaEngine` on first render, driven by the snapshot.
 *   - Binds a `requestAnimationFrame` loop with the re-mount discipline
 *     (`runIdRef` self-stop pattern, PARTY.md §5).
 *   - Pauses RAF when the document is hidden (Page Visibility API).
 *   - Renders: three rooms (Sala de Forja / Tribunal del Juez / Bóveda),
 *     one sprite per running WO (≤ wave) with WO-id tag + hover tooltip,
 *     the "+N en cola" queue badge, the reviewer gate with three lenses,
 *     the trophy shelf + "+N archivados" compact, the parchment element,
 *     and the FRD tracker (title) + global project counter.
 *   - Delegates deep-mode relay rendering to `<DeepRelay>` (WO-06-013).
 *   - Tab-hidden pauses RAF; re-mount discipline prevents double loops.
 *
 * Read-only invariant (AC-06-009.1):
 *   - ZERO control affordances (no buttons, no inputs, no mode selector).
 *   - Mode is displayed as plain text data, never as a selector.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only (see FraguaScene.styles.ts).
 *   - `data-testid` on every significant element.
 *   - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-scene → REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004,
 *                  REQ-06-005, REQ-06-006, REQ-06-009
 *
 * data-testid surface (WO-06-006 contract):
 *   fragua-scene              — root <section>
 *   fragua-room-forge         — Sala de Forja room
 *   fragua-room-tribunal      — Tribunal del Juez room
 *   fragua-room-vault         — Bóveda room
 *   fragua-wo-{id}            — one sprite per running WO in the forge
 *   fragua-queue-badge        — "+N en cola" count badge
 *   fragua-reviewer           — reviewer figure (data-gate-open attribute)
 *   fragua-trophy-{id}        — one trophy per VERIFIED WO on the Bóveda shelf
 *   fragua-archived           — "+N archivados" compact indicator
 *   fragua-parchment          — the status-note parchment element
 *   fragua-frd-tracker        — FRD id + title block
 *   fragua-project-counter    — global WO done/total counter
 *   fragua-mode-display       — mode display (read-only, no selector)
 */

import { useEffect, useRef } from "react";

import { DeepRelay } from "../DeepRelay/DeepRelay";
import type { FraguaEngine } from "../engine/engine";
import { createFraguaEngine } from "../engine/engine";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import {
  ARCHIVED_STYLE,
  COUNTER_STYLE,
  FORGE_SPRITES_STYLE,
  FRD_ID_STYLE,
  FRD_TITLE_STYLE,
  FRD_TRACKER_STYLE,
  HALO_STYLE,
  HEADER_STYLE,
  LENS_STYLE,
  MODE_STYLE,
  PARCHMENT_STYLE,
  QUEUE_BADGE_STYLE,
  QUEUED_STYLE,
  REVIEWER_ACTIVE_STYLE,
  REVIEWER_DIMMED_STYLE,
  ROOM_LABEL_STYLE,
  ROOM_STYLE,
  ROOMS_STYLE,
  SCENE_STYLE,
  TROPHY_SHELF_STYLE,
  TROPHY_STYLE,
  WO_SPRITE_STYLE,
} from "./FraguaScene.styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FraguaSceneProps {
  /** The server-derived snapshot (blueprint §3). */
  snapshot: FraguaSnapshot;
}

// ---------------------------------------------------------------------------
// Three lenses for the reviewer gate (AC-06-004.2)
// ---------------------------------------------------------------------------

/** The three lenses the reviewer applies when the gate opens. */
const REVIEWER_LENSES = [
  { key: "correctness", label: "Corrección", icon: "✓" },
  { key: "security", label: "Seguridad", icon: "🔒" },
  { key: "quality", label: "Calidad", icon: "⭐" },
] as const;

// ---------------------------------------------------------------------------
// FraguaScene component
// ---------------------------------------------------------------------------

/**
 * Renders the La Fragua scene (rooms, sprites, trophies, gate, FRD tracker).
 * Observation-only: no mode selector, no pause/reset controls.
 * Mounts the La Fragua engine and drives a RAF loop for smooth animation.
 *
 * @param props.snapshot - The FraguaSnapshot from the RSC PartyTab.
 */
export function FraguaScene({ snapshot }: FraguaSceneProps): React.JSX.Element {
  const { frd, mode, running, queuedCount, gate, trophies, archivedCount, project } = snapshot;

  // -------------------------------------------------------------------------
  // Engine lifecycle + RAF loop
  // -------------------------------------------------------------------------

  const engineRef = useRef<FraguaEngine | null>(null);
  const runIdRef = useRef<number>(0);

  useEffect(() => {
    // Create the engine from the current snapshot.
    const engine = createFraguaEngine({ mode, wave: snapshot.wave });

    // Seed the engine with running WOs from the snapshot.
    for (const { wo, state } of running) {
      engine.setWo(wo, state);
    }

    // Seed trophies.
    for (const { wo: twoId } of trophies) {
      engine.verifyWo(twoId);
    }

    // Open gate if the snapshot says so.
    if (gate.open) engine.openGate();

    engineRef.current = engine;

    // RAF loop with self-stop discipline (runIdRef pattern).
    const myRunId = ++runIdRef.current;

    function tick(): void {
      if (runIdRef.current !== myRunId) return; // stopped by re-mount or unmount
      if (typeof document !== "undefined" && document.hidden) {
        requestAnimationFrame(tick);
        return;
      }
      engineRef.current?.tick(performance.now());
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    return () => {
      runIdRef.current++;
      engineRef.current = null;
    };
  }, [mode, snapshot.wave, running, trophies, gate.open]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section
      data-testid="fragua-scene"
      aria-label="La Fragua — vista de construcción en vivo"
      style={SCENE_STYLE}
    >
      {/* Header: FRD tracker + global counter + mode display */}
      <div style={HEADER_STYLE}>
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

        {/* Global project counter: WO done / total (AC-06-002.2) */}
        <div
          data-testid="fragua-project-counter"
          style={COUNTER_STYLE}
          title={`${project.done} de ${project.total} órdenes de trabajo completadas`}
        >
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
      </div>

      {/* Parchment — status-note hand-off element (AC-06-006.1, REQ-06-006)
          Structurally always present; hidden when no parchment is in flight.
          The engine drives parchment animation; for the static render it is hidden. */}
      <div
        data-testid="fragua-parchment"
        role="img"
        aria-label="Pergamino de traspaso de estado"
        aria-hidden="true"
        style={PARCHMENT_STYLE}
      >
        <span aria-hidden="true">📜</span>
      </div>

      {/* Rooms: Sala de Forja → Tribunal del Juez → Bóveda (AC-06-003.1) */}
      <div data-testid="fragua-rooms" style={ROOMS_STYLE}>
        {/* === Sala de Forja — running WOs (REQ-06-001) === */}
        <div data-testid="fragua-room-forge" style={ROOM_STYLE}>
          <div style={ROOM_LABEL_STYLE}>Sala de Forja</div>

          {/* Running WO sprites (one per running WO, ≤ wave) */}
          <div data-testid="fragua-forge-sprites" style={FORGE_SPRITES_STYLE}>
            {running.map(({ wo, title, relay }) =>
              mode === "deep" ? (
                // Deep mode: relay (if frontend) or single implementer (AC-06-007.1/.4)
                <DeepRelay
                  key={wo}
                  wo={wo}
                  relay={relay ?? { step: "test", contractPublished: false }}
                  hasFrontend={relay !== undefined}
                />
              ) : (
                // Non-deep: one sprite chip per running WO (AC-06-001.1)
                <span
                  key={wo}
                  data-testid={`fragua-wo-${wo}`}
                  data-wo={wo}
                  title={`${wo} — ${title}`}
                  role="img"
                  aria-label={`Orden de trabajo ${wo}: ${title}`}
                  style={WO_SPRITE_STYLE}
                >
                  {/* Halo — visual pulse indicator for the implementer */}
                  <span aria-hidden="true" style={HALO_STYLE} />
                  <span aria-hidden="true">⚒</span>
                  <span>{wo}</span>
                </span>
              ),
            )}

            {running.length === 0 && (
              <span data-testid="fragua-forge-empty" style={QUEUED_STYLE}>
                Sin órdenes en forja
              </span>
            )}
          </div>

          {/* "+N en cola" badge (AC-06-001.3) */}
          {queuedCount > 0 && (
            <div
              data-testid="fragua-queue-badge"
              style={QUEUE_BADGE_STYLE}
              title={`${queuedCount} órdenes en cola`}
            >
              +{queuedCount} en cola
            </div>
          )}
        </div>

        {/* === Tribunal del Juez — reviewer gate (REQ-06-004) === */}
        <div data-testid="fragua-room-tribunal" style={ROOM_STYLE}>
          <div style={ROOM_LABEL_STYLE}>Tribunal del Juez</div>

          {/* Reviewer figure: dimmed when gate closed, active with three lenses when open.
              data-gate-open mirrors the gate state for tests and CSS (AC-06-004.1/2). */}
          <div
            data-testid="fragua-reviewer"
            data-gate-open={String(gate.open)}
            role="img"
            aria-label={
              gate.open
                ? "Revisor activo — evalúa con tres lentes"
                : "Revisor en espera — pendiente de revisión"
            }
            style={gate.open ? REVIEWER_ACTIVE_STYLE : REVIEWER_DIMMED_STYLE}
          >
            <span aria-hidden="true">⚖</span>
            <span>{gate.open ? "Tribunal abierto" : "Tribunal en espera"}</span>

            {/* Three lenses — shown when gate is open (AC-06-004.2) */}
            {gate.open &&
              REVIEWER_LENSES.map(({ key, label, icon }) => (
                <span
                  key={key}
                  data-testid={`fragua-reviewer-lens-${key}`}
                  data-lens={key}
                  title={label}
                  style={LENS_STYLE}
                >
                  {icon}
                </span>
              ))}
          </div>
        </div>

        {/* === Bóveda — VERIFIED trophies (REQ-06-005) === */}
        <div data-testid="fragua-room-vault" style={ROOM_STYLE}>
          <div style={ROOM_LABEL_STYLE}>Bóveda</div>

          <div data-testid="fragua-trophy-shelf" style={TROPHY_SHELF_STYLE}>
            {/* Trophy per verified WO (AC-06-005.1) */}
            {trophies.map(({ wo: twoId }) => (
              <span
                key={twoId}
                data-testid={`fragua-trophy-${twoId}`}
                title={twoId}
                role="img"
                aria-label={`Trofeo: ${twoId} verificado`}
                style={TROPHY_STYLE}
              >
                🏆
              </span>
            ))}

            {trophies.length === 0 && archivedCount === 0 && (
              <span data-testid="fragua-vault-empty" style={QUEUED_STYLE}>
                Sin trofeos aún
              </span>
            )}

            {/* "+N archivados" compact indicator — when shelf capacity exceeded (AC-06-005.2) */}
            {archivedCount > 0 && (
              <span
                data-testid="fragua-archived"
                style={ARCHIVED_STYLE}
                title={`${archivedCount} órdenes verificadas archivadas`}
              >
                +{archivedCount} archivados
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
