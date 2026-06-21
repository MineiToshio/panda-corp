/**
 * WO-06-007 — FraguaScene ADVERSARIAL tests (reviewer, FRD gate, DR-015)
 *
 * Edge-cases / spec-fidelity the implementer's own tests did NOT cover, anchored
 * verbatim in the FRD EARS criteria (docs/frds/frd-06-party/frd.md) and the
 * approved mock (docs/frds/frd-06-party/mocks/la-fragua.html).
 *
 * Why these exist: the implementer's FraguaScene.test.tsx asserts only "three
 * lenses (>=3)" while REQ-06-004 (AC-06-004.2/.3) demands FOUR lenses
 * (correctness · security · quality · runtime/visual) PLUS a visual judge that
 * compares capture vs mock and blesses the baseline — the mock spells it out:
 * "4 lentes (correctitud·seguridad·calidad·runtime/visual) + el juez visual".
 * A test that matches an incomplete impl is decorative; these lock the contract.
 *
 * Acceptance criteria under test:
 *   AC-06-004.2 — the gate indicates FOUR lenses (the 4th is runtime/visual)
 *   AC-06-004.3 — the gate indicates a visual judge (capture vs mock) + baseline
 *
 * (The wave cap is owned upstream by the VERIFIED `toFraguaSnapshot`, WO-06-005,
 * which already trims `running` to `<= wave`; the scene legitimately trusts it,
 * so the cap is not re-asserted here against WO-06-007.)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FraguaSnapshot } from "../../fragua-snapshot/fragua-snapshot";
import { FraguaScene } from "../FraguaScene";

vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});

function snap(overrides: Partial<FraguaSnapshot> = {}): FraguaSnapshot {
  return {
    frd: { id: "frd-06-party", title: "FRD-06 Party" },
    mode: "powerful",
    wave: 8,
    running: [],
    queuedCount: 0,
    gate: { open: false },
    trophies: [],
    archivedCount: 0,
    project: { done: 4, total: 12 },
    events: [],
    active: true,
    lastEventAt: "2026-06-18T20:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-06-004.2 — FOUR lenses, the 4th being runtime/visual
// ---------------------------------------------------------------------------

describe("frd-06 (adversarial): the reviewer gate indicates FOUR lenses (AC-06-004.2)", () => {
  it("frd-06: WHEN the gate is open THEN at least FOUR lenses are indicated (not three)", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: true } })} />);
    const reviewer = screen.getByTestId("fragua-reviewer");
    // REQ-06-004 / mock: correctness · security · quality · runtime/visual
    expect(reviewer.querySelectorAll("[data-lens]").length).toBeGreaterThanOrEqual(4);
  });

  it("frd-06: WHEN the gate is open THEN a runtime/visual lens is present (the 4th lens)", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: true } })} />);
    const reviewer = screen.getByTestId("fragua-reviewer");
    const lensKeys = Array.from(reviewer.querySelectorAll("[data-lens]")).map((el) =>
      el.getAttribute("data-lens"),
    );
    // The 4th lens is runtime/visual (FRD wording); accept either spelling.
    expect(lensKeys.some((k) => k === "runtime" || k === "visual")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-06-004.3 — visual judge (capture vs mock) + baseline blessing, distinct
// from the four code lenses
// ---------------------------------------------------------------------------

describe("frd-06 (adversarial): the gate indicates a visual judge + baseline (AC-06-004.3)", () => {
  it("frd-06: WHEN the gate is open THEN a visual-judge indicator is present", () => {
    render(<FraguaScene snapshot={snap({ gate: { open: true } })} />);
    const reviewer = screen.getByTestId("fragua-reviewer");
    // The visual judge is distinct from the code lenses (mock: "juez visual").
    expect(reviewer.querySelector("[data-testid='fragua-visual-judge']")).not.toBeNull();
  });
});
