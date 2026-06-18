/**
 * WO-06-002 — Roster + station positions (pure layout)
 *
 * Tests for:
 *   - rosterFor(mode): Role[] — IF-06-roster
 *   - mcPositions(roster, mode): Pos[] — IF-06-positions
 *   - agentColor(role): string — IF-06-agent-color
 *   - ZONE_ROLE — zone↔role constant
 *
 * Traceability: AC-06-001.1, AC-06-002.1, AC-06-005.1
 * REQ-06-001, REQ-06-002, REQ-06-005
 *
 * Pure, no DOM. TDD RED→GREEN per WO-06-002.
 */

import { describe, expect, it } from "vitest";
import { agentColor, mcPositions, type Pos, type Role, rosterFor, ZONE_ROLE } from "./layout";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MODES = ["pro", "balanced", "powerful", "deep"] as const;

// MCCENTER from prototype: [380, 285]
const MCCENTER: Pos = [380, 285];

function isCollisionWithCenter(pos: Pos): boolean {
  return pos[0] === MCCENTER[0] && pos[1] === MCCENTER[1];
}

// ---------------------------------------------------------------------------
// rosterFor — IF-06-roster
// ---------------------------------------------------------------------------

describe("rosterFor — IF-06-roster (AC-06-002.1, AC-06-005.1)", () => {
  it("pro mode yields exactly 2 roles", () => {
    const roster = rosterFor("pro");
    expect(roster).toHaveLength(2);
  });

  it("balanced mode yields exactly 4 roles", () => {
    const roster = rosterFor("balanced");
    expect(roster).toHaveLength(4);
  });

  it("powerful mode yields exactly 6 roles", () => {
    const roster = rosterFor("powerful");
    expect(roster).toHaveLength(6);
  });

  it("deep mode yields exactly 6 roles", () => {
    const roster = rosterFor("deep");
    expect(roster).toHaveLength(6);
  });

  it("pro roster does NOT include researcher (AC-06-005.1)", () => {
    const roster = rosterFor("pro");
    expect(roster).not.toContain("researcher");
  });

  it("balanced roster does NOT include researcher (AC-06-005.1)", () => {
    const roster = rosterFor("balanced");
    expect(roster).not.toContain("researcher");
  });

  it("powerful roster INCLUDES researcher (AC-06-005.1 — on-demand)", () => {
    const roster = rosterFor("powerful");
    expect(roster).toContain("researcher");
  });

  it("deep roster INCLUDES researcher (AC-06-005.1 — on-demand)", () => {
    const roster = rosterFor("deep");
    expect(roster).toContain("researcher");
  });

  it("each mode returns an array of strings (Role[])", () => {
    for (const mode of MODES) {
      const roster = rosterFor(mode);
      for (const r of roster) {
        expect(typeof r).toBe("string");
      }
    }
  });

  it("each mode roster has no duplicate roles", () => {
    for (const mode of MODES) {
      const roster = rosterFor(mode);
      const unique = new Set(roster);
      expect(unique.size).toBe(roster.length);
    }
  });

  it("returns a new array on each call (not the same reference)", () => {
    const a = rosterFor("balanced");
    const b = rosterFor("balanced");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("all roles in balanced are non-empty strings", () => {
    const roster = rosterFor("balanced");
    for (const r of roster) {
      expect(r.length).toBeGreaterThan(0);
    }
  });

  it("all modes produce non-empty rosters", () => {
    for (const mode of MODES) {
      const roster = rosterFor(mode);
      expect(roster.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// mcPositions — IF-06-positions
// ---------------------------------------------------------------------------

describe("mcPositions — IF-06-positions (AC-06-001.1)", () => {
  it("n=1 (pro without reviewer): returns 1 position", () => {
    const roster = rosterFor("pro").slice(0, 1) as Role[];
    const pos = mcPositions(roster, "pro");
    expect(pos).toHaveLength(1);
  });

  it("n=2 (pro): returns exactly 2 positions (2-in-column shape)", () => {
    const roster = rosterFor("pro");
    const pos = mcPositions(roster, "pro");
    expect(pos).toHaveLength(2);
  });

  it("n=3: returns exactly 3 positions", () => {
    const roster = rosterFor("balanced").slice(0, 3) as Role[];
    const pos = mcPositions(roster, "balanced");
    expect(pos).toHaveLength(3);
  });

  it("n=4 (balanced): returns exactly 4 positions (4-corner shape)", () => {
    const roster = rosterFor("balanced");
    const pos = mcPositions(roster, "balanced");
    expect(pos).toHaveLength(4);
  });

  it("n=5: returns exactly 5 positions", () => {
    const roster = rosterFor("powerful").slice(0, 5) as Role[];
    const pos = mcPositions(roster, "powerful");
    expect(pos).toHaveLength(5);
  });

  it("n=6 (powerful): returns exactly 6 positions", () => {
    const roster = rosterFor("powerful");
    const pos = mcPositions(roster, "powerful");
    expect(pos).toHaveLength(6);
  });

  it("n=6 (deep): returns exactly 6 positions", () => {
    const roster = rosterFor("deep");
    const pos = mcPositions(roster, "deep");
    expect(pos).toHaveLength(6);
  });

  it("each position is a [number, number] tuple", () => {
    for (const mode of MODES) {
      const roster = rosterFor(mode);
      const pos = mcPositions(roster, mode);
      for (const p of pos) {
        expect(Array.isArray(p)).toBe(true);
        expect(p).toHaveLength(2);
        expect(typeof p[0]).toBe("number");
        expect(typeof p[1]).toBe("number");
      }
    }
  });

  it("no position collides with center [380, 285] for any mode", () => {
    for (const mode of MODES) {
      const roster = rosterFor(mode);
      const pos = mcPositions(roster, mode);
      for (const p of pos) {
        const collides = isCollisionWithCenter(p);
        expect(collides, `mode=${mode} pos=[${p}] collides with center`).toBe(false);
      }
    }
  });

  it("n=2 shape: TC=[380,175] at index 0 and BC=[380,400] at index 1", () => {
    // 2-in-column shape from prototype: [TC, BC] = [[380,175],[380,400]]
    const roster = rosterFor("pro");
    const pos = mcPositions(roster, "pro");
    expect(pos[0]).toEqual([380, 175]);
    expect(pos[1]).toEqual([380, 400]);
  });

  it("n=3 shape: T1=[200,170], T3=[560,170], BC=[380,400]", () => {
    const roster = rosterFor("balanced").slice(0, 3) as Role[];
    const pos = mcPositions(roster, "balanced");
    expect(pos[0]).toEqual([200, 170]);
    expect(pos[1]).toEqual([560, 170]);
    expect(pos[2]).toEqual([380, 400]);
  });

  it("n=4 shape: TL=[180,175], TR=[580,175], BL=[180,400], BR=[580,400]", () => {
    const roster = rosterFor("balanced");
    const pos = mcPositions(roster, "balanced");
    expect(pos[0]).toEqual([180, 175]);
    expect(pos[1]).toEqual([580, 175]);
    expect(pos[2]).toEqual([180, 400]);
    expect(pos[3]).toEqual([580, 400]);
  });

  it("n=5 shape: T1=[200,170], T2=[380,170], T3=[560,170], B1=[255,408], B2=[510,408]", () => {
    const roster = rosterFor("powerful").slice(0, 5) as Role[];
    const pos = mcPositions(roster, "powerful");
    expect(pos[0]).toEqual([200, 170]);
    expect(pos[1]).toEqual([380, 170]);
    expect(pos[2]).toEqual([560, 170]);
    expect(pos[3]).toEqual([255, 408]);
    expect(pos[4]).toEqual([510, 408]);
  });

  it("n=6 powerful shape: T1,T2,T3,[200,408],[380,408],[560,408]", () => {
    const roster = rosterFor("powerful");
    const pos = mcPositions(roster, "powerful");
    expect(pos[0]).toEqual([200, 170]);
    expect(pos[1]).toEqual([380, 170]);
    expect(pos[2]).toEqual([560, 170]);
    expect(pos[3]).toEqual([200, 408]);
    expect(pos[4]).toEqual([380, 408]);
    expect(pos[5]).toEqual([560, 408]);
  });

  it("n=6 deep shape: T1,T2,T3,[148,408],[380,408],[612,408]", () => {
    const roster = rosterFor("deep");
    const pos = mcPositions(roster, "deep");
    expect(pos[0]).toEqual([200, 170]);
    expect(pos[1]).toEqual([380, 170]);
    expect(pos[2]).toEqual([560, 170]);
    expect(pos[3]).toEqual([148, 408]);
    expect(pos[4]).toEqual([380, 408]);
    expect(pos[5]).toEqual([612, 408]);
  });

  it("positions are unique (no two agents share the same spot)", () => {
    for (const mode of MODES) {
      const roster = rosterFor(mode);
      const pos = mcPositions(roster, mode);
      const keys = pos.map((p) => `${p[0]},${p[1]}`);
      const unique = new Set(keys);
      expect(unique.size, `mode=${mode} has duplicate positions`).toBe(pos.length);
    }
  });

  it("ring fallback for n=7: returns 7 positions on a ring", () => {
    const bigRoster: Role[] = [
      "backend-dev",
      "frontend-dev",
      "test-writer",
      "researcher",
      "reviewer",
      "designer",
      "architect",
    ];
    const pos = mcPositions(bigRoster, "deep");
    expect(pos).toHaveLength(7);
    // Ring: all points at a distance from center within bounds
    for (const p of pos) {
      const dx = p[0] - 380;
      const dy = p[1] - 285;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // rx=250, ry=180, so distances vary. Just verify not colliding with center.
      expect(dist).toBeGreaterThan(0);
    }
  });

  it("returns a new array on each call (not the same reference)", () => {
    const roster = rosterFor("balanced");
    const a = mcPositions(roster, "balanced");
    const b = mcPositions(roster, "balanced");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// agentColor — IF-06-agent-color
// ---------------------------------------------------------------------------

describe("agentColor — IF-06-agent-color (AC-06-011.1)", () => {
  it("returns a string for each role in balanced roster", () => {
    for (const role of rosterFor("balanced")) {
      const key = agentColor(role);
      expect(typeof key).toBe("string");
    }
  });

  it("returns a string for each role in powerful roster", () => {
    for (const role of rosterFor("powerful")) {
      const key = agentColor(role);
      expect(typeof key).toBe("string");
    }
  });

  it("returns a CSS custom property key (starts with '--')", () => {
    for (const mode of MODES) {
      for (const role of rosterFor(mode)) {
        const key = agentColor(role);
        expect(key.startsWith("--"), `role=${role} key=${key}`).toBe(true);
      }
    }
  });

  it("researcher color key is stable (same value on every call)", () => {
    expect(agentColor("researcher")).toBe(agentColor("researcher"));
  });

  it("backend-dev color key is stable", () => {
    expect(agentColor("backend-dev")).toBe(agentColor("backend-dev"));
  });

  it("frontend-dev color key is stable", () => {
    expect(agentColor("frontend-dev")).toBe(agentColor("frontend-dev"));
  });

  it("test-writer color key is stable", () => {
    expect(agentColor("test-writer")).toBe(agentColor("test-writer"));
  });

  it("reviewer color key is stable", () => {
    expect(agentColor("reviewer")).toBe(agentColor("reviewer"));
  });

  it("all roles in all modes have distinct color keys", () => {
    const allRoles = new Set<Role>();
    const allKeys = new Set<string>();
    for (const mode of MODES) {
      for (const role of rosterFor(mode)) {
        allRoles.add(role);
      }
    }
    for (const role of allRoles) {
      allKeys.add(agentColor(role));
    }
    // Each role should have a unique color key
    expect(allKeys.size).toBe(allRoles.size);
  });

  it("returns the AGENT_COLOR token key for known roles (FRD-13 contract)", () => {
    // The key must match the AGENT_COLOR map from tokens.ts
    const key = agentColor("researcher");
    expect(key).toBe("--color-agent-researcher");
  });

  it("agentColor('backend-dev') returns '--color-agent-backend-dev'", () => {
    expect(agentColor("backend-dev")).toBe("--color-agent-backend-dev");
  });

  it("agentColor('frontend-dev') returns '--color-agent-frontend-dev'", () => {
    expect(agentColor("frontend-dev")).toBe("--color-agent-frontend-dev");
  });

  it("agentColor('test-writer') returns '--color-agent-test-writer'", () => {
    expect(agentColor("test-writer")).toBe("--color-agent-test-writer");
  });

  it("agentColor('reviewer') returns '--color-agent-reviewer'", () => {
    expect(agentColor("reviewer")).toBe("--color-agent-reviewer");
  });
});

// ---------------------------------------------------------------------------
// ZONE_ROLE — zone↔role mapping constant (AC-06-001.1)
// ---------------------------------------------------------------------------

describe("ZONE_ROLE — zone↔role mapping (AC-06-001.1)", () => {
  it("has exactly 4 zones (Research, Backend, Frontend, Testing)", () => {
    const zones = Object.keys(ZONE_ROLE);
    expect(zones).toHaveLength(4);
  });

  it("zone 'library' maps to 'researcher' (Research = library)", () => {
    expect(ZONE_ROLE.library).toBe("researcher");
  });

  it("zone 'forge' maps to 'backend-dev' (Backend = forge)", () => {
    expect(ZONE_ROLE.forge).toBe("backend-dev");
  });

  it("zone 'workshop' maps to 'frontend-dev' (Frontend = workshop)", () => {
    expect(ZONE_ROLE.workshop).toBe("frontend-dev");
  });

  it("zone 'lab' maps to 'test-writer' (Testing = lab)", () => {
    expect(ZONE_ROLE.lab).toBe("test-writer");
  });

  it("ZONE_ROLE is a frozen object (immutable constant)", () => {
    expect(Object.isFrozen(ZONE_ROLE)).toBe(true);
  });

  it("all values in ZONE_ROLE are valid Role strings", () => {
    for (const role of Object.values(ZONE_ROLE)) {
      expect(typeof role).toBe("string");
      expect(role.length).toBeGreaterThan(0);
    }
  });
});
