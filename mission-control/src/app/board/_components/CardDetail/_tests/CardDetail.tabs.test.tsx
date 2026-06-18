/**
 * WO-02-007 (reopened) — CardDetail 3-tab restructure tests
 *
 * Traceability:
 *   CMP-02-card-detail → REQ-02-009
 *   AC-02-009.1 — 3 tabs (Campaña · Documentos · Comandos); default active = Campaña.
 *   AC-02-009.2 — clicking a tab activates it and shows its body.
 *   AC-02-009.3 — clicking a doc entry switches to Documentos tab.
 *   AC-02-009.4 — active tab persists across re-renders of the detail.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * CampaignPipeline is mocked because its internal animation/phases are tested
 * in CampaignPipeline.test.tsx; here we only verify the tab wiring.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDocsIndex } from "@/lib/docs/docs";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import type { NextStep } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/next-step/next-step", () => ({
  nextStep: vi.fn(),
}));

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
import { nextStep } from "@/lib/next-step/next-step";

const mockNextStep = vi.mocked(nextStep);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STEP: NextStep = {
  command: "/pandacorp:spec <idea>",
  label: "Crear spec del proyecto",
};

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

beforeEach(() => {
  mockNextStep.mockReturnValue(STEP);
});
afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// AC-02-009.1 — 3 tabs rendered; default active = Campaña
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-009.1 — 3-tab structure, default Campaña", () => {
  it("frd-02: WHEN a card detail renders THEN all 3 tab buttons are present", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("card-detail-tab-campana")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-tab-docs")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-tab-comandos")).toBeInTheDocument();
  });

  it("frd-02: WHEN card detail renders THEN the Campaña tab button is active by default", () => {
    render(<CardDetail {...MINIMAL} />);
    const tab = screen.getByTestId("card-detail-tab-campana");
    expect(tab).toHaveAttribute("aria-selected", "true");
  });

  it("frd-02: WHEN card detail renders THEN Documentos and Comandos tabs are NOT active by default", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute(
      "aria-selected",
      "false",
    );
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

  it("frd-02: WHEN card detail renders THEN tab labels are in Spanish (Campaña / Documentos / Comandos)", () => {
    render(<CardDetail {...MINIMAL} />);
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveTextContent("Campaña");
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveTextContent("Documentos");
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveTextContent("Comandos");
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

  it("frd-02: WHEN Documentos tab is clicked THEN Campaña and Comandos are no longer active", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("frd-02: WHEN Comandos tab is clicked THEN it becomes active", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute("aria-selected", "true");
  });

  it("frd-02: WHEN Comandos tab is clicked THEN Campaña and Documentos are no longer active", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "false");
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

  it("frd-02: WHEN Documentos tab is active and card has no docs THEN no navigator is shown", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    expect(screen.queryByTestId("card-detail-docs-nav")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-02-009.2 — Comandos tab body: existing next-step command
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-009.2 — Comandos tab body contains next-step command", () => {
  it("frd-02: WHEN Comandos tab is clicked THEN the comandos panel is the active panel", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("card-detail-next-step")).toBeInTheDocument();
  });

  it("frd-02: WHEN Comandos tab is active THEN the next-step command text is in the Comandos panel", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    const panel = screen.getByTestId("card-detail-panel-comandos");
    expect(panel).toHaveTextContent("/pandacorp:spec <idea>");
  });

  it("frd-02: WHEN Comandos tab is active THEN the copy button is present in the Comandos panel", () => {
    render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
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

  it("frd-02: WHEN a doc nav item is clicked from Comandos tab THEN Documentos tab becomes active", () => {
    render(<CardDetail {...WITH_DOCS} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    const [firstItem] = screen.getAllByTestId("card-detail-docs-nav-item");
    fireEvent.click(firstItem as HTMLElement);
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

  it("frd-02: WHEN Comandos tab is selected and the card re-renders THEN it stays on Comandos", () => {
    const { rerender } = render(<CardDetail {...MINIMAL} />);
    fireEvent.click(screen.getByTestId("card-detail-tab-comandos"));
    rerender(<CardDetail {...MINIMAL} advancePending={true} />);
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute("aria-selected", "true");
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
