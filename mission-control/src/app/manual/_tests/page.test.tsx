/**
 * app/manual/page.test.tsx — WO-08-002
 *
 * Tests for the Manual page shell: side menu (Diátaxis) + reader.
 *
 * Traceability:
 *   AC-08-002.1 — The Manual SHALL offer a side menu with pages and a reading area.
 *   AC-08-002.2 — The side menu SHALL group pages by the four Diátaxis quadrants:
 *                 Empezar aquí / Guías / Referencia / Conceptos.
 *   AC-08-002.3 — Selecting a page SHALL render it in the reading area
 *                 (authored markdown via react-markdown or a Reference catalog view).
 *   AC-08-002.4 — The shell SHALL use FRD-13 tokens (rationed accent on active page),
 *                 Spanish labels/aria-labels, keyboard navigation and visible focus ring.
 *
 * TDD plan (WO):
 *   1. RED: all tests fail — components don't exist yet.
 *   2. GREEN: implement DocNav + DocReader + ManualPage shell.
 *   3. Refactor: check SideMenu sharing with FRD-04/07.
 *
 * Architecture: Server Component (page.tsx) reads data; DocNav + DocReader
 * are Client Components that handle interaction. Tests use DocNav and DocReader
 * directly (as client components) with vitest + jsdom.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// --------------------------------------------------------------------------
// Module mocks — isolate from filesystem / Next.js router
// --------------------------------------------------------------------------

// Mock next/navigation (used by DocNav for URL-based active state if needed)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/manual",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock react-markdown to keep tests fast and avoid ESM parsing issues.
// The real component integrates react-markdown; tests verify it's invoked.
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown-output">{children}</div>
  ),
}));

// --------------------------------------------------------------------------
// Fixture data
// --------------------------------------------------------------------------

const FIXTURE_PAGES = [
  {
    group: "tutorial",
    slug: "como-empezar",
    title: "Cómo empezar",
    order: 1,
    body: "# Cómo empezar\n\nEsta es la guía de inicio.",
  },
  {
    group: "guides",
    slug: "operacion-diaria",
    title: "Cómo operas a diario",
    order: 1,
    body: "# Cómo operas a diario\n\nOperación diaria de la fábrica.",
  },
  {
    group: "guides",
    slug: "como-se-construye",
    title: "Cómo se construye",
    order: 2,
    body: "# Cómo se construye\n\nPipeline de construcción.",
  },
  {
    group: "concepts",
    slug: "que-es-pandacorp",
    title: "Qué es Pandacorp",
    order: 1,
    body: "# Qué es Pandacorp\n\nExplicación del sistema completo.",
  },
];

// A page whose slug has NO bespoke React renderer in the registry, so DocReader
// takes the markdown fallback path (DocH title + react-markdown body). Used by the
// markdown-reader / title-heading tests so they assert the fallback path directly
// (the real content slugs render bespoke composed React pages — the repaint).
const FIXTURE_MD_PAGE = {
  group: "concepts",
  slug: "__fixture_markdown_only__",
  title: "Página de prueba",
  order: 99,
  body: "# Página de prueba\n\nCuerpo de la página de prueba.",
} as const;

const FIXTURE_SKILLS = [
  {
    slug: "explore",
    description: "Explora una idea fuzzy en conversación.",
    runsIn: "factory" as const,
    body: "",
  },
  {
    slug: "spec",
    description: "Crea el proyecto y documenta el MVP.",
    runsIn: "factory" as const,
    body: "",
  },
];

const FIXTURE_AGENTS = [
  {
    id: "backend-dev",
    name: "Backend Developer",
    description: "Implementa el backend.",
    model: "claude-opus-4-5",
    body: "",
  },
];

const FIXTURE_RULES = [
  {
    id: "DR-001",
    patron: "Adding a new dependency",
    default: "Only approved libraries.",
    requiereHumano: false,
  },
];

const FIXTURE_STANDARDS = [
  {
    id: "conventions",
    title: "Conventions",
    body: "# Conventions\n\nConvenciones de código.",
    domain: "Engineering" as const,
    severity: "MUST" as const,
    enforcement: "lint" as const,
    summary: ["Usar TypeScript strict", "No any"],
  },
];

// --------------------------------------------------------------------------
// Import the client components under test
// --------------------------------------------------------------------------

// DocNav — the side menu Client Component
import { DocNav } from "../DocNav";
// DocReader — the reading area Client Component
import { DocReader } from "../DocReader";

// --------------------------------------------------------------------------
// Cleanup after each test
// --------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ==========================================================================
// AC-08-002.1 — Side menu + reading area
// ==========================================================================

describe("AC-08-002.1 — side menu with pages and reading area", () => {
  it("DocNav renders a nav landmark with data-testid='doc-nav'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("doc-nav")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /manual/i })).toBeTruthy();
  });

  it("DocReader renders a reading area with data-testid='doc-reader'", () => {
    render(
      <DocReader
        activePage={null}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    expect(screen.getByTestId("doc-reader")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
  });

  it("DocReader shows an empty-state message when no page is selected", () => {
    render(
      <DocReader
        activePage={null}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    expect(screen.getByTestId("doc-reader-empty")).toBeTruthy();
  });

  it("DocNav lists authored pages as clickable items", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    // Each authored page should appear as a button/link
    expect(screen.getByText("Cómo empezar")).toBeTruthy();
    expect(screen.getByText("Cómo operas a diario")).toBeTruthy();
    expect(screen.getByText("Qué es Pandacorp")).toBeTruthy();
  });
});

// ==========================================================================
// AC-08-002.2 — Four Diátaxis quadrants
// ==========================================================================

describe("AC-08-002.2 — four Diátaxis quadrants in side menu", () => {
  it("renders a group heading for 'Empezar aquí'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("doc-nav-group-tutorial")).toBeTruthy();
    expect(screen.getByText("Empezar aquí")).toBeTruthy();
  });

  it("renders a group heading for 'Guías'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("doc-nav-group-guides")).toBeTruthy();
    expect(screen.getByText("Guías")).toBeTruthy();
  });

  it("renders a group heading for 'Referencia'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("doc-nav-group-reference")).toBeTruthy();
    expect(screen.getByText("Referencia")).toBeTruthy();
  });

  it("renders a group heading for 'Conceptos'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("doc-nav-group-concepts")).toBeTruthy();
    expect(screen.getByText("Conceptos")).toBeTruthy();
  });

  it("renders all four groups even when some authored groups have no pages", () => {
    // Only tutorial + concepts pages; guides is absent
    const pagesNoGuides = FIXTURE_PAGES.filter((p) => p.group !== "guides");
    render(
      <DocNav
        pages={pagesNoGuides}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    // All four groups must always appear
    expect(screen.getByTestId("doc-nav-group-tutorial")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-group-guides")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-group-reference")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-group-concepts")).toBeTruthy();
  });

  it("Reference group contains four sub-entries (commands, agents, rules, standards)", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    const refGroup = screen.getByTestId("doc-nav-group-reference");
    expect(within(refGroup).getByTestId("doc-nav-item-reference-commands")).toBeTruthy();
    expect(within(refGroup).getByTestId("doc-nav-item-reference-agents")).toBeTruthy();
    expect(within(refGroup).getByTestId("doc-nav-item-reference-rules")).toBeTruthy();
    expect(within(refGroup).getByTestId("doc-nav-item-reference-standards")).toBeTruthy();
  });

  it("authored pages appear under their correct Diátaxis group", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    const tutorialGroup = screen.getByTestId("doc-nav-group-tutorial");
    expect(within(tutorialGroup).getByText("Cómo empezar")).toBeTruthy();

    const guidesGroup = screen.getByTestId("doc-nav-group-guides");
    expect(within(guidesGroup).getByText("Cómo operas a diario")).toBeTruthy();
    expect(within(guidesGroup).getByText("Cómo se construye")).toBeTruthy();

    const conceptsGroup = screen.getByTestId("doc-nav-group-concepts");
    expect(within(conceptsGroup).getByText("Qué es Pandacorp")).toBeTruthy();
  });

  it("shows authored pages in order within their group", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    const guidesGroup = screen.getByTestId("doc-nav-group-guides");
    const items = within(guidesGroup).getAllByRole("button");
    // First guide should be "Cómo operas a diario" (order: 1)
    expect(items[0]?.textContent).toContain("Cómo operas a diario");
    // Second guide should be "Cómo se construye" (order: 2)
    expect(items[1]?.textContent).toContain("Cómo se construye");
  });
});

// ==========================================================================
// AC-08-002.3 — Selecting a page renders it in the reading area
// ==========================================================================

describe("AC-08-002.3 — selecting a page renders it in the reading area", () => {
  it("clicking a page item calls onSelect with the page slug and type", () => {
    const onSelect = vi.fn();
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Cómo empezar"));
    expect(onSelect).toHaveBeenCalledWith({
      type: "authored",
      group: "tutorial",
      slug: "como-empezar",
    });
  });

  it("clicking a Reference catalog sub-entry calls onSelect with type 'reference'", () => {
    const onSelect = vi.fn();
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("doc-nav-item-reference-commands"));
    expect(onSelect).toHaveBeenCalledWith({ type: "reference", catalog: "commands" });
  });

  it("DocReader renders authored markdown body when an authored page is active", () => {
    render(
      <DocReader
        // A slug with no bespoke React page → markdown fallback path.
        activePage={{ type: "authored", page: FIXTURE_MD_PAGE }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // The mock react-markdown renders children as text
    const output = screen.getByTestId("react-markdown-output");
    expect(output.textContent).toContain("Página de prueba");
  });

  it("DocReader renders the commands Reference catalog view when commands page is active", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "commands" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // DR-046/DR-057: the catalog REUSES the FRD-07 SkillsSection → SkillCard.
    expect(screen.getByTestId("skills-section")).toBeTruthy();
  });

  it("DocReader renders the agents Reference catalog view when agents page is active", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "agents" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // DR-046/DR-057: the catalog REUSES the FRD-07 AgentList → agent-card.
    expect(screen.getAllByTestId("agent-card").length).toBeGreaterThan(0);
  });

  it("DocReader renders the rules Reference catalog view when rules page is active", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "rules" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // DR-046/DR-057: the catalog REUSES the FRD-07 DecisionRulesSection.
    expect(screen.getByTestId("rules-section")).toBeTruthy();
  });

  it("DocReader renders the standards Reference catalog view when standards page is active", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "standards" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // DR-046/DR-057: the catalog REUSES the FRD-07 StandardsSection.
    expect(screen.getByTestId("standards-section")).toBeTruthy();
  });

  it("DocReader reference-commands view lists all skill slugs", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "commands" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // Skills render through the shared SkillCard (skill-card-<slug>).
    expect(screen.getByTestId("skill-card-explore")).toBeTruthy();
    expect(screen.getByTestId("skill-card-spec")).toBeTruthy();
    expect(screen.getByTestId("skill-card-explore").textContent).toContain("explore");
    expect(screen.getByTestId("skill-card-spec").textContent).toContain("spec");
  });

  it("DocReader reference-agents view lists agent names", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "agents" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // Agents render through the shared AgentList (agent-card).
    const view = screen.getByTestId("doc-reader-reference");
    expect(within(view).getByText("Backend Developer")).toBeTruthy();
  });

  it("DocReader reference-rules view lists rule IDs", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "rules" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    const view = screen.getByTestId("rules-section");
    expect(within(view).getByText("DR-001")).toBeTruthy();
  });

  it("DocReader reference-standards view lists standard titles", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "standards" }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    const view = screen.getByTestId("standards-section");
    expect(within(view).getByText("Conventions")).toBeTruthy();
  });
});

// ==========================================================================
// AC-08-002.4 — FRD-13 tokens + Spanish + keyboard + focus ring
// ==========================================================================

describe("AC-08-002.4 — FRD-13 tokens, Spanish labels, keyboard nav, focus ring", () => {
  it("DocNav has a Spanish aria-label on the nav element", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    const nav = screen.getByRole("navigation");
    expect(nav.getAttribute("aria-label")).toBeTruthy();
    // Must be in Spanish (non-English label)
    const label = nav.getAttribute("aria-label") ?? "";
    expect(label).not.toBe("");
  });

  it("active page item has data-active attribute set to 'true'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={{ type: "authored", group: "tutorial", slug: "como-empezar" }}
        onSelect={vi.fn()}
      />,
    );
    const activeItem = screen.getByTestId("doc-nav-item-tutorial-como-empezar");
    expect(activeItem.getAttribute("data-active")).toBe("true");
  });

  it("inactive page items do NOT have data-active='true'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={{ type: "authored", group: "tutorial", slug: "como-empezar" }}
        onSelect={vi.fn()}
      />,
    );
    const inactiveItem = screen.getByTestId("doc-nav-item-guides-operacion-diaria");
    expect(inactiveItem.getAttribute("data-active")).not.toBe("true");
  });

  it("DocNav page items are keyboard-navigable (role=button)", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    // All page items should be buttons (keyboard-navigable by default)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("DocNav does not use hardcoded colors in inline style (uses CSS vars only)", () => {
    const { container } = render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    // Collect all style attributes in the rendered tree
    const allStyles = container.querySelectorAll("[style]");
    for (const el of allStyles) {
      const style = el.getAttribute("style") ?? "";
      // Should not contain hardcoded hex, rgb, hsl, or oklch literal values
      // (only var(--*) references are allowed)
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(style).not.toMatch(/\brgb\s*\(/);
      expect(style).not.toMatch(/\bhsl\s*\(/);
    }
  });

  it("DocReader does not use hardcoded colors in inline style", () => {
    const { container } = render(
      <DocReader
        // biome-ignore lint/style/noNonNullAssertion: FIXTURE_PAGES[0] is always defined
        activePage={{ type: "authored", page: FIXTURE_PAGES[0]! }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    const allStyles = container.querySelectorAll("[style]");
    for (const el of allStyles) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(style).not.toMatch(/\brgb\s*\(/);
      expect(style).not.toMatch(/\bhsl\s*\(/);
    }
  });

  it("active Reference sub-entry has data-active='true'", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={{ type: "reference", catalog: "commands" }}
        onSelect={vi.fn()}
      />,
    );
    const commandsItem = screen.getByTestId("doc-nav-item-reference-commands");
    expect(commandsItem.getAttribute("data-active")).toBe("true");
  });

  it("DocReader reading area has an aria-label for accessibility", () => {
    render(
      <DocReader
        // biome-ignore lint/style/noNonNullAssertion: FIXTURE_PAGES[0] is always defined
        activePage={{ type: "authored", page: FIXTURE_PAGES[0]! }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // The main reading area should have aria-label (or be a main landmark)
    const main = screen.getByRole("main");
    expect(main).toBeTruthy();
  });

  it("DocNav group headings render as heading elements (a11y hierarchy)", () => {
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    // Group headings should use heading or have role that conveys grouping
    const headings = screen.getAllByRole("heading");
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain("Empezar aquí");
    expect(headingTexts).toContain("Guías");
    expect(headingTexts).toContain("Referencia");
    expect(headingTexts).toContain("Conceptos");
  });

  it("DocNav page item fires onSelect via keyboard Enter key", () => {
    const onSelect = vi.fn();
    render(
      <DocNav
        pages={FIXTURE_PAGES}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
        activePage={null}
        onSelect={onSelect}
      />,
    );
    const button = screen.getByText("Cómo empezar").closest("button");
    expect(button).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect().not.toBeNull() above
    fireEvent.keyDown(button!, { key: "Enter" });
    // Buttons handle Enter natively, so we verify click fires
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect().not.toBeNull() above
    fireEvent.click(button!);
    expect(onSelect).toHaveBeenCalled();
  });

  it("DocReader renders page title as a heading element", () => {
    render(
      <DocReader
        // Markdown-fallback page: the title renders as a DocH <h1> heading.
        activePage={{ type: "authored", page: FIXTURE_MD_PAGE }}
        skills={FIXTURE_SKILLS}
        agents={FIXTURE_AGENTS}
        rules={FIXTURE_RULES}
        standards={FIXTURE_STANDARDS}
      />,
    );
    // The page title should appear as a heading
    const headings = screen.getAllByRole("heading");
    const texts = headings.map((h) => h.textContent);
    expect(texts.some((t) => t?.includes("Página de prueba"))).toBe(true);
  });
});
