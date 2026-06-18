/**
 * WO-06-002 — Roster + station positions (pure layout)
 *
 * Pure module — no DOM, no I/O, no side-effects.
 *
 * Exports:
 *   - rosterFor(mode): Role[]        IF-06-roster
 *   - mcPositions(roster, mode): Pos[] IF-06-positions
 *   - agentColor(role): string        IF-06-agent-color
 *   - ZONE_ROLE                       zone↔role constant
 *   - MCCENTER                        the stage center (handoffs route through it)
 *   - Pos / Role                      types
 *
 * Reference: prototype/index.html — MCROSTER, mcPositions, mcRing, MCCENTER.
 * The approved functional reference is the prototype; visual reference is docs/design/brief.md.
 *
 * Traceability:
 *   IF-06-roster    → REQ-06-002, REQ-06-005
 *   IF-06-positions → REQ-06-001
 *   IF-06-agent-color → REQ-06-011
 *
 * Dependencies:
 *   - BuildMode (FRD-11) from @/lib/constants
 *   - AGENT_COLOR (FRD-13) from @/app/_design/tokens
 */

import { AGENT_COLOR } from "@/app/_design/tokens/tokens";
import type { BuildMode } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A 2D position as [x, y] pixel coordinates within the RPG scene canvas. */
export type Pos = [number, number];

/**
 * Canonical role identifiers for workflow subagents.
 * These are a subset of AgentRole (FRD-13/tokens.ts) — only the roles
 * that participate in the Party view's roster and zones.
 */
export type Role =
  | "researcher"
  | "backend-dev"
  | "frontend-dev"
  | "test-writer"
  | "reviewer"
  | "designer"
  | "architect"
  | "security-auditor"
  | "product-manager"
  | "guild";

// ---------------------------------------------------------------------------
// MCCENTER — the stage center (handoff route point, never a station)
// Ported from prototype: MCCENTER = [380, 285]
// ---------------------------------------------------------------------------

/** The center of the RPG scene canvas. Handoffs route through here. */
export const MCCENTER: Pos = [380, 285];

// ---------------------------------------------------------------------------
// ZONE_ROLE — zone↔role mapping constant (AC-06-001.1)
//
// Zones (pixel-art areas):
//   Research = library   → researcher
//   Backend  = forge     → backend-dev
//   Frontend = workshop  → frontend-dev
//   Testing  = lab       → test-writer
// ---------------------------------------------------------------------------

/** Frozen mapping: zone name → canonical role (AC-06-001.1, REQ-06-001). */
export const ZONE_ROLE: Readonly<Record<"library" | "forge" | "workshop" | "lab", Role>> =
  Object.freeze({
    library: "researcher",
    forge: "backend-dev",
    workshop: "frontend-dev",
    lab: "test-writer",
  });

// ---------------------------------------------------------------------------
// MCROSTER — per-mode roster catalog (IF-06-roster internal data)
//
// Ported from prototype MCROSTER. Role names updated to canonical FRD-11 ids.
// Researcher is NOT in pro/balanced — only in powerful/deep (AC-06-005.1).
//
// The prototype had "implementer", "analytics", "analytics" as role names;
// those are mapped to canonical FRD roles for the Party view:
//   implementer → reviewer (the lead/orchestrator role)
//   analytics   → guild    (analytics/platform role)
// ---------------------------------------------------------------------------

const MCROSTER: Readonly<Record<BuildMode, readonly Role[]>> = Object.freeze({
  pro: ["backend-dev", "reviewer"],
  balanced: ["backend-dev", "frontend-dev", "test-writer", "reviewer"],
  powerful: ["backend-dev", "frontend-dev", "test-writer", "researcher", "reviewer", "guild"],
  deep: ["backend-dev", "frontend-dev", "test-writer", "researcher", "reviewer", "guild"],
});

// ---------------------------------------------------------------------------
// rosterFor — IF-06-roster
// ---------------------------------------------------------------------------

/**
 * Returns the roster of roles for the given build mode.
 *
 * - pro: 2 agents, no researcher
 * - balanced: 4 agents, no researcher
 * - powerful: 6 agents, includes researcher (on-demand, AC-06-005.1)
 * - deep: 6 agents, includes researcher (on-demand, AC-06-005.1)
 *
 * Returns a fresh array copy on every call — callers may mutate safely.
 */
export function rosterFor(mode: BuildMode): Role[] {
  const base = MCROSTER[mode] ?? MCROSTER.balanced;
  return [...base];
}

// ---------------------------------------------------------------------------
// mcRing — fallback ring layout for n > 6
// Ported from prototype: mcRing(i, n)
//   cx=380, cy=285, rx=250, ry=180
//   ang = -π/2 + i * 2π/n
// ---------------------------------------------------------------------------

function mcRing(i: number, n: number): Pos {
  const cx = 380;
  const cy = 285;
  const rx = 250;
  const ry = 180;
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [Math.round(cx + rx * Math.cos(ang)), Math.round(cy + ry * Math.sin(ang))];
}

// ---------------------------------------------------------------------------
// mcPositions — IF-06-positions
//
// Ported verbatim from prototype mcPositions(roster, mode).
// Positions (pixel coords within the 760×570 RPG scene canvas):
//
//   Named corners/anchors:
//     TL=[180,175]  TC=[380,175]  TR=[580,175]
//     T1=[200,170]  T2=[380,170]  T3=[560,170]
//     BL=[180,400]  BC=[380,400]  BR=[580,400]
//     B1=[255,408]  B2=[510,408]
//
//   Shapes by roster size:
//     n≤2 → [TC, BC].slice(0, n)                    — 2-in-column (or 1)
//     n=3 → [T1, T3, BC]                            — triangle
//     n=4 → [TL, TR, BL, BR]                        — 4-corner
//     n=5 → [T1, T2, T3, B1, B2]                   — 3+2
//     n=6, mode="deep" → [T1,T2,T3,[148,408],[380,408],[612,408]]  — 3+3 deep
//     n=6, other       → [T1,T2,T3,[200,408],[380,408],[560,408]]  — 3+3 std
//     n>6 → ring fallback (mcRing)
//
// Center [380, 285] is never a station — handoffs route through it.
// ---------------------------------------------------------------------------

/** Named anchor positions (prototype coordinate system). */
const TL: Pos = [180, 175];
const TC: Pos = [380, 175];
const TR: Pos = [580, 175];
const BL: Pos = [180, 400];
const BC: Pos = [380, 400];
const BR: Pos = [580, 400];
const T1: Pos = [200, 170];
const T2: Pos = [380, 170];
const T3: Pos = [560, 170];
const B1: Pos = [255, 408];
const B2: Pos = [510, 408];

/**
 * Computes station positions for the given roster and build mode.
 *
 * Returns a fresh Pos[] — callers may mutate safely.
 * Never places a sprite at MCCENTER (handoff routing point).
 *
 * @param roster - list of roles (from rosterFor or a slice)
 * @param mode   - build mode (affects n=6 layout only)
 */
export function mcPositions(roster: readonly Role[], mode: BuildMode): Pos[] {
  const n = roster.length;

  if (n <= 2) {
    return ([TC, BC] as Pos[]).slice(0, n).map(([x, y]) => [x, y]);
  }
  if (n === 3) {
    return [T1, T3, BC].map(([x, y]) => [x, y] as Pos);
  }
  if (n === 4) {
    return [TL, TR, BL, BR].map(([x, y]) => [x, y] as Pos);
  }
  if (n === 5) {
    return [T1, T2, T3, B1, B2].map(([x, y]) => [x, y] as Pos);
  }
  if (n === 6) {
    const topRow: Pos[] = [T1, T2, T3].map(([x, y]) => [x, y] as Pos);
    const bottomRow: Pos[] =
      mode === "deep"
        ? ([
            [148, 408],
            [380, 408],
            [612, 408],
          ] as Pos[])
        : ([
            [200, 408],
            [380, 408],
            [560, 408],
          ] as Pos[]);
    return [...topRow, ...bottomRow];
  }
  // Ring fallback for n > 6
  return roster.map((_, i) => mcRing(i, n));
}

// ---------------------------------------------------------------------------
// agentColor — IF-06-agent-color
//
// Returns the CSS custom property key for a given role.
// Delegates to AGENT_COLOR (FRD-13 tokens.ts) — single source of truth.
// All consumers (sprite, feed, cards) read through this function.
// ---------------------------------------------------------------------------

/**
 * Returns the CSS token key for the given role's fixed color.
 *
 * - Known roles: returns the canonical key from AGENT_COLOR (FRD-13).
 * - Unknown roles: returns a generic fallback key.
 *
 * The returned string starts with '--' and is a CSS custom property reference.
 * The actual color value is defined by FRD-13's @theme in globals.css.
 */
export function agentColor(role: Role): string {
  if (Object.hasOwn(AGENT_COLOR, role)) {
    return AGENT_COLOR[role as keyof typeof AGENT_COLOR];
  }
  return "--color-agent-unknown";
}
