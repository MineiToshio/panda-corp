"use client";

/**
 * CampaignPipeline — La Campaña: the 6-phase pixel-art pipeline view (CMP-02-campaign-pipeline).
 *
 * Traceability:
 *   CMP-02-campaign-pipeline → REQ-02-010
 *   AC-02-010.1 — 6-phase pipeline in order inside a labelled container.
 *   AC-02-010.3 — done / current / locked state by position vs activePhase.
 *   AC-02-010.4 — per-phase ficha: description + LEE/ESCRIBE + the WHOLE team.
 *   AC-02-010.5 — build phase "Entrar a La Fragua" calls onEnterForge(slug).
 *   AC-02-010.6 — read-only: no write, no network, no fs, no Claude call.
 *   AC-02-010.7 — locked future phases render a graceful locked/empty state.
 *
 * Architecture (DR-057 / WO-13-009):
 *   Built from shared Party canvas primitives — Room · StoneBridge · AgentSprite
 *   — reproducing mocks/la-campana.html on frozen design tokens.
 *   Static phase model (PHASES, TeamMember, PhaseDefinition) lives in ./phases.ts.
 *   "use client" is required: useState (selected phase) + onClick handlers.
 *
 * Stage layout (faithful to la-campana.html):
 *   920 × 560 dark canvas with a 30px dot-grid.
 *   Serpentine: top row L→R (rooms 0,1,2), step down, bottom row R→L (rooms 3,4,5).
 *   Room size: 250 × 208px (FDD-02 §2 / party.roomSizes_px.campanaRoom).
 *
 * Design rules (AGENTS.md):
 *   - Zero hardcoded color values — all via CSS custom properties / party structural literals.
 *   - data-testid on every significant interactive element.
 *   - Spanish aria-labels and user-facing copy.
 *   - Read-only: no writes, no fs calls, no network calls, no Claude calls.
 *
 * Party structural literals (design-tokens.json partyStructural — intentional, not tokens):
 *   rgba(12,17,19,.82) — room scrim background (Room primitive uses this directly).
 */

import { useState } from "react";
import { AgentSprite } from "@/components/modules/party/AgentSprite/AgentSprite";
import { Room } from "@/components/modules/party/Room/Room";
import { StoneBridge } from "@/components/modules/party/StoneBridge/StoneBridge";
import type { CampaignPhase } from "@/lib/campaign/campaign";
import type { PhaseDefinition } from "./phases";
import { PHASES } from "./phases";
import { RoamingCast, type RoamingCastMember } from "./RoamingCast";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Props for CampaignPipeline. */
export interface CampaignPipelineProps {
  /** The project/idea slug — forwarded to onEnterForge (AC-02-010.5). */
  slug: string;
  /** Active phase index 0–5, derived from phaseFromStatus (WO-02-011). */
  activePhase: CampaignPhase;
  /**
   * Host-navigation callback wired to goToParty (WO-02-012).
   * Called when the user activates "Entrar a La Fragua" in the build phase.
   * @param slug - the project/idea slug.
   */
  onEnterForge: (slug: string) => void;
}

// ---------------------------------------------------------------------------
// Phase state type
// ---------------------------------------------------------------------------

type PhaseState = "done" | "current" | "locked";

// ---------------------------------------------------------------------------
// Stage layout constants (faithful to la-campana.html)
// ---------------------------------------------------------------------------

/** Room size: 250×208px (FDD-02 §2 / party.roomSizes_px.campanaRoom). */
const ROOM_W = 250;
const ROOM_H = 208;

/**
 * Serpentine positions [left, top] for each of the 6 rooms on the 920×560 stage.
 * Top row L→R (0,1,2), step down, bottom row R→L (3,4,5).
 */
const ROOM_POS: ReadonlyArray<readonly [number, number]> = [
  [18, 46],
  [335, 46],
  [652, 46],
  [652, 306],
  [335, 306],
  [18, 306],
];

/**
 * Room zone identifiers for each campaign phase.
 * product=spec (review.png), design=design (frontend.png).
 */
const PHASE_ZONE = ["research", "spec", "design", "architecture", "build", "release"] as const;

/** Sprite home positions [left, top] inside a room, by team size (1,2,3 members). */
const SPRITE_HOMES: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[97, 84]],
  2: [
    [52, 82],
    [144, 82],
  ],
  3: [
    [34, 80],
    [97, 94],
    [160, 80],
  ],
};

/** Bridge descriptors: one per connector between consecutive rooms. */
interface BridgeDesc {
  fromIdx: number;
  orientation: "h" | "v";
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 5 StoneBridge connectors (positions faithful to la-campana.html conn() calls). */
const BRIDGES: ReadonlyArray<BridgeDesc> = [
  { fromIdx: 0, orientation: "h", left: 268, top: 143, width: 67, height: 16 },
  { fromIdx: 1, orientation: "h", left: 585, top: 143, width: 67, height: 16 },
  { fromIdx: 2, orientation: "v", left: 770, top: 254, width: 16, height: 52 },
  { fromIdx: 3, orientation: "h", left: 585, top: 403, width: 67, height: 16 },
  { fromIdx: 4, orientation: "h", left: 268, top: 403, width: 67, height: 16 },
];

/**
 * Per-phase presentation meta (emoji · short deliverable name · accent colour),
 * faithful to the prototype PHASES `emo` / `deliver` / `col` (party-pipeline.html
 * L171-197). Index 0–5 = phase. The room shows `{emo} {deliver}`; a bridge from a
 * phase carries that phase's deliverable; the ficha header tints `{n · name}` in `col`.
 */
const PHASE_META: ReadonlyArray<{ emo: string; deliver: string; col: string }> = [
  { emo: "🔍", deliver: "research.md", col: "var(--color-cat-8)" },
  { emo: "📋", deliver: "PRD + FRDs", col: "var(--color-cat-2)" },
  { emo: "🎨", deliver: "sistema + mocks", col: "var(--color-cat-3)" },
  { emo: "📐", deliver: "blueprint + Build Plan", col: "var(--color-cat-4)" },
  { emo: "⚒️", deliver: "el código", col: "var(--color-cat-7)" },
  { emo: "🚀", deliver: "auditoría + deploy", col: "var(--color-cat-9)" },
];

/**
 * Delivery state of a bridge, by its source phase index vs the active phase:
 *   fromIdx < active-1 → done (✓) · fromIdx === active-1 → flow (→) · else locked.
 */
function bridgeDeliverState(fromIdx: number, activePhase: number): "done" | "flow" | "locked" {
  if (fromIdx === activePhase - 1) return "flow";
  if (fromIdx < activePhase - 1) return "done";
  return "locked";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPhaseState(index: number, activePhase: CampaignPhase): PhaseState {
  if (index < activePhase) return "done";
  if (index === activePhase) return "current";
  return "locked";
}

function phaseStateToRoomState(state: PhaseState): "done" | "active" | "locked" {
  if (state === "done") return "done";
  if (state === "current") return "active";
  return "locked";
}

function phaseBadgeLabel(state: PhaseState): string {
  if (state === "done") return "✓ Completada";
  if (state === "current") return "● Activa";
  return "🔒 Bloqueada";
}

/** Ficha header state label (prototype renderDetail: completada / EN CURSO / en espera). */
function fichaStateLabel(state: PhaseState): string {
  if (state === "done") return "completada";
  if (state === "current") return "EN CURSO";
  return "en espera";
}

// ---------------------------------------------------------------------------
// AgentSpriteRole type guard
// ---------------------------------------------------------------------------

const VALID_AGENT_ROLES = new Set([
  "implementer",
  "reviewer",
  "test-writer",
  "backend-dev",
  "frontend-dev",
  "researcher",
  "designer",
  "architect",
  "product-manager",
  "copywriter",
  "analytics",
  "devops",
  "security-auditor",
]);

type ValidAgentRole = Parameters<typeof AgentSprite>[0]["agentRole"];

function isValidAgentRole(role: string): role is ValidAgentRole {
  return VALID_AGENT_ROLES.has(role);
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; party structural rgba literals are intentional.
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  // The campana tab body is one bordered panel (prototype detailView campana .panel):
  // header (left) + full-width stage (rooms centred) + ficha, sitting below the tabs.
  padding: "10px 12px",
  background: "var(--color-panel, var(--color-surface, Canvas))",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md, 12px)",
};

const CONTAINER_HEADING_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "6px",
  flexWrap: "wrap",
  fontSize: "0.6875rem",
  fontWeight: 400,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text3, var(--color-text-muted, currentColor))",
  margin: 0,
  padding: "0 calc(var(--spacing, 0.25rem) * 2)",
};

const CONTAINER_HEADING_ICON_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-accent-text)",
};

const CONTAINER_HEADING_HINT_STYLE: React.CSSProperties = {
  color: "var(--color-text3, var(--color-text-muted, currentColor))",
  fontWeight: 400,
  textTransform: "none",
  letterSpacing: 0,
};

const STAGE_STYLE: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "560px",
  borderRadius: "14px",
  overflow: "hidden",
  border: "1px solid var(--color-border)",
  background: "radial-gradient(760px 380px at 50% 46%, #16201d 0%, transparent 72%), #0c1113",
  imageRendering: "pixelated",
};

/** Inner rooms layer — the 920×560 serpentine, centred in the full-width stage. */
const STAGE_INNER_STYLE: React.CSSProperties = {
  position: "relative",
  width: "920px",
  maxWidth: "100%",
  height: "560px",
  margin: "0 auto",
};

const FICHA_WRAPPER_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 2) 0",
};

const FICHA_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

/** Ficha header — "{n · name} — {state}" (prototype `.detail h3`). */
const FICHA_HEADER_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-pixel, monospace)",
  fontWeight: 500,
  fontSize: "18px",
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "9px",
  flexWrap: "wrap",
};

const FICHA_HEADER_STATE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted))",
};

const FICHA_SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

const FICHA_SECTION_VALUE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.5,
  margin: 0,
};

const FICHA_LOCKED_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  alignItems: "center",
  padding: "calc(var(--spacing, 0.25rem) * 6) 0",
};

const FICHA_SUBSECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const TEAM_MEMBER_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  alignItems: "flex-start",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-card, var(--color-surface-panel, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "10px",
  flex: "1 1 230px",
  minWidth: "220px",
  maxWidth: "330px",
};

const TEAM_MEMBER_ROLE_KEY_STYLE: React.CSSProperties = {
  fontSize: "0.5625rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  fontFamily: "var(--font-mono, monospace)",
  margin: "2px 0 3px",
  display: "block",
};

const TEAM_MEMBER_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  fontFamily: "var(--font-pixel, monospace)",
  display: "block",
};

const TEAM_MEMBER_WHAT_STYLE: React.CSSProperties = {
  fontSize: "0.71875rem",
  color: "var(--color-text2, var(--color-text-muted, currentColor))",
  lineHeight: 1.4,
};

const ENTER_FORGE_BUTTON_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 12px",
  background: "var(--color-accent-bg, var(--color-accent, currentColor))",
  color: "var(--color-accent-text, var(--color-accent, currentColor))",
  border: "1px solid var(--color-accent, currentColor)",
  borderRadius: "8px",
  fontFamily: "var(--font-display, inherit)",
  fontWeight: 500,
  fontSize: "0.8125rem",
  cursor: "pointer",
  alignSelf: "flex-start",
};

const ROOM_BUTTON_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "none",
  border: "none",
  cursor: "pointer",
  zIndex: 4,
  outline: "none",
};

const LOCK_ICON_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "46%",
  transform: "translate(-50%, -50%)",
  fontSize: "30px",
  zIndex: 4,
  opacity: 0.85,
  pointerEvents: "none",
};

const DELIVERABLE_CHIP_WRAPPER_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 9,
  right: 9,
  bottom: 8,
  display: "flex",
  alignItems: "center",
  gap: 7,
  zIndex: 5,
  pointerEvents: "none",
};

// ---------------------------------------------------------------------------
// PhaseBadge — top-right status chip inside a room
// ---------------------------------------------------------------------------

function phaseBadgeStyle(state: PhaseState): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    top: 8,
    right: 9,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "10px",
    borderRadius: "20px",
    padding: "1px 8px",
    zIndex: 5,
    border: "1px solid",
    pointerEvents: "none",
  };
  if (state === "done") {
    return {
      ...base,
      color: "var(--color-ok)",
      background: "var(--color-ok-bg)",
      borderColor: "var(--color-ok)",
    };
  }
  if (state === "current") {
    return {
      ...base,
      color: "var(--color-accent-text)",
      background: "var(--color-accent-bg)",
      borderColor: "var(--color-accent)",
    };
  }
  return {
    ...base,
    color: "var(--color-text3, var(--color-text-muted))",
    background: "var(--color-card)",
    borderColor: "var(--color-border-strong)",
  };
}

function phaseBadgeText(state: PhaseState): string {
  if (state === "done") return "✓ entregado";
  if (state === "current") return "● en curso";
  return "🔒 en espera";
}

// ---------------------------------------------------------------------------
// DeliverableChip — the deliverable label at the bottom of a visible room
// ---------------------------------------------------------------------------

function deliverableChipStyle(state: PhaseState): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "11px",
    background: "rgba(12,17,19,.82)",
    border: "1px solid var(--color-border-strong)",
    borderRadius: "7px",
    padding: "2px 8px",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  };
  if (state === "done")
    return { ...base, color: "var(--color-ok)", borderColor: "var(--color-ok)" };
  return { ...base, color: "var(--color-text)" };
}

// ---------------------------------------------------------------------------
// PhaseRoom — renders a single Room with its contents (button + badge + sprites + deliverable)
// ---------------------------------------------------------------------------

interface PhaseRoomProps {
  phase: PhaseDefinition;
  index: number;
  state: PhaseState;
  isSelected: boolean;
  onPhaseClick: (key: string) => void;
}

function PhaseRoom({
  phase,
  index,
  state,
  isSelected,
  onPhaseClick,
}: PhaseRoomProps): React.JSX.Element {
  const roomState = phaseStateToRoomState(state);
  const pos = ROOM_POS[index] ?? [0, 0];
  const num = index + 1;
  const ariaLabel = `${num} ${phase.name}`;
  const meta = PHASE_META[index];
  const zone = PHASE_ZONE[index] ?? "research";
  const homes = SPRITE_HOMES[phase.team.length] ?? SPRITE_HOMES[1] ?? [];
  const castMembers: RoamingCastMember[] = [];
  for (const member of phase.team) {
    if (isValidAgentRole(member.role)) {
      castMembers.push({ role: member.role, label: member.label, lead: castMembers.length === 0 });
    }
  }

  const roomStyle: React.CSSProperties = {
    left: pos[0],
    top: pos[1],
    width: ROOM_W,
    height: ROOM_H,
    zIndex: 2,
    cursor: "pointer",
    outline: isSelected ? "2px solid var(--color-accent-text, var(--color-accent))" : undefined,
    outlineOffset: isSelected ? "2px" : undefined,
  };

  return (
    <Room
      key={phase.key}
      zone={zone}
      label={ariaLabel}
      labelNode={
        <>
          <span style={{ color: "var(--color-accent-text)" }}>{num}</span> {phase.name}
        </>
      }
      state={roomState}
      style={roomStyle}
    >
      {/* Transparent overlay button — carries testid/a11y attrs; Room<section> cannot be role=button */}
      <button
        data-testid={`campaign-phase-${phase.key}`}
        data-phase-state={state}
        type="button"
        aria-label={`Fase ${index + 1}: ${phase.name} — ${phaseBadgeLabel(state)}`}
        aria-expanded={isSelected}
        aria-pressed={isSelected}
        onClick={() => onPhaseClick(phase.key)}
        style={ROOM_BUTTON_STYLE}
      />

      {/* Status badge (top-right) */}
      <span aria-hidden="true" style={phaseBadgeStyle(state)}>
        {phaseBadgeText(state)}
      </span>

      {/* Lock overlay for locked phases */}
      {state === "locked" && (
        <span aria-hidden="true" style={LOCK_ICON_STYLE}>
          🔒
        </span>
      )}

      {/* Agent sprites — roam in the active room, idle-bob when done, static when locked */}
      <RoamingCast members={castMembers} homes={homes} state={state} />

      {/* Deliverable chip — bottom of room (hidden for locked). Owner: drop the
          "entrega ▸" label + arrow — just the icon + short artifact name (prototype `.art`). */}
      {state !== "locked" && meta != null && (
        <div aria-hidden="true" style={DELIVERABLE_CHIP_WRAPPER_STYLE}>
          <span style={deliverableChipStyle(state)}>
            <span>{meta.emo}</span> {meta.deliver}
          </span>
        </div>
      )}
    </Room>
  );
}

// ---------------------------------------------------------------------------
// FichaContent — the content shown when a phase is clicked.
// ---------------------------------------------------------------------------

interface FichaContentProps {
  phase: PhaseDefinition;
  /** Phase index 0–5 — for the header number + accent colour. */
  phaseIndex: number;
  phaseState: PhaseState;
  slug: string;
  onEnterForge: (slug: string) => void;
}

function FichaContent({
  phase,
  phaseIndex,
  phaseState,
  slug,
  onEnterForge,
}: FichaContentProps): React.JSX.Element {
  if (phaseState === "locked") {
    return (
      <section
        data-testid="campaign-phase-ficha"
        style={FICHA_STYLE}
        aria-label={`Ficha de fase bloqueada: ${phase.name}`}
      >
        <div data-testid="ficha-locked-marker" style={FICHA_LOCKED_STYLE}>
          <span style={{ fontSize: "2rem" }}>🔒</span>
          <p
            style={{
              ...FICHA_SECTION_VALUE_STYLE,
              textAlign: "center",
              color: "var(--color-text-muted, var(--color-text, currentColor))",
            }}
          >
            Esta fase aún no está disponible. Completa las fases anteriores para desbloquearla.
          </p>
        </div>
      </section>
    );
  }

  const isBuild = phase.key === "build";

  return (
    <section
      data-testid="campaign-phase-ficha"
      style={FICHA_STYLE}
      aria-label={`Ficha de fase: ${phase.name}`}
    >
      {/* Header — "investigación EN CURSO": phase n · name (accent-tinted) + state */}
      <p data-testid="ficha-header" style={FICHA_HEADER_STYLE}>
        <span style={{ color: PHASE_META[phaseIndex]?.col ?? "var(--color-text)" }}>
          {phaseIndex + 1} · {phase.name}
        </span>
        <span style={FICHA_HEADER_STATE_STYLE}>— {fichaStateLabel(phaseState)}</span>
      </p>

      <div data-testid="ficha-description" style={FICHA_SUBSECTION_STYLE}>
        <p style={FICHA_SECTION_LABEL_STYLE}>Descripción</p>
        <p style={FICHA_SECTION_VALUE_STYLE}>{phase.description}</p>
      </div>

      <div data-testid="ficha-lee" style={FICHA_SUBSECTION_STYLE}>
        <p style={FICHA_SECTION_LABEL_STYLE}>LEE</p>
        <p style={FICHA_SECTION_VALUE_STYLE}>{phase.reads}</p>
      </div>

      <div data-testid="ficha-escribe" style={FICHA_SUBSECTION_STYLE}>
        <p style={FICHA_SECTION_LABEL_STYLE}>ESCRIBE</p>
        <p style={FICHA_SECTION_VALUE_STYLE}>{phase.writes}</p>
      </div>

      <div
        data-testid="ficha-team"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "calc(var(--spacing, 0.25rem) * 2)",
        }}
      >
        <p style={FICHA_SECTION_LABEL_STYLE}>
          {`EQUIPO DE LA FASE — ${phase.team.length} ${phase.team.length > 1 ? "especialistas que colaboran" : "especialista"}`}
        </p>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "calc(var(--spacing, 0.25rem) * 2)" }}
        >
          {phase.team.map((member) => (
            <div key={member.role} data-testid="ficha-team-member" style={TEAM_MEMBER_STYLE}>
              <AgentSprite
                agentRole={member.role as ValidAgentRole}
                state="idle"
                woId={member.role}
                style={{ position: "relative", flexShrink: 0 }}
              />
              <div>
                <span style={TEAM_MEMBER_LABEL_STYLE}>{member.label}</span>
                <span style={TEAM_MEMBER_ROLE_KEY_STYLE}>{member.role}</span>
                <span style={TEAM_MEMBER_WHAT_STYLE}>{member.what}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isBuild && (
        <button
          data-testid="ficha-enter-forge"
          type="button"
          style={ENTER_FORGE_BUTTON_STYLE}
          aria-label="Entrar a La Fragua — ver el build en vivo"
          onClick={() => onEnterForge(slug)}
        >
          ⚒️ Entrar a La Fragua →
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CampaignPipeline — the main component
// ---------------------------------------------------------------------------

/**
 * CampaignPipeline — La Campaña: the 6-phase pixel-art pipeline view.
 *
 * Built from shared Party canvas primitives (DR-057 / WO-13-009):
 *   Room · StoneBridge · AgentSprite
 *
 * Stage: 920×560 dark canvas, 30px dot-grid, serpentine room layout.
 * Fichas appear below the stage when a room is clicked.
 * "use client" because it uses useState and onClick handlers.
 *
 * @param props - slug, activePhase (0–5), onEnterForge callback.
 */
export function CampaignPipeline({
  slug,
  activePhase,
  onEnterForge,
}: CampaignPipelineProps): React.JSX.Element {
  // Default the open ficha to the ACTIVE phase so the "investigación en curso" team
  // panel shows by default (the prototype initialises sel=active), not only after a click.
  const [selectedPhaseKey, setSelectedPhaseKey] = useState<string | null>(
    () => PHASES[activePhase]?.key ?? null,
  );

  // The ficha stays open: clicking a phase selects it; clicking the open one does
  // NOT toggle it closed (owner: the detail below must always stay visible).
  const handlePhaseClick = (key: string) => {
    setSelectedPhaseKey(key);
  };

  const selectedPhase =
    selectedPhaseKey != null ? (PHASES.find((p) => p.key === selectedPhaseKey) ?? null) : null;

  const selectedPhaseIndex =
    selectedPhaseKey != null ? PHASES.findIndex((p) => p.key === selectedPhaseKey) : -1;

  const selectedPhaseState: PhaseState =
    selectedPhaseIndex >= 0 ? getPhaseState(selectedPhaseIndex, activePhase) : "locked";

  return (
    <section
      data-testid="campaign-pipeline"
      style={ROOT_STYLE}
      aria-label="La Campaña — las 6 fases del viaje de la idea"
    >
      {/* Labelled container heading (AC-02-010.1) — centred, light weight, with the
          map icon + a hint (prototype detailView wrapper, party-pipeline.html). */}
      <p style={CONTAINER_HEADING_STYLE}>
        <i className="ti ti-map-2" style={CONTAINER_HEADING_ICON_STYLE} aria-hidden="true" />
        EL VIAJE DE ESTA IDEA POR LAS 6 FASES
        <span style={CONTAINER_HEADING_HINT_STYLE}>— clic en una sala para su ficha</span>
      </p>

      {/* Stage — 920×560 dark pixel-art canvas */}
      <div data-testid="campaign-stage" style={STAGE_STYLE} data-party-stage="campana">
        {/* Inner 920×560 layer — centred in the full-width stage backdrop */}
        <div style={STAGE_INNER_STYLE}>
          {/* 5 connectors — z-index 1: the road sits UNDER the rooms; its doc chip,
              centred in the gap between rooms, stays visible */}
          {BRIDGES.map((bridge) => {
            const deliverable = PHASE_META[bridge.fromIdx];
            const deliverState = bridgeDeliverState(bridge.fromIdx, activePhase);
            return (
              <StoneBridge
                key={`bridge-${bridge.fromIdx}`}
                orientation={bridge.orientation}
                variant="road"
                flow={bridge.fromIdx === activePhase - 1}
                deliverableEmoji={deliverable?.emo}
                deliverableLabel={deliverable?.deliver}
                deliverableState={deliverState}
                style={{
                  left: bridge.left,
                  top: bridge.top,
                  width: bridge.width,
                  height: bridge.height,
                  zIndex: 1,
                }}
              />
            );
          })}

          {/* 6 Phase Rooms — z-index 2 (above the road) */}
          {PHASES.map((phase, index) => (
            <PhaseRoom
              key={phase.key}
              phase={phase}
              index={index}
              state={getPhaseState(index, activePhase)}
              isSelected={selectedPhaseKey === phase.key}
              onPhaseClick={handlePhaseClick}
            />
          ))}
        </div>
      </div>

      {/* Ficha — shown below the stage for the selected phase */}
      {selectedPhase != null && (
        <div style={FICHA_WRAPPER_STYLE}>
          <FichaContent
            phase={selectedPhase}
            phaseIndex={selectedPhaseIndex}
            phaseState={selectedPhaseState}
            slug={slug}
            onEnterForge={onEnterForge}
          />
        </div>
      )}
    </section>
  );
}
