"use client";

/**
 * WO-06-007 — PartyScene (the outer chrome shell for La Fragua)
 *
 * This is the SCENE SHELL that frames the 920×560 stage with:
 *   - Scene title "La Fragua" above the stage
 *   - MissionBar (FND-4 primitive) — FRD pipeline pips + global WO counter + effort (read-only)
 *   - FlowStrip (FND-4 primitive) — always-visible 8-beat pipeline row
 *   - FraguaScene — the living map inside the stage (rooms, sprites, bridges)
 *   - PowerOffOverlay (FND-4 primitive) — derived from snapshot.active; never a toggle
 *   - EventFeed + AchievementToast are rendered by the parent (PartyTab), not here
 *
 * Read-only invariant (DR-061, AC-06-009.1):
 *   - NO mode selector, NO pause/reset controls anywhere
 *   - Effort shown as read-only data in MissionBar (DR-061)
 *   - DemoControls are NOT rendered in production — demo-only block never ships
 *
 * Factory-off treatment (AC-06-013):
 *   - PowerOffOverlay covers the stage when snapshot.active=false
 *   - Never a blank screen; derived from real state, not a prop toggle
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only
 *   - data-testid on every significant element
 *   - Spanish aria-labels and labels
 *
 * Traceability:
 *   CMP-06-scene (shell) → REQ-06-009, REQ-06-010, REQ-06-012, REQ-06-013
 *
 * data-testid surface:
 *   party-scene               — root <section> container
 *   mission-bar-root          — MissionBar FND-4 primitive
 *   flow-strip-root           — FlowStrip FND-4 primitive
 *   fragua-scene              — FraguaScene living map (inside)
 *   power-off-overlay-root    — PowerOffOverlay FND-4 primitive
 */

import type { FlowBeat } from "@/components/modules/party/FlowStrip/FlowStrip";
import { FlowStrip } from "@/components/modules/party/FlowStrip/FlowStrip";
import { MissionBar } from "@/components/modules/party/MissionBar/MissionBar";
import { PowerOffOverlay } from "@/components/modules/party/PowerOffOverlay/PowerOffOverlay";

import { CampaignStrip } from "../CampaignStrip/CampaignStrip";
import { FraguaScene } from "../FraguaScene/FraguaScene";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PartySceneProps {
  /** The server-derived snapshot — drives everything in the scene. */
  snapshot: FraguaSnapshot;
}

// ---------------------------------------------------------------------------
// Flow strip beats (8-beat pipeline, always visible)
// Labels in Spanish (user-facing copy per AGENTS.md).
// ---------------------------------------------------------------------------

const FLOW_BEATS: readonly FlowBeat[] = [
  {
    key: "foundation",
    icon: "🧱",
    label: "Fundación",
    sub: "primitivos",
    tipBody: "El implementer forja los primitivos compartidos antes de la primera oleada.",
  },
  {
    key: "wave",
    icon: "🌊",
    label: "Oleada",
    sub: "en paralelo",
    tipBody: "Varios WO corren en paralelo según el modo (pro 2 · equilibrado 4 · potente 8).",
  },
  {
    key: "fidelity",
    icon: "🖼",
    label: "Fidelidad",
    sub: "render→mock",
    tipBody:
      "Cada WO de UI hace render→compara con el mock→corrige (×≤3) antes de IN_REVIEW. DR-056.",
  },
  {
    key: "status-note",
    icon: "📜",
    label: "Status Note",
    sub: "mano a mano",
    tipBody:
      "El pergamino viaja del WO cerrado a su dependiente: interfaces + decisiones/supuestos reales.",
  },
  {
    key: "tribunal",
    icon: "⚖️",
    label: "Tribunal",
    sub: "4 lentes",
    tipBody:
      "El Juez abre el gate cuando todos están IN_REVIEW: corrección · seguridad · calidad · visual.",
  },
  {
    key: "commit",
    icon: "✅",
    label: "Commit",
    sub: "oleada serializada",
    tipBody:
      "El motor commitea la oleada con un solo escritor serializado. Workers no tocan git. DR-060.",
  },
  {
    key: "vault",
    icon: "🏆",
    label: "Bóveda",
    sub: "WOs verificados",
    tipBody: "Los WO VERIFIED van a la Bóveda como trofeos del FRD. Más de 9 → '+N archivados'.",
  },
  {
    key: "integration",
    icon: "🔗",
    label: "Integración",
    sub: "costuras cross-FRD",
    tipBody:
      "Al cerrar el proyecto, un revisor verifica que productor y consumidor de cada contrato concuerden.",
  },
] as const;

// ---------------------------------------------------------------------------
// Mode-to-FRD-pip and effort helpers
// ---------------------------------------------------------------------------

/** Effort label in Spanish per the mock. */
function effortLabel(mode: string): string {
  const MAP: Record<string, string> = {
    pro: "potente",
    balanced: "equilibrado",
    powerful: "potente",
    deep: "profundo",
  };
  return MAP[mode] ?? mode;
}

/** Derive which flow beats are active from the snapshot. */
function activeFlowBeats(snapshot: FraguaSnapshot): string[] {
  const { running, gate, trophies, mode } = snapshot;
  const keys: string[] = [];

  if (running.length > 0) {
    // Check if it's a foundation/first WO
    if (trophies.length === 0 && running.length === 1) {
      keys.push("foundation");
    }
    keys.push("wave");
  }

  if (running.some((r) => r.state === "in_review")) {
    keys.push("tribunal");
  }

  if (gate.open) {
    keys.push("tribunal", "commit");
  }

  if (trophies.length > 0) {
    keys.push("vault");
  }

  if (mode === "deep") {
    // Deep mode relay includes status note step
    keys.push("status-note");
  }

  return [...new Set(keys)];
}

// ---------------------------------------------------------------------------
// Inline styles — CSS custom properties only
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const STAGE_WRAPPER_STYLE: React.CSSProperties = {
  position: "relative",
};

/** "18/21 FRDs" — completed vs total, from the campaign (empty → undefined). */
function missionSummary(campaign: PartySceneProps["snapshot"]["campaign"]): string | undefined {
  if (campaign === undefined || campaign.length === 0) return undefined;
  const donefrds = campaign.filter((c) => c.state === "verified").length;
  return `${donefrds}/${campaign.length} FRDs`;
}

// ---------------------------------------------------------------------------
// PartyScene component
// ---------------------------------------------------------------------------

/**
 * PartyScene — the outer chrome shell for La Fragua.
 * Frames the stage with MissionBar, FlowStrip, scene title, and
 * PowerOffOverlay. Embeds FraguaScene (the living map) inside.
 *
 * Observation-only: no mode selector, no pause/reset (DR-061).
 * Factory-off derived from snapshot.active (AC-06-013).
 *
 * @param props.snapshot - The FraguaSnapshot from the RSC PartyTab.
 */
export function PartyScene({ snapshot }: PartySceneProps): React.JSX.Element {
  const { project, mode, active } = snapshot;

  // v2 global waves: no single-FRD pip in the Misión strip (that was the mono-FRD
  // world; the Campaña below carries every FRD's state — owner, 2026-07-02).
  const frdPips: { id: string; state: "current" }[] = [];

  // When the factory is off (active false), no flow-strip beat is lit — otherwise a
  // stale "Oleada" keeps glowing as if a wave were running (AC-06-013).
  const activeKeys = active ? activeFlowBeats(snapshot) : [];

  return (
    <section
      data-testid="party-scene"
      aria-label="La Fragua — sala de construcción"
      style={ROOT_STYLE}
    >
      {/* === MissionBar — FRD pips + global WO counter + effort (read-only) === */}
      <MissionBar
        frdPips={frdPips}
        done={project.done}
        total={project.total}
        effort={`${effortLabel(mode)} · ${snapshot.wave} paralelos`}
        summary={missionSummary(snapshot.campaign)}
      />

      {/* === FlowStrip — always-visible 8-beat pipeline row (AC-06-010) === */}
      <FlowStrip beats={FLOW_BEATS} activeKeys={activeKeys} />

      {/* === La Campaña — every FRD's real state at a glance (REQ-06-019) === */}
      {snapshot.campaign !== undefined && snapshot.campaign.length > 0 && (
        <CampaignStrip campaign={snapshot.campaign} judging={snapshot.gate.judging} />
      )}

      {/* No scene-title row (owner, 2026-07-02): the tab header already titles La
          Fragua, and liveness has ONE voice — the DR-066 FreshnessBadge above. */}

      {/* === Stage wrapper — contains the living map + power-off overlay === */}
      <div style={STAGE_WRAPPER_STYLE}>
        {/* The living map: rooms, sprites, bridges */}
        <FraguaScene snapshot={snapshot} />

        {/* Power-off overlay — covers the stage when factory is powered down */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: active ? "none" : "auto",
          }}
        >
          <PowerOffOverlay off={!active} />
        </div>
      </div>
    </section>
  );
}
