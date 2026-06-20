"use client";

/**
 * WO-06-006 — PartyScene (CMP-06-scene)
 *
 * The RPG map: zones, stations, sprites, the RAF loop, the animation queue.
 * Wraps the engine (IF-06-engine, WO-06-004).
 *
 * Responsibilities:
 *  - Mounts the engine once on mount (createPartyEngine).
 *  - Binds it to a requestAnimationFrame loop — the loop reads engine.agents()
 *    each tick and applies transforms + state classes to sprite DOM refs.
 *  - Re-mount discipline (PARTY.md §5): each render bumps a runId via useRef;
 *    the old loop self-stops via closure. Tab-hidden pauses RAF automatically
 *    (browser default: RAF does not fire when the tab is not visible).
 *  - Calls engine.applyEvents(diff) when the events prop changes (prop-driven
 *    event dispatch — the RSC re-renders this component with new events).
 *  - Renders zones (stations) with labels — zone label stays in the station
 *    so it persists when the agent leaves for a handoff (PARTY.md §2).
 *  - Renders sprites with per-agent color and initial state class.
 *  - Observation-only: ZERO control affordances (buttons, inputs, etc.)
 *    per REQ-06-009 / AC-06-009.1.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *  - image-rendering: pixelated on all sprite/zone images.
 *  - CSS custom properties only — zero hardcoded colors.
 *  - data-testid on every significant element.
 *  - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-scene → REQ-06-001, REQ-06-002, REQ-06-003, REQ-06-004, REQ-06-009
 *   AC-06-001.1 — 4 zones with labels
 *   AC-06-002.1 — sprite per roster role in its zone
 *   AC-06-003.1 — breathing + wandering (engine handles physics; scene renders)
 *   AC-06-009.1 — observation-only (no control affordances)
 *
 * Dependencies:
 *   WO-06-004 (engine.ts) — createPartyEngine, PartyEngine, AgentSnapshot, EngineAgent
 *   WO-06-002 (layout.ts) — mcPositions, ZONE_ROLE, agentColor, Role
 *   WO-06-003 (state-map.ts) — AgentState, VisualAction
 */

import { useEffect, useRef, useState } from "react";

import type { AgentSnapshot, EngineAgent, PartyEngine } from "../engine/engine.legacy";
import { createPartyEngine } from "../engine/engine.legacy";
import type { Role } from "../layout";
import { agentColor, mcPositions, ZONE_ROLE } from "../layout";
import type { AgentState, VisualAction } from "../state-map/state-map";

// ---------------------------------------------------------------------------
// Types — public props contract
// ---------------------------------------------------------------------------

interface AgentInfo {
  /** Canonical role id (e.g. "backend-dev"). */
  id: Role;
  /** Initial visual state for this agent. */
  state: AgentState;
  /** CSS custom property value for this agent's color. */
  color: string;
}

export interface PartySceneProps {
  /** Ordered list of roles in the current build party. */
  roster: Role[];
  /** Initial agent states (server-derived snapshot). */
  agents: AgentInfo[];
  /** Whether there is an active team running. */
  active: boolean;
  /** Build mode — affects station layout (IF-06-positions). */
  mode: "pro" | "balanced" | "powerful" | "deep";
  /**
   * New visual actions since last render (prop-driven event dispatch).
   * The component calls engine.applyEvents(events) whenever this changes.
   * Optional — if absent, no events are applied on this render.
   */
  events?: VisualAction[];
}

// ---------------------------------------------------------------------------
// Zone metadata — labels and zone background images
// The 4 canonical Party zones (AC-06-001.1 / REQ-06-001)
// ---------------------------------------------------------------------------

type ZoneName = "library" | "forge" | "workshop" | "lab";

interface ZoneMeta {
  name: ZoneName;
  /** Spanish display label (UI copy in Spanish per AGENTS.md) */
  label: string;
  /** Path to zone background image (pixel-art room, PARTY.md §6) */
  bgSrc: string;
  /** Canonical role that "owns" this zone (ZONE_ROLE). */
  role: Role;
}

const ZONES: ZoneMeta[] = [
  {
    name: "library",
    label: "Biblioteca",
    bgSrc: "/prototype/assets/zones/research.png",
    role: ZONE_ROLE.library,
  },
  {
    name: "forge",
    label: "Forja",
    bgSrc: "/prototype/assets/zones/backend.png",
    role: ZONE_ROLE.forge,
  },
  {
    name: "workshop",
    label: "Taller",
    bgSrc: "/prototype/assets/zones/frontend.png",
    role: ZONE_ROLE.workshop,
  },
  {
    name: "lab",
    label: "Laboratorio",
    bgSrc: "/prototype/assets/zones/testing.png",
    role: ZONE_ROLE.lab,
  },
];

// Reverse map: role → zone name (for sprites to declare their home zone)
const ROLE_TO_ZONE: Partial<Record<Role, ZoneName>> = Object.fromEntries(
  ZONES.map((z) => [z.role, z.name]),
) as Partial<Record<Role, ZoneName>>;

// ---------------------------------------------------------------------------
// Sprite asset path helper
// ---------------------------------------------------------------------------

function spriteSrc(role: Role): string {
  // Map canonical role ids to asset file names
  const FILE: Partial<Record<Role, string>> = {
    researcher: "researcher.png",
    "backend-dev": "backend-dev.png",
    "frontend-dev": "frontend-dev.png",
    "test-writer": "test-writer.png",
    reviewer: "reviewer.png",
    "security-auditor": "security-auditor.png",
    "product-manager": "product-manager.png",
    guild: "analytics.png",
    designer: "designer.png",
    architect: "architect.png",
  };
  return `/prototype/assets/agents/${FILE[role] ?? "backend-dev.png"}`;
}

// ---------------------------------------------------------------------------
// Scene canvas dimensions (ported from prototype coordinate system)
// ---------------------------------------------------------------------------

const SCENE_WIDTH = 760;
const SCENE_HEIGHT = 570;

// Station dimensions (ported from prototype)
const STATION_W = 160;
const STATION_H = 140;

// Sprite element size (54×54 px, centered on position — apply transform: translate(px-27, py-27+bob))
const SPRITE_HALF = 27;

// ---------------------------------------------------------------------------
// PartyScene component
// ---------------------------------------------------------------------------

export function PartyScene({ roster, agents, mode, events }: PartySceneProps): React.JSX.Element {
  // -----------------------------------------------------------------------
  // Reduced-motion detection (FRD-13, WO-06-011)
  // Read matchMedia once on mount — disables the RAF loop when true so ALL
  // Party animation is suppressed for users who have opted out of motion.
  // Using useState initializer so it runs once synchronously before the
  // first render (avoids a flash of animated content).
  // -----------------------------------------------------------------------
  const [reducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  // -----------------------------------------------------------------------
  // Refs — sprite DOM elements (keyed by role id)
  // -----------------------------------------------------------------------
  const spriteRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Engine ref — persists across renders without causing re-renders
  const engineRef = useRef<PartyEngine | null>(null);

  // runId ref — bumped on (re)mount to stop the previous RAF loop (PARTY.md §5)
  const runIdRef = useRef(0);

  // Stable refs for values used inside the RAF closure — avoids stale captures
  // and lets biome's exhaustive-deps see only primitive/stable-string deps.
  const agentsRef = useRef(agents);
  const rosterRef = useRef(roster);
  const modeRef = useRef(mode);
  const eventsRef = useRef<VisualAction[] | undefined>(events);

  // Keep refs in sync with props on every render (no dep array = runs every render,
  // which is exactly what we want for stale-closure safety inside the RAF loop).
  useEffect(() => {
    agentsRef.current = agents;
    rosterRef.current = roster;
    modeRef.current = mode;
    eventsRef.current = events;
  });

  // -----------------------------------------------------------------------
  // Compute station positions for this roster + mode (used in render)
  // -----------------------------------------------------------------------
  const positions = mcPositions(roster, mode);

  // Stable string key — changes only when roster composition or mode changes.
  // This is the dep that triggers engine re-mount without needing the array ref.
  const rosterKey = `${roster.join(",")}:${mode}`;

  // -----------------------------------------------------------------------
  // Mount / re-mount the engine and RAF loop (PARTY.md §5)
  // -----------------------------------------------------------------------
  useEffect(() => {
    // rosterKey is the trigger dep: its value changes when roster composition
    // or mode changes, causing the engine to re-mount. It is also passed to
    // createPartyEngine as the seed comment so biome sees it referenced here.
    void rosterKey; // referenced so biome's exhaustive-deps sees this dep

    // Read roster/agents/mode through refs so the effect body only closes over
    // refs (always stable) — avoids unnecessary re-mounts on agent state change.
    const currentRoster = rosterRef.current;
    const currentAgents = agentsRef.current;
    const currentMode = modeRef.current;

    const currentPositions = mcPositions(currentRoster, currentMode);

    const engineSnapshot: AgentSnapshot[] = currentRoster.map((role, ix) => {
      const agentInfo = currentAgents.find((a) => a.id === role);
      const pos = currentPositions[ix] ?? [SCENE_WIDTH / 2, SCENE_HEIGHT / 2];
      return {
        id: role,
        state: (agentInfo?.state ?? "idle") as AgentState,
        home: pos as [number, number],
      };
    });

    // (Re)create the engine from the current snapshot
    const engine = createPartyEngine(engineSnapshot, {});
    engineRef.current = engine;

    // Apply initial states from the agents prop
    for (const agInfo of currentAgents) {
      engine.setState(agInfo.id, agInfo.state);
    }

    // Bump runId — the previous loop's closure will see its myId !== runId
    runIdRef.current += 1;
    const myId = runIdRef.current;

    // Apply any events that arrived with this render
    const initialEvents = eventsRef.current;
    if (initialEvents && initialEvents.length > 0) {
      engine.applyEvents(initialEvents);
    }

    // When the user prefers reduced motion, skip the RAF loop entirely.
    // Sprites remain visible at their initial positions with their state class,
    // but no continuous animation runs (FRD-13, WO-06-011).
    if (reducedMotion) {
      return () => {
        runIdRef.current += 1;
      };
    }

    // RAF loop — advances the engine and syncs DOM sprite positions/classes
    function loop(now: number): void {
      if (runIdRef.current !== myId) return; // self-stop on re-mount

      engine.tick(now);

      // Sync sprite DOM elements
      const agentStates: EngineAgent[] = engine.agents();
      for (const ag of agentStates) {
        const el = spriteRefs.current.get(ag.id);
        if (!el) continue;

        // Apply transform — position within the scene canvas
        el.style.transform = `translate(${ag.px - SPRITE_HALF}px, ${ag.py - SPRITE_HALF + ag.bob}px)`;

        // Apply state class (s-work / s-walk / s-idle / s-blocked / s-review)
        el.className = `mcag s-${ag.state}`;
      }

      requestAnimationFrame(loop);
    }

    const rafHandle = requestAnimationFrame(loop);

    return () => {
      // Cleanup: bump runId to stop the loop
      runIdRef.current += 1;
      cancelAnimationFrame(rafHandle);
    };
  }, [rosterKey, reducedMotion]);

  // -----------------------------------------------------------------------
  // Apply new events when the events prop changes (without remounting)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (events && events.length > 0 && engineRef.current) {
      engineRef.current.applyEvents(events);
    }
  }, [events]);

  // -----------------------------------------------------------------------
  // Apply agents state on prop change (sync without remounting the engine)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const agInfo of agents) {
      engine.setState(agInfo.id, agInfo.state);
    }
    // Immediately sync DOM to reflect new state classes (before next RAF tick)
    const agentStates: EngineAgent[] = engine.agents();
    for (const ag of agentStates) {
      const el = spriteRefs.current.get(ag.id);
      if (!el) continue;
      el.className = `mcag s-${ag.state}`;
    }
  }, [agents]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const sceneStyle: React.CSSProperties = {
    position: "relative",
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    overflow: "hidden",
    background: "var(--color-surface, Canvas)",
    // Grid background matching prototype's dot-grid aesthetic using CSS custom properties
    backgroundImage: [
      "linear-gradient(var(--color-border, oklch(0.3 0 0 / 0.15)) 0.5px, transparent 0.5px)",
      "linear-gradient(90deg, var(--color-border, oklch(0.3 0 0 / 0.15)) 0.5px, transparent 0.5px)",
    ].join(", "),
    backgroundSize: "32px 32px",
    imageRendering: "pixelated",
    // Prevent the map from overflowing its parent
    flexShrink: 0,
  };

  return (
    <section
      data-testid="party-scene"
      aria-label="Mapa RPG del equipo de agentes"
      data-reduced-motion={reducedMotion ? "true" : undefined}
      style={sceneStyle}
    >
      {/* Stations — fixed pixel-art zone backgrounds with labels */}
      {ZONES.map((zone) => {
        // Check if this zone's role is in the roster
        const isActive = roster.includes(zone.role);
        const roleColor = agentColor(zone.role);

        const stationLeft = (() => {
          const idx = roster.indexOf(zone.role);
          if (idx === -1) {
            const zoneIdx = ZONES.findIndex((z) => z.name === zone.name);
            const defaultPos = mcPositions(
              ZONES.map((z) => z.role),
              "balanced",
            );
            return (defaultPos[zoneIdx]?.[0] ?? 0) - STATION_W / 2;
          }
          return (positions[idx]?.[0] ?? 0) - STATION_W / 2;
        })();

        const stationTop = (() => {
          const idx = roster.indexOf(zone.role);
          if (idx === -1) {
            const zoneIdx = ZONES.findIndex((z) => z.name === zone.name);
            const defaultPos = mcPositions(
              ZONES.map((z) => z.role),
              "balanced",
            );
            return (defaultPos[zoneIdx]?.[1] ?? 0) - STATION_H / 2;
          }
          return (positions[idx]?.[1] ?? 0) - STATION_H / 2;
        })();

        const stationStyle: React.CSSProperties = {
          position: "absolute",
          left: stationLeft,
          top: stationTop,
          width: STATION_W,
          height: STATION_H,
          borderRadius: "var(--radius, 10px)",
          overflow: "hidden",
          border: `1px solid ${isActive ? `var(${roleColor})` : "var(--color-border, currentColor)"}`,
          zIndex: 0,
          opacity: isActive ? 1 : 0.4,
        };

        const bgStyle: React.CSSProperties = {
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${zone.bgSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          imageRendering: "pixelated",
          filter: isActive ? "none" : "grayscale(0.82) brightness(0.93)",
          opacity: isActive ? 1 : 0.5,
        };

        const labelStyle: React.CSSProperties = {
          position: "absolute",
          bottom: 4,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "0.6875rem",
          fontWeight: 500,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "var(--color-surface, Canvas)",
          border: "0.5px solid var(--color-border, currentColor)",
          borderRadius: "var(--radius, 5px)",
          padding: "0 6px",
          whiteSpace: "nowrap",
          zIndex: 2,
          lineHeight: 1.5,
          color: `var(${roleColor})`,
        };

        return (
          <div
            key={zone.name}
            data-testid={`party-zone-${zone.name}`}
            data-pixelart="true"
            style={stationStyle}
          >
            {/* Zone background image */}
            <div style={bgStyle} aria-hidden="true" />

            {/* Zone label — stays here even when the agent leaves (PARTY.md §2) */}
            <span style={labelStyle}>{zone.label}</span>
          </div>
        );
      })}

      {/* Sprites — one per roster role (AC-06-002.1) */}
      {roster.map((role, ix) => {
        const agentInfo = agents.find((a) => a.id === role);
        const initialState: AgentState = agentInfo?.state ?? "idle";
        const roleColor = agentColor(role);
        const pos = positions[ix];
        const zoneName = ROLE_TO_ZONE[role] ?? "forge";

        // Initial transform before RAF loop kicks in
        const initialX = (pos?.[0] ?? 0) - SPRITE_HALF;
        const initialY = (pos?.[1] ?? 0) - SPRITE_HALF;

        const spriteStyle: React.CSSProperties = {
          position: "absolute",
          width: 54,
          height: 54,
          willChange: "transform",
          zIndex: 2,
          transform: `translate(${initialX}px, ${initialY}px)`,
        };

        const haloStyle: React.CSSProperties = {
          position: "absolute",
          left: 7,
          bottom: 2,
          width: 40,
          height: 14,
          borderRadius: "50%",
          background: `var(${roleColor})`,
          opacity: 0,
          zIndex: 1,
        };

        return (
          <div
            key={role}
            ref={(el) => {
              if (el) {
                spriteRefs.current.set(role, el);
              } else {
                spriteRefs.current.delete(role);
              }
            }}
            data-testid={`party-sprite-${role}`}
            data-zone={zoneName}
            data-role={role}
            className={`mcag s-${initialState}`}
            style={spriteStyle}
          >
            {/* Halo — pulsing ellipse, shown on work/review/blocked (PARTY.md §2) */}
            <div className="halo" style={haloStyle} aria-hidden="true" />

            {/* Sprite image — pixel-art character (PARTY.md §6) */}
            {/* biome-ignore lint/performance/noImgElement: pixelated pixel-art sprite — Next.js Image does not support image-rendering:pixelated */}
            <img
              src={spriteSrc(role)}
              alt={`Sprite de ${role}`}
              style={{
                width: 54,
                height: 54,
                imageRendering: "pixelated",
                display: "block",
                position: "relative",
                zIndex: 2,
              }}
            />
          </div>
        );
      })}
    </section>
  );
}
