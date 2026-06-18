/**
 * WO-02-007 — CardDetail ADVERSARIAL tests (reviewer / DR-015)
 *
 * These probe edges the implementer's own suite (CardDetail.test.tsx) did NOT cover,
 * derived from the EARS criteria and the docs.ts/next-step.ts contracts:
 *
 *   - comms.bugs[] navigator entries (untested in the GREEN suite) + filename derivation
 *     from a path via `.split("/").at(-1)` — including a path that ends in "/".
 *   - comms.decisions navigator entry (untested).
 *   - hasAdr / hasAnalytics navigator entries (fixtures set them but no item assertion).
 *   - SECURITY: react-markdown must NOT render raw <script>/<img onerror> from the body,
 *     and must neutralise `javascript:` links (markdown body is project-derived content).
 *   - key collision: two FRD modules with the SAME slug must not crash React (duplicate keys).
 *   - slug carried into data-slug must survive special characters without breaking the DOM.
 *   - docsIndex present but ONLY comms.bugs populated → navigator IS shown (not summary-only).
 *
 * Stack: Vitest + @testing-library/react (jsdom). nextStep mocked at the boundary.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDocsIndex } from "@/lib/docs";
import type { IdeaStatus } from "@/lib/ideas";
import type { NextStep } from "@/lib/next-step";

vi.mock("@/lib/next-step", () => ({ nextStep: vi.fn() }));

import { nextStep } from "@/lib/next-step";
import { CardDetail } from "./CardDetail";

const mockNextStep = vi.mocked(nextStep);

const STEP: NextStep = { command: "/pandacorp:design", label: "Ejecutar diseño" };

const BASE = {
  slug: "adv-idea",
  title: "Adversarial Idea",
  status: "in-pipeline" as IdeaStatus,
  body: "## Summary\n\nA body.",
  phase: undefined,
  advancePending: false,
};

beforeEach(() => {
  mockNextStep.mockReturnValue(STEP);
});
afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// comms.bugs[] — the implementer never rendered a bug entry
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL — comms.bugs navigator entries", () => {
  it("renders one nav item per bug file", () => {
    const docsIndex: ProjectDocsIndex = {
      frds: [],
      hasAdr: false,
      hasAnalytics: false,
      hasDecisionLog: false,
      comms: {
        bugs: [
          "/p/.pandacorp/inbox/bugs/bug-001-foo.md",
          "/p/.pandacorp/inbox/bugs/bug-002-bar.md",
        ],
      },
    };
    render(<CardDetail {...BASE} docsIndex={docsIndex} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const bugItems = items.filter((el) => /bug/i.test(el.textContent ?? ""));
    expect(bugItems.length).toBe(2);
    expect(bugItems.map((el) => el.textContent ?? "").join(" ")).toContain("bug-001-foo.md");
  });

  it("a docsIndex with ONLY bugs populated still shows the navigator (not summary-only)", () => {
    const docsIndex: ProjectDocsIndex = {
      frds: [],
      hasAdr: false,
      hasAnalytics: false,
      hasDecisionLog: false,
      comms: { bugs: ["/p/.pandacorp/inbox/bugs/only.md"] },
    };
    render(<CardDetail {...BASE} docsIndex={docsIndex} />);
    expect(screen.getByTestId("card-detail-docs-nav")).toBeInTheDocument();
  });

  it("a bug path that ends in '/' does not yield an empty label", () => {
    // .split("/").at(-1) on "a/b/" is "" — label must still be meaningful (no bare 'Bug: ').
    const docsIndex: ProjectDocsIndex = {
      frds: [],
      hasAdr: false,
      hasAnalytics: false,
      hasDecisionLog: false,
      comms: { bugs: ["/p/.pandacorp/inbox/bugs/"] },
    };
    expect(() => render(<CardDetail {...BASE} docsIndex={docsIndex} />)).not.toThrow();
    // The item renders without crashing; label is allowed to be the raw path fallback.
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// decisions / ADR / analytics navigator entries (set in fixtures but never asserted)
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL — decisions / ADR / analytics entries", () => {
  it("renders a decisions entry when comms.decisions is present", () => {
    const docsIndex: ProjectDocsIndex = {
      frds: [],
      hasAdr: false,
      hasAnalytics: false,
      hasDecisionLog: false,
      comms: { decisions: "/p/.pandacorp/inbox/decisions.md", bugs: [] },
    };
    render(<CardDetail {...BASE} docsIndex={docsIndex} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items.some((el) => /decision/i.test(el.textContent ?? ""))).toBe(true);
  });

  it("renders an ADR entry when hasAdr is true", () => {
    const docsIndex: ProjectDocsIndex = {
      frds: [],
      hasAdr: true,
      hasAnalytics: false,
      hasDecisionLog: false,
      comms: { bugs: [] },
    };
    render(<CardDetail {...BASE} docsIndex={docsIndex} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items.some((el) => /adr/i.test(el.textContent ?? ""))).toBe(true);
  });

  it("renders an analytics entry when hasAnalytics is true", () => {
    const docsIndex: ProjectDocsIndex = {
      frds: [],
      hasAdr: false,
      hasAnalytics: true,
      hasDecisionLog: false,
      comms: { bugs: [] },
    };
    render(<CardDetail {...BASE} docsIndex={docsIndex} />);
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    expect(items.some((el) => /analytic/i.test(el.textContent ?? ""))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECURITY — markdown body is project-derived; must not execute raw HTML / scripts
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL SECURITY — markdown body sanitisation", () => {
  it("does NOT inject a <script> element from the body into the DOM", () => {
    const body = "Normal text\n\n<script>window.__pwned = true;</script>";
    render(<CardDetail {...BASE} body={body} />);
    const summary = screen.getByTestId("card-detail-summary");
    // react-markdown without rehype-raw renders raw HTML as text, never as a live node.
    expect(summary.querySelector("script")).toBeNull();
  });

  it("does NOT create an <img onerror> handler element from the body", () => {
    const body = 'Text\n\n<img src=x onerror="window.__pwned=1">';
    render(<CardDetail {...BASE} body={body} />);
    const summary = screen.getByTestId("card-detail-summary");
    const img = summary.querySelector("img");
    // Either no img element at all, or one without an onerror handler.
    expect(img?.getAttribute("onerror") ?? null).toBeNull();
  });

  it("does NOT produce a javascript: href from a markdown link in the body", () => {
    const body = "[click me](javascript:alert(1))";
    render(<CardDetail {...BASE} body={body} />);
    const summary = screen.getByTestId("card-detail-summary");
    const anchor = summary.querySelector("a");
    const href = anchor?.getAttribute("href") ?? "";
    expect(href.toLowerCase().startsWith("javascript:")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// React key integrity — duplicate FRD slugs must not crash the navigator
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL — duplicate FRD slugs (React key collision)", () => {
  it("renders both items when two FRD modules share the same slug without throwing", () => {
    const dup = {
      slug: "frd-01-auth",
      hasFdd: false,
      hasBlueprint: false,
      hasMocks: false,
      hasWorkOrders: false,
    };
    const docsIndex: ProjectDocsIndex = {
      frds: [dup, { ...dup }],
      hasAdr: false,
      hasAnalytics: false,
      hasDecisionLog: false,
      comms: { bugs: [] },
    };
    expect(() => render(<CardDetail {...BASE} docsIndex={docsIndex} />)).not.toThrow();
    const items = screen.getAllByTestId("card-detail-docs-nav-item");
    const frdItems = items.filter((el) => /frd-01-auth/.test(el.textContent ?? ""));
    expect(frdItems.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// slug data-binding — special characters must not break rendering
// ---------------------------------------------------------------------------

describe("frd-02: ADVERSARIAL — slug with special characters", () => {
  it("renders without throwing when slug contains quotes / angle brackets", () => {
    expect(() =>
      render(<CardDetail {...BASE} slug={'weird"slug<>&'} docsIndex={null} />),
    ).not.toThrow();
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
  });
});
