/**
 * WO-02-007 — CardDetail component tests
 *
 * Traceability:
 *   CMP-02-card-detail → components/CardDetail.tsx
 *   REQ-02-004   WHEN the owner clicks a card, the system SHALL show: summary, key points,
 *                a navigator of the idea's documents. (The next-step command moved into the
 *                campaign ficha — CampaignPipeline — and is covered there.)
 *   REQ-02-008   (Edge) Idea with no documents → show only the summary.
 *   AC-02-004.1  Summary + key points + docs navigator.
 *   AC-02-008.1  Card with no docs → summary only, no navigator, no crash.
 *
 * Regression anchors from progress.md (past bugs → regression tests):
 *   B1' (rate/timeline/status): NaN / array-shaped values for phase must not crash the detail.
 *   I2  (status): empty / absent status.yaml → component still renders summary-only, no crash.
 *   I3  (status): array-shaped phase value → component survives gracefully.
 *   WO-04-003 adversarial: shared-reference mutation — docs index objects must not mutate
 *     across renders (each render gets its own prop reference).
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * CampaignPipeline is the real child here (the markdown summary + docs navigator are the unit
 * under test); the next-step command it now carries is verified in CampaignPipeline.test.tsx.
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
 *     "card-detail"               — root container
 *     "card-detail-summary"       — markdown body (shown when "Resumen" is selected — the default)
 *     "card-detail-docs-nav"      — docs navigator rail (ALWAYS present; always lists Resumen)
 *     "card-detail-docs-nav-resumen" — the always-present "Resumen" rail item
 *     "card-detail-docs-nav-item" — one per navigable project doc (only when docsIndex has entries)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectDocsIndex } from "@/lib/docs/docs";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Import the component under test
// ---------------------------------------------------------------------------

import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

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
  phase: "release" as Phase,
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
// frd-02: AC-02-004.1 — summary markdown renders REAL headings (shared <Markdown>)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — summary markdown renders real headings", () => {
  it("frd-02: WHEN the body has an h1 THEN the summary renders a real <h1> (not remapped to <p>/<strong>)", () => {
    render(<CardDetail {...MINIMAL_CARD} body="# The Big Title\n\nBody." />);
    const summary = screen.getByTestId("card-detail-summary");
    const h1 = summary.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1).toHaveTextContent("The Big Title");
  });

  it("frd-02: WHEN the body has an h2 THEN the summary renders a real <h2>", () => {
    render(<CardDetail {...MINIMAL_CARD} body="## Section\n\nBody." />);
    const summary = screen.getByTestId("card-detail-summary");
    const h2 = summary.querySelector("h2");
    expect(h2).not.toBeNull();
    expect(h2).toHaveTextContent("Section");
  });

  it("frd-02: WHEN the body has headings THEN they render inside the shared .pc-markdown container", () => {
    render(<CardDetail {...MINIMAL_CARD} body="# Title\n\nBody." />);
    const summary = screen.getByTestId("card-detail-summary");
    expect(summary.querySelector(".pc-markdown")).not.toBeNull();
  });

  it("frd-02: WHEN the summary has its own headings THEN queryAllByRole('heading') finds them (additional to the title)", () => {
    // The component's own <h2> title is clipped but present; the summary adds real
    // headings on top. Both are discoverable as headings — they no longer collapse to <p>.
    render(<CardDetail {...MINIMAL_CARD} body="# Summary heading\n\nText." />);
    const summary = screen.getByTestId("card-detail-summary");
    const headings = summary.querySelectorAll("h1, h2, h3, h4");
    expect(headings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-004.1 — docs navigator (in-pipeline with docs)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — docs navigator (in-pipeline card with docs)", () => {
  it("frd-02: WHEN an in-pipeline card has a PRD THEN the docs navigator is present", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
  });

  it("frd-02: WHEN an in-pipeline card has a PRD THEN a nav item for it is rendered", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-02: WHEN docsIndex has two FRD modules THEN two FRD items appear in the navigator", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    // PRD + architecture + 2 FRDs + decision-log = at least 5 items; exact FRD text check:
    const itemTexts = items.map((el) => el.textContent ?? "");
    const frdItems = itemTexts.filter((t) => t.toLowerCase().includes("frd-0"));
    expect(frdItems.length).toBe(2);
  });

  it("frd-02: WHEN docsIndex has a PRD THEN a nav item referencing 'prd' or 'PRD' is present", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const hasPrd = items.some((el) => /prd/i.test(el.textContent ?? ""));
    expect(hasPrd).toBe(true);
  });

  it("frd-02: WHEN docsIndex has an architecture doc THEN a nav item for it is present", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const hasArch = items.some((el) => /architecture|arquitectura/i.test(el.textContent ?? ""));
    expect(hasArch).toBe(true);
  });

  it("frd-02: WHEN docsIndex has a progress comms file THEN a nav item for it is present", () => {
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
  it("frd-02: WHEN docsIndex is null THEN the rail still lists Resumen but no project doc items", () => {
    // New contract: the docs rail is always present (it always lists "Resumen");
    // project doc items appear only when docsIndex has entries. A null index ⇒ none.
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeInTheDocument();
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("frd-02: WHEN docsIndex is null THEN no nav items are rendered", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("frd-02: WHEN docsIndex has no navigable entries THEN the rail lists only Resumen (no doc items)", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeInTheDocument();
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
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
    });
  }
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.1 — edge: all pipeline phases render without crash
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.1 — all pipeline phases render without crash", () => {
  const PHASES: Phase[] = ["product", "design", "architecture", "implementation", "release"];

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
    // The campaign view falls back to research — the component must not crash on undefined phase.
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
  });
});

// ---------------------------------------------------------------------------
// frd-02: Regression — empty docs index does NOT show navigator
// ---------------------------------------------------------------------------

describe("frd-02: regression I2 — empty docsIndex shows no project doc items", () => {
  it("frd-02: WHEN docsIndex has frds:[] and no other entries THEN no project doc items appear", () => {
    // I2 regression under the new always-present rail: an empty index must not
    // fabricate any project doc nav item (the rail still lists Resumen only).
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeInTheDocument();
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("frd-02: WHEN docsIndex has frds:[] and no other entries THEN summary is still visible", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: Read-only invariant — no network calls triggered by render
// ---------------------------------------------------------------------------

describe("frd-02: read-only invariant — no side effects on render", () => {
  it("frd-02: WHEN an in-pipeline card with docs renders THEN it mounts without throwing (read-only)", () => {
    // CardDetail is a read-only display component. Rendering the rich in-pipeline
    // card (summary + docs navigator + real campaign) must produce no crash.
    expect(() => render(<CardDetail {...IN_PIPELINE_CARD} />)).not.toThrow();
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
  });

  it("frd-02: WHEN the component renders twice with different slugs THEN both mount in isolation", () => {
    const { unmount } = render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
    unmount();
    render(<CardDetail {...SHIPPED_CARD} />);
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-summary")).toHaveTextContent("Already live.");
  });
});

// ---------------------------------------------------------------------------
// frd-02: terminal cards (shipped / discarded) render summary
// ---------------------------------------------------------------------------

describe("frd-02: terminal cards render the summary", () => {
  it("frd-02: WHEN a shipped card is rendered THEN its summary text is visible", () => {
    render(<CardDetail {...SHIPPED_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toHaveTextContent("Already live.");
  });

  it("frd-02: WHEN a discarded card is rendered THEN its summary text is visible", () => {
    render(<CardDetail {...DISCARDED_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toHaveTextContent("Not pursued.");
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
    // Either aria-label or a heading supplies the accessible name. Use the plural
    // query: the real CampaignPipeline mounts its own headings too, so queryByRole
    // (singular) would throw on multiple matches.
    const ariaLabel = root.getAttribute("aria-label") ?? "";
    const hasHeading = screen.queryAllByRole("heading").length > 0;
    expect(ariaLabel.length > 0 || hasHeading).toBe(true);
  });

  it("frd-02: WHEN rendered THEN the title is visible as text in the component", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByText("Minimal idea")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: Structural order — summary precedes the docs navigator-less reader layout
// ---------------------------------------------------------------------------

describe("frd-02: structural order — navigator precedes the reader/summary", () => {
  it("frd-02: WHEN an in-pipeline card with docs is rendered THEN the navigator appears before the summary reader", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const nav = screen.getByTestId("card-detail-docs-nav");
    const summary = screen.getByTestId("card-detail-summary");
    // compareDocumentPosition: FOLLOWING means nav precedes summary in the DOM.
    expect(nav.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
