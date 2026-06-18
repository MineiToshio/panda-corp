/**
 * WO-06-002 — La Fragua layout (rooms + forge/tribunal/vault slots) — tests
 *
 * Tests for:
 *   - forgeSlots(mode): Pos[]  — FORGE_SLOTS (8, pro/balanced/powerful) / DEEP_SLOTS (6, deep)
 *   - reviewSlots(): Pos[]     — 12 tribunal slots (4×3)
 *   - vaultSlots(): { slots: Pos[]; moreAnchor: Pos; maxVault: number }
 *   - roleColor(role): string  — build role → CSS token key (FRD-13)
 *   - Room rectangles + connecting paths (typed constants)
 *
 * Traceability: AC-06-001.2, AC-06-003.1, AC-06-004.3, AC-06-005.2, AC-06-007.1
 *
 * Pure, no DOM. TDD RED→GREEN per WO-06-002.
 */

import { describe, expect, it } from "vitest";
import {
  DEEP_SLOTS,
  FORGE_OUT,
  FORGE_ROOM,
  FORGE_SLOTS,
  forgeSlots,
  MAXVAULT,
  REVIEW_SLOTS,
  REVIEWER_HOME,
  reviewSlots,
  roleColor,
  SHELF_Y,
  TRIB_IN,
  TRIB_OUT,
  TRIBUNAL_ROOM,
  VAULT_DX,
  VAULT_MORE,
  VAULT_ROOM,
  VAULT_X0,
  VAULT_Y,
  vaultSlots,
} from "../layout";

// ---------------------------------------------------------------------------
// forgeSlots(mode) — AC-06-001.2 / AC-06-007.1
// ---------------------------------------------------------------------------

describe("forgeSlots — forge slot selection by mode (AC-06-001.2, AC-06-007.1)", () => {
  it("pro mode returns exactly 8 slots (FORGE_SLOTS)", () => {
    const slots = forgeSlots("pro");
    expect(slots).toHaveLength(8);
  });

  it("balanced mode returns exactly 8 slots (FORGE_SLOTS)", () => {
    const slots = forgeSlots("balanced");
    expect(slots).toHaveLength(8);
  });

  it("powerful mode returns exactly 8 slots (FORGE_SLOTS)", () => {
    const slots = forgeSlots("powerful");
    expect(slots).toHaveLength(8);
  });

  it("deep mode returns exactly 6 slots (DEEP_SLOTS — AC-06-007.1: 2×3 wider stations)", () => {
    const slots = forgeSlots("deep");
    expect(slots).toHaveLength(6);
  });

  it("pro/balanced/powerful return same layout as FORGE_SLOTS constant", () => {
    expect(forgeSlots("pro")).toEqual(FORGE_SLOTS);
    expect(forgeSlots("balanced")).toEqual(FORGE_SLOTS);
    expect(forgeSlots("powerful")).toEqual(FORGE_SLOTS);
  });

  it("deep returns same layout as DEEP_SLOTS constant", () => {
    expect(forgeSlots("deep")).toEqual(DEEP_SLOTS);
  });

  it("FORGE_SLOTS has 8 entries — wave cap for pro=2 / balanced=4 / powerful=8", () => {
    expect(FORGE_SLOTS).toHaveLength(8);
  });

  it("DEEP_SLOTS has 6 entries — wave cap for deep=6 (AC-06-007.1)", () => {
    expect(DEEP_SLOTS).toHaveLength(6);
  });

  it("each forge slot is a [number, number] tuple", () => {
    for (const mode of ["pro", "balanced", "powerful", "deep"] as const) {
      for (const slot of forgeSlots(mode)) {
        expect(Array.isArray(slot)).toBe(true);
        expect(slot).toHaveLength(2);
        expect(typeof slot[0]).toBe("number");
        expect(typeof slot[1]).toBe("number");
      }
    }
  });

  it("forge slots are all unique — no two slots share the same position", () => {
    for (const mode of ["pro", "balanced", "powerful", "deep"] as const) {
      const slots = forgeSlots(mode);
      const keys = slots.map((s) => `${s[0]},${s[1]}`);
      const unique = new Set(keys);
      expect(unique.size, `mode=${mode} has duplicate forge slots`).toBe(slots.length);
    }
  });

  it("forgeSlots returns a fresh array on each call (not the same reference)", () => {
    const a = forgeSlots("powerful");
    const b = forgeSlots("powerful");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("FORGE_SLOTS exact coordinates match prototype (row1: x∈[95,378], row2: x∈[95,378], y=[155,300])", () => {
    // From prototype: [[95,155],[190,155],[285,155],[378,155],[95,300],[190,300],[285,300],[378,300]]
    expect(FORGE_SLOTS[0]).toEqual([95, 155]);
    expect(FORGE_SLOTS[1]).toEqual([190, 155]);
    expect(FORGE_SLOTS[2]).toEqual([285, 155]);
    expect(FORGE_SLOTS[3]).toEqual([378, 155]);
    expect(FORGE_SLOTS[4]).toEqual([95, 300]);
    expect(FORGE_SLOTS[5]).toEqual([190, 300]);
    expect(FORGE_SLOTS[6]).toEqual([285, 300]);
    expect(FORGE_SLOTS[7]).toEqual([378, 300]);
  });

  it("DEEP_SLOTS exact coordinates match prototype (2×3: x∈[140,320], y∈[150,360])", () => {
    // From prototype: [[140,150],[320,150],[140,255],[320,255],[140,360],[320,360]]
    expect(DEEP_SLOTS[0]).toEqual([140, 150]);
    expect(DEEP_SLOTS[1]).toEqual([320, 150]);
    expect(DEEP_SLOTS[2]).toEqual([140, 255]);
    expect(DEEP_SLOTS[3]).toEqual([320, 255]);
    expect(DEEP_SLOTS[4]).toEqual([140, 360]);
    expect(DEEP_SLOTS[5]).toEqual([320, 360]);
  });
});

// ---------------------------------------------------------------------------
// reviewSlots() — AC-06-004.3 (12 non-overlapping slots, 4×3)
// ---------------------------------------------------------------------------

describe("reviewSlots — tribunal 12 slots (4×3) (AC-06-004.3)", () => {
  it("returns exactly 12 slots", () => {
    const slots = reviewSlots();
    expect(slots).toHaveLength(12);
  });

  it("all 12 slots are unique — no overlapping positions (AC-06-004.3)", () => {
    const slots = reviewSlots();
    const keys = slots.map((s) => `${s[0]},${s[1]}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(12);
  });

  it("each slot is a [number, number] tuple", () => {
    for (const slot of reviewSlots()) {
      expect(Array.isArray(slot)).toBe(true);
      expect(slot).toHaveLength(2);
      expect(typeof slot[0]).toBe("number");
      expect(typeof slot[1]).toBe("number");
    }
  });

  it("returns same layout as REVIEW_SLOTS constant", () => {
    expect(reviewSlots()).toEqual(REVIEW_SLOTS);
  });

  it("REVIEW_SLOTS has exactly 12 entries", () => {
    expect(REVIEW_SLOTS).toHaveLength(12);
  });

  it("REVIEW_SLOTS exact coordinates match prototype (4 columns × 3 rows, right side of canvas)", () => {
    // From prototype: row1=[538..808,190], row2=[538..808,275], row3=[538..808,360]
    expect(REVIEW_SLOTS[0]).toEqual([538, 190]);
    expect(REVIEW_SLOTS[1]).toEqual([628, 190]);
    expect(REVIEW_SLOTS[2]).toEqual([718, 190]);
    expect(REVIEW_SLOTS[3]).toEqual([808, 190]);
    expect(REVIEW_SLOTS[4]).toEqual([538, 275]);
    expect(REVIEW_SLOTS[5]).toEqual([628, 275]);
    expect(REVIEW_SLOTS[6]).toEqual([718, 275]);
    expect(REVIEW_SLOTS[7]).toEqual([808, 275]);
    expect(REVIEW_SLOTS[8]).toEqual([538, 360]);
    expect(REVIEW_SLOTS[9]).toEqual([628, 360]);
    expect(REVIEW_SLOTS[10]).toEqual([718, 360]);
    expect(REVIEW_SLOTS[11]).toEqual([808, 360]);
  });

  it("REVIEWER_HOME is a valid Pos tuple ([626, 108])", () => {
    expect(REVIEWER_HOME).toEqual([626, 108]);
  });

  it("reviewSlots returns a fresh array on each call", () => {
    const a = reviewSlots();
    const b = reviewSlots();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("supports at least 11 WOs being judged simultaneously (12 slots > 11 WOs max)", () => {
    // AC-06-004.3: up to 11 WOs can be judged without overlap
    const slots = reviewSlots();
    expect(slots.length).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// vaultSlots() — AC-06-005.2 (9 shelf positions + "+N archivados" anchor)
// ---------------------------------------------------------------------------

describe("vaultSlots — Bóveda shelf (AC-06-005.2)", () => {
  it("MAXVAULT is 9 (shelf capacity)", () => {
    expect(MAXVAULT).toBe(9);
  });

  it("vaultSlots returns exactly 9 shelf positions", () => {
    const { slots } = vaultSlots();
    expect(slots).toHaveLength(9);
  });

  it("each shelf position is a [number, number] tuple", () => {
    const { slots } = vaultSlots();
    for (const slot of slots) {
      expect(Array.isArray(slot)).toBe(true);
      expect(slot).toHaveLength(2);
      expect(typeof slot[0]).toBe("number");
      expect(typeof slot[1]).toBe("number");
    }
  });

  it("shelf positions are unique — no two trophies share the same spot", () => {
    const { slots } = vaultSlots();
    const keys = slots.map((s) => `${s[0]},${s[1]}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(9);
  });

  it("shelf positions are evenly spaced by VAULT_DX along VAULT_Y", () => {
    const { slots } = vaultSlots();
    // All y-coords must equal VAULT_Y
    for (const slot of slots) {
      expect(slot[1]).toBe(VAULT_Y);
    }
    // x-coords must form arithmetic sequence starting from VAULT_X0 with step VAULT_DX
    slots.forEach((slot, i) => {
      expect(slot[0]).toBe(VAULT_X0 + i * VAULT_DX);
    });
  });

  it("moreAnchor equals VAULT_MORE constant (the '+N archivados' indicator position)", () => {
    const { moreAnchor } = vaultSlots();
    expect(moreAnchor).toEqual(VAULT_MORE);
  });

  it("VAULT_MORE is [820, 465] per prototype", () => {
    expect(VAULT_MORE).toEqual([820, 465]);
  });

  it("VAULT_Y is 492 per prototype", () => {
    expect(VAULT_Y).toBe(492);
  });

  it("VAULT_X0 is 112 per prototype", () => {
    expect(VAULT_X0).toBe(112);
  });

  it("VAULT_DX is 80 per prototype", () => {
    expect(VAULT_DX).toBe(80);
  });

  it("vaultSlots returns maxVault equal to MAXVAULT", () => {
    const { maxVault } = vaultSlots();
    expect(maxVault).toBe(MAXVAULT);
  });

  it("vaultSlots returns a fresh object on each call (not the same reference)", () => {
    const a = vaultSlots();
    const b = vaultSlots();
    expect(a).not.toBe(b);
    expect(a.slots).not.toBe(b.slots);
    expect(a).toEqual(b);
  });

  it("first shelf slot is at [VAULT_X0, VAULT_Y]", () => {
    const { slots } = vaultSlots();
    expect(slots[0]).toEqual([VAULT_X0, VAULT_Y]);
  });

  it("ninth (last) shelf slot is at [VAULT_X0 + 8*VAULT_DX, VAULT_Y]", () => {
    const { slots } = vaultSlots();
    expect(slots[8]).toEqual([VAULT_X0 + 8 * VAULT_DX, VAULT_Y]);
  });
});

// ---------------------------------------------------------------------------
// Room rectangles + connecting paths (AC-06-003.1)
// ---------------------------------------------------------------------------

describe("room constants — Forja / Tribunal / Bóveda (AC-06-003.1)", () => {
  it("FORGE_ROOM is a typed constant (x, y, w, h)", () => {
    expect(typeof FORGE_ROOM.x).toBe("number");
    expect(typeof FORGE_ROOM.y).toBe("number");
    expect(typeof FORGE_ROOM.w).toBe("number");
    expect(typeof FORGE_ROOM.h).toBe("number");
  });

  it("TRIBUNAL_ROOM is a typed constant (x, y, w, h)", () => {
    expect(typeof TRIBUNAL_ROOM.x).toBe("number");
    expect(typeof TRIBUNAL_ROOM.y).toBe("number");
    expect(typeof TRIBUNAL_ROOM.w).toBe("number");
    expect(typeof TRIBUNAL_ROOM.h).toBe("number");
  });

  it("VAULT_ROOM is a typed constant (x, y, w, h)", () => {
    expect(typeof VAULT_ROOM.x).toBe("number");
    expect(typeof VAULT_ROOM.y).toBe("number");
    expect(typeof VAULT_ROOM.w).toBe("number");
    expect(typeof VAULT_ROOM.h).toBe("number");
  });

  it("FORGE_OUT is a valid Pos tuple (exit point of Sala de Forja)", () => {
    expect(FORGE_OUT).toHaveLength(2);
    expect(typeof FORGE_OUT[0]).toBe("number");
    expect(typeof FORGE_OUT[1]).toBe("number");
    // From prototype: [450, 170]
    expect(FORGE_OUT).toEqual([450, 170]);
  });

  it("TRIB_IN is a valid Pos tuple (entry point of Tribunal)", () => {
    expect(TRIB_IN).toHaveLength(2);
    expect(typeof TRIB_IN[0]).toBe("number");
    expect(typeof TRIB_IN[1]).toBe("number");
    // From prototype: [476, 170]
    expect(TRIB_IN).toEqual([476, 170]);
  });

  it("TRIB_OUT is a valid Pos tuple (exit point of Tribunal, drop toward Bóveda)", () => {
    expect(TRIB_OUT).toHaveLength(2);
    expect(typeof TRIB_OUT[0]).toBe("number");
    expect(typeof TRIB_OUT[1]).toBe("number");
    // From prototype: [688, 412]
    expect(TRIB_OUT).toEqual([688, 412]);
  });

  it("SHELF_Y is a number (y-coord of the drop path into the Bóveda shelf)", () => {
    expect(typeof SHELF_Y).toBe("number");
    // From prototype: 420
    expect(SHELF_Y).toBe(420);
  });

  it("rooms have positive non-zero width and height", () => {
    for (const room of [FORGE_ROOM, TRIBUNAL_ROOM, VAULT_ROOM]) {
      expect(room.w).toBeGreaterThan(0);
      expect(room.h).toBeGreaterThan(0);
    }
  });

  it("forge → tribunal path: FORGE_OUT x < TRIB_IN x (left-to-right linear flow)", () => {
    // AC-06-003.1: linear flow Forja → Tribunal → Bóveda
    expect(FORGE_OUT[0]).toBeLessThan(TRIB_IN[0]);
  });
});

// ---------------------------------------------------------------------------
// roleColor(role) — IF-06-role-color (replaces agentColor)
// ---------------------------------------------------------------------------

describe("roleColor — build role → CSS token key (IF-06-role-color)", () => {
  const BUILD_ROLES = [
    "implementer",
    "reviewer",
    "test-writer",
    "backend-dev",
    "frontend-dev",
  ] as const;

  it("returns a CSS custom property key starting with '--' for each build role", () => {
    for (const role of BUILD_ROLES) {
      const key = roleColor(role);
      expect(key.startsWith("--"), `role=${role} key=${key} must start with --`).toBe(true);
    }
  });

  it("roleColor('implementer') returns a stable CSS token key", () => {
    expect(roleColor("implementer")).toBe(roleColor("implementer"));
  });

  it("roleColor('reviewer') returns a stable CSS token key", () => {
    expect(roleColor("reviewer")).toBe(roleColor("reviewer"));
  });

  it("roleColor('test-writer') returns a stable CSS token key", () => {
    expect(roleColor("test-writer")).toBe(roleColor("test-writer"));
  });

  it("roleColor('backend-dev') returns a stable CSS token key", () => {
    expect(roleColor("backend-dev")).toBe(roleColor("backend-dev"));
  });

  it("roleColor('frontend-dev') returns a stable CSS token key", () => {
    expect(roleColor("frontend-dev")).toBe(roleColor("frontend-dev"));
  });

  it("all 5 build roles have distinct color keys", () => {
    const keys = BUILD_ROLES.map((r) => roleColor(r));
    const unique = new Set(keys);
    expect(unique.size).toBe(BUILD_ROLES.length);
  });

  it("roleColor('implementer') returns '--color-agent-implementer' (FRD-13 token key)", () => {
    expect(roleColor("implementer")).toBe("--color-agent-implementer");
  });

  it("roleColor('reviewer') returns '--color-agent-reviewer'", () => {
    expect(roleColor("reviewer")).toBe("--color-agent-reviewer");
  });

  it("roleColor('test-writer') returns '--color-agent-test-writer'", () => {
    expect(roleColor("test-writer")).toBe("--color-agent-test-writer");
  });

  it("roleColor('backend-dev') returns '--color-agent-backend-dev'", () => {
    expect(roleColor("backend-dev")).toBe("--color-agent-backend-dev");
  });

  it("roleColor('frontend-dev') returns '--color-agent-frontend-dev'", () => {
    expect(roleColor("frontend-dev")).toBe("--color-agent-frontend-dev");
  });

  it("unknown/legacy role falls back gracefully without throwing", () => {
    // Extra roles from AGENT_COLOR (FRD-13) are valid since roleColor delegates to it
    expect(() => roleColor("researcher" as "implementer")).not.toThrow();
  });
});
