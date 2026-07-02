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

import { useState } from "react";

import { AgentSprite } from "@/components/modules/party/AgentSprite/AgentSprite";
import { JudgeSprite } from "@/components/modules/party/JudgeSprite/JudgeSprite";
import { Parchment } from "@/components/modules/party/Parchment/Parchment";
import { Room } from "@/components/modules/party/Room/Room";
import { SpeechBubble } from "@/components/modules/party/SpeechBubble/SpeechBubble";
import { StoneBridge } from "@/components/modules/party/StoneBridge/StoneBridge";

import { DeepRelay } from "../DeepRelay/DeepRelay";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { useFraguaSprites } from "./useFraguaSprites";
import { useSceneLife } from "./useSceneLife";

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
const MAX_VAULT = 45;

/** Trophies per vault row; the shelf GROWS a row instead of hiding work (owner, 2026-07-02). */
const VAULT_PER_ROW = 9;

/** Vertical distance between vault rows (sprite + tag + breathing room — sized so a
 * scaled FRD champion never invades the row below). */
const VAULT_ROW_H = 78;

// ---------------------------------------------------------------------------
// Mode-display label map (Spanish, from mocks)
// ---------------------------------------------------------------------------

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
// Four lenses for the reviewer gate (AC-06-004.2) — the 4th is runtime/visual.
// The mock spells it out: "4 lentes (correctitud·seguridad·calidad·runtime/visual)".
// ---------------------------------------------------------------------------

const REVIEWER_LENSES = [
  { key: "correctness", label: "Corrección", icon: "✓" },
  { key: "security", label: "Seguridad", icon: "🔒" },
  { key: "quality", label: "Calidad", icon: "⭐" },
  { key: "runtime", label: "Runtime/visual", icon: "▶" },
] as const;

// ---------------------------------------------------------------------------
// Inline styles — CSS custom properties only (zero hardcoded colors)
// ---------------------------------------------------------------------------

const SCENE_WRAPPER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
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

// The visual judge (distinct from the four code lenses): it compares the live
// capture against the mock and blesses the baseline (DR-055/056). Mock: "el juez
// visual compara captura vs mock y bendice el baseline".
const VISUAL_JUDGE_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  padding: "0 calc(var(--spacing, 0.25rem) * 0.5)",
  background: "var(--color-accent-bg)",
  borderRadius: "var(--radius, 0.25rem)",
  border: "1px solid var(--color-accent)",
  color: "var(--color-accent-text)",
};

/** One ambient smoke puff over the forge chimney (animated by .fragua-smoke). */
const SMOKE_PUFF_STYLE: React.CSSProperties = {
  position: "absolute",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "var(--color-text-muted, currentColor)",
  opacity: 0,
};

// ---------------------------------------------------------------------------
// TribunalLine — the serialized gate queue chips (v2, BL-0021)
// ---------------------------------------------------------------------------

const TRIBUNAL_LINE_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "12px",
  bottom: "8px",
  right: "12px",
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  alignItems: "center",
  fontSize: "10px",
  fontFamily: "var(--font-display, system-ui)",
  zIndex: 4,
};

const TRIBUNAL_JUDGING_STYLE: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: "var(--radius, 0.5rem)",
  background: "var(--color-warn-bg, oklch(0.35 0.08 80 / 0.35))",
  color: "var(--color-warn, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-warn, currentColor)",
};

const TRIBUNAL_QUEUED_STYLE: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  color: "var(--color-text-muted, currentColor)",
};

/** Gates run one at a time (BL-0021): the FRD in session + the FRDs waiting in line. */
function TribunalLine({
  judging,
  queue,
}: {
  judging: string | null;
  queue: readonly string[];
}): React.JSX.Element | null {
  const waiting = queue.filter((q) => q !== judging);
  if (judging === null && waiting.length === 0) return null;
  return (
    <div data-testid="fragua-tribunal-line" style={TRIBUNAL_LINE_STYLE}>
      {judging !== null && (
        <span
          data-testid="fragua-tribunal-judging"
          title={`${judging} — en sesión ante el juez`}
          style={TRIBUNAL_JUDGING_STYLE}
        >
          ⚖️ en sesión: {judging}
        </span>
      )}
      {waiting.map((q) => (
        <span
          key={q}
          data-testid={`fragua-tribunal-queued-${q}`}
          title={`${q} — esperando su juicio (los gates corren de a uno)`}
          style={TRIBUNAL_QUEUED_STYLE}
        >
          {q}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RunningSprite — one moving WO on the stage (sprite + FRD banner + bubble)
// ---------------------------------------------------------------------------

/** Real elapsed-time bubble copy — never a fabricated progress value. */
function bubbleText(item: FraguaSnapshot["running"][number], nowMs: number): string {
  const place = item.state === "in_review" ? "ante el juez" : "al fuego";
  if (item.startedAtMs !== undefined && nowMs > item.startedAtMs) {
    const mins = Math.max(1, Math.round((nowMs - item.startedAtMs) / 60_000));
    return `${item.wo} · ${mins} min ${place}`;
  }
  return `${item.wo} · ${place}`;
}

/** One running WO: the walking sprite, its FRD color banner and (when its turn
 * comes) the conversational bubble with REAL elapsed time (Fase 2). */
function RunningSprite({
  item,
  slot,
  mode,
  speaking,
  nowMs,
  refCb,
}: {
  item: FraguaSnapshot["running"][number];
  slot: readonly [number, number] | undefined;
  mode: FraguaSnapshot["mode"];
  speaking: boolean;
  nowMs: number;
  refCb: (el: HTMLDivElement | null) => void;
}): React.JSX.Element {
  const initLeft = (slot?.[0] ?? 0) - SPRITE_HALF;
  const initTop = (slot?.[1] ?? 0) - SPRITE_HALF;
  return (
    <div
      ref={refCb}
      data-testid={`fragua-wo-${item.wo}`}
      data-wo={item.wo}
      data-frd={item.frd}
      title={`${item.wo} — ${item.title}${item.frd !== undefined ? ` · ${item.frd}` : ""}`}
      style={{ position: "absolute", left: `${initLeft}px`, top: `${initTop}px`, zIndex: 6 }}
    >
      {mode === "deep" ? (
        <DeepRelay
          wo={item.wo}
          relay={item.relay ?? { step: "test", contractPublished: false }}
          hasFrontend={item.relay !== undefined}
        />
      ) : (
        <AgentSprite
          agentRole="implementer"
          state={woStateToSpriteState(item.state)}
          woId={item.wo}
        />
      )}
      {/* FRD marker (v2 global scene): a small dot, not a bar — the bar read as a
          loader (owner, 2026-07-02). Decorative: the frd id itself travels in
          data-frd + the tooltip, never color alone. */}
      {item.colorKey !== undefined && (
        <span
          data-testid={`fragua-wo-banner-${item.wo}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "-7px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: `var(${item.colorKey})`,
            opacity: 0.9,
          }}
        />
      )}
      {speaking && <SpeechBubble text={bubbleText(item, nowMs)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InfirmaryCorner — BLOCKED WOs get a bed, never a hidden queue slot (Fase 2)
// ---------------------------------------------------------------------------

/** Beds shown before compacting to "+N". */
const MAX_INFIRMARY_BEDS = 3;

/** The enfermería — a small corner patch inside the forge, shown ONLY when a
 * blocked WO occupies a bed (owner, 2026-07-02 v2: being a corner sticker and not
 * a full room, a permanent empty hut read stranger than the pop-in; it overlays
 * nothing, so appearing never pushes the vault or breaks a bridge). */
function InfirmaryCorner({
  beds,
}: {
  beds: NonNullable<FraguaSnapshot["infirmary"]>;
}): React.JSX.Element | null {
  if (beds.length === 0) return null;
  const empty = false;
  const shown = beds.slice(0, MAX_INFIRMARY_BEDS);
  return (
    <div
      data-testid="fragua-infirmary"
      data-empty={empty ? "true" : undefined}
      role="img"
      aria-label={
        empty
          ? "Enfermería vacía — ninguna orden bloqueada"
          : `Enfermería: ${beds.length} orden(es) bloqueada(s) esperando al owner`
      }
      style={{
        position: "absolute",
        left: `${FORGE_RECT.left + 10}px`,
        top: `${FORGE_RECT.top + FORGE_RECT.height - 78}px`,
        display: "flex",
        alignItems: "flex-end",
        gap: "4px",
        padding: "4px 8px",
        borderRadius: "var(--radius, 0.5rem)",
        border: empty
          ? "var(--hairline, 1px) dashed var(--color-border-strong, currentColor)"
          : "var(--hairline, 1px) dashed var(--color-danger, currentColor)",
        // The infirmary pixel-art room, dimmed so the resting sprites read on top.
        background:
          "linear-gradient(oklch(0.18 0.05 25 / 0.6), oklch(0.18 0.05 25 / 0.6)), url(/prototype/assets/zones/infirmary.png) center / cover",
        minWidth: "112px",
        minHeight: "44px",
        opacity: empty ? 0.85 : 1,
        transition: "opacity 0.4s ease, border-color 0.4s ease",
        zIndex: 5,
      }}
    >
      <span
        style={{
          fontSize: "10px",
          fontFamily: "var(--font-display, system-ui)",
          color: empty
            ? "var(--color-text-muted, currentColor)"
            : "var(--color-danger, currentColor)",
        }}
      >
        🏥
      </span>
      {empty && (
        <span
          style={{
            fontSize: "11px",
            fontFamily: "var(--font-display, system-ui)",
            color: "var(--color-text-muted, currentColor)",
            paddingBottom: "2px",
          }}
        >
          sin heridos
        </span>
      )}
      {shown.map((bed) => (
        <span
          key={bed.wo}
          title={`${bed.wo}${bed.frd !== undefined ? ` · ${bed.frd}` : ""} — bloqueado (te espera)`}
        >
          <AgentSprite agentRole="implementer" state="idle" woId={bed.wo} />
        </span>
      ))}
      {beds.length > shown.length && (
        <span
          style={{
            fontSize: "10px",
            fontFamily: "var(--font-display, system-ui)",
            color: "var(--color-danger, currentColor)",
          }}
        >
          +{beds.length - shown.length}
        </span>
      )}
    </div>
  );
}

/** "frd-02-ideas-board" → "FRD-02" (the stacked-trophy tag). */
function frdShortLabel(frdId: string): string {
  const m = /^frd-(\d+)/.exec(frdId);
  return m ? `FRD-${m[1]}` : frdId;
}

/**
 * Vault room — the verified-WO trophy shelf (AC-06-005.1) plus the compact
 * "+N arch." indicator (AC-06-005.2). A fully-verified FRD arrives as ONE
 * `group` entry and renders as a stacked trophy. Trophies come pre-capped at
 * MAX_VAULT.
 */
function VaultRoom({
  trophies,
  archivedCount,
  extraHeight,
}: {
  trophies: FraguaSnapshot["trophies"];
  archivedCount: number;
  extraHeight: number;
}): React.JSX.Element {
  return (
    <div data-testid="fragua-room-vault" style={{ display: "contents" }}>
      <Room
        zone="vault"
        label="🏆 Bóveda · trofeos"
        state={trophies.length > 0 ? "active" : "cool"}
        count={trophies.length + archivedCount || undefined}
        style={{
          left: `${VAULT_RECT.left}px`,
          top: `${VAULT_RECT.top}px`,
          width: `${VAULT_RECT.width}px`,
          height: `${VAULT_RECT.height + extraHeight}px`,
          transition: "height 0.5s ease",
        }}
      >
        {/* Trophy sprites (AC-06-005.1). A COMPLETED FRD collapses into ONE stacked
            trophy labelled FRD-NN (owner, 2026-07-02) — two ghost sprites behind the
            front one suggest the pile; a loose verified WO keeps its single statuette.
            No color bands here: identity lives in the tooltip/label, and a finished
            shelf needs no "loader" marks. */}
        {trophies.map((t, idx) => {
          const vaultX = VAULT_X0 + (idx % VAULT_PER_ROW) * VAULT_DX - VAULT_RECT.left;
          const vaultY =
            VAULT_Y - VAULT_RECT.top - SPRITE_HALF + Math.floor(idx / VAULT_PER_ROW) * VAULT_ROW_H;
          const isGroup = t.group !== undefined;
          const label = isGroup ? frdShortLabel(t.wo) : t.wo;
          const title = isGroup
            ? `${t.wo} — FRD completo · ${t.group?.count} WO verificados`
            : `${t.wo}${t.frd !== undefined ? ` · ${t.frd}` : ""}`;
          return (
            <div
              key={t.wo}
              data-testid={`fragua-trophy-${t.wo}`}
              data-frd={t.frd}
              data-group={isGroup ? "true" : undefined}
              title={title}
              role="img"
              aria-label={
                isGroup
                  ? `Trofeo: ${label} completo (${t.group?.count} órdenes verificadas)`
                  : `Trofeo: ${t.wo} verificado`
              }
              style={{
                position: "absolute",
                left: vaultX,
                top: vaultY,
                transition: "left 0.5s ease, top 0.5s ease",
              }}
            >
              {/* A completed FRD reads bigger, not busier (owner, 2026-07-02): ONE
                  champion sprite scaled up + a 🏆 mark — instantly distinguishable
                  from a normal-size loose WO without pile clutter. */}
              {isGroup ? (
                <span
                  style={{
                    display: "inline-block",
                    transform: "scale(1.18)",
                    transformOrigin: "bottom center",
                    position: "relative",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: "-8px",
                      left: "-4px",
                      fontSize: "12px",
                      zIndex: 1,
                      filter: "drop-shadow(0 1px 1px oklch(0 0 0 / 0.6))",
                    }}
                  >
                    🏆
                  </span>
                  <AgentSprite agentRole="implementer" state="vault" woId={label} />
                </span>
              ) : (
                <AgentSprite agentRole="implementer" state="vault" woId={label} />
              )}
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
            title={`${archivedCount} trofeos más allá de la vitrina (5 filas)`}
          >
            +{archivedCount} más
          </span>
        )}
      </Room>
    </div>
  );
}

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
  const { mode, running, queuedCount, gate, trophies, archivedCount } = snapshot;

  // -------------------------------------------------------------------------
  // Reduced-motion detection (FRD-13, AC-06-010.2)
  // -------------------------------------------------------------------------
  const [reducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  // -------------------------------------------------------------------------
  // Engine lifecycle + RAF loop — drives the stage-level sprite layer.
  // React owns the sprite LIST (from `running`); the RAF loop owns their
  // POSITIONS, read from `engine.wos()` and written imperatively each frame so
  // a WO actually WALKS between rooms along the bridges (AC-06-003.2).
  // -------------------------------------------------------------------------
  const { registerSprite } = useFraguaSprites({
    // v2 global scene: the engine persists across the WHOLE build — sprites of
    // every FRD share the stage, so a change of the judged/focused FRD must
    // NOT reset in-flight walks (the diff effect retires departed WOs).
    frdId: "fragua-global",
    running,
    trophies,
    gate,
    mode,
    wave: snapshot.wave,
    reducedMotion,
  });

  // Fase-2 "vida": bubble rotation + real-elapsed clock + courier cue.
  const life = useSceneLife({
    runningCount: running.length,
    lastCommitAt: snapshot.lastCommit?.at,
    reducedMotion,
  });

  // -------------------------------------------------------------------------
  // Compute sprite slots per mode (used only for the first-paint static fallback;
  // the engine drives the live positions through `registerSprite`).
  // -------------------------------------------------------------------------
  const forgeSlots = mode === "deep" ? DEEP_SLOTS : FORGE_SLOTS;

  // Determine flow: bridges flow when WOs are running
  const hasRunning = running.length > 0;

  // Vault trophies to render (capped at MAX_VAULT = 5 rows; beyond that "+N más")
  const shownTrophies = trophies.slice(0, MAX_VAULT);
  // The shelf grows a row per 9 entries instead of hiding finished work behind a
  // counter (owner, 2026-07-02); the stage grows with it (smooth height transition).
  const vaultRows = Math.max(1, Math.ceil(shownTrophies.length / VAULT_PER_ROW));
  // +18px once multi-row: the LAST row's name tags need clearance from the stage edge.
  const vaultExtraH = (vaultRows - 1) * VAULT_ROW_H + (vaultRows > 1 ? 18 : 0);

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
      {/* No header here (owner, 2026-07-02): the FRD focus, the global counter and
          the mode all live ONCE in the MissionBar/Campaña above — the scene starts
          at the stage. */}

      {/* =====================================================================
          920×560 bounded stage — all rooms, bridges, sprites positioned here
          ===================================================================== */}
      <div
        data-testid="fragua-stage"
        style={{
          ...STAGE_STYLE,
          height: `${STAGE_H + vaultExtraH}px`,
          transition: "height 0.5s ease",
        }}
      >
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
            Stone bridges — sit BELOW the rooms (z-index 0): their endpoints
            overlap the room rectangles, so the room art occludes them.
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
            {/* Running WO sprites are NOT rendered here anymore: they live in
                the stage-level sprite layer (below the rooms in this file) so the
                engine can WALK them between rooms along the bridges (AC-06-003.2).
                The forge Room stays as a background layer. */}

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

              {/* Four lenses + the visual judge — shown when gate is open (AC-06-004.2/.3) */}
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
                  {/* The visual judge: capture vs mock + baseline (AC-06-004.3) */}
                  <span
                    data-testid="fragua-visual-judge"
                    title="Juez visual — compara captura vs mock y bendice el baseline"
                    style={VISUAL_JUDGE_STYLE}
                  >
                    📸
                  </span>
                </div>
              )}

              {/* WOs in review are NOT rendered here anymore: an in_review WO is
                  a moving sprite that WALKS forge→tribunal, so it lives in the
                  stage-level sprite layer (AC-06-003.2), not as a static slot. */}

              {/* Tribunal line (v2, BL-0021): gates are SERIALIZED — one FRD in
                  session, the rest waiting. Real queue from the frontmatter. */}
              <TribunalLine judging={gate.judging ?? null} queue={gate.queue ?? []} />
            </div>
          </Room>
        </div>

        {/* ================================================================
            VAULT — Bóveda (verified trophies)
            ================================================================ */}
        <VaultRoom
          trophies={shownTrophies}
          archivedCount={archivedCount}
          extraHeight={vaultExtraH}
        />

        {/* ================================================================
            STAGE-LEVEL SPRITE LAYER — the MOVING WO sprites (forge + tribunal).
            One wrapper per running WO, positioned in STAGE coordinates and
            driven imperatively from `engine.wos()` every frame (see
            useFraguaSprites) so a WO WALKS between rooms (AC-06-003.2).
            Verified trophies stay in the vault Room above (static, they don't move).
            ================================================================ */}
        {running.map((item, idx) => (
          <RunningSprite
            key={item.wo}
            item={item}
            slot={forgeSlots[idx] ?? forgeSlots[0]}
            mode={mode}
            speaking={idx === life.bubbleIndex}
            nowMs={life.nowMs}
            refCb={registerSprite(item.wo)}
          />
        ))}

        {/* Enfermería — real BLOCKED WOs resting until the owner acts (Fase 2). */}
        <InfirmaryCorner beds={snapshot.infirmary ?? []} />

        {/* Courier flight — fires on a REAL wo_commit event: the courier runs
            forge → tribunal (decorative cue anchored to the engine's commit).
            Pixel art requires <img> with image-rendering:pixelated (same as
            AgentSprite), not next/image. */}
        {life.courierVisible && (
          <div
            data-testid="fragua-courier"
            aria-hidden="true"
            className="fragua-courier-flight"
            style={{
              position: "absolute",
              left: `${PARCHMENT_START[0]}px`,
              top: `${PARCHMENT_START[1]}px`,
              zIndex: 7,
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: pixel-art sprite needs image-rendering:pixelated (next/image re-encodes) — same rationale as AgentSprite. */}
            <img
              src="/prototype/assets/agents/courier.png"
              alt=""
              width={52}
              height={52}
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        )}

        {/* Panda mascot — pure ambient decoration: strolls across the stage
            bottom on a long CSS loop; hidden under prefers-reduced-motion. */}
        <div
          data-testid="fragua-panda"
          aria-hidden="true"
          className="fragua-panda-walk"
          style={{
            position: "absolute",
            bottom: "2px",
            left: "-56px",
            zIndex: 8,
            pointerEvents: "none",
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: pixel-art sprite needs image-rendering:pixelated (next/image re-encodes) — same rationale as AgentSprite. */}
          <img
            src="/prototype/assets/agents/panda-mascot.png"
            alt=""
            width={44}
            height={44}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Ambient chimney smoke over the forge — pure-CSS decoration. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${FORGE_RECT.left + 96}px`,
            top: `${FORGE_RECT.top + 16}px`,
            zIndex: 3,
          }}
        >
          <span className="fragua-smoke" style={SMOKE_PUFF_STYLE} />
          <span className="fragua-smoke-late" style={{ ...SMOKE_PUFF_STYLE, left: "12px" }} />
        </div>
      </div>
    </section>
  );
}
