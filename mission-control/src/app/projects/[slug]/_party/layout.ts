/**
 * WO-06-002 — La Fragua layout (rooms + forge/tribunal/vault slots)
 *
 * Pure module — no DOM, no I/O, no side-effects.
 *
 * Exports:
 *   - forgeSlots(mode): Pos[]   — 8 normal (FORGE_SLOTS) or 6 deep (DEEP_SLOTS) stations
 *   - reviewSlots(): Pos[]      — 12 tribunal slots (4×3, REVIEW_SLOTS) + REVIEWER_HOME
 *   - vaultSlots(): VaultLayout — 9 shelf positions + moreAnchor + maxVault
 *   - roleColor(role): string   — build role → CSS token key (FRD-13, IF-06-role-color)
 *   - Room rectangles: FORGE_ROOM, TRIBUNAL_ROOM, VAULT_ROOM
 *   - Connecting paths: FORGE_OUT, TRIB_IN, TRIB_OUT, SHELF_Y
 *   - Raw constants: FORGE_SLOTS, DEEP_SLOTS, REVIEW_SLOTS, REVIEWER_HOME,
 *                    VAULT_X0, VAULT_DX, VAULT_Y, VAULT_MORE, MAXVAULT
 *   - Pos / BuildRole types
 *
 * Visual contract: prototype/party-proposal.html (La Fragua).
 * The faithful engine model: prototype/party-redesign-spec.md §2–3.
 *
 * Traceability:
 *   IF-06-fragua-layout → REQ-06-001, REQ-06-003, REQ-06-004, REQ-06-005, REQ-06-007
 *   IF-06-role-color    → REQ-06-010, REQ-06-011
 *
 * Dependencies:
 *   - BuildMode (FRD-11) from @/lib/constants
 *   - AGENT_COLOR (FRD-13) from @/app/_design/tokens/tokens
 *
 * REMOVED from this module (obsoleted by La Fragua redesign):
 *   - rosterFor, mcPositions, MCCENTER, ZONE_ROLE, agentColor
 *   These implemented the fictitious 4-zone model (library/forge/workshop/lab).
 *   The faithful model uses one figure per running work order, not per role.
 */

import { AGENT_COLOR } from "@/app/_design/tokens/tokens";
import type { BuildMode } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A 2D position as [x, y] pixel coordinates within the RPG scene canvas. */
export type Pos = [number, number];

/**
 * A room rectangle within the La Fragua canvas.
 * Origin is the top-left corner; dimensions in pixels.
 */
export interface Room {
  /** Left edge x-coordinate. */
  x: number;
  /** Top edge y-coordinate. */
  y: number;
  /** Width in pixels. */
  w: number;
  /** Height in pixels. */
  h: number;
}

/**
 * Build roles that participate in the La Fragua scene.
 * One sprite per running work order; in deep mode a WO may be a 3-step relay.
 * Source: prototype/party-redesign-spec.md §2; FRD-13 canonical roles.
 */
export type BuildRole = "implementer" | "reviewer" | "test-writer" | "backend-dev" | "frontend-dev";

/** Return type for vaultSlots() — all Bóveda shelf data in one object. */
export interface VaultLayout {
  /** The 9 shelf positions, evenly spaced by VAULT_DX along VAULT_Y. */
  slots: Pos[];
  /** Position of the "+N archivados" overflow indicator (AC-06-005.2). */
  moreAnchor: Pos;
  /** Maximum trophies shown on the shelf before compaction. */
  maxVault: number;
}

// ---------------------------------------------------------------------------
// Forge slots (IF-06-fragua-layout, AC-06-001.2 / AC-06-007.1)
//
// Ported from prototype:
//   FORGE_SLOTS = 8 stations in 2 rows of 4 (pro/balanced/powerful)
//   DEEP_SLOTS  = 6 wider stations in 2×3 grid (deep mode, relay fits without overlap)
//
// The slot count also determines the wave cap rendered by the scene:
//   pro=2, balanced=4, powerful=8, deep=6 (the engine enforces the cap;
//   the scene never renders more sprites than there are slots).
// ---------------------------------------------------------------------------

/**
 * 8 forge stations for pro / balanced / powerful modes.
 * Arranged in two rows of 4 within the Sala de Forja.
 * Coordinates from prototype/party-proposal.html.
 */
export const FORGE_SLOTS: readonly Pos[] = Object.freeze([
  [95, 155],
  [190, 155],
  [285, 155],
  [378, 155],
  [95, 300],
  [190, 300],
  [285, 300],
  [378, 300],
]) as readonly Pos[];

/**
 * 6 wider forge stations for deep mode (2×3 grid).
 * Wider spacing so each WO's sequential test→backend→frontend relay
 * fits without sprite overlap (AC-06-007.1).
 * Coordinates from prototype/party-proposal.html.
 */
export const DEEP_SLOTS: readonly Pos[] = Object.freeze([
  [140, 150],
  [320, 150],
  [140, 255],
  [320, 255],
  [140, 360],
  [320, 360],
]) as readonly Pos[];

/**
 * Returns the forge slot layout for the given build mode.
 *
 * - pro / balanced / powerful → 8 stations (FORGE_SLOTS)
 * - deep                      → 6 wider stations (DEEP_SLOTS, AC-06-007.1)
 *
 * Returns a fresh array on every call — callers may mutate safely.
 *
 * @param mode - build mode (FRD-11)
 */
export function forgeSlots(mode: BuildMode): Pos[] {
  const source = mode === "deep" ? DEEP_SLOTS : FORGE_SLOTS;
  return source.map(([x, y]) => [x, y]);
}

// ---------------------------------------------------------------------------
// Tribunal (review) slots (IF-06-fragua-layout, AC-06-004.3)
//
// 12 well-spaced slots arranged in a 4×3 grid on the right side of the
// canvas. Sufficient for up to 11 work orders of a FRD to be judged
// simultaneously without sprite overlap.
// Coordinates from prototype/party-proposal.html.
// ---------------------------------------------------------------------------

/**
 * 12 tribunal slots in a 4-column × 3-row grid.
 * Columns at x ∈ {538, 628, 718, 808}; rows at y ∈ {190, 275, 360}.
 */
export const REVIEW_SLOTS: readonly Pos[] = Object.freeze([
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
]) as readonly Pos[];

/**
 * The reviewer's home position — where the `reviewer` figure rests
 * while waiting for the gate to open (one reviewer per FRD, AC-06-004.1).
 */
export const REVIEWER_HOME: Pos = Object.freeze([626, 108]) as Pos;

/**
 * Returns the 12 tribunal review slots (REVIEW_SLOTS).
 * Returns a fresh array on every call — callers may mutate safely.
 */
export function reviewSlots(): Pos[] {
  return REVIEW_SLOTS.map(([x, y]) => [x, y]);
}

// ---------------------------------------------------------------------------
// Bóveda (vault) shelf (IF-06-fragua-layout, AC-06-005.2)
//
// 9 shelf positions, evenly spaced along VAULT_Y.
// When VERIFIED trophies exceed MAXVAULT=9, the overflow is compacted
// into a "+N archivados" indicator at VAULT_MORE.
// Coordinates from prototype/party-proposal.html.
// ---------------------------------------------------------------------------

/** Maximum trophies shown on the Bóveda shelf before overflow compaction. */
export const MAXVAULT = 9;

/** Y-coordinate of the Bóveda shelf row. */
export const VAULT_Y = 492;

/** X-coordinate of the first (leftmost) shelf slot. */
export const VAULT_X0 = 112;

/** Horizontal step between consecutive shelf slots. */
export const VAULT_DX = 80;

/**
 * Position of the "+N archivados" overflow indicator.
 * Shown when trophies exceed MAXVAULT (AC-06-005.2).
 */
export const VAULT_MORE: Pos = Object.freeze([820, 465]) as Pos;

/**
 * Returns all Bóveda layout data: 9 shelf positions, the overflow anchor,
 * and the shelf capacity.
 *
 * Shelf positions are computed as:
 *   slots[i] = [VAULT_X0 + i * VAULT_DX, VAULT_Y]  for i in 0..8
 *
 * Returns a fresh object and fresh arrays on every call — callers may mutate safely.
 */
export function vaultSlots(): VaultLayout {
  const slots: Pos[] = Array.from({ length: MAXVAULT }, (_, i) => [
    VAULT_X0 + i * VAULT_DX,
    VAULT_Y,
  ]);
  return {
    slots,
    moreAnchor: [VAULT_MORE[0], VAULT_MORE[1]],
    maxVault: MAXVAULT,
  };
}

// ---------------------------------------------------------------------------
// Room rectangles (IF-06-fragua-layout, AC-06-003.1)
//
// Three rooms in the linear flow: Sala de Forja (left) → Tribunal del
// Juez (right) → Bóveda (bottom shelf). The scene renders the rooms
// with their labels and MUST NOT render a 3-column kanban.
//
// Approximate bounding rectangles within the La Fragua canvas.
// Derived from the slot positions in the prototype.
// ---------------------------------------------------------------------------

/**
 * Bounding rectangle of the Sala de Forja (left room).
 * Contains all FORGE_SLOTS and DEEP_SLOTS within this area.
 */
export const FORGE_ROOM: Readonly<Room> = Object.freeze({
  x: 60,
  y: 120,
  w: 360,
  h: 220,
});

/**
 * Bounding rectangle of the Tribunal del Juez (right room).
 * Contains all REVIEW_SLOTS within this area.
 */
export const TRIBUNAL_ROOM: Readonly<Room> = Object.freeze({
  x: 510,
  y: 160,
  w: 330,
  h: 230,
});

/**
 * Bounding rectangle of the Bóveda (bottom shelf room).
 * Contains all vault shelf slots within this area.
 */
export const VAULT_ROOM: Readonly<Room> = Object.freeze({
  x: 80,
  y: 440,
  w: 780,
  h: 90,
});

// ---------------------------------------------------------------------------
// Connecting paths (IF-06-fragua-layout, AC-06-003.1)
//
// Two connectors define the linear flow between rooms:
//   Forge → Tribunal : FORGE_OUT → TRIB_IN  (short horizontal hop)
//   Tribunal → Vault : TRIB_OUT → SHELF_Y   (vertical drop then shelf)
//
// Coordinates from prototype/party-proposal.html.
// ---------------------------------------------------------------------------

/**
 * Exit point of the Sala de Forja — start of the forge→tribunal connector.
 * Sprites leaving the forge animate through this point.
 */
export const FORGE_OUT: Pos = Object.freeze([450, 170]) as Pos;

/**
 * Entry point of the Tribunal del Juez — end of the forge→tribunal connector.
 * Sprites enter the tribunal through this point.
 */
export const TRIB_IN: Pos = Object.freeze([476, 170]) as Pos;

/**
 * Exit point of the Tribunal del Juez — start of the tribunal→vault connector.
 * Sprites drop from here toward the Bóveda shelf.
 */
export const TRIB_OUT: Pos = Object.freeze([688, 412]) as Pos;

/**
 * Y-coordinate of the lateral shelf path from TRIB_OUT to the vault slot.
 * Sprites move horizontally at this Y before descending to VAULT_Y.
 */
export const SHELF_Y = 420;

// ---------------------------------------------------------------------------
// roleColor — IF-06-role-color
//
// Maps a build role to its CSS custom property key.
// Delegates to AGENT_COLOR (FRD-13 tokens.ts) — single source of truth.
// All consumers (sprite, relay, feed, trophies) read through this function.
//
// Build roles in the La Fragua scene:
//   implementer — the general-purpose WO agent (one per running WO)
//   reviewer    — the FRD gate (one per FRD; dimmed until gate opens)
//   test-writer — deep relay step 1 (RED phase)
//   backend-dev — deep relay step 2 (publishes docs/api.md contract)
//   frontend-dev— deep relay step 3 (consumes the contract)
// ---------------------------------------------------------------------------

/**
 * Returns the CSS token key for the given build role's fixed color.
 *
 * - Known roles: returns the canonical key from AGENT_COLOR (FRD-13).
 * - Unknown roles: returns a generic fallback key without throwing.
 *
 * The returned string starts with '--' and is a CSS custom property reference.
 * The actual color value is defined by FRD-13's @theme in globals.css.
 *
 * @param role - a build role identifier
 */
export function roleColor(role: string): string {
  if (Object.hasOwn(AGENT_COLOR, role)) {
    return AGENT_COLOR[role as keyof typeof AGENT_COLOR];
  }
  return "--color-agent-unknown";
}

// ---------------------------------------------------------------------------
// Compatibility stubs — deprecated, to be removed when WO-06-004/005/006
// are re-implemented for the La Fragua faithful model.
//
// These stubs exist only to keep the pre-existing engine.ts, PartyScene.tsx
// and PartyTab.tsx (all PLANNED for redesign) compiling while their WOs
// are pending. New code MUST NOT import these — use the La Fragua API above.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use forgeSlots(mode) and the per-WO sprite model instead.
 * Kept for WO-06-004/006 backward compatibility until their redesign.
 * The old role type is preserved as a wider union for consumers.
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
  | "implementer"
  | "guild";

/**
 * @deprecated Handoffs are now station-to-station via the parchment (WO-06-006).
 * MCCENTER is kept only for the pre-existing engine.ts (WO-06-004 redesign pending).
 */
export const MCCENTER: Pos = [380, 285];

/**
 * @deprecated Zone roles are removed in the La Fragua faithful model.
 * Rooms replace the 4-zone layout. Kept for PartyScene.tsx (WO-06-006 pending).
 */
export const ZONE_ROLE: Readonly<Record<"library" | "forge" | "workshop" | "lab", Role>> =
  Object.freeze({
    library: "researcher",
    forge: "backend-dev",
    workshop: "frontend-dev",
    lab: "test-writer",
  });

/** Internal roster catalog — backing rosterFor (deprecated). */
const _MCROSTER: Readonly<Record<BuildMode, readonly Role[]>> = Object.freeze({
  pro: ["backend-dev", "reviewer"],
  balanced: ["backend-dev", "frontend-dev", "test-writer", "reviewer"],
  powerful: ["backend-dev", "frontend-dev", "test-writer", "researcher", "reviewer", "guild"],
  deep: ["backend-dev", "frontend-dev", "test-writer", "researcher", "reviewer", "guild"],
});

/**
 * @deprecated One sprite per running WO replaces the per-role roster.
 * Kept for engine.test.ts and PartyTab.tsx (WO-06-004/005 redesign pending).
 */
export function rosterFor(mode: BuildMode): Role[] {
  const base = _MCROSTER[mode] ?? _MCROSTER.balanced;
  return [...base];
}

/** Internal ring layout (backing mcPositions, deprecated). */
function _mcRing(i: number, n: number): Pos {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [Math.round(380 + 250 * Math.cos(ang)), Math.round(285 + 180 * Math.sin(ang))];
}

// Named anchor positions used by the deprecated mcPositions.
const _TL: Pos = [180, 175];
const _TC: Pos = [380, 175];
const _TR: Pos = [580, 175];
const _BL: Pos = [180, 400];
const _BC: Pos = [380, 400];
const _BR: Pos = [580, 400];
const _T1: Pos = [200, 170];
const _T2: Pos = [380, 170];
const _T3: Pos = [560, 170];
const _B1: Pos = [255, 408];
const _B2: Pos = [510, 408];

/**
 * @deprecated Use forgeSlots()/reviewSlots()/vaultSlots() and per-WO positions.
 * Kept for PartyScene.tsx and engine.test.ts (WO-06-004/006 redesign pending).
 */
export function mcPositions(roster: readonly Role[], mode: BuildMode): Pos[] {
  const n = roster.length;
  if (n <= 2) return ([_TC, _BC] as Pos[]).slice(0, n).map(([x, y]) => [x, y]);
  if (n === 3) return [_T1, _T3, _BC].map(([x, y]) => [x, y] as Pos);
  if (n === 4) return [_TL, _TR, _BL, _BR].map(([x, y]) => [x, y] as Pos);
  if (n === 5) return [_T1, _T2, _T3, _B1, _B2].map(([x, y]) => [x, y] as Pos);
  if (n === 6) {
    const topRow: Pos[] = [_T1, _T2, _T3].map(([x, y]) => [x, y] as Pos);
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
  return roster.map((_, i) => _mcRing(i, n));
}

/**
 * @deprecated Use roleColor(role) instead — same delegation to FRD-13.
 * Kept for PartyScene.tsx and PartyTab.tsx (WO-06-006/005 redesign pending).
 */
export function agentColor(role: Role): string {
  return roleColor(role as string);
}
