/**
 * WO-02-010 — CampaignPipeline component tests (TDD: RED phase)
 *
 * Traceability:
 *   CMP-02-campaign-pipeline → components/modules/CampaignPipeline/CampaignPipeline.tsx
 *   REQ-02-010 — La Campaña: 6-phase pipeline, derived active phase, per-phase ficha,
 *                host-navigate on build Entrar a La Fragua, read-only, graceful locked states.
 *   AC-02-010.1 — renders 6 phases in order in labelled container.
 *   AC-02-010.3 — done/current/locked by position relative to activePhase.
 *   AC-02-010.4 — clicking a phase shows its ficha: description + LEE/ESCRIBE + whole team.
 *   AC-02-010.5 — build phase "Entrar a La Fragua" calls onEnterForge(slug).
 *   AC-02-010.6 — read-only: no write, no network, no fs, no Claude call.
 *   AC-02-010.7 — locked future phase renders graceful locked state without crashing.
 *
 * Team fixture (from FRD-02 / blueprint §4b):
 *   research      → researcher
 *   product       → product-manager
 *   design        → designer + copywriter
 *   architecture  → architect
 *   build         → implementer + reviewer + analytics
 *   release       → security-auditor + devops
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CampaignPipeline,
  type CampaignPipelineProps,
} from "@/components/modules/CampaignPipeline/CampaignPipeline";
import type { CampaignPhase } from "@/lib/campaign/campaign";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_PROPS: CampaignPipelineProps = {
  slug: "my-idea",
  activePhase: 0,
  onEnterForge: vi.fn(),
};

// Phase keys in order — the pipeline must render them exactly in this sequence.
const PHASE_KEYS = ["research", "product", "design", "architecture", "build", "release"] as const;

// ---------------------------------------------------------------------------
// AC-02-010.1 — 6 phases rendered in order inside a labelled container
// ---------------------------------------------------------------------------

describe("AC-02-010.1 — 6-phase pipeline in labelled container", () => {
  it("mounts without throwing", () => {
    expect(() => render(<CampaignPipeline {...DEFAULT_PROPS} />)).not.toThrow();
  });

  it("root element has data-testid='campaign-pipeline'", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("campaign-pipeline")).toBeInTheDocument();
  });

  it("renders exactly 6 phase elements", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    // each phase has data-testid="campaign-phase-{key}"
    const allPhaseEls = PHASE_KEYS.map((k) => screen.getByTestId(`campaign-phase-${k}`));
    expect(allPhaseEls).toHaveLength(6);
  });

  it.each(PHASE_KEYS)("renders phase '%s' element", (key) => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    expect(screen.getByTestId(`campaign-phase-${key}`)).toBeInTheDocument();
  });

  it("phases are rendered in order: research, product, design, architecture, build, release", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const root = screen.getByTestId("campaign-pipeline");
    const phaseEls = PHASE_KEYS.map((k) => screen.getByTestId(`campaign-phase-${k}`));
    // Each phase must appear in the pipeline container
    for (const el of phaseEls) {
      expect(root.contains(el)).toBe(true);
    }
    // Document order: phase N precedes phase N+1
    for (let i = 0; i < phaseEls.length - 1; i++) {
      const current = phaseEls[i];
      const next = phaseEls[i + 1];
      if (current == null || next == null) continue;
      expect(current.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("renders a labelled container heading 'EL VIAJE DE ESTA IDEA POR LAS 6 FASES'", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    expect(screen.getByText(/EL VIAJE DE ESTA IDEA POR LAS 6 FASES/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-02-010.3 — done / current / locked by index vs activePhase
// ---------------------------------------------------------------------------

describe("AC-02-010.3 — done / current / locked phase states", () => {
  it("activePhase=0 (research): research is current, all others are locked", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const research = screen.getByTestId("campaign-phase-research");
    expect(research).toHaveAttribute("data-phase-state", "current");
    for (const key of PHASE_KEYS.slice(1)) {
      expect(screen.getByTestId(`campaign-phase-${key}`)).toHaveAttribute(
        "data-phase-state",
        "locked",
      );
    }
  });

  it("activePhase=2 (design): research+product are done, design is current, arch+build+release are locked", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={2} />);
    expect(screen.getByTestId("campaign-phase-research")).toHaveAttribute(
      "data-phase-state",
      "done",
    );
    expect(screen.getByTestId("campaign-phase-product")).toHaveAttribute(
      "data-phase-state",
      "done",
    );
    expect(screen.getByTestId("campaign-phase-design")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    expect(screen.getByTestId("campaign-phase-architecture")).toHaveAttribute(
      "data-phase-state",
      "locked",
    );
    expect(screen.getByTestId("campaign-phase-build")).toHaveAttribute(
      "data-phase-state",
      "locked",
    );
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "locked",
    );
  });

  it("activePhase=4 (build): research+product+design+architecture are done, build is current, release is locked", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={4} />);
    for (const key of ["research", "product", "design", "architecture"] as const) {
      expect(screen.getByTestId(`campaign-phase-${key}`)).toHaveAttribute(
        "data-phase-state",
        "done",
      );
    }
    expect(screen.getByTestId("campaign-phase-build")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "locked",
    );
  });

  it("activePhase=5 (release): all prior phases are done, release is current", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={5} />);
    for (const key of PHASE_KEYS.slice(0, 5)) {
      expect(screen.getByTestId(`campaign-phase-${key}`)).toHaveAttribute(
        "data-phase-state",
        "done",
      );
    }
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
  });

  it("activePhase=1 (product): research is done, product is current, rest locked", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={1} />);
    expect(screen.getByTestId("campaign-phase-research")).toHaveAttribute(
      "data-phase-state",
      "done",
    );
    expect(screen.getByTestId("campaign-phase-product")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    for (const key of ["design", "architecture", "build", "release"] as const) {
      expect(screen.getByTestId(`campaign-phase-${key}`)).toHaveAttribute(
        "data-phase-state",
        "locked",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AC-02-010.4 — per-phase ficha with description + LEE/ESCRIBE + WHOLE team
// ---------------------------------------------------------------------------

describe("AC-02-010.4 — per-phase ficha (active by default; click to switch, never toggle-close)", () => {
  it("the active phase's ficha is shown by default (sel initialises to active)", () => {
    // New contract: selectedPhaseKey defaults to the active phase, so its ficha
    // is open on initial render — there is no "nothing open" state before a click.
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(ficha).toBeInTheDocument();
    // It's the ACTIVE phase's ficha (research) — its team member is the researcher.
    expect(within(ficha).getByTestId("ficha-team")).toHaveTextContent(/researcher/i);
  });

  it("clicking a DIFFERENT phase shows that phase's ficha", () => {
    // research is open by default (active); clicking the (done/unlocked) product
    // phase switches the ficha to product. Use activePhase=5 so product is unlocked.
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={5} />);
    fireEvent.click(screen.getByTestId("campaign-phase-product"));
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(ficha).toBeInTheDocument();
    expect(within(ficha).getByTestId("ficha-team")).toHaveTextContent(/product-manager/i);
  });

  it("the active phase ficha contains a description section", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).getByTestId("ficha-description")).toBeInTheDocument();
  });

  it("the active phase ficha contains LEE (reads previous deliverable)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={1} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).getByTestId("ficha-lee")).toBeInTheDocument();
  });

  it("the active phase ficha contains ESCRIBE (writes next deliverable)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={1} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).getByTestId("ficha-escribe")).toBeInTheDocument();
  });

  it("the active phase ficha contains the team section", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).getByTestId("ficha-team")).toBeInTheDocument();
  });

  it("the active phase ficha header shows '{n · name} — {state}' (EN CURSO for the active phase)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const header = screen.getByTestId("ficha-header");
    // n · name (1 · Investigación) and the state label EN CURSO for the current phase.
    expect(header).toHaveTextContent(/1 · Investigación/);
    expect(header).toHaveTextContent(/EN CURSO/);
  });

  // --- research team: researcher only (active by default at activePhase=0) ---
  it("research ficha shows 'researcher' team member", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).getByTestId("ficha-team")).toHaveTextContent(/researcher/i);
  });

  it("research ficha shows exactly 1 team member", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const team = screen.getByTestId("ficha-team");
    const members = within(team).getAllByTestId("ficha-team-member");
    expect(members).toHaveLength(1);
  });

  // --- product team: product-manager only ---
  it("product ficha shows 'product-manager' team member", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={1} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    // ficha-team must include the role key "product-manager"
    expect(within(ficha).getByTestId("ficha-team")).toHaveTextContent(/product-manager/i);
  });

  it("product ficha shows exactly 1 team member", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={1} />);
    const team = screen.getByTestId("ficha-team");
    const members = within(team).getAllByTestId("ficha-team-member");
    expect(members).toHaveLength(1);
  });

  // --- design team: designer + copywriter ---
  it("design ficha shows BOTH designer and copywriter team members (AC-02-010.4)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={2} />);
    const team = screen.getByTestId("ficha-team");
    // Both role key and display label match /designer/i — use getAllByText (multiple ok)
    expect(within(team).getAllByText(/designer/i).length).toBeGreaterThanOrEqual(1);
    expect(within(team).getAllByText(/copywriter/i).length).toBeGreaterThanOrEqual(1);
  });

  it("design ficha shows exactly 2 team members", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={2} />);
    const team = screen.getByTestId("ficha-team");
    const members = within(team).getAllByTestId("ficha-team-member");
    expect(members).toHaveLength(2);
  });

  // --- architecture team: architect only ---
  it("architecture ficha shows 'architect' team member", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={3} />);
    const team = screen.getByTestId("ficha-team");
    expect(within(team).getAllByText(/architect/i).length).toBeGreaterThanOrEqual(1);
  });

  it("architecture ficha shows exactly 1 team member", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={3} />);
    const team = screen.getByTestId("ficha-team");
    const members = within(team).getAllByTestId("ficha-team-member");
    expect(members).toHaveLength(1);
  });

  // --- build team: implementer + reviewer + analytics ---
  it("build ficha shows implementer, reviewer AND analytics (AC-02-010.4 whole team)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={4} />);
    const team = screen.getByTestId("ficha-team");
    expect(within(team).getAllByText(/implementer/i).length).toBeGreaterThanOrEqual(1);
    expect(within(team).getAllByText(/reviewer/i).length).toBeGreaterThanOrEqual(1);
    expect(within(team).getAllByText(/analytics/i).length).toBeGreaterThanOrEqual(1);
  });

  it("build ficha shows exactly 3 team members", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={4} />);
    const team = screen.getByTestId("ficha-team");
    const members = within(team).getAllByTestId("ficha-team-member");
    expect(members).toHaveLength(3);
  });

  // --- release team: security-auditor + devops ---
  it("release ficha shows BOTH security-auditor and devops team members (AC-02-010.4)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={5} />);
    const team = screen.getByTestId("ficha-team");
    expect(within(team).getAllByText(/security-auditor/i).length).toBeGreaterThanOrEqual(1);
    expect(within(team).getAllByText(/devops/i).length).toBeGreaterThanOrEqual(1);
  });

  it("release ficha shows exactly 2 team members", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={5} />);
    const team = screen.getByTestId("ficha-team");
    const members = within(team).getAllByTestId("ficha-team-member");
    expect(members).toHaveLength(2);
  });

  // --- clicking a different phase updates the ficha ---
  it("clicking a second phase replaces the ficha with the new phase's data", () => {
    // activePhase=5 (release) → all prior phases are done, so both research and build are accessible.
    // release is the active phase, so its ficha is open by default; click research, then build.
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={5} />);
    fireEvent.click(screen.getByTestId("campaign-phase-research"));
    const researchFicha = screen.getByTestId("campaign-phase-ficha");
    expect(within(researchFicha).getByTestId("ficha-team")).toHaveTextContent(/researcher/i);

    fireEvent.click(screen.getByTestId("campaign-phase-build"));
    const buildFicha = screen.getByTestId("campaign-phase-ficha");
    expect(within(buildFicha).getByTestId("ficha-team")).toHaveTextContent(/implementer/i);
    // Only one ficha at a time
    expect(screen.getAllByTestId("campaign-phase-ficha")).toHaveLength(1);
  });

  // --- the ficha is always visible: clicking the open phase does NOT close it ---
  it("clicking the already-open (active) phase keeps the ficha visible (no toggle-close)", () => {
    // research is open by default at activePhase=0; re-clicking it must NOT hide the ficha
    // (the detail below the map must always stay visible).
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    expect(screen.getByTestId("campaign-phase-ficha")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("campaign-phase-research"));
    expect(screen.getByTestId("campaign-phase-ficha")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("campaign-phase-research"));
    expect(screen.getByTestId("campaign-phase-ficha")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-02-010.5 — build phase "Entrar a La Fragua" calls onEnterForge(slug)
// ---------------------------------------------------------------------------

describe("AC-02-010.5 — build phase Entrar a La Fragua callback", () => {
  it("build phase ficha shows 'Entrar a La Fragua' button (build is active → open by default)", () => {
    // At activePhase=4 the build ficha is open by default — no click needed.
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={4} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).getByTestId("ficha-enter-forge")).toBeInTheDocument();
  });

  it("clicking 'Entrar a La Fragua' calls onEnterForge with the slug", () => {
    const mockOnEnterForge = vi.fn();
    // build is the active phase → its ficha (with the forge button) is open by default.
    render(<CampaignPipeline slug="cool-idea" activePhase={4} onEnterForge={mockOnEnterForge} />);
    fireEvent.click(screen.getByTestId("ficha-enter-forge"));
    expect(mockOnEnterForge).toHaveBeenCalledWith("cool-idea");
    expect(mockOnEnterForge).toHaveBeenCalledTimes(1);
  });

  it("other phases do NOT show the 'Entrar a La Fragua' button", () => {
    // research is the active phase → its ficha is open by default and must NOT
    // expose the forge button (only the build ficha does).
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    const ficha = screen.getByTestId("campaign-phase-ficha");
    expect(within(ficha).getByTestId("ficha-team")).toHaveTextContent(/researcher/i);
    expect(screen.queryByTestId("ficha-enter-forge")).not.toBeInTheDocument();
  });

  it("onEnterForge is NOT called just by opening the build phase ficha (only on button click)", () => {
    const mockOnEnterForge = vi.fn();
    // Rendering with build active opens its ficha by default; that alone must not navigate.
    render(<CampaignPipeline slug="s" activePhase={4} onEnterForge={mockOnEnterForge} />);
    expect(screen.getByTestId("ficha-enter-forge")).toBeInTheDocument();
    expect(mockOnEnterForge).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-02-010.7 — locked future phases render graceful locked state without crash
// ---------------------------------------------------------------------------

describe("AC-02-010.7 — locked future phases: graceful locked state", () => {
  it("a locked phase renders its element without crashing (activePhase=0 → all locked except research)", () => {
    expect(() => render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />)).not.toThrow();
    // All future phases still render
    for (const key of PHASE_KEYS.slice(1)) {
      expect(screen.getByTestId(`campaign-phase-${key}`)).toBeInTheDocument();
    }
  });

  it("clicking a locked future phase shows a ficha with a locked marker", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    // product is locked (index 1 > activePhase 0)
    fireEvent.click(screen.getByTestId("campaign-phase-product"));
    const ficha = screen.getByTestId("campaign-phase-ficha");
    // The ficha must show some locked indicator (data-locked="true" or a testid)
    expect(within(ficha).getByTestId("ficha-locked-marker")).toBeInTheDocument();
  });

  it("a locked phase's ficha does NOT show the team members (no deliverable)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    fireEvent.click(screen.getByTestId("campaign-phase-product"));
    const ficha = screen.getByTestId("campaign-phase-ficha");
    // No team members in a locked ficha
    expect(within(ficha).queryAllByTestId("ficha-team-member")).toHaveLength(0);
  });

  it("all 6 phases render even when all but one are locked (activePhase=0)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={0} />);
    for (const key of PHASE_KEYS) {
      expect(screen.getByTestId(`campaign-phase-${key}`)).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-02-010.6 — read-only: no writes, no network, no fs, no Claude calls
// ---------------------------------------------------------------------------

describe("AC-02-010.6 — read-only invariant", () => {
  it("rendering does NOT call fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rendering does NOT call XMLHttpRequest", () => {
    const xhrSpy = vi.spyOn(globalThis.XMLHttpRequest.prototype, "open");
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    expect(xhrSpy).not.toHaveBeenCalled();
    xhrSpy.mockRestore();
  });

  it("onEnterForge is only called when the user explicitly clicks Entrar a La Fragua", () => {
    const mockOnEnterForge = vi.fn();
    render(<CampaignPipeline slug="s" activePhase={4} onEnterForge={mockOnEnterForge} />);
    // Rendering + opening ficha must not trigger navigation
    fireEvent.click(screen.getByTestId("campaign-phase-build"));
    expect(mockOnEnterForge).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Design tokens — no hardcoded color values
// ---------------------------------------------------------------------------

describe("design tokens — no hardcoded colors on root", () => {
  it("root element does not carry a hardcoded background-color", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const root = screen.getByTestId("campaign-pipeline");
    const bg = (root as HTMLElement).style.backgroundColor;
    expect(bg).not.toMatch(/^#|^rgb\(|^rgba\(/);
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("accessibility", () => {
  it("root container has an accessible aria-label in Spanish", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    const root = screen.getByTestId("campaign-pipeline");
    const label = root.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("each phase element is keyboard-accessible (button or has role=button)", () => {
    render(<CampaignPipeline {...DEFAULT_PROPS} />);
    for (const key of PHASE_KEYS) {
      const phase = screen.getByTestId(`campaign-phase-${key}`);
      const tag = phase.tagName.toLowerCase();
      const role = phase.getAttribute("role");
      expect(tag === "button" || role === "button").toBe(true);
    }
  });

  it("Entrar a La Fragua button has an accessible label", () => {
    // build is the active phase → its ficha (with the forge button) is open by default.
    render(<CampaignPipeline {...DEFAULT_PROPS} activePhase={4} />);
    const btn = screen.getByTestId("ficha-enter-forge");
    const label = btn.getAttribute("aria-label") ?? btn.textContent ?? "";
    expect(label.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// All phases robustness — each activePhase value 0-5 renders without crash
// ---------------------------------------------------------------------------

describe("robustness — every activePhase value 0-5 renders without crash", () => {
  const allPhases: CampaignPhase[] = [0, 1, 2, 3, 4, 5];

  it.each(allPhases)("activePhase=%i renders without throwing", (activePhase) => {
    expect(() =>
      render(<CampaignPipeline slug="x" activePhase={activePhase} onEnterForge={vi.fn()} />),
    ).not.toThrow();
    screen.getByTestId("campaign-pipeline");
    // Clean up between renders
    document.body.innerHTML = "";
  });
});
