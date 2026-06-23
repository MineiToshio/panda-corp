/**
 * WO-02-007 — CardDetail ADVERSARIAL tests (reviewer / DR-015)
 *
 * These probe edges the implementer's own suite (CardDetail.test.tsx) did NOT cover,
 * for the navigable-docs-with-content model (DR-046):
 *
 *   - SECURITY: react-markdown must NOT render raw <script>/<img onerror> from the body
 *     OR from a lazily-loaded doc body, and must neutralise `javascript:` links
 *     (both the summary body and the doc content are project-derived content).
 *   - React key integrity: two FRD groups (or repeated relPaths) must not crash the rail.
 *   - The rail groups by FRD section; a doc with an unknown filename keeps a sensible label.
 *   - The lazy reader must not flash a stale body when switching between docs.
 *   - slug carried into data-slug must survive special characters without breaking the DOM.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import type { DocNode } from "@/lib/docs/tree";
import type { IdeaStatus } from "@/lib/ideas/ideas";

afterEach(() => {
  vi.restoreAllMocks();
});

const BASE = {
  slug: "adv-idea",
  title: "Adversarial Idea",
  status: "in-pipeline" as IdeaStatus,
  body: "## Summary\n\nA body.",
  phase: undefined,
  advancePending: false,
  project: "projects/p",
};

function docNode(relPath: string, label: string, group: string): DocNode {
  return { id: relPath.replace(/\.[^/.]+$/, ""), label, group, relPath };
}

// ---------------------------------------------------------------------------
// SECURITY — markdown (summary AND lazily-loaded doc body) is project-derived;
// must not execute raw HTML / scripts or emit javascript: links.
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL SECURITY — markdown body sanitisation", () => {
  it("does NOT inject a <script> element from the summary body into the DOM", () => {
    const body = "Normal text\n\n<script>window.__pwned = true;</script>";
    render(<CardDetail {...BASE} body={body} />);
    const summary = screen.getByTestId("card-detail-summary");
    // react-markdown without rehype-raw renders raw HTML as text, never as a live node.
    expect(summary.querySelector("script")).toBeNull();
  });

  it("does NOT create an <img onerror> handler element from the summary body", () => {
    const body = 'Text\n\n<img src=x onerror="window.__pwned=1">';
    render(<CardDetail {...BASE} body={body} />);
    const summary = screen.getByTestId("card-detail-summary");
    const img = summary.querySelector("img");
    expect(img?.getAttribute("onerror") ?? null).toBeNull();
  });

  it("does NOT produce a javascript: href from a markdown link in the summary body", () => {
    const body = "[click me](javascript:alert(1))";
    render(<CardDetail {...BASE} body={body} />);
    const summary = screen.getByTestId("card-detail-summary");
    const anchor = summary.querySelector("a");
    const href = anchor?.getAttribute("href") ?? "";
    expect(href.toLowerCase().startsWith("javascript:")).toBe(false);
  });

  it("does NOT execute a <script> embedded in a lazily-loaded DOC body", async () => {
    // The doc content is project-derived too — same renderer, same sanitisation.
    const read = vi.fn(async () => "Doc text\n\n<script>window.__pwned=1</script>");
    render(
      <CardDetail
        {...BASE}
        docNodes={[docNode("docs/product/prd.md", "prd.md", "Product")]}
        readDocAction={read}
      />,
    );
    fireEvent.click(screen.getAllByTestId("card-detail-docs-nav-item")[0] as HTMLElement);
    const reader = await screen.findByTestId("card-detail-doc-reader");
    await waitFor(() => expect(reader.querySelector(".pc-markdown")).not.toBeNull());
    expect(reader.querySelector("script")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// React key integrity — two FRD groups + repeated docs must not crash the rail
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL — multiple FRD groups / repeated docs (React key integrity)", () => {
  it("renders one section per FRD group without throwing, even with two groups present", () => {
    const docNodes: DocNode[] = [
      docNode("docs/frds/frd-01-auth/frd.md", "frd.md", "Feature: frd-01-auth"),
      docNode("docs/frds/frd-01-auth/blueprint.md", "blueprint.md", "Feature: frd-01-auth"),
      docNode("docs/frds/frd-02-billing/frd.md", "frd.md", "Feature: frd-02-billing"),
    ];
    expect(() => render(<CardDetail {...BASE} docNodes={docNodes} />)).not.toThrow();
    const sections = screen
      .getAllByTestId("card-detail-docs-nav-section")
      .map((s) => s.textContent);
    expect(sections).toEqual(expect.arrayContaining(["frd-01-auth", "frd-02-billing"]));
    // Two FRDs (frd.md ×2 + blueprint.md ×1) → three doc items, none crashing.
    expect(screen.getAllByTestId("card-detail-docs-nav-item")).toHaveLength(3);
  });

  it("a doc with an unknown filename keeps the filename as its label (no blank item)", () => {
    const docNodes: DocNode[] = [
      docNode("docs/frds/frd-09-x/notes.md", "notes.md", "Feature: frd-09-x"),
    ];
    render(<CardDetail {...BASE} docNodes={docNodes} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items).toHaveLength(1);
    expect((items[0]?.textContent ?? "").trim()).toContain("notes.md");
  });
});

// ---------------------------------------------------------------------------
// Lazy reader — no stale body flash when switching docs
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL — lazy reader resets content when switching docs", () => {
  it("after loading doc A, selecting doc B does not keep showing A's body", async () => {
    const read = vi.fn(async (_p: string, relPath: string) => `Body of ${relPath}`);
    const docNodes: DocNode[] = [
      docNode("docs/product/prd.md", "prd.md", "Product"),
      docNode("docs/product/research.md", "research.md", "Product"),
    ];
    render(<CardDetail {...BASE} docNodes={docNodes} readDocAction={read} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    // Select PRD first.
    fireEvent.click(items[0] as HTMLElement);
    const reader = await screen.findByTestId("card-detail-doc-reader");
    await waitFor(() => expect(reader).toHaveTextContent("docs/product/prd.md"));
    // Switch to Research — the PRD body must not linger.
    fireEvent.click(items[1] as HTMLElement);
    await waitFor(() => expect(reader).toHaveTextContent("docs/product/research.md"));
    expect(reader).not.toHaveTextContent("docs/product/prd.md");
  });
});

// ---------------------------------------------------------------------------
// slug data-binding — special characters must not break rendering
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL — slug with special characters", () => {
  it("renders without throwing when slug contains quotes / angle brackets", () => {
    expect(() => render(<CardDetail {...BASE} slug={'weird"slug<>&'} />)).not.toThrow();
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
  });
});
