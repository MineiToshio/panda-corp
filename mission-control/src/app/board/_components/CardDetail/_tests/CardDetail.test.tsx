/**
 * WO-02-007 — CardDetail component tests
 *
 * Traceability:
 *   CMP-02-card-detail → components/CardDetail.tsx
 *   REQ-02-004   WHEN the owner clicks a card, the system SHALL show: summary, key points,
 *                a navigator of the idea's documents WITH their content (DR-046). (The
 *                next-step command lives in the campaign ficha — CampaignPipeline.)
 *   REQ-02-008   (Edge) Idea with no documents → show only the summary (rail lists Resumen).
 *   AC-02-004.1  Summary + key points + docs navigator with content.
 *   AC-02-008.1  Card with no docs → Resumen only, no project doc items, no crash.
 *
 * Docs model (DR-046): the rail is built from `docNodes` (the scoped DocNode list —
 * PRD + research + per-FRD docs). Selecting a doc lazily loads its body via the
 * injected `readDocAction` and renders it through the shared <Markdown> (.pc-markdown).
 *
 * Regression anchors from progress.md (past bugs → regression tests):
 *   B1' (rate/timeline/status): NaN / array-shaped values for phase must not crash the detail.
 *   I2  (status): empty / absent status.yaml → component still renders summary-only, no crash.
 *   I3  (status): array-shaped phase value → component survives gracefully.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * CampaignPipeline is the real child here (the markdown summary + docs navigator are the unit
 * under test); the next-step command it now carries is verified in CampaignPipeline.test.tsx.
 *
 * Rendered structure (data-testid):
 *   "card-detail"                  — root container
 *   "card-detail-summary"          — markdown body (shown when "Resumen" is selected — the default)
 *   "card-detail-doc-reader"       — reader for a selected project doc (lazy body)
 *   "card-detail-docs-nav"         — docs navigator rail (ALWAYS present; always lists Resumen)
 *   "card-detail-docs-nav-resumen" — the always-present "Resumen" rail item
 *   "card-detail-docs-nav-section" — a rail section header (Producto / an FRD slug)
 *   "card-detail-docs-nav-item"    — one per navigable project doc (only when docNodes has entries)
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocNode } from "@/lib/docs/tree";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Import the component under test
// ---------------------------------------------------------------------------

import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Scoped DocNode list (PRD + research + two FRDs) as page.tsx would produce. */
const DOC_NODES: DocNode[] = [
  { id: "docs/product/prd", label: "prd.md", group: "Product", relPath: "docs/product/prd.md" },
  {
    id: "docs/product/research",
    label: "research.md",
    group: "Product",
    relPath: "docs/product/research.md",
  },
  {
    id: "docs/frds/frd-01-auth/frd",
    label: "frd.md",
    group: "Feature: frd-01-auth",
    relPath: "docs/frds/frd-01-auth/frd.md",
  },
  {
    id: "docs/frds/frd-01-auth/blueprint",
    label: "blueprint.md",
    group: "Feature: frd-01-auth",
    relPath: "docs/frds/frd-01-auth/blueprint.md",
  },
  {
    id: "docs/frds/frd-02-billing/frd",
    label: "frd.md",
    group: "Feature: frd-02-billing",
    relPath: "docs/frds/frd-02-billing/frd.md",
  },
];

/** A read action that echoes which doc was requested (markdown). */
const echoReadDoc = vi.fn(
  async (_project: string, relPath: string): Promise<string | null> =>
    `# Documento\n\nContenido de **${relPath}**.`,
);

/** Minimal card — no docs, no phase. */
const MINIMAL_CARD = {
  slug: "minimal-idea",
  title: "Minimal idea",
  status: "discovered" as IdeaStatus,
  body: "## Summary\n\nThis is a short summary.\n\n- Key point A\n- Key point B",
  phase: undefined,
  advancePending: undefined,
};

/** Full in-pipeline card with a rich scoped doc list + a working read action. */
const IN_PIPELINE_CARD = {
  slug: "my-saas-idea",
  title: "My SaaS Idea",
  status: "in-pipeline" as IdeaStatus,
  body: "## Summary\n\nBuilding a great SaaS product.\n\n- Multi-tenant\n- Subscription billing",
  phase: "design" as Phase,
  advancePending: false,
  docNodes: DOC_NODES,
  project: "projects/my-saas",
  readDocAction: echoReadDoc,
};

/** In-pipeline card with no scoped docs (rail lists only Resumen). */
const IN_PIPELINE_EMPTY_DOCS_CARD = {
  ...IN_PIPELINE_CARD,
  slug: "empty-docs-idea",
  docNodes: [] as DocNode[],
};

/** Shipped card — terminal state. */
const SHIPPED_CARD = {
  slug: "shipped-idea",
  title: "Shipped Idea",
  status: "shipped" as IdeaStatus,
  body: "## Summary\n\nAlready live.",
  phase: "release" as Phase,
  advancePending: false,
};

/** Discarded card — terminal state. */
const DISCARDED_CARD = {
  slug: "discarded-idea",
  title: "Discarded Idea",
  status: "discarded" as IdeaStatus,
  body: "## Summary\n\nNot pursued.",
  phase: undefined,
  advancePending: undefined,
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
  it("frd-02: WHEN the body has an h1 THEN it renders as a real heading demoted to <h2> (never an <h1> — embedded content keeps the page's single h1)", () => {
    render(<CardDetail {...MINIMAL_CARD} body="# The Big Title\n\nBody." />);
    const summary = screen.getByTestId("card-detail-summary");
    // Embedded markdown must not emit an <h1> (WCAG one-h1-per-page); the document title is
    // demoted to <h2> but still a real heading (not flattened to <p>/<strong>) at the top scale.
    expect(summary.querySelector("h1")).toBeNull();
    const h2 = summary.querySelector("h2");
    expect(h2).not.toBeNull();
    expect(h2).toHaveTextContent("The Big Title");
  });

  it("frd-02: WHEN the body has an h2 THEN it renders as a real heading demoted to <h3>", () => {
    render(<CardDetail {...MINIMAL_CARD} body="## Section\n\nBody." />);
    const summary = screen.getByTestId("card-detail-summary");
    const h3 = summary.querySelector("h3");
    expect(h3).not.toBeNull();
    expect(h3).toHaveTextContent("Section");
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
// frd-02: AC-02-004.1 — docs navigator (in-pipeline with scoped docs)
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-004.1 — docs navigator (in-pipeline card with docs)", () => {
  it("frd-02: WHEN an in-pipeline card has docs THEN the docs navigator is present", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
  });

  it("frd-02: WHEN an in-pipeline card has docs THEN nav items are rendered", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("frd-02: WHEN docNodes has the PRD THEN a nav item labelled 'PRD' is present", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const hasPrd = items.some((el) => /^PRD$/.test((el.textContent ?? "").trim()));
    expect(hasPrd).toBe(true);
  });

  it("frd-02: WHEN docNodes has research THEN a nav item labelled 'Research' is present under Producto", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const hasResearch = items.some((el) => /research/i.test(el.textContent ?? ""));
    expect(hasResearch).toBe(true);
    const sections = screen
      .getAllByTestId("card-detail-docs-nav-section")
      .map((s) => s.textContent);
    expect(sections).toContain("Producto");
  });

  it("frd-02: WHEN docNodes has two FRD groups THEN one section per FRD slug appears", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const sections = screen
      .getAllByTestId("card-detail-docs-nav-section")
      .map((s) => s.textContent);
    expect(sections).toContain("frd-01-auth");
    expect(sections).toContain("frd-02-billing");
  });

  it("frd-02: WHEN an FRD has frd.md + blueprint.md THEN they carry the Spanish labels", () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const itemTexts = screen
      .getAllByTestId("card-detail-docs-nav-item")
      .map((el) => el.textContent ?? "");
    expect(itemTexts.some((t) => t.includes("Contrato (frd.md)"))).toBe(true);
    expect(itemTexts.some((t) => t.includes("Implementación (blueprint.md)"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-009.3 / AC-02-004.1 — lazy reader loads the selected doc's body
// ---------------------------------------------------------------------------

describe("frd-02: lazy doc reader — selecting a doc loads its content via the read action", () => {
  it("frd-02: WHEN a doc nav item is selected THEN readDocAction is called with the project + relPath", async () => {
    const read = vi.fn(async () => "# Doc\n\nbody");
    render(<CardDetail {...IN_PIPELINE_CARD} readDocAction={read} />);
    const prdItem = screen
      .getAllByTestId("card-detail-docs-nav-item")
      .find((el) => /^PRD$/.test((el.textContent ?? "").trim()));
    expect(prdItem).toBeDefined();
    fireEvent.click(prdItem as HTMLElement);
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(read).toHaveBeenCalledWith("projects/my-saas", "docs/product/prd.md");
  });

  it("frd-02: WHEN the read action resolves THEN the doc content renders via .pc-markdown in the reader", async () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const prdItem = screen
      .getAllByTestId("card-detail-docs-nav-item")
      .find((el) => /^PRD$/.test((el.textContent ?? "").trim())) as HTMLElement;
    fireEvent.click(prdItem);
    const reader = await screen.findByTestId("card-detail-doc-reader");
    await waitFor(() => expect(reader.querySelector(".pc-markdown")).not.toBeNull());
    expect(reader).toHaveTextContent("docs/product/prd.md");
  });

  it("frd-02: WHEN the read action returns null THEN the reader shows 'No se pudo leer este documento.'", async () => {
    const read = vi.fn(async () => null);
    render(<CardDetail {...IN_PIPELINE_CARD} readDocAction={read} />);
    const item = screen.getAllByTestId("card-detail-docs-nav-item")[0] as HTMLElement;
    fireEvent.click(item);
    const reader = await screen.findByTestId("card-detail-doc-reader");
    await waitFor(() => expect(reader).toHaveTextContent("No se pudo leer este documento."));
  });

  it("frd-02: WHEN no readDocAction is provided THEN selecting a doc shows the workspace fallback (no crash)", () => {
    // Older callers/tests: docNodes present but no read action → graceful fallback.
    render(
      <CardDetail
        slug="no-action"
        title="No action"
        status="in-pipeline"
        body="x"
        phase="design"
        docNodes={DOC_NODES}
        project="projects/p"
      />,
    );
    const item = screen.getAllByTestId("card-detail-docs-nav-item")[0] as HTMLElement;
    expect(() => fireEvent.click(item)).not.toThrow();
    const reader = screen.getByTestId("card-detail-doc-reader");
    expect(reader).toHaveTextContent("El contenido se abre en el workspace del proyecto.");
  });

  it("frd-02: WHEN switching from a loaded doc to Resumen THEN the summary shows again (content reset)", async () => {
    render(<CardDetail {...IN_PIPELINE_CARD} />);
    const item = screen.getAllByTestId("card-detail-docs-nav-item")[0] as HTMLElement;
    fireEvent.click(item);
    await screen.findByTestId("card-detail-doc-reader");
    fireEvent.click(screen.getByTestId("card-detail-docs-nav-resumen"));
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: AC-02-008.1 — edge: card with no docs → Resumen only, no doc items
// ---------------------------------------------------------------------------

describe("frd-02: AC-02-008.1 — edge: card with no docs (Resumen only)", () => {
  it("frd-02: WHEN docNodes is absent THEN the rail still lists Resumen but no project doc items", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeInTheDocument();
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("frd-02: WHEN docNodes is absent THEN no section headers are rendered", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.queryAllByTestId("card-detail-docs-nav-section")).toHaveLength(0);
  });

  it("frd-02: WHEN docNodes is an empty array THEN the rail lists only Resumen (no doc items)", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeInTheDocument();
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("frd-02: WHEN docNodes is absent THEN the summary is still rendered (no crash)", () => {
    render(<CardDetail {...MINIMAL_CARD} />);
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });

  it("frd-02: WHEN docNodes is absent and body has content THEN summary text is visible", () => {
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
      />,
    );
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
    expect(screen.getByTestId("card-detail-summary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// frd-02: Regression — empty docs list does NOT fabricate doc items
// ---------------------------------------------------------------------------

describe("frd-02: regression I2 — empty docNodes shows no project doc items", () => {
  it("frd-02: WHEN docNodes is [] THEN no project doc items appear (rail lists Resumen only)", () => {
    render(<CardDetail {...IN_PIPELINE_EMPTY_DOCS_CARD} />);
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeInTheDocument();
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("frd-02: WHEN docNodes is [] THEN summary is still visible", () => {
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

  it("frd-02: WHEN the component first renders THEN the read action is NOT called (lazy — only on select)", () => {
    const read = vi.fn(async () => "x");
    render(<CardDetail {...IN_PIPELINE_CARD} readDocAction={read} />);
    expect(read).not.toHaveBeenCalled();
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
    // Title appears in the accessible (clipped) <h2> AND visibly in the Propuesta pitch hero.
    expect(screen.getAllByText("Minimal idea").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// frd-02: Structural order — navigator precedes the reader/summary
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

// ---------------------------------------------------------------------------
// In-doc links resolve to THIS reader (owner: the board had the same broken-link
// bug as the portfolio). A relative link to a doc the reader surfaces SELECTS it
// (client-state nav); off-app URLs open in a new tab; anything else is plain text.
// ---------------------------------------------------------------------------

describe("frd-02: in-doc links open the linked doc in the card-detail reader", () => {
  // A read action whose PRD body links a sibling FRD (relative → known), an external site,
  // and a doc the reader does NOT surface — exercising each branch of the resolver.
  const linkyReadDoc = vi.fn(async (_project: string, relPath: string): Promise<string | null> => {
    if (relPath === "docs/product/prd.md") {
      return "Ver [FRD-02](../frds/frd-02-billing/frd.md), [sitio](https://x.com) y [WO](../work-orders/wo-01.md).";
    }
    return `# ${relPath}\n\nCuerpo de ${relPath}.`;
  });
  const CARD = { ...IN_PIPELINE_CARD, readDocAction: linkyReadDoc };

  async function openPrd(): Promise<void> {
    render(<CardDetail {...CARD} />);
    // The first project doc in the rail is the PRD (Producto section, first item).
    const [prdItem] = screen.getAllByTestId("card-detail-docs-nav-item");
    if (!prdItem) throw new Error("expected a PRD nav item");
    fireEvent.click(prdItem);
    await waitFor(() => expect(screen.getByRole("button", { name: "FRD-02" })).toBeInTheDocument());
  }

  it("frd-02: a link to a KNOWN doc renders as a button; selecting it loads that doc", async () => {
    await openPrd();
    fireEvent.click(screen.getByRole("button", { name: "FRD-02" }));
    await waitFor(() =>
      expect(linkyReadDoc).toHaveBeenCalledWith(CARD.project, "docs/frds/frd-02-billing/frd.md"),
    );
  });

  it("frd-02: an external in-doc link stays a new-tab anchor", async () => {
    await openPrd();
    expect(screen.getByRole("link", { name: "sitio" }).getAttribute("target")).toBe("_blank");
  });

  it("frd-02: a link to a doc the reader does not surface becomes plain text", async () => {
    await openPrd();
    expect(screen.queryByRole("link", { name: "WO" })).toBeNull();
    expect(screen.queryByRole("button", { name: "WO" })).toBeNull();
    expect(screen.getByText("WO")).toBeInTheDocument();
  });
});
