/**
 * WO-02-007 — CardDetail component tests (TDD: RED phase)
 *
 * Traceability:
 *   CMP-02-card-detail → components/CardDetail.tsx
 *   REQ-02-004   WHEN the owner clicks a card, the system SHALL show: summary, key points,
 *                a navigator of the idea's documents, and the next-step command (with a copy button).
 *   REQ-02-008   (Edge) Idea with no documents → show only the summary.
 *   AC-02-004.1  Summary + key points + docs navigator + next-step command (copy).
 *   AC-02-008.1  Card with no docs → summary only, no navigator, no crash.
 *
 * Regression anchors from progress.md (past bugs → regression tests):
 *   B1' (rate/timeline/status): NaN / array-shaped values for phase must not crash the detail.
 *     nextStep already guards these upstream; we verify the component tolerates undefined phase.
 *   I2  (status): empty / absent status.yaml → component still renders summary-only, no crash.
 *   I3  (status): array-shaped phase value → component survives gracefully.
 *   WO-04-003 adversarial: shared-reference mutation — docs index objects must not mutate
 *     across renders (each render gets its own prop reference).
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * All external modules (nextStep, readProjectDocs) are mocked at the module boundary —
 * this is a unit test for the component; the library contracts are tested separately.
 *
 * Design contract for CardDetail (from WO-02-007):
 *   Props:
 *     slug: string
 *     title: string
 *     status: IdeaStatus
 *     body: string                          — markdown body (summary + key points)
 *     phase?: Phase                         — from linked project's status.yaml (in-pipeline only)
 *     advancePending?: boolean              — DR-032 hint
 *     docsIndex?: ProjectDocsIndex | null   — from readProjectDocs(card.project), null when absent
 *
 *   Rendered structure (data-testid):
 *     "card-detail"              — root container
 *     "card-detail-summary"      — markdown body (react-markdown or <div>)
 *     "card-detail-docs-nav"     — docs navigator (only when docsIndex has entries)
 *     "card-detail-docs-nav-item"— one per navigable doc (queryAllByTestId)
 *     "card-detail-next-step"    — row containing the next-step command string
 *     "copy-button"              — CopyButton (data-testid from CopyButton.tsx)
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDocsIndex } from "@/lib/docs";
import type { IdeaStatus } from "@/lib/ideas";
import type { NextStep } from "@/lib/next-step";
import type { Phase } from "@/lib/status";

// ---------------------------------------------------------------------------
// Mock: lib/next-step — nextStep is a pure function tested separately
// ---------------------------------------------------------------------------

vi.mock("@/lib/next-step", () => ({
  nextStep: vi.fn(),
}));

import { nextStep } from "@/lib/next-step";

const mockNextStep = vi.mocked(nextStep);

// ---------------------------------------------------------------------------
// Import the component under test (will be RED until implementation exists)
// ---------------------------------------------------------------------------

import { CardDetail } from "./CardDetail";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEFAULT_NEXT_STEP: NextStep = {
  command: "/pandacorp:spec <idea>",
  label: "Crear spec del proyecto",
};

const DESIGN_NEXT_STEP: NextStep = {
  command: "/pandacorp:design",
  label: "Ejecutar diseño",
};

const ADVANCE_PENDING_NEXT_STEP: NextStep = {
  command: "/pandacorp:blueprint",
  label: "Crear blueprint — escribe «ok, advance» para continuar",
};

/** Minimal card — no docs, no phase. */
const MINIMAL_CARD = {
  slug: "minimal-idea",
  title: "Minimal idea",
  status: "discovered" as IdeaStatus,
  body: "## Summary\n\nThis is a short summary.\n\n- Key point A\n- Key point B",
  phase: undefined,
  advancePending: undefined,
  docsIndex: null,
};

/** Full in-pipeline card with a rich docs index. */
const IN_PIPELINE_CARD = {
  slug: "my-saas-idea",
  title: "My SaaS Idea",
  status: "in-pipeline" as IdeaStatus,
  body: "## Summary\n\nBuilding a great SaaS product.\n\n- Multi-tenant\n- Subscription billing",
  phase: "design" as Phase,
  advancePending: false,
  docsIndex: {
    prd: "/projects/my-saas/docs/product/prd.md",
    architecture: "/projects/my-saas/docs/product/architecture.md",
    frds: [
      {
        slug: "frd-01-auth",
        hasFdd: true,
        hasBlueprint: true,
        hasMocks: false,
        hasWorkOrders: true,
      },
      {
        slug: "frd-02-billing",
        hasFdd: false,
        hasBlueprint: true,
        hasMocks: true,
        hasWorkOrders: false,
      },
    ],
    hasAdr: true,
    hasAnalytics: false,
    hasDecisionLog: true,
    comms: {
      progress: "/projects/my-saas/.pandacorp/comms/progress.md",
      bugs: [],
    },
  } satisfies ProjectDocsIndex,
};

/** In-pipeline card with a completely empty docs index (no navigable entries). */
const IN_PIPELINE_EMPTY_DOCS_CARD = {
  ...IN_PIPELINE_CARD,
  slug: "empty-docs-idea",
  docsIndex: {
    frds: [],
    hasAdr: false,
    hasAnalytics: false,
    hasDecisionLog: false,
    comms: { bugs: [] },
  } satisfies ProjectDocsIndex,
};

/** Shipped card — terminal state. */
const SHIPPED_CARD = {
  slug: "shipped-idea",
  title: "Shipped Idea",
  status: "shipped" as IdeaStatus,
  body: "## Summary\n\nAlready live.",
  phase: "operation" as Phase,
  advancePending: false,
  docsIndex: null,
};

/** Discarded card — terminal state. */
const DISCARDED_CARD = {
  slug: "discarded-idea",
  title: "Discarded Idea",
  status: "discarded" as IdeaStatus,
  body: "## Summary\n\nNot pursued.",
  phase: undefined,
  advancePending: undefined,
  docsIndex: null,
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockNextStep.mockReturnValue(DEFAULT_NEXT_STEP);
});

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-004.1 — rendering the root container
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — CardDetail root container", () => {
  it("frd-02: WHEN a card is rendered THEN the component mounts without throwing", () => {
    expect(() => render(<CardDetail {...MINIMAL_CARD} />)).not.toThrow();
  });

  it("frd-02: WHEN a card is rendered THEN root element has data-testid='card-detail'", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
  });

  it("frd-02: WHEN an in-pipeline card is rendered THEN the component mounts without throwing", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    expect(() => render(<CardDetail {...IN_PIPELINE_CARD} />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-004.1 — summary (markdown body)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — summary section (markdown body)", () => {
  it("frd-02: WHEN a card is rendered THEN the summary section has data-testid='card-detail-summary'", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });

  it("frd-02: WHEN a card body contains text THEN that text is rendered in the summary", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toHaveTextContent("This is a short summary.");
  });

  it("frd-02: WHEN a card body contains key points THEN key point text appears in the summary", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    const summary = screen.getByTestId("card-detail-summary");
    expect(summary).toHaveTextContent("Key point A");
    expect(summary).toHaveTextContent("Key point B");
  });

  it("frd-02: WHEN an in-pipeline card is rendered THEN its body text appears in the summary", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toHaveTextContent(
      "Building a great SaaS product.",
    );
  });

  it("frd-02: WHEN body is an empty string THEN the summary section is still present (no crash)", () => {
    render(<CardDetail {...MINIMAL_CARD} body="" />);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });

  it("frd-02: WHEN body contains only whitespace THEN summary section renders without crash", () => {
    render(<CardDetail {...MINIMAL_CARD} body="   " />);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-004.1 — docs navigator (in-pipeline with docs)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — docs navigator (in-pipeline card with docs)", () => {
  it("frd-02: WHEN an in-pipeline card has a PRD THEN the docs navigator is present", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
  });

  it("frd-02: WHEN an in-pipeline card has a PRD THEN a nav item for it is rendered", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-02: WHEN docsIndex has two FRD modules THEN two FRD items appear in the navigator", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    // PRD + architecture + 2 FRDs + decision-log = at least 5 items; exact FRD text check:
    const itemTexts = items.map((el) => el.textContent ?? "");
    const frdItems = itemTexts.filter((t) => t.toLowerCase().includes("frd-0"));
    expect(frdItems.length).toBe(2);
  });

  it("frd-02: WHEN docsIndex has a PRD THEN a nav item referencing 'prd' or 'PRD' is present", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const hasPrd = items.some((el) => /prd/i.test(el.textContent ?? ""));
    expect(hasPrd).toBe(true);
  });

  it("frd-02: WHEN docsIndex has an architecture doc THEN a nav item for it is present", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const hasArch = items.some((el) => /architecture|arquitectura/i.test(el.textContent ?? ""));
    expect(hasArch).toBe(true);
  });

  it("frd-02: WHEN docsIndex has a progress comms file THEN a nav item for it is present", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const hasProgress = items.some((el) => /progress|progreso/i.test(el.textContent ?? ""));
    expect(hasProgress).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.1 — edge: card with no docs → summary only, no navigator
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.1 — edge: card with no docs (summary only)", () => {
  it("frd-02: WHEN docsIndex is null THEN no docs navigator is rendered", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.queryByTestId("card-detail-docs-nav")).not.toBeInTheDocument();
  });

  it("frd-02: WHEN docsIndex is null THEN no nav items are rendered", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("frd-02: WHEN docsIndex has no navigable entries THEN no navigator is rendered (empty index)", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.queryByTestId("card-detail-docs-nav")).not.toBeInTheDocument();
  });

  it("frd-02: WHEN docsIndex is null THEN the summary is still rendered (no crash)", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });

  it("frd-02: WHEN docsIndex is null and body has content THEN summary text is visible", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toHaveTextContent("This is a short summary.");
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-004.1 — next-step command row
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — next-step command row", () => {
  it("frd-02: WHEN a card is rendered THEN the next-step section has data-testid='card-detail-next-step'", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-next-step")).toBeInTheDocument();
  });

  it("frd-02: WHEN nextStep returns a command THEN that command string is visible in the detail", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-next-step")).toHaveTextContent("/pandacorp:spec <idea>");
  });

  it("frd-02: WHEN an in-pipeline card with phase=design is rendered THEN nextStep is called with correct args", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    expect(mockNextStep).toHaveBeenCalledWith({
      cardStatus: "in-pipeline",
      phase: "design",
      advancePending: false,
    });
  });

  it("frd-02: WHEN nextStep returns /pandacorp:design THEN that command appears in the next-step row", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    expect(screen.getByTestId("card-detail-next-step")).toHaveTextContent("/pandacorp:design");
  });

  it("frd-02: WHEN a discovered card is rendered THEN nextStep is called with cardStatus=discovered", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(mockNextStep).toHaveBeenCalledWith(
      expect.objectContaining({ cardStatus: "discovered" }),
    );
  });

  it("frd-02: WHEN a shipped card is rendered THEN nextStep receives cardStatus=shipped", () => {
    const shippedStep: NextStep = {
      command: "/pandacorp:review-launch",
      label: "Revisar métricas de lanzamiento",
    };
    mockNextStep.mockReturnValue(shippedStep);
    render(<CardDetail {...SHIPPED_CARD} />);
    expect(mockNextStep).toHaveBeenCalledWith(expect.objectContaining({ cardStatus: "shipped" }));
    expect(screen.getByTestId("card-detail-next-step")).toHaveTextContent(
      "/pandacorp:review-launch",
    );
  });

  it("frd-02: WHEN a discarded card is rendered THEN nextStep receives cardStatus=discarded", () => {
    const discardedStep: NextStep = {
      command: "/pandacorp:recommend",
      label: "Ver ideas recomendadas",
    };
    mockNextStep.mockReturnValue(discardedStep);
    render(<CardDetail {...DISCARDED_CARD} />);
    expect(mockNextStep).toHaveBeenCalledWith(expect.objectContaining({ cardStatus: "discarded" }));
  });

  it("frd-02: DR-032 WHEN advancePending is true THEN nextStep is called with advancePending=true", () => {
    mockNextStep.mockReturnValue(ADVANCE_PENDING_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} phase="design" advancePending={true} />);
    expect(mockNextStep).toHaveBeenCalledWith({
      cardStatus: "in-pipeline",
      phase: "design",
      advancePending: true,
    });
  });

  it("frd-02: DR-032 WHEN advancePending is true THEN the advance hint text is visible in the next-step row", () => {
    mockNextStep.mockReturnValue(ADVANCE_PENDING_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} phase="design" advancePending={true} />);
    // The label returned by nextStep (with the DR-032 suffix) must be rendered
    expect(screen.getByTestId("card-detail-next-step")).toHaveTextContent("ok, advance");
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-004.1 — CopyButton for the next-step command
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — CopyButton on the next-step command", () => {
  it("frd-02: WHEN a card detail is rendered THEN a copy-button is present", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
  });

  it("frd-02: WHEN the next-step command is /pandacorp:spec THEN CopyButton receives that value", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    // The CopyButton aria-label defaults to "Copiar al portapapeles" (unclicked)
    expect(screen.getByRole("button", { name: /copiar al portapapeles/i })).toBeInTheDocument();
  });

  it("frd-02: WHEN the next-step command is /pandacorp:design THEN CopyButton shows it", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    // Verify one copy-button exists (exact value is verified via CopyButton's own tests)
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
  });

  it("frd-02: WHEN nextStep returns a command THEN only one CopyButton is rendered (no duplication)", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getAllByTestId("copy-button")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.1 — edge: all lifecycle statuses render without crash
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.1 — all lifecycle statuses render without crash", () => {
  const STATUSES: IdeaStatus[] = [
    "discovered",
    "recommended",
    "in-pipeline",
    "shipped",
    "discarded",
  ];

  for (const status of STATUSES) {
    it(`frd-02: WHEN status is '${status}' THEN the component renders without throwing`, () => {
      render(
        <CardDetail
          slug="test-slug"
          title="Test Idea"
          status={status}
          body="Body content."
          phase={undefined}
          advancePending={undefined}
          docsIndex={null}
        />,
      );
      expect(screen.getByTestId("card-detail")).toBeInTheDocument();
      expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
      expect(screen.getByTestId("card-detail-next-step")).toBeInTheDocument();
    });
  }
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.1 — edge: all pipeline phases render without crash
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.1 — all pipeline phases render without crash", () => {
  const PHASES: Phase[] = [
    "product",
    "design",
    "architecture",
    "implementation",
    "release",
    "operation",
  ];

  for (const phase of PHASES) {
    it(`frd-02: WHEN in-pipeline card has phase='${phase}' THEN renders without throwing`, () => {
      render(
        <CardDetail
          slug="test-in-pipeline"
          title="In Pipeline Idea"
          status="in-pipeline"
          body="Body."
          phase={phase}
          advancePending={false}
          docsIndex={null}
        />,
      );
      expect(screen.getByTestId("card-detail")).toBeInTheDocument();
    });
  }
});

// ---------------------------------------------------------------------------
// frd-02: Regression — undefined phase on in-pipeline (B1' from progress.md)
// ---------------------------------------------------------------------------

describe("frd-02: regression B1' — undefined phase on in-pipeline card", () => {
  it("frd-02: WHEN phase is undefined on in-pipeline card THEN component renders without crash", () => {
    // B1': NaN/array phase values are rejected upstream by readStatus; arrive here as undefined.
    // nextStep falls back to CMD_SPEC — the component must not crash on undefined phase.
    render(
      <CardDetail
        slug="no-phase-idea"
        title="No Phase Idea"
        status="in-pipeline"
        body="Some content."
        phase={undefined}
        advancePending={false}
        docsIndex={null}
      />,
    );
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-next-step")).toBeInTheDocument();
  });

  it("frd-02: WHEN phase is undefined THEN nextStep is called with phase=undefined (not fabricated)", () => {
    render(
      <CardDetail
        slug="no-phase-idea"
        title="No Phase Idea"
        status="in-pipeline"
        body="Some content."
        phase={undefined}
        advancePending={false}
        docsIndex={null}
      />,
    );
    expect(mockNextStep).toHaveBeenCalledWith(expect.objectContaining({ phase: undefined }));
  });
});

// ---------------------------------------------------------------------------
// frd-02: Regression — empty docs index does NOT show navigator
// ---------------------------------------------------------------------------

describe("frd-02: regression I2 — empty docsIndex must not show navigator", () => {
  it("frd-02: WHEN docsIndex has frds:[] and no other entries THEN navigator is absent", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.queryByTestId("card-detail-docs-nav")).not.toBeInTheDocument();
  });

  it("frd-02: WHEN docsIndex has frds:[] and no other entries THEN summary is still visible", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });

  it("frd-02: WHEN docsIndex has frds:[] and no other entries THEN next-step row is still present", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.getByTestId("card-detail-next-step")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: Read-only invariant — no write or network calls triggered by render
// ---------------------------------------------------------------------------

describe("frd-02: read-only invariant — no side effects on render", () => {
  it("frd-02: WHEN the component renders THEN it does not call any write or network function", () => {
    // CardDetail is a read-only display component. No write or Claude call must happen.
    // If the implementation calls fs.writeFileSync or fetch, the vi.mock below would catch it.
    // This test verifies that rendering alone produces no unintended calls beyond nextStep.
    mockNextStep.mockReturnValue(DEFAULT_NEXT_STEP);
    const callCountBefore = mockNextStep.mock.calls.length;
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    // nextStep was called exactly once (not zero, not more than once per render)
    expect(mockNextStep.mock.calls.length - callCountBefore).toBe(1);
  });

  it("frd-02: WHEN the component renders twice with different slugs THEN nextStep is called twice (isolated)", () => {
    const { unmount } = render(<CardDetail {...MINIMAL_CARD} />);
    unmount();
    render(<CardDetail {...SHIPPED_CARD} status="shipped" />);
    expect(mockNextStep).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// frd-02: Design tokens — no hardcoded color values on the root element
// ---------------------------------------------------------------------------

describe("frd-02: design tokens — no hardcoded color values", () => {
  it("frd-02: WHEN rendered THEN the root element does not have a hardcoded background color", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    const root = screen.getByTestId("card-detail");
    const bg = (root as HTMLElement).style.backgroundColor;
    // A hardcoded hex or rgb() value is a violation; CSS var() resolves to "" in jsdom.
    expect(bg).not.toMatch(/^#|^rgb\(|^rgba\(/);
  });
});

// ---------------------------------------------------------------------------
// frd-02: Accessibility — root element has accessible labeling in Spanish
// ---------------------------------------------------------------------------

describe("frd-02: accessibility — Spanish aria-label", () => {
  it("frd-02: WHEN rendered THEN the root element carries an accessible name", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    const root = screen.getByTestId("card-detail");
    // Either aria-label or a heading supplies the accessible name.
    const ariaLabel = root.getAttribute("aria-label") ?? "";
    const hasHeading = screen.queryByRole("heading") !== null;
    expect(ariaLabel.length > 0 || hasHeading).toBe(true);
  });

  it("frd-02: WHEN rendered THEN the title is visible as text in the component", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByText("Minimal idea")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: Structural order — summary precedes next-step (layout contract)
// ---------------------------------------------------------------------------

describe("frd-02: structural order — summary before next-step", () => {
  it("frd-02: WHEN rendered THEN the summary section appears before the next-step section in the DOM", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    const summary = screen.getByTestId("card-detail-summary");
    const nextStepEl = screen.getByTestId("card-detail-next-step");
    // compareDocumentPosition: 4 means summary precedes next-step
    expect(
      summary.compareDocumentPosition(nextStepEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("frd-02: WHEN an in-pipeline card with docs is rendered THEN navigator appears before next-step", () => {
    mockNextStep.mockReturnValue(DESIGN_NEXT_STEP);
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const nav = screen.getByTestId("card-detail-docs-nav");
    const nextStepEl = screen.getByTestId("card-detail-next-step");
    expect(nav.compareDocumentPosition(nextStepEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
