"use client";

/**
 * WO-06-007 — FraguaScene re-paint (CMP-06-scene, La Fragua faithful model)
 *
 * Client component: receives a `FraguaSnapshot` from the RSC `PartyTab` and
 * renders the La Fragua living-world scene on a 920×560 stage, composed
 * entirely from the VERIFIED FND-4 Party canvas primitives (WO-13-009/WO-06-006):
 *   - Room × 3 (forge / tribunal / vault) — absolutely positioned per mock layout
 *   - StoneBridge × 2 (h: forge→tribunal, v: tribunal→vault) — per mock coords
 *   - AgentSprite per running WO (≤ wave) in the forge; JudgeSprite in the tribunal
 *   - AgentSprite per trophy WO (state=vault) in the vault shelf
 *   - Parchment — the travelling status-note hand-off element
 *   - Header: FRD tracker + global counter + mode display
 *   - "+N en cola" badge, "+N archivados" compact
 *   - Deep-mode WOs delegate to the existing DeepRelay (REUSE)
 *
 * Architecture (blueprint §2, CMP-06-scene):
 *   - Mounts `createFraguaEngine` on first render, driven by the snapshot.
 *   - Binds a `requestAnimationFrame` loop with the re-mount discipline
 *     (`runIdRef` self-stop pattern, PARTY.md §5).
 *   - Pauses RAF when the document is hidden (Page Visibility API).
 *   - Tab-hidden pauses RAF; re-mount discipline prevents double loops.
 *
 * Read-only invariant (AC-06-009.1):
 *   - ZERO control affordances (no buttons, no inputs, no mode selector).
 *   - Mode is displayed as plain text data, never as a selector.
 *
 * Stage layout (matching mocks/la-fragua.html):
 *   Stage 920×560, grid 30px, dark radial-gradient bg
 *   Forge:    left:16,  top:40,  width:432, height:372
 *   Tribunal: left:472, top:40,  width:432, height:372
 *   Vault:    left:16,  top:438, width:888, height:106
 *   Bridge-h: left:415, top:140, width:90,  height:60
 *   Bridge-v: left:662, top:383, width:52,  height:84
 *
 * data-testid surface (WO-06-007 contract — must remain stable):
 *   fragua-scene              — root <section> containing everything
 *   fragua-stage              — 920×560 bounded stage
 *   fragua-room-forge         — wrapper for the forge Room primitive
 *   fragua-room-tribunal      — wrapper for the tribunal Room primitive
 *   fragua-room-vault         — wrapper for the vault Room primitive
 *   fragua-wo-{id}            — one sprite wrapper per running WO in the forge
 *   fragua-queue-badge        — "+N en cola" count badge
 *   fragua-reviewer           — wrapper for the JudgeSprite (data-gate-open)
 *   fragua-trophy-{id}        — one sprite wrapper per VERIFIED WO trophy
 *   fragua-archived           — "+N archivados" compact indicator
 *   fragua-parchment          — wrapper for the Parchment primitive
 *   fragua-frd-tracker        — FRD id + title block
 *   fragua-project-counter    — global WO done/total counter
 *   fragua-mode-display       — mode display (read-only, no selector)
 *
 * FND-4 primitives used (data-testid surface from the primitives):
 *   room-root                 — Room primitive (data-zone=forge/tribunal/vault)
 *   stone-bridge-root         — StoneBridge primitive (data-orientation=h/v)
 *   agent-sprite-root         — AgentSprite per running WO + per trophy (state=vault)
 *   judge-sprite-root         — JudgeSprite for the reviewer gate
 *   parchment-root            — Parchment primitive
 *
 * Traceability:
 *   CMP-06-scene → REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004,
 *                  REQ-06-005, REQ-06-006, REQ-06-007, REQ-06-009
 */

import { useEffect, useRef, useState } from "react";

import { AgentSprite } from "@/components/modules/party/AgentSprite/AgentSprite";
import { JudgeSprite } from "@/components/modules/party/JudgeSprite/JudgeSprite";
import { Parchment } from "@/components/modules/party/Parchment/Parchment";
import { Room } from "@/components/modules/party/Room/Room";
import { StoneBridge } from "@/components/modules/party/StoneBridge/StoneBridge";

import { DeepRelay } from "../DeepRelay/DeepRelay";
import type { FraguaEngine } from "../engine/engine";
import { createFraguaEngine } from "../engine/engine";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FraguaSceneProps {
  /** The server-derived snapshot (blueprint §3). */
  snapshot: FraguaSnapshot;
}

// ---------------------------------------------------------------------------
// Stage layout constants (mocks/la-fragua.html pixel-exact coordinates)
// ---------------------------------------------------------------------------

const STAGE_W = 920;
const STAGE_H = 560;

// Room rectangles (left, top, width, height)
const FORGE_RECT = { left: 16, top: 40, width: 432, height: 372 } as const;
const TRIBUNAL_RECT = { left: 472, top: 40, width: 432, height: 372 } as const;
const VAULT_RECT = { left: 16, top: 438, width: 888, height: 106 } as const;

// Bridge rectangles
const BRIDGE_H_RECT = { left: 415, top: 140, width: 90, height: 60 } as const;
const BRIDGE_V_RECT = { left: 662, top: 383, width: 52, height: 84 } as const;

// Forge sprite slots (8 positions for powerful mode)
// Matching la-fragua.html FORGE_SLOTS relative to the stage origin
const FORGE_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [95, 155],
  [190, 155],
  [285, 155],
  [378, 155],
  [95, 300],
  [190, 300],
  [285, 300],
  [378, 300],
] as const;

// Deep mode forge slots (6, wider for relay)
const DEEP_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [140, 150],
  [320, 150],
  [140, 255],
  [320, 255],
  [140, 360],
  [320, 360],
] as const;

// Tribunal review slots (12, for reviewer WO sprites during review)
const REVIEW_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [538, 190],
  [628, 190],
  [718, 190],
  [808, 190],
  [538, 275],
  [628, 275],
  [718, 275],
  [808, 275],
  [538, 360],
  [628, 360],
  [718, 360],
  [808, 360],
] as const;

// Reviewer / judge home position in the tribunal
const REVIEWER_HOME = [626, 108] as const;

// Vault trophy shelf
const VAULT_Y = 492 as const;
const VAULT_X0 = 112 as const;
const VAULT_DX = 80 as const;
const VAULT_MORE_POS = [820, 465] as const;

// Parchment starts at forge→tribunal bridge midpoint
const PARCHMENT_START = [430, 155] as const;

// Sprite size offset (center sprite on slot: slot is center, sprite is 52px)
const SPRITE_HALF = 26;

// Max vault trophies shown before "+N archivados"
const MAX_VAULT = 9;

// ---------------------------------------------------------------------------
// Mode-display label map (Spanish, from mocks)
// ---------------------------------------------------------------------------

const MODE_LABEL: Record<string, string> = {
  pro: "Pro · 2 paralelos",
  balanced: "Equilibrado · 4 paralelos",
  powerful: "Potente · 8 paralelos",
  deep: "Profundo · 6 WO · relevo · Opus",
};

// ---------------------------------------------------------------------------
// WoState → AgentSpriteState mapper
// ---------------------------------------------------------------------------

type WoState = "building" | "in_review" | "verified" | "blocked";

function woStateToSpriteState(state: WoState): "work" | "review" | "vault" | "idle" {
  switch (state) {
    case "building":
      return "work";
    case "in_review":
      return "review";
    case "verified":
      return "vault";
    case "blocked":
      return "idle";
    default:
      return "idle";
  }
}

// ---------------------------------------------------------------------------
// Three lenses for the reviewer gate (AC-06-004.2)
// ---------------------------------------------------------------------------

const REVIEWER_LENSES = [
  { key: "correctness", label: "Corrección", icon: "✓" },
  { key: "security", label: "Seguridad", icon: "🔒" },
  { key: "quality", label: "Calidad", icon: "⭐" },
] as const;

// ---------------------------------------------------------------------------
// Inline styles — CSS custom properties only (zero hardcoded colors)
// ---------------------------------------------------------------------------

const SCENE_WRAPPER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
};

const FRD_TRACKER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 0.5)",
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

// The 920×560 bounded stage
const STAGE_STYLE: React.CSSProperties = {
  position: "relative",
  width: `${STAGE_W}px`,
  height: `${STAGE_H}px`,
  borderRadius: "14px",
  overflow: "hidden",
  border: "1px solid var(--color-border-strong, var(--color-border))",
  background: [
    "radial-gradient(680px 340px at 24% 36%, #16201d 0%, transparent 70%)",
    "#0c1113",
  ].join(", "),
  imageRendering: "pixelated",
  flexShrink: 0,
};

// Grid overlay (matching the mock's ::before pseudo-element)
const STAGE_GRID_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: [
    "linear-gradient(#1d2629 .5px,transparent .5px)",
    "linear-gradient(90deg,#1d2629 .5px,transparent .5px)",
  ].join(", "),
  backgroundSize: "30px 30px",
  opacity: 0.45,
  pointerEvents: "none",
  zIndex: 0,
};

const QUEUE_BADGE_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(var(--spacing, 0.25rem) * 3)",
  left: "calc(var(--spacing, 0.25rem) * 2)",
  display: "inline-flex",
  alignItems: "center",
  fontSize: "0.6875rem",
  fontWeight: 700,
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  color: "var(--color-text-muted, currentColor)",
  fontStyle: "italic",
  zIndex: 10,
};

const ARCHIVED_STYLE: React.CSSProperties = {
  position: "absolute",
  display: "inline-flex",
  alignItems: "center",
  fontSize: "0.6875rem",
  fontWeight: 700,
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-ok-bg, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-ok, currentColor)",
  color: "var(--color-ok, currentColor)",
  fontStyle: "italic",
  zIndex: 10,
};

const REVIEWER_ACTIVE_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(var(--spacing, 0.25rem) * 1)",
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 0.5)",
  zIndex: 10,
};

const LENS_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  padding: "0 calc(var(--spacing, 0.25rem) * 0.5)",
  background: "var(--color-warn-bg)",
  borderRadius: "var(--radius, 0.25rem)",
  border: "1px solid var(--color-warn)",
  color: "var(--color-warn)",
};

// ---------------------------------------------------------------------------
// FraguaScene component
// ---------------------------------------------------------------------------

/**
 * Renders the La Fragua scene on a 920×560 stage, composed from FND-4
 * primitives (Room, StoneBridge, AgentSprite, JudgeSprite, Parchment).
 * Observation-only: no mode selector, no pause/reset controls.
 * Mounts the La Fragua engine and drives a RAF loop for smooth animation.
 *
 * @param props.snapshot - The FraguaSnapshot from the RSC PartyTab.
 */
export function FraguaScene({ snapshot }: FraguaSceneProps): React.JSX.Element {
  const { frd, mode, running, queuedCount, gate, trophies, archivedCount, project } = snapshot;

  // -------------------------------------------------------------------------
  // Reduced-motion detection (FRD-13, AC-06-010.2)
  // -------------------------------------------------------------------------
  const [reducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  // -------------------------------------------------------------------------
  // Engine lifecycle + RAF loop
  // -------------------------------------------------------------------------
  const engineRef = useRef<FraguaEngine | null>(null);
  const runIdRef = useRef<number>(0);

  useEffect(() => {
    const engine = createFraguaEngine({ mode, wave: snapshot.wave });

    for (const { wo, state } of running) {
      engine.setWo(wo, state);
    }
    for (const { wo: twoId } of trophies) {
      engine.verifyWo(twoId);
    }
    if (gate.open) engine.openGate();

    engineRef.current = engine;

    if (reducedMotion) {
      return () => {
        runIdRef.current++;
        engineRef.current = null;
      };
    }

    const myRunId = ++runIdRef.current;

    function tick(): void {
      if (runIdRef.current !== myRunId) return;
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
  }, [mode, snapshot.wave, running, trophies, gate.open, reducedMotion]);

  // -------------------------------------------------------------------------
  // Compute sprite slots per mode
  // -------------------------------------------------------------------------
  const forgeSlots = mode === "deep" ? DEEP_SLOTS : FORGE_SLOTS;

  // Determine flow: bridges flow when WOs are running
  const hasRunning = running.length > 0;

  // Vault trophies to render (capped at MAX_VAULT)
  const shownTrophies = trophies.slice(0, MAX_VAULT);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section
      data-testid="fragua-scene"
      aria-label="La Fragua — vista de construcción en vivo"
      data-reduced-motion={reducedMotion ? "true" : undefined}
      style={SCENE_WRAPPER_STYLE}
    >
      {/* Header: FRD tracker + global counter + mode display */}
      <div style={HEADER_STYLE}>
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
          <span data-testid="fragua-mode-value">{MODE_LABEL[mode] ?? mode}</span>
        </div>
      </div>

      {/* =====================================================================
          920×560 bounded stage — all rooms, bridges, sprites positioned here
          ===================================================================== */}
      <div data-testid="fragua-stage" style={STAGE_STYLE}>
        {/* Grid overlay — 30px dot grid per mock */}
        <div aria-hidden="true" style={STAGE_GRID_STYLE} />

        {/* ----------------------------------------------------------------
            Parchment — status-note hand-off element (AC-06-006.1)
            Structurally always present. The engine drives its position;
            for the initial static render it sits at the forge→tribunal edge.
            ---------------------------------------------------------------- */}
        <div data-testid="fragua-parchment" aria-hidden="true">
          <Parchment
            from="forge"
            to="tribunal"
            style={{
              left: `${PARCHMENT_START[0]}px`,
              top: `${PARCHMENT_START[1]}px`,
              visibility: "hidden", // hidden until a HandoffWritten event arrives
            }}
          />
        </div>

        {/* ----------------------------------------------------------------
            Stone bridges — sit above room backgrounds (z-index 2),
            below sprites (z-index 5).
            bridge-h: forge → tribunal (horizontal)
            bridge-v: tribunal → vault (vertical)
            ---------------------------------------------------------------- */}
        <StoneBridge
          orientation="h"
          flow={hasRunning}
          style={{
            left: `${BRIDGE_H_RECT.left}px`,
            top: `${BRIDGE_H_RECT.top}px`,
            width: `${BRIDGE_H_RECT.width}px`,
            height: `${BRIDGE_H_RECT.height}px`,
          }}
        />
        <StoneBridge
          orientation="v"
          flow={hasRunning}
          style={{
            left: `${BRIDGE_V_RECT.left}px`,
            top: `${BRIDGE_V_RECT.top}px`,
            width: `${BRIDGE_V_RECT.width}px`,
            height: `${BRIDGE_V_RECT.height}px`,
          }}
        />

        {/* ================================================================
            FORGE — Sala de Forja (building)
            ================================================================ */}
        <div data-testid="fragua-room-forge" style={{ display: "contents" }}>
          <Room
            zone="forge"
            label="⚒️ Sala de Forja"
            state={hasRunning ? "hot" : "cool"}
            count={running.length}
            style={{
              left: `${FORGE_RECT.left}px`,
              top: `${FORGE_RECT.top}px`,
              width: `${FORGE_RECT.width}px`,
              height: `${FORGE_RECT.height}px`,
            }}
          >
            {/* Running WO sprites — one AgentSprite per WO ≤ wave */}
            {running.map(({ wo, title, relay }, idx) => {
              const slot = forgeSlots[idx] ?? forgeSlots[0];
              // Position relative to stage origin → relative to room origin
              const relX = (slot?.[0] ?? 0) - FORGE_RECT.left - SPRITE_HALF;
              const relY = (slot?.[1] ?? 0) - FORGE_RECT.top - SPRITE_HALF;

              return mode === "deep" ? (
                <div
                  key={wo}
                  data-testid={`fragua-wo-${wo}`}
                  data-wo={wo}
                  title={`${wo} — ${title}`}
                  style={{ position: "absolute", left: relX, top: relY }}
                >
                  <DeepRelay
                    wo={wo}
                    relay={relay ?? { step: "test", contractPublished: false }}
                    hasFrontend={relay !== undefined}
                  />
                </div>
              ) : (
                <div
                  key={wo}
                  data-testid={`fragua-wo-${wo}`}
                  data-wo={wo}
                  title={`${wo} — ${title}`}
                  style={{ position: "absolute", left: relX, top: relY }}
                >
                  <AgentSprite
                    agentRole="implementer"
                    state={woStateToSpriteState(
                      snapshot.running.find((r) => r.wo === wo)?.state ?? "building",
                    )}
                    woId={wo}
                  />
                </div>
              );
            })}

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
          </Room>
        </div>

        {/* ================================================================
            TRIBUNAL — Tribunal del Juez (review gate)
            ================================================================ */}
        <div data-testid="fragua-room-tribunal" style={{ display: "contents" }}>
          <Room
            zone="tribunal"
            label="⚖️ Tribunal del Juez"
            state={gate.open ? "hot" : "cool"}
            count={running.filter((r) => r.state === "in_review").length || undefined}
            style={{
              left: `${TRIBUNAL_RECT.left}px`,
              top: `${TRIBUNAL_RECT.top}px`,
              width: `${TRIBUNAL_RECT.width}px`,
              height: `${TRIBUNAL_RECT.height}px`,
            }}
          >
            {/* Reviewer / judge — JudgeSprite primitive (AC-06-004.1) */}
            <div
              data-testid="fragua-reviewer"
              data-gate-open={String(gate.open)}
              role="img"
              aria-label={
                gate.open
                  ? "Revisor activo — evalúa con cuatro lentes"
                  : "Revisor en espera — pendiente de revisión"
              }
              style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
            >
              <JudgeSprite
                active={gate.open}
                style={{
                  left: `${REVIEWER_HOME[0] - TRIBUNAL_RECT.left - SPRITE_HALF}px`,
                  top: `${REVIEWER_HOME[1] - TRIBUNAL_RECT.top - SPRITE_HALF}px`,
                }}
              />

              {/* Three lenses — shown when gate is open (AC-06-004.2) */}
              {gate.open && (
                <div style={REVIEWER_ACTIVE_STYLE}>
                  {REVIEWER_LENSES.map(({ key, label, icon }) => (
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
              )}

              {/* WOs in review — positioned in the tribunal review slots */}
              {running
                .filter((r) => r.state === "in_review")
                .map(({ wo, title }, idx) => {
                  const slot = REVIEW_SLOTS[idx] ?? REVIEW_SLOTS[0];
                  const relX = (slot?.[0] ?? 0) - TRIBUNAL_RECT.left - SPRITE_HALF;
                  const relY = (slot?.[1] ?? 0) - TRIBUNAL_RECT.top - SPRITE_HALF;
                  return (
                    <div
                      key={wo}
                      data-wo={wo}
                      title={`${wo} — ${title}`}
                      style={{ position: "absolute", left: relX, top: relY }}
                    >
                      <AgentSprite agentRole="implementer" state="review" woId={wo} />
                    </div>
                  );
                })}
            </div>
          </Room>
        </div>

        {/* ================================================================
            VAULT — Bóveda (verified trophies)
            ================================================================ */}
        <div data-testid="fragua-room-vault" style={{ display: "contents" }}>
          <Room
            zone="vault"
            label="🏆 Bóveda · trofeos del FRD"
            state={shownTrophies.length > 0 ? "active" : "cool"}
            count={shownTrophies.length || undefined}
            style={{
              left: `${VAULT_RECT.left}px`,
              top: `${VAULT_RECT.top}px`,
              width: `${VAULT_RECT.width}px`,
              height: `${VAULT_RECT.height}px`,
            }}
          >
            {/* Trophy sprites — AgentSprite with state=vault (AC-06-005.1) */}
            {shownTrophies.map(({ wo: twoId }, idx) => {
              const vaultX = VAULT_X0 + idx * VAULT_DX - VAULT_RECT.left;
              const vaultY = VAULT_Y - VAULT_RECT.top - SPRITE_HALF;
              return (
                <div
                  key={twoId}
                  data-testid={`fragua-trophy-${twoId}`}
                  title={twoId}
                  role="img"
                  aria-label={`Trofeo: ${twoId} verificado`}
                  style={{ position: "absolute", left: vaultX, top: vaultY }}
                >
                  <AgentSprite agentRole="implementer" state="vault" woId={twoId} />
                </div>
              );
            })}

            {/* "+N archivados" compact indicator (AC-06-005.2) */}
            {archivedCount > 0 && (
              <span
                data-testid="fragua-archived"
                style={{
                  ...ARCHIVED_STYLE,
                  right: `${VAULT_RECT.width - VAULT_MORE_POS[0] + VAULT_RECT.left}px`,
                  top: `${VAULT_MORE_POS[1] - VAULT_RECT.top}px`,
                }}
                title={`${archivedCount} órdenes verificadas archivadas`}
              >
                +{archivedCount} arch.
              </span>
            )}
          </Room>
        </div>
      </div>
    </section>
  );
}
