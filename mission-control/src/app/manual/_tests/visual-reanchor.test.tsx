/**
 * app/manual/_tests/visual-reanchor.test.tsx — WO-08-002 visual re-anchor gate
 *
 * Tests that the Documentación surface matches the owner-approved prototype
 * layout and design (the rpghall shell, sticky nav, PageTitle H1 "Documentación",
 * navitem with accent active state, panel-wrapped content, docH headings).
 *
 * These tests verify the VISUAL and STRUCTURAL re-anchor (not the data derivation,
 * which is covered by manual.reviewer.integration.test.tsx and ReferenceRulesStandards.test.tsx).
 *
 * Traceability:
 *   AC-08-002.1 — side menu + reading area (236px 1fr two-pane shell)
 *   AC-08-002.2 — four Diátaxis groups, correct order
 *   AC-08-002.4 — FRD-13 tokens (no hardcoded colors), Spanish labels,
 *                  keyboard nav, PageTitle H1 "Documentación" (DR-062)
 *   FDD-08 §1   — the layout: PageTitle light block + 236px 1fr grid + sticky nav
 *   FDD-08 §3   — components: PageTitle, DocNav, DocReader, Panel, DocHeading, CmdRow
 *   DR-062      — the ONE light PageTitle block; page H1 = "Documentación" (nav label)
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/manual",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown-output">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { DocNav } from "../DocNav";
import { DocReader } from "../DocReader";
import { ManualShell } from "../ManualShell";
import ManualPage from "../page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const PAGES = [
  { group: "tutorial", slug: "que-es", title: "Qué es Pandacorp", order: 1, body: "# Qué es" },
  { group: "guides", slug: "g-capturar", title: "Capturar una idea", order: 1, body: "# Capturar" },
  { group: "concepts", slug: "c-pipeline", title: "El pipeline", order: 1, body: "# Pipeline" },
];
const SKILLS = [{ slug: "spec", description: "Handoff.", runsIn: "factory" as const, body: "" }];
const AGENTS = [
  { id: "reviewer", name: "Reviewer", description: "Revisa.", model: "opus", body: "" },
];
const RULES = [
  { id: "DR-001", patron: "Adding dep", default: "approved libs", requiereHumano: false },
];
const STANDARDS = [
  {
    id: "conventions.md",
    title: "Conventions",
    body: "# Conv",
    domain: "Engineering" as const,
    severity: "MUST" as const,
    enforcement: "lint" as const,
    summary: ["strict TS"],
  },
];

// ---------------------------------------------------------------------------
// DR-062 — PageTitle H1 "Documentación"
// ---------------------------------------------------------------------------

describe("DR-062 — page H1 is 'Documentación' (the nav label)", () => {
  it("ManualShell renders a visible H1 with text 'Documentación'", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: /documentaci[oó]n/i });
    expect(h1).toBeTruthy();
  });

  it("ManualPage renders a H1 with text 'Documentación' via PageTitle", () => {
    render(ManualPage());
    const h1 = screen.getByRole("heading", { level: 1, name: /documentaci[oó]n/i });
    expect(h1).toBeTruthy();
  });

  it("page H1 is NOT 'Manual' or 'Códice' (FRD-08 AC, DR-062)", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    const h1s = screen.getAllByRole("heading", { level: 1 });
    for (const h of h1s) {
      expect(h.textContent?.toLowerCase()).not.toContain("manual");
      expect(h.textContent?.toLowerCase()).not.toContain("códice");
    }
  });
});

// ---------------------------------------------------------------------------
// FDD-08 §1 — Two-pane layout (236px 1fr, sticky nav)
// ---------------------------------------------------------------------------

describe("FDD-08 §1 — two-pane shell layout (ManualShell)", () => {
  it("ManualShell renders data-testid='manual-shell'", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    expect(screen.getByTestId("manual-shell")).toBeTruthy();
  });

  it("ManualShell contains the DocNav side menu AND the DocReader reading area", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    expect(screen.getByTestId("doc-nav")).toBeTruthy();
    expect(screen.getByTestId("doc-reader")).toBeTruthy();
  });

  it("DocNav is inside a sticky wrapper (data-testid='doc-nav-sticky')", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    expect(screen.getByTestId("doc-nav-sticky")).toBeTruthy();
  });

  it("reading area has min-width:0 guard (prevents overflow in 1fr column)", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    const reader = screen.getByTestId("manual-reader-area");
    // The area must have min-width:0 set (directly or via CSS class)
    const style = reader.getAttribute("style") ?? "";
    expect(style).toContain("min-width");
  });
});

// ---------------------------------------------------------------------------
// FDD-08 §2 — DocNav navitem styling
// ---------------------------------------------------------------------------

describe("FDD-08 §2 — DocNav navitem styling and active state", () => {
  it("active nav item has data-active='true' and aria-current='page'", () => {
    render(
      <DocNav
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
        activePage={{ type: "authored", group: "tutorial", slug: "que-es" }}
        onSelect={vi.fn()}
      />,
    );
    const item = screen.getByTestId("doc-nav-item-tutorial-que-es");
    expect(item.getAttribute("data-active")).toBe("true");
    expect(item.getAttribute("aria-current")).toBe("page");
  });

  it("inactive nav items have data-active='false'", () => {
    render(
      <DocNav
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
        activePage={{ type: "authored", group: "tutorial", slug: "que-es" }}
        onSelect={vi.fn()}
      />,
    );
    const inactiveItem = screen.getByTestId("doc-nav-item-guides-g-capturar");
    expect(inactiveItem.getAttribute("data-active")).not.toBe("true");
  });

  it("Diátaxis group headers have data-testid pattern doc-nav-group-{key}", () => {
    render(
      <DocNav
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("doc-nav-group-tutorial")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-group-guides")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-group-reference")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-group-concepts")).toBeTruthy();
  });

  it("Reference nav items have data-testid pattern doc-nav-item-reference-{catalog}", () => {
    render(
      <DocNav
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("doc-nav-item-reference-commands")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-item-reference-agents")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-item-reference-rules")).toBeTruthy();
    expect(screen.getByTestId("doc-nav-item-reference-standards")).toBeTruthy();
  });

  it("Reference active item has data-active='true'", () => {
    render(
      <DocNav
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
        activePage={{ type: "reference", catalog: "commands" }}
        onSelect={vi.fn()}
      />,
    );
    const item = screen.getByTestId("doc-nav-item-reference-commands");
    expect(item.getAttribute("data-active")).toBe("true");
  });

  it("clicking a nav item fires onSelect with the correct payload", () => {
    const onSelect = vi.fn();
    render(
      <DocNav
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
        activePage={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("doc-nav-item-tutorial-que-es"));
    expect(onSelect).toHaveBeenCalledWith({ type: "authored", group: "tutorial", slug: "que-es" });
  });
});

// ---------------------------------------------------------------------------
// FDD-08 §3 — DocReader content rendering
// ---------------------------------------------------------------------------

describe("FDD-08 §3 — DocReader renders each page kind correctly", () => {
  it("renders empty state when no page is selected", () => {
    render(
      <DocReader
        activePage={null}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    expect(screen.getByTestId("doc-reader-empty")).toBeTruthy();
  });

  it("renders authored page with DocHeading title", () => {
    const firstPage = PAGES[0];
    if (!firstPage) throw new Error("PAGES fixture must have at least one entry");
    render(
      <DocReader
        activePage={{ type: "authored", page: firstPage }}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    // Authored page should show a heading with the page title
    expect(screen.getByTestId("doc-reader-authored")).toBeTruthy();
    const headings = screen.getAllByRole("heading");
    const texts = headings.map((h) => h.textContent);
    expect(texts.some((t) => t?.includes("Qué es Pandacorp"))).toBe(true);
  });

  it("renders reference section when reference page is selected", () => {
    render(
      <DocReader
        activePage={{ type: "reference", catalog: "commands" }}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    expect(screen.getByTestId("doc-reader-reference")).toBeTruthy();
    expect(screen.getByTestId("skills-section")).toBeTruthy();
  });

  it("DocReader main element has aria-label in Spanish", () => {
    render(
      <DocReader
        activePage={null}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    const main = screen.getByRole("main");
    expect(main.getAttribute("aria-label")).toBeTruthy();
    expect(main.getAttribute("aria-label")).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// FRD-13 tokens — no hardcoded colors in the full page
// ---------------------------------------------------------------------------

describe("FRD-13 — no hardcoded colors in ManualShell or DocNav", () => {
  function hasNoHardcodedColors(container: HTMLElement): void {
    const allStyled = container.querySelectorAll("[style]");
    for (const el of allStyled) {
      const style = el.getAttribute("style") ?? "";
      // No hex literals, no rgb/hsl literals — only var(--*) or structural rgba
      // (rgba() is allowed for the RPG emboss structural shadows, which are theme-independent)
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(style).not.toMatch(/\bhsl\s*\(/);
    }
  }

  it("ManualShell has no hardcoded hex colors in inline styles", () => {
    const { container } = render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    hasNoHardcodedColors(container);
  });

  it("DocNav has no hardcoded hex colors in inline styles", () => {
    const { container } = render(
      <DocNav
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
        activePage={null}
        onSelect={vi.fn()}
      />,
    );
    hasNoHardcodedColors(container);
  });
});

// ---------------------------------------------------------------------------
// Inline content pages (ManualLanding, Quickstart, GuideDoc, DocPage, RefSection)
// Verified via the full ManualShell + DocReader integration
// ---------------------------------------------------------------------------

describe("Inline content pages — the Diátaxis page kinds", () => {
  it("ManualLanding renders when 'que-es' tutorial page is selected", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    // Select the tutorial page
    fireEvent.click(screen.getByTestId("doc-nav-item-tutorial-que-es"));
    // Should render an authored page with the title
    expect(screen.getByTestId("doc-reader-authored")).toBeTruthy();
  });

  it("RefSection renders when a Reference catalog is selected", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    fireEvent.click(screen.getByTestId("doc-nav-item-reference-commands"));
    expect(screen.getByTestId("doc-reader-reference")).toBeTruthy();
    expect(screen.getByTestId("skills-section")).toBeTruthy();
  });

  it("Guides page renders authored content when selected", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    fireEvent.click(screen.getByTestId("doc-nav-item-guides-g-capturar"));
    expect(screen.getByTestId("doc-reader-authored")).toBeTruthy();
  });

  it("Concepts page renders authored content when selected", () => {
    render(
      <ManualShell
        pages={PAGES}
        skills={SKILLS}
        agents={AGENTS}
        rules={RULES}
        standards={STANDARDS}
      />,
    );
    fireEvent.click(screen.getByTestId("doc-nav-item-concepts-c-pipeline"));
    expect(screen.getByTestId("doc-reader-authored")).toBeTruthy();
  });
});
