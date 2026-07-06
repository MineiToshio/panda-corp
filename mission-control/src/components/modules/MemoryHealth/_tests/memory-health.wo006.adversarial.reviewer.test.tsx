/**
 * WO-17-006 — REVIEWER FRD-GATE adversarial test (DR-015, DR-057).
 *
 * Written at the FRD gate by a model distinct from the implementer (opus vs the
 * sonnet/haiku worker). WO-17-006 removes the obsolete "SOLO DEMO" `bDemo` frame
 * (dashed border + warn pill + "en la app real…" note) from MemoryHealth: the
 * trigger is now REAL (`shouldNudge` over real thresholds/health data,
 * AC-17-005.2), so the demo chrome misrepresented a genuine signal as simulated.
 *
 * The implementer's own WO-17-006 tests assert the pill text and the note text
 * are absent. These reviewer tests are STRICTER and mutation-killing — they close
 * the gaps a text-only assertion leaves:
 *   1. STRUCTURAL: the demo chrome cannot survive as an empty pill or a
 *      differently-worded note — no dashed-border wrapper, no warn-pill styling
 *      on the nudge/invite subtree (a re-added `BDemo` with the pill text changed
 *      would still fail here).
 *   2. REUSE-PROOF (DR-057): the nudge/invite affordance MUST be the shared
 *      `Banner` (stamps data-testid="banner"), not a re-forked local banner
 *      substituted for the removed frame — and both surfaces keep the real,
 *      copyable command (copy-button + the exact /pandacorp:memory command).
 *   3. INTEGRATION: exercised together with the fresh-factory invite AND the
 *      staleness nudge in the same render tree (not one surface in isolation).
 *
 * Traceability: AC-17-006.5 (pill/note gone), AC-17-006.6 (real Banner stands),
 * DR-057 (reuse-before-create), DR-015 (adversarial, distinct model).
 *
 * Stack: Vitest + @testing-library/react (jsdom). No fs access — fixture props only.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MemoryHealth as MemoryHealthData } from "@/lib/memory/memory-health";
import { MemoryHealth } from "../MemoryHealth";

// ---------------------------------------------------------------------------
// Fixtures — one that forces the staleness nudge, one fresh-factory invite.
// ---------------------------------------------------------------------------

const NUDGE_HEALTH: MemoryHealthData = {
  rawNotes: 30,
  candidates: 4,
  lastMemoryRunAt: "2026-05-01T10:00:00.000Z",
  staleDays: 42,
  lastSweepAt: null,
  harvestOrphans: [],
};

const FRESH_FACTORY: MemoryHealthData = {
  rawNotes: 0,
  candidates: 0,
  lastMemoryRunAt: null,
  staleDays: null,
  lastSweepAt: null,
  harvestOrphans: [],
};

// ---------------------------------------------------------------------------
// AC-17-006.5 — the demo chrome is gone (structural, not just text)
// ---------------------------------------------------------------------------

describe("wo-17-006 reviewer: no SOLO DEMO demo chrome survives (structural)", () => {
  it("the nudge subtree contains NO dashed-border demo wrapper", () => {
    render(<MemoryHealth health={NUDGE_HEALTH} />);
    const nudge = screen.getByTestId("memory-health-nudge");
    // A re-added bDemo frame set `border: 1.5px dashed …`. Assert no descendant
    // (nor the wrapper itself) carries a dashed border — the demo chrome is gone
    // even if its pill text were renamed.
    const dashed = Array.from(nudge.querySelectorAll<HTMLElement>("*")).filter((el) =>
      (el.getAttribute("style") ?? "").includes("dashed"),
    );
    expect(dashed).toHaveLength(0);
    expect(nudge.getAttribute("style") ?? "").not.toContain("dashed");
  });

  it("no 'SOLO DEMO'-style pill (any casing) renders in the nudge or invite", () => {
    render(<MemoryHealth health={NUDGE_HEALTH} />);
    render(<MemoryHealth health={FRESH_FACTORY} />);
    // Case-insensitive: catches "SOLO DEMO", "Solo demo", "solo-demo" variants.
    const soloDemo = screen.queryAllByText(/solo\s*demo/i);
    expect(soloDemo).toHaveLength(0);
  });

  it("the demo note prefix 'En la app real' is gone from both nudge and invite", () => {
    const { unmount } = render(<MemoryHealth health={NUDGE_HEALTH} />);
    expect(screen.getByTestId("memory-health-nudge").textContent ?? "").not.toMatch(
      /en la app real/i,
    );
    unmount();
    render(<MemoryHealth health={FRESH_FACTORY} />);
    expect(screen.getByTestId("memory-health-first-harvest").textContent ?? "").not.toMatch(
      /en la app real/i,
    );
  });
});

// ---------------------------------------------------------------------------
// AC-17-006.6 — the real, copyable Banner still stands (DR-057 reuse-proof)
// ---------------------------------------------------------------------------

describe("wo-17-006 reviewer: the real shared Banner still stands (DR-057)", () => {
  it("the staleness nudge IS the shared Banner (data-testid='banner'), not a re-forked div", () => {
    render(<MemoryHealth health={NUDGE_HEALTH} />);
    const nudge = screen.getByTestId("memory-health-nudge");
    // Mutation-killer: a hand-rolled replacement banner cannot stamp
    // data-testid="banner" — only the shared primitive does.
    expect(within(nudge).getByTestId("banner")).toBeInTheDocument();
  });

  it("the first-harvest invite IS the shared Banner (data-testid='banner')", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);
    const invite = screen.getByTestId("memory-health-first-harvest");
    expect(within(invite).getByTestId("banner")).toBeInTheDocument();
  });

  it("the nudge keeps its exact copyable /pandacorp:memory command + copy-button", () => {
    render(<MemoryHealth health={NUDGE_HEALTH} />);
    const nudge = screen.getByTestId("memory-health-nudge");
    expect(nudge.textContent ?? "").toMatch(/\/pandacorp:memory\s+(harvest|review)/);
    expect(within(nudge).getByTestId("copy-button")).toBeInTheDocument();
  });

  it("the invite keeps its exact copyable /pandacorp:memory harvest command + copy-button", () => {
    render(<MemoryHealth health={FRESH_FACTORY} />);
    const invite = screen.getByTestId("memory-health-first-harvest");
    expect(invite.textContent ?? "").toContain("/pandacorp:memory harvest");
    expect(within(invite).getByTestId("copy-button")).toBeInTheDocument();
  });

  it("the 10px top spacing the removed frame supplied is preserved on both surfaces", () => {
    const { unmount } = render(<MemoryHealth health={NUDGE_HEALTH} />);
    expect(screen.getByTestId("memory-health-nudge").getAttribute("style") ?? "").toContain(
      "margin-top: 10px",
    );
    unmount();
    render(<MemoryHealth health={FRESH_FACTORY} />);
    expect(screen.getByTestId("memory-health-first-harvest").getAttribute("style") ?? "").toContain(
      "margin-top: 10px",
    );
  });
});
