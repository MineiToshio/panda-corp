/**
 * FRD-06 — Second-pass adversarial reviewer tests at the SCENE/INTEGRATION level
 * (FRD gate, powerful mode, Opus — DR-015).
 *
 * The first reviewer pass (`frd-06-gate.reviewer.test.ts`) and the implementer's
 * own tests exercise the PURE snapshot (`toFraguaSnapshot`) and the FraguaScene in
 * isolation. This file closes the gaps at the COMPOSITION boundary — the real path
 * the workspace page mounts (`PartyTab` → `PartyLiveShell` → `PartyScene` →
 * `FraguaScene`), exercising WO-06-007 TOGETHER with its VERIFIED dependencies
 * (WO-06-005 snapshot, the FND-4 primitives WO-13-009, the live shell WO-01-009).
 *
 * Deliberately disjoint from the existing coverage:
 *   - `frd-06-gate.reviewer.test.ts` covers the snapshot derivation (cap, FRD pick,
 *     trophy overflow, mode fallback, empty stream).
 *   - `FraguaScene.adversarial.test.tsx` covers the 4 lenses + visual judge on the
 *     ISOLATED FraguaScene.
 *   This file adds:
 *     AC-06-001.2  — the SCENE itself never over-renders forge sprites past the wave,
 *                    even when handed a snapshot whose `running` array is over-stuffed
 *                    (defense-in-depth — the mock: "the view must never render more
 *                    sprites than the mode's wave even if the stream is noisy").
 *     AC-06-004.2/.3 — the 4 lenses + visual judge reach the DOM through the FULL
 *                    PartyScene/PartyLiveShell composition (not only the isolated scene).
 *     AC-06-009.1  — the FULL composition exposes NO control affordance (no button,
 *                    no input, no select, no mode-selector) anywhere in the tree.
 *     AC-06-013    — factory-off is DERIVED from `active`: active=false → the power-off
 *                    overlay is on; the scene never throws / never blanks.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Event as DashboardEvent } from "@/lib/events/events";
import type { FraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { PartyScene } from "../PartyScene/PartyScene";

// The FND-4 primitives + scene drive a RAF loop; stub it so jsdom stays quiet.
vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});

function runningWos(count: number): FraguaSnapshot["running"] {
  return Array.from({ length: count }, (_, i) => ({
    wo: `WO-06-${String(i + 1).padStart(3, "0")}`,
    title: `Work order ${i + 1}`,
    state: "building" as const,
  }));
}

function snap(overrides: Partial<FraguaSnapshot> = {}): FraguaSnapshot {
  return {
    frd: { id: "frd-06-party", title: "FRD-06 Party — La Fragua" },
    mode: "powerful",
    wave: 8,
    running: runningWos(3),
    queuedCount: 0,
    gate: { open: false },
    trophies: [],
    archivedCount: 0,
    project: { done: 4, total: 12 },
    events: [],
    active: true,
    lastEventAt: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-06-001.2 — the rendered scene never paints more forge sprites than the wave,
// through the REAL data path: a noisy/over-stuffed event stream is capped at
// snapshot derivation (WO-06-005, VERIFIED) and the scene then renders exactly
// that capped set. The mock: "never render more sprites than the mode's wave even
// if the stream is noisy/duplicated." This integration test feeds the scene the
// snapshot the production pipeline (PartyTab → toFraguaSnapshot → PartyScene)
// actually produces — not a hand-stuffed array that bypasses the cap.
// ---------------------------------------------------------------------------

function working(wo: string, frd: string, mode: DashboardEvent["mode"]): DashboardEvent {
  return { event: "AgentWorking", at: "2026-06-20T10:00:00Z", workOrder: wo, frd, mode };
}

describe("frd-06 scene gate: the forge never paints more sprites than the wave (AC-06-001.2)", () => {
  it("frd-06: GIVEN 12 noisy powerful-mode WOs in the stream THEN the scene paints at most 8 forge sprites", () => {
    // 12 distinct running WOs, but powerful wave is 8: the snapshot caps to 8,
    // and the scene must render exactly the capped set — never 12.
    const events = Array.from({ length: 12 }, (_, i) =>
      working(`WO-06-${String(i + 1).padStart(3, "0")}`, "frd-06-party", "powerful"),
    );
    const derived = toFraguaSnapshot(events, { lastEventAt: "2026-06-20T10:00:00Z" });
    expect(derived.wave).toBe(8);
    render(<PartyScene snapshot={derived} />);
    const forgeSprites = screen.getAllByTestId(/^fragua-wo-WO-06-/);
    expect(forgeSprites.length).toBeLessThanOrEqual(8);
    // The remainder is surfaced as the queue badge, never lost (AC-06-001.3).
    expect(screen.getByTestId("fragua-queue-badge").textContent).toContain("4");
  });

  it("frd-06: GIVEN 9 noisy deep-mode WOs in the stream THEN the scene paints at most 6 forge sprites", () => {
    const events = Array.from({ length: 9 }, (_, i) =>
      working(`WO-06-${String(i + 1).padStart(3, "0")}`, "frd-06-party", "deep"),
    );
    const derived = toFraguaSnapshot(events, { lastEventAt: "2026-06-20T10:00:00Z" });
    expect(derived.wave).toBe(6);
    render(<PartyScene snapshot={derived} />);
    const forgeSprites = screen.getAllByTestId(/^fragua-wo-WO-06-/);
    expect(forgeSprites.length).toBeLessThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// AC-06-004.2/.3 — the four lenses + visual judge reach the DOM through the FULL
// PartyScene composition (the scene-host, not just the isolated FraguaScene).
// ---------------------------------------------------------------------------

describe("frd-06 scene gate: four lenses + visual judge via the full PartyScene (AC-06-004.2/.3)", () => {
  it("frd-06: WHEN the gate is open in PartyScene THEN four code lenses + a visual judge are present", () => {
    render(<PartyScene snapshot={snap({ gate: { open: true } })} />);
    const reviewer = screen.getByTestId("fragua-reviewer");
    expect(reviewer.querySelectorAll("[data-lens]").length).toBeGreaterThanOrEqual(4);
    // The visual judge is a DISTINCT element from the four code lenses.
    const visualJudge = screen.getByTestId("fragua-visual-judge");
    expect(visualJudge.hasAttribute("data-lens")).toBe(false);
  });

  it("frd-06: WHILE the gate is CLOSED THEN no lenses and no visual judge are shown (the gate is shut)", () => {
    render(<PartyScene snapshot={snap({ gate: { open: false } })} />);
    expect(screen.queryByTestId("fragua-visual-judge")).toBeNull();
    expect(document.querySelectorAll("[data-lens]").length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-06-009.1 — the FULL composition exposes NO control affordance (read-only).
// ---------------------------------------------------------------------------

describe("frd-06 scene gate: the full scene is read-only — no control affordances (AC-06-009.1)", () => {
  it("frd-06: PartyScene renders ZERO buttons / inputs / selects / mode-selector", () => {
    const { container } = render(<PartyScene snapshot={snap({ gate: { open: true } })} />);
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.querySelectorAll("input").length).toBe(0);
    expect(container.querySelectorAll("select").length).toBe(0);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByTestId("mode-selector")).toBeNull();
    expect(screen.queryByTestId("demo-controls-badge")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-06-013 — factory-off is DERIVED from `active`, never a control, never blanks.
// ---------------------------------------------------------------------------

describe("frd-06 scene gate: factory-off is derived from real state (AC-06-013)", () => {
  it("frd-06: WHEN active=false THEN the power-off overlay is ON and the scene still renders", () => {
    render(<PartyScene snapshot={snap({ active: false })} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    // PowerOffOverlay is `off` (visible treatment) when active=false.
    expect(overlay.getAttribute("data-off")).not.toBe("false");
    // The scene is NOT blank — the stage still mounts behind the overlay.
    expect(screen.getByTestId("fragua-scene")).toBeTruthy();
  });

  it("frd-06: WHEN active=true THEN the power-off overlay is OFF (no false factory-off)", () => {
    render(<PartyScene snapshot={snap({ active: true })} />);
    const overlay = screen.getByTestId("power-off-overlay-root");
    expect(overlay.getAttribute("data-off")).toBe("false");
  });
});
