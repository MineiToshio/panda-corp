/**
 * core/Markdown — heading-demotion contract (regression guard).
 *
 * The shared renderer is ALWAYS embedded under a page that already owns the single
 * <h1> (the PageTitle), so a document's markdown must never emit its own <h1> — the
 * WCAG "one h1 per page" rule (docs/rules/accessibility.md). Markdown.tsx satisfies it
 * by demoting every heading one level (`#`→<h2>, `##`→<h3>, …) while keeping the visual
 * scale (H1_STYLE on the <h2>, so the document's main title still reads as the biggest).
 *
 * This is the ROOT-CAUSE guard for the Portfolio "two <h1>" defect (decision-log
 * 2026-06-22 / commit 17bb6da): an idea-card body whose first line is `# Title`, rendered
 * inside TabSummary on the Portfolio page (which has its own PageTitle h1), must NOT
 * introduce a second <h1>. Pinned here at the renderer so every reuse surface (card-detail
 * Documentos, work-order detail, project documents tab, Manual fallback, summaries) is safe.
 *
 * Stack: Vitest + @testing-library/react + jsdom. Accessible-role queries only.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "../Markdown";

describe("core/Markdown — heading demotion (one-h1-per-page invariant)", () => {
  it("NEVER emits an <h1>, even when the source starts with a top-level '#'", () => {
    render(<Markdown>{"# Pandacorp (Mission Control)\n\n## Problema\n\nCuerpo."}</Markdown>);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("demotes a top-level '#' to an <h2> (still the document's main heading)", () => {
    render(<Markdown>{"# Pandacorp (Mission Control)"}</Markdown>);
    expect(
      screen.getByRole("heading", { level: 2, name: "Pandacorp (Mission Control)" }),
    ).toBeInTheDocument();
  });

  it("demotes a second-level '##' to an <h3>", () => {
    render(<Markdown>{"## Problema"}</Markdown>);
    expect(screen.getByRole("heading", { level: 3, name: "Problema" })).toBeInTheDocument();
  });

  it("keeps a full document's hierarchy one level below the page (h2 > h3, no h1)", () => {
    render(
      <Markdown data-testid="md-root">{"# Título\n\n## Sección\n\nTexto del cuerpo."}</Markdown>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Título" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Sección" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    // The raw '#' markers must not survive as text either.
    expect(screen.getByTestId("md-root").textContent).not.toContain("# Título");
  });

  it("still renders the demoted main title with the H1 visual scale (20px)", () => {
    render(<Markdown>{"# Título"}</Markdown>);
    // Demotion changes the TAG (h1→h2) but keeps the visual weight (H1_STYLE, 20px),
    // so the document's main title never reads smaller than its own sub-headings.
    const heading = screen.getByRole("heading", { level: 2, name: "Título" });
    expect(heading.style.fontSize).toBe("20px");
  });
});
