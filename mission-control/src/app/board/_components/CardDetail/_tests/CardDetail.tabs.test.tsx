/**
 * WO-02-007 (reopened) — CardDetail 2-tab restructure tests
 *
 * Traceability:
 *   CMP-02-card-detail → REQ-02-009
 *   AC-02-009.1 — 2 tabs (Campaña · Documentos); default active = Campaña.
 *   AC-02-009.2 — clicking a tab activates it and shows its body.
 *   AC-02-009.3 — clicking a doc entry switches to Documentos tab.
 *   AC-02-009.4 — active tab persists across re-renders of the detail.
 *
 * The "Comandos" tab is gone: the next-step command moved into the campaign ficha
 * (CampaignPipeline). Its coverage now lives in CampaignPipeline.test.tsx.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * CampaignPipeline is mocked because its internal animation/phases are tested
 * in CampaignPipeline.test.tsx; here we only verify the tab wiring.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectDocsIndex } from "@/lib/docs/docs";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock CampaignPipeline so the tab-wiring tests are isolated from its internals.
vi.mock("@/components/modules/CampaignPipeline/CampaignPipeline", () => ({
  CampaignPipeline: ({
    onEnterForge,
    slug,
    activePhase,
  }: {
    onEnterForge: (slug: string) => void;
    slug: string;
    activePhase: number;
  }) => (
    <div data-testid="campaign-pipeline" data-slug={slug} data-active-phase={activePhase}>
      <button type="button" data-testid="mock-enter-forge" onClick={() => onEnterForge(slug)}>
        Entrar a La Fragua
      </button>
    </div>
  ),
}));

import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL: {
  slug: string;
  title: string;
  status: IdeaStatus;
  body: string;
  phase: Phase | undefined;
  advancePending: boolean | undefined;
  docsIndex: ProjectDocsIndex | null;
  onEnterForge?: (slug: string) => void;
} = {
  slug: "test-idea",
  title: "Test Idea",
  status: "discovered",
  body: "## Summary\n\nAn idea summary.\n\n- Point A\n- Point B",
  phase: undefined,
  advancePending: undefined,
  docsIndex: null,
};

const WITH_DOCS: typeof MINIMAL = {
  ...MINIMAL,
  slug: "pipeline-idea",
  status: "in-pipeline",
  phase: "design",
  docsIndex: {
    prd: "/projects/p/docs/product/prd.md",
    architecture: "/projects/p/docs/product/architecture.md",
    frds: [
      {
        slug: "frd-01-auth",
        hasFdd: false,
        hasBlueprint: true,
        hasMocks: false,
        hasWorkOrders: true,
      },
    ],
    hasAdr: false,
    hasAnalytics: false,
    hasDecisionLog: false,
    comms: { bugs: [] },
  } satisfies ProjectDocsIndex,
};

// ---------------------------------------------------------------------------
// AC-02-009.1 — 2 tabs rendered; default active = Campaña
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-009.1 — 2-tab structure, default Campaña", () => {
  it("frd-02: WHEN a card detail renders THEN both tab buttons are present", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("card-detail-tab-campana")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-tab-docs")).toBeInTheDocument();
  });

  it("frd-02: WHEN a card detail renders THEN there is NO Comandos tab", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.queryByTestId("card-detail-tab-comandos")).not.toBeInTheDocument();
  });

  it("frd-02: WHEN a card detail renders THEN exactly 2 tabs are present", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("frd-02: WHEN card detail renders THEN the Campaña tab button is active by default", () => {
    render(<CardDetail {...MINIMAL} />);
    const tab = screen.getByTestId("card-detail-tab-campana");
    expect(tab).toHaveAttribute("aria-selected", "true");
  });

  it("frd-02: WHEN card detail renders THEN the Documentos tab is NOT active by default", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "false");
  });

  it("frd-02: WHEN card detail renders THEN the CampaignPipeline is mounted (Campaña is default)", () => {
    render(<CardDetail {...MINIMAL} />);
    // The campaign-pipeline panel is mounted when Campaña is the default active tab.
    expect(screen.getByTestId("campaign-pipeline")).toBeInTheDocument();
  });

  it("frd-02: WHEN card detail renders THEN the Campaña tab body panel has testid card-detail-panel-campana", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("card-detail-panel-campana")).toBeInTheDocument();
  });

  it("frd-02: WHEN card detail renders THEN tab labels are in Spanish (Campaña / Documentos)", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveTextContent("Campaña");
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveTextContent("Documentos");
  });
});

// ---------------------------------------------------------------------------
// AC-02-009.2 — clicking a tab activates only that tab
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-009.2 — tab activation on click", () => {
  it("frd-02: WHEN Documentos tab is clicked THEN it becomes active", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
  });

  it("frd-02: WHEN Documentos tab is clicked THEN Campaña is no longer active", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("aria-selected", "false");
  });

  it("frd-02: WHEN Campaña tab is clicked after navigating away THEN it becomes active again", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    fireEvent.click(screen.getByTestId("card-detail-tab-campana"));
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("aria-selected", "true");
  });

  it("frd-02: WHEN Documentos tab is active THEN only one tab has aria-selected=true", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    const activeTabs = screen
      .getAllByRole("tab")
      .filter((t) => t.getAttribute("aria-selected") === "true");
    expect(activeTabs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-02-009.2 — Documentos tab body: existing summary + docs navigator
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-009.2 — Documentos tab body contains summary and docs navigator", () => {
  it("frd-02: WHEN Documentos tab is clicked THEN the docs panel is the active panel", () => {
    render(<CardDetail {...WITH_DOCS} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    // The docs tab is active
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
    // Summary exists inside the docs panel
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });

  it("frd-02: WHEN Documentos tab is active and card has docs THEN the navigator is visible", () => {
    render(<CardDetail {...WITH_DOCS} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
  });

  it("frd-02: WHEN Documentos tab is active and card has no docs THEN the rail lists only Resumen (no project doc items)", () => {
    // New contract: the docs navigator is ALWAYS present — it always lists the
    // "Resumen" item; project doc items appear only when docsIndex has entries.
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeInTheDocument();
    // No project documents → zero doc nav items.
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02-009.3 — clicking a doc entry switches to Documentos tab
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-009.3 — doc entry click switches to Documentos tab", () => {
  it("frd-02: WHEN a doc nav item is clicked THEN the Documentos tab becomes active", () => {
    render(<CardDetail {...WITH_DOCS} />);
    // getAllByTestId guarantees at least 1 match — the first element is always HTMLElement.
    const [firstItem] = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(firstItem).toBeDefined();
    fireEvent.click(firstItem as HTMLElement);
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
  });

  it("frd-02: WHEN a doc nav item is clicked from Campaña tab THEN Documentos tab becomes active", () => {
    render(<CardDetail {...WITH_DOCS} />);
    // Start on Campaña (default), click a doc entry
    const [firstItem] = screen.getAllByTestId("card-detail-docs-nav-item");
    fireEvent.click(firstItem as HTMLElement);
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("aria-selected", "false");
  });

  it("frd-02: WHEN the Resumen rail item is clicked THEN Documentos tab becomes active", () => {
    render(<CardDetail {...WITH_DOCS} />);
    // Start on Campaña (default); clicking the always-present Resumen item also
    // switches to the Documentos tab (handleSelectDoc forces the docs panel).
    fireEvent.click(screen.getByTestId("card-detail-docs-nav-resumen"));
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// AC-02-009.4 — active tab persists across re-renders
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-009.4 — active tab persists across re-renders", () => {
  it("frd-02: WHEN Documentos tab is selected and the card re-renders THEN it stays on Documentos", () => {
    const { rerender } = render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    // Trigger a re-render with same slug (simulating parent re-render)
    rerender(<CardDetail {...MINIMAL} body="Updated body content." />);
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
  });

  it("frd-02: WHEN Campaña tab is selected and the card re-renders THEN it stays on Campaña", () => {
    const { rerender } = render(<CardDetail {...MINIMAL} />);
    // Campaña is the default; switch to docs, back to Campaña, then re-render.
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    fireEvent.click(screen.getByTestId("card-detail-tab-campana"));
    rerender(<CardDetail {...MINIMAL} advancePending={true} />);
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("aria-selected", "true");
  });
});

// ---------------------------------------------------------------------------
// CampaignPipeline integration — slug and activePhase wiring
// ---------------------------------------------------------------------------

describe("frd-02: CampaignPipeline wiring in Campaña tab", () => {
  it("frd-02: WHEN rendered THEN CampaignPipeline receives the correct slug", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("campaign-pipeline")).toHaveAttribute("data-slug", "test-idea");
  });

  it("frd-02: WHEN card is discovered THEN CampaignPipeline activePhase is 0 (research)", () => {
    render(<CardDetail {...MINIMAL} status="discovered" phase={undefined} />);
    expect(screen.getByTestId("campaign-pipeline")).toHaveAttribute("data-active-phase", "0");
  });

  it("frd-02: WHEN card is in-pipeline with phase=design THEN CampaignPipeline activePhase is 2", () => {
    render(<CardDetail {...MINIMAL} status="in-pipeline" phase="design" />);
    expect(screen.getByTestId("campaign-pipeline")).toHaveAttribute("data-active-phase", "2");
  });

  it("frd-02: WHEN card is shipped THEN CampaignPipeline activePhase is 5 (release)", () => {
    render(<CardDetail {...MINIMAL} status="shipped" phase={undefined} />);
    expect(screen.getByTestId("campaign-pipeline")).toHaveAttribute("data-active-phase", "5");
  });
});
