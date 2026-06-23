/**
 * FRD-02 GATE — adversarial integration (reviewer-authored, DR-015).
 *
 * Exercises the FRD-02 work orders TOGETHER with NO internal mocks:
 *   WO-02-007 CardDetail (3-tab shell)
 *     → mounts WO-02-010 CampaignPipeline (real)
 *       → driven by WO-02-011 phaseFromStatus (real, via CardDetail)
 *     → raises onEnterForge wired in WO-02-012 goToParty contract (real callback shape)
 *
 * The implementers' own tests mock CampaignPipeline (CardDetail.tabs.test.tsx) or test each
 * unit in isolation. This file verifies the REAL seam: that the active campaign phase the
 * pipeline renders is the one phaseFromStatus derives from the card's status/phase, that the
 * "Entrar a La Fragua" button bubbles the card's slug back through CardDetail's onEnterForge,
 * and edge/abuse cases the isolated suites did not see crossing the seam.
 *
 * Stack: Vitest + @testing-library/react (jsdom). No vi.mock of any FRD-02 unit.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import { phaseFromStatus } from "@/lib/campaign/campaign";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import type { Phase } from "@/lib/status/status";

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PHASE_ORDER = ["research", "product", "design", "architecture", "build", "release"] as const;

function renderDetail(overrides: Partial<React.ComponentProps<typeof CardDetail>> = {}): {
  onEnterForge: ReturnType<typeof vi.fn>;
} {
  const onEnterForge = vi.fn();
  render(
    <CardDetail
      slug={overrides.slug ?? "my-idea"}
      title={overrides.title ?? "Mi idea"}
      status={overrides.status ?? "discovered"}
      body={overrides.body ?? "Resumen de la idea."}
      phase={overrides.phase}
      advancePending={overrides.advancePending}
      docsIndex={overrides.docsIndex}
      onEnterForge={overrides.onEnterForge ?? onEnterForge}
    />,
  );
  return { onEnterForge };
}

/** The phase button that should be the `current` one, by data-phase-state. */
function currentPhaseKey(): string | null {
  const buttons = screen.getAllByTestId(/^campaign-phase-/);
  const current = buttons.find((b) => b.getAttribute("data-phase-state") === "current");
  if (current == null) return null;
  return current.getAttribute("data-testid")?.replace("campaign-phase-", "") ?? null;
}

// ---------------------------------------------------------------------------
// Seam 1: the phase the pipeline renders == phaseFromStatus(status, phase)
// ---------------------------------------------------------------------------

describe("FRD-02 integration — CardDetail drives the REAL CampaignPipeline active phase (WO-007↔010↔011)", () => {
  const cases: Array<{ status: IdeaStatus; phase?: Phase; expectKey: string }> = [
    { status: "discovered", expectKey: "research" },
    { status: "recommended", expectKey: "research" },
    { status: "in-pipeline", phase: "product", expectKey: "product" },
    { status: "in-pipeline", phase: "design", expectKey: "design" },
    { status: "in-pipeline", phase: "architecture", expectKey: "architecture" },
    { status: "in-pipeline", phase: "implementation", expectKey: "build" },
    { status: "in-pipeline", phase: "release", expectKey: "build" },
    { status: "in-pipeline", phase: "operation", expectKey: "release" },
    { status: "shipped", expectKey: "release" },
  ];

  for (const { status, phase, expectKey } of cases) {
    it(`status=${status} phase=${phase ?? "—"} → pipeline current phase is "${expectKey}" (matches phaseFromStatus)`, () => {
      // Cross-check the derivation oracle directly so the test is anchored, not circular.
      const idx = phaseFromStatus({ cardStatus: status, phase });
      expect(PHASE_ORDER[idx]).toBe(expectKey);

      renderDetail({ status, phase });
      expect(currentPhaseKey()).toBe(expectKey);
    });
  }

  it("in-pipeline card with NO project phase (missing status.yaml) falls back to research, view still renders (AC-02-010.2 edge across the seam)", () => {
    renderDetail({ status: "in-pipeline", phase: undefined });
    expect(screen.getByTestId("campaign-pipeline")).toBeInTheDocument();
    expect(currentPhaseKey()).toBe("research");
    // Every later phase must be locked, none crashing.
    expect(screen.getByTestId("campaign-phase-release").getAttribute("data-phase-state")).toBe(
      "locked",
    );
  });
});

// ---------------------------------------------------------------------------
// Seam 2: done/current/locked invariant holds end-to-end (AC-02-010.3/.7)
// ---------------------------------------------------------------------------

describe("FRD-02 integration — phase-state invariant through CardDetail (AC-02-010.3/.7)", () => {
  it("shipped → all 5 earlier phases done, release current, none locked-before (no off-by-one across the seam)", () => {
    renderDetail({ status: "shipped" });
    const states = PHASE_ORDER.map((key) =>
      screen.getByTestId(`campaign-phase-${key}`).getAttribute("data-phase-state"),
    );
    expect(states).toEqual(["done", "done", "done", "done", "done", "current"]);
  });

  it("discovered → research current, all 5 following phases locked (AC-02-010.7)", () => {
    renderDetail({ status: "discovered" });
    const states = PHASE_ORDER.map((key) =>
      screen.getByTestId(`campaign-phase-${key}`).getAttribute("data-phase-state"),
    );
    expect(states).toEqual(["current", "locked", "locked", "locked", "locked", "locked"]);
  });

  it("a locked future phase opens its full ficha (team readable), no locked-out marker, no forge action (AC-02-010.7)", () => {
    renderDetail({ status: "discovered" });
    fireEvent.click(screen.getByTestId("campaign-phase-release"));
    const ficha = screen.getByTestId("campaign-phase-ficha");
    // Phase INFO is always readable — no locked-out marker; the team is shown.
    expect(within(ficha).queryByTestId("ficha-locked-marker")).not.toBeInTheDocument();
    expect(within(ficha).queryAllByTestId("ficha-team-member").length).toBeGreaterThan(0);
    // A locked phase still must NOT expose the forge ACTION (info yes, action no).
    expect(within(ficha).queryByTestId("ficha-enter-forge")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Seam 3: "Entrar a La Fragua" bubbles the card slug through CardDetail (WO-010↔012↔007)
// ---------------------------------------------------------------------------

describe("FRD-02 integration — Entrar a La Fragua bubbles the slug to onEnterForge (AC-02-010.5)", () => {
  it("clicking the build phase's forge button calls CardDetail.onEnterForge with THE CARD'S slug, not a stale one", () => {
    // Build phase is only reachable (non-locked) when active. Use an in-pipeline/build card.
    const { onEnterForge } = renderDetail({
      slug: "panda-shop",
      status: "in-pipeline",
      phase: "implementation",
    });
    // build is the current phase → its ficha is open by DEFAULT and exposes the forge button
    // (sel initialises to the active phase). Clicking build again would toggle it closed.
    fireEvent.click(screen.getByTestId("ficha-enter-forge"));
    expect(onEnterForge).toHaveBeenCalledTimes(1);
    expect(onEnterForge).toHaveBeenCalledWith("panda-shop");
  });

  it("the forge button only exists in the BUILD ficha, never in another phase's ficha (no accidental nav from product)", () => {
    renderDetail({ slug: "x", status: "shipped" });
    // open product ficha (done phase) — has team, but no forge button
    fireEvent.click(screen.getByTestId("campaign-phase-product"));
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).queryByTestId("ficha-enter-forge")).toBeNull();
    expect(within(ficha).getAllByTestId("ficha-team-member").length).toBeGreaterThan(0);
  });

  it("CardDetail without an onEnterForge prop does NOT crash when the forge button is clicked (default no-op)", () => {
    render(
      <CardDetail
        slug="no-cb"
        title="Sin callback"
        status="in-pipeline"
        phase="implementation"
        body="x"
      />,
    );
    // build is the active phase → its ficha (with the forge button) is open by default.
    expect(() => fireEvent.click(screen.getByTestId("ficha-enter-forge"))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Seam 4: the tab default + Documentos/Comandos coexistence (AC-02-009.x) with the REAL pipeline
// ---------------------------------------------------------------------------

describe("FRD-02 integration — 3 tabs coexist with the real pipeline (AC-02-009.x)", () => {
  it("defaults to Campaña and the real pipeline is the active panel's content", () => {
    renderDetail({ status: "discovered" });
    expect(screen.getByTestId("card-detail-tab-campana").getAttribute("aria-selected")).toBe(
      "true",
    );
    // The real pipeline (not a mock) is present with its labelled container.
    expect(screen.getByTestId("campaign-pipeline")).toBeInTheDocument();
    expect(screen.getByText("EL VIAJE DE ESTA IDEA POR LAS 6 FASES")).toBeInTheDocument();
  });

  it("a card with no docs shows summary only and still renders the full pipeline (no cross-tab breakage)", () => {
    renderDetail({ status: "discovered", body: "Solo resumen.", docsIndex: null });
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    // New contract: the docs rail is always present (lists Resumen); with no project
    // docs it has zero project doc items, and the Resumen reader shows the summary.
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
    // pipeline still mounted (clip strategy keeps all panels in the tree)
    expect(screen.getByTestId("campaign-pipeline")).toBeInTheDocument();
  });

  it("opening a phase ficha does NOT reset the active tab choice (AC-02-009.4 across an interaction that re-renders)", () => {
    renderDetail({ status: "in-pipeline", phase: "implementation" });
    // switch to Comandos
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    expect(screen.getByTestId("card-detail-tab-comandos").getAttribute("aria-selected")).toBe(
      "true",
    );
    // interacting with the (hidden) pipeline ficha must not steal the active tab
    fireEvent.click(screen.getByTestId("campaign-phase-build"));
    expect(screen.getByTestId("card-detail-tab-comandos").getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});

// ---------------------------------------------------------------------------
// Seam 5: read-only invariant across the integrated render (AC-02-010.6)
// ---------------------------------------------------------------------------

describe("FRD-02 integration — read-only across the whole detail (AC-02-010.6)", () => {
  it("rendering and clicking through every phase ficha performs NO network call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    renderDetail({ status: "shipped" });
    for (const key of PHASE_ORDER) {
      fireEvent.click(screen.getByTestId(`campaign-phase-${key}`));
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
