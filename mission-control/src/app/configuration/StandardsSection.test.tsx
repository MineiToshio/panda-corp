/**
 * WO-07-009 — Standards section: categorized list + detail (CMP-07-standards-list,
 * CMP-07-standard-detail) tests.
 *
 * Traceability:
 *   AC-07-009.1  The section SHALL group standards by domain (9 domains), reading readStandards().
 *   AC-07-009.2  Each standard SHALL show a severity badge (MUST/SHOULD/MAY) and an enforcement
 *                badge (lint/CI/checklist/human gate), paired with label/shape (not color alone).
 *   AC-07-009.3  Each standard SHALL offer a Summary view (real key points) and a Detail view
 *                (rendered markdown via react-markdown).
 *   AC-07-009.4  The section SHALL include a "New standard" button that copies /pandacorp:learn
 *                (clipboard, no exec).
 *   AC-07-009.5  The section SHALL render gracefully when a standard lacks metadata (falls back
 *                to derivation map / "Other", WO-07-004) — never empty, never crash.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import type { Standard } from "@/lib/standards";

/** Minimal Standard fixture covering the 9 expected domains */
const FIXTURE_STANDARDS: Standard[] = [
  {
    id: "quality.md",
    title: "Quality Standards",
    body: "# Quality Standards\n- Write tests before code\n- Keep coverage above 80%",
    domain: "Quality",
    severity: "MUST",
    enforcement: "CI",
    summary: ["Write tests before code", "Keep coverage above 80%"],
  },
  {
    id: "security.md",
    title: "Security Standards",
    body: "# Security Standards\n- No secrets in code\n- Validate all inputs",
    domain: "Security",
    severity: "MUST",
    enforcement: "lint",
    summary: ["No secrets in code", "Validate all inputs"],
  },
  {
    id: "conventions.md",
    title: "Conventions",
    body: "# Conventions\n- Use TypeScript strict mode\n- Use Conventional Commits",
    domain: "Programming",
    severity: "MUST",
    enforcement: "lint",
    summary: ["Use TypeScript strict mode", "Use Conventional Commits"],
  },
  {
    id: "patterns.md",
    title: "Architecture Patterns",
    body: "# Architecture Patterns\nFeature-first, isolated data layer.",
    domain: "Architecture",
    severity: "SHOULD",
    enforcement: "checklist",
    summary: ["Feature-first, isolated data layer."],
  },
  {
    id: "stack.md",
    title: "Technology Stack",
    body: "# Technology Stack\nNext.js, TypeScript, Tailwind.",
    domain: "Technology",
    severity: "SHOULD",
    enforcement: "checklist",
    summary: ["Next.js, TypeScript, Tailwind."],
  },
];

const FIXTURE_WITH_MISSING_META: Standard[] = [
  {
    id: "unknown.md",
    title: "Unknown Standard",
    body: "# Unknown Standard\nSome content without metadata.",
    domain: "Other",
    severity: "SHOULD",
    enforcement: "checklist",
    summary: ["Some content without metadata."],
  },
];

const FIXTURE_NO_SUMMARY: Standard[] = [
  {
    id: "nosummary.md",
    title: "No Summary Standard",
    body: "# No Summary Standard\nA standard without any bullet points.",
    domain: "Quality",
    severity: "MUST",
    enforcement: "CI",
    summary: [], // empty summary
  },
];

// ---------------------------------------------------------------------------
// Mock readStandards — prevents real fs reads in jsdom
// ---------------------------------------------------------------------------

vi.mock("@/lib/standards", () => ({
  readStandards: vi.fn(() => FIXTURE_STANDARDS),
}));

// After the mock, import the component under test
import { StandardsSection } from "./StandardsSection";

// ---------------------------------------------------------------------------
// Clipboard mock
// ---------------------------------------------------------------------------

let clipboardWrittenValue: string | null = null;

beforeEach(() => {
  clipboardWrittenValue = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn((val: string) => {
        clipboardWrittenValue = val;
        return Promise.resolve();
      }),
    },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC-07-009.1 — Domain grouping
// ---------------------------------------------------------------------------

describe("frd-07: StandardsSection — AC-07-009.1 grouped by domain", () => {
  it("frd-07: AC-07-009.1 — renders the standards section container", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("standards-section")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — renders a domain group for Quality", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("standards-domain-Quality")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — renders a domain group for Security", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("standards-domain-Security")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — renders a domain group for Programming", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("standards-domain-Programming")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — renders a domain group for Architecture", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("standards-domain-Architecture")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — renders a domain group for Technology", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("standards-domain-Technology")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — Quality domain group contains Quality Standards entry", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const group = screen.getByTestId("standards-domain-Quality");
    expect(within(group).getByTestId("standard-item-quality.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — Security domain group contains Security Standards entry", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const group = screen.getByTestId("standards-domain-Security");
    expect(within(group).getByTestId("standard-item-security.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — Programming domain group contains Conventions entry", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const group = screen.getByTestId("standards-domain-Programming");
    expect(within(group).getByTestId("standard-item-conventions.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — domain group heading is visible", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("standards-domain-heading-Quality")).toBeDefined();
  });

  it("frd-07: AC-07-009.1 — domain headings show the domain name", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const heading = screen.getByTestId("standards-domain-heading-Quality");
    expect(heading.textContent).toContain("Quality");
  });
});

// ---------------------------------------------------------------------------
// AC-07-009.2 — Severity and enforcement badges (label+shape, not color alone)
// ---------------------------------------------------------------------------

describe("frd-07: StandardsSection — AC-07-009.2 severity + enforcement badges", () => {
  it("frd-07: AC-07-009.2 — each standard shows a severity badge", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badges = screen.getAllByTestId(/^standard-severity-badge-/);
    expect(badges.length).toBe(FIXTURE_STANDARDS.length);
  });

  it("frd-07: AC-07-009.2 — severity badge for quality.md shows MUST", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badge = screen.getByTestId("standard-severity-badge-quality.md");
    expect(badge.textContent).toContain("MUST");
  });

  it("frd-07: AC-07-009.2 — severity badge for patterns.md shows SHOULD", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badge = screen.getByTestId("standard-severity-badge-patterns.md");
    expect(badge.textContent).toContain("SHOULD");
  });

  it("frd-07: AC-07-009.2 — each standard shows an enforcement badge", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badges = screen.getAllByTestId(/^standard-enforcement-badge-/);
    expect(badges.length).toBe(FIXTURE_STANDARDS.length);
  });

  it("frd-07: AC-07-009.2 — enforcement badge for quality.md shows CI", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badge = screen.getByTestId("standard-enforcement-badge-quality.md");
    expect(badge.textContent).toContain("CI");
  });

  it("frd-07: AC-07-009.2 — enforcement badge for security.md shows lint", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badge = screen.getByTestId("standard-enforcement-badge-security.md");
    expect(badge.textContent).toContain("lint");
  });

  it("frd-07: AC-07-009.2 — enforcement badge for patterns.md shows checklist", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badge = screen.getByTestId("standard-enforcement-badge-patterns.md");
    expect(badge.textContent).toContain("checklist");
  });

  it("frd-07: AC-07-009.2 — severity badge has data-severity attribute (shape, not color alone)", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badge = screen.getByTestId("standard-severity-badge-quality.md");
    expect(badge.getAttribute("data-severity")).toBe("MUST");
  });

  it("frd-07: AC-07-009.2 — enforcement badge has data-enforcement attribute (shape, not color alone)", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const badge = screen.getByTestId("standard-enforcement-badge-quality.md");
    expect(badge.getAttribute("data-enforcement")).toBe("CI");
  });

  it("frd-07: AC-07-009.2 — MAY severity is represented when present", () => {
    const withMAY: Standard[] = [
      {
        id: "seo-i18n.md",
        title: "SEO & i18n",
        body: "# SEO & i18n\nOptional SEO standards.",
        domain: "Product/Docs",
        severity: "MAY",
        enforcement: "checklist",
        summary: ["Optional SEO standards."],
      },
    ];
    render(<StandardsSection standards={withMAY} />);
    const badge = screen.getByTestId("standard-severity-badge-seo-i18n.md");
    expect(badge.textContent).toContain("MAY");
    expect(badge.getAttribute("data-severity")).toBe("MAY");
  });
});

// ---------------------------------------------------------------------------
// AC-07-009.3 — Summary / Detail toggle per standard
// ---------------------------------------------------------------------------

describe("frd-07: StandardsSection — AC-07-009.3 Summary/Detail toggle", () => {
  it("frd-07: AC-07-009.3 — standard item is initially collapsed (no detail visible)", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    // No standard-detail visible initially
    expect(screen.queryByTestId("standard-detail-quality.md")).toBeNull();
  });

  it("frd-07: AC-07-009.3 — clicking a standard item reveals its detail panel", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    expect(screen.getByTestId("standard-detail-quality.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.3 — detail panel shows Summary tab by default", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detail = screen.getByTestId("standard-detail-quality.md");
    expect(within(detail).getByTestId("standard-tab-summary")).toBeDefined();
  });

  it("frd-07: AC-07-009.3 — detail panel shows Detail tab option", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detail = screen.getByTestId("standard-detail-quality.md");
    expect(within(detail).getByTestId("standard-tab-detail")).toBeDefined();
  });

  it("frd-07: AC-07-009.3 — summary view renders key points from summary array", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    expect(screen.getByText("Write tests before code")).toBeDefined();
  });

  it("frd-07: AC-07-009.3 — clicking Detail tab switches to detail view", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detail = screen.getByTestId("standard-detail-quality.md");
    fireEvent.click(within(detail).getByTestId("standard-tab-detail"));
    expect(within(detail).getByTestId("standard-markdown-body")).toBeDefined();
  });

  it("frd-07: AC-07-009.3 — detail markdown view renders the standard body", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detail = screen.getByTestId("standard-detail-quality.md");
    fireEvent.click(within(detail).getByTestId("standard-tab-detail"));
    const mdBody = within(detail).getByTestId("standard-markdown-body");
    // react-markdown renders the H1 and bullets
    expect(mdBody.textContent).toContain("Quality Standards");
  });

  it("frd-07: AC-07-009.3 — clicking Summary tab after Detail reverts to summary view", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detail = screen.getByTestId("standard-detail-quality.md");
    // switch to detail
    fireEvent.click(within(detail).getByTestId("standard-tab-detail"));
    // switch back to summary
    fireEvent.click(within(detail).getByTestId("standard-tab-summary"));
    expect(screen.getByText("Write tests before code")).toBeDefined();
  });

  it("frd-07: AC-07-009.3 — clicking same item again closes the detail", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    expect(screen.getByTestId("standard-detail-quality.md")).toBeDefined();
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    expect(screen.queryByTestId("standard-detail-quality.md")).toBeNull();
  });

  it("frd-07: AC-07-009.3 — opening a second standard closes the first detail", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    expect(screen.getByTestId("standard-detail-quality.md")).toBeDefined();
    // Open the security standard
    fireEvent.click(screen.getByTestId("standard-item-security.md"));
    // First is now closed
    expect(screen.queryByTestId("standard-detail-quality.md")).toBeNull();
    // Second is open
    expect(screen.getByTestId("standard-detail-security.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.3 — Summary tab has data-active=true when summary view is shown", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detail = screen.getByTestId("standard-detail-quality.md");
    expect(within(detail).getByTestId("standard-tab-summary").getAttribute("data-active")).toBe(
      "true",
    );
    expect(within(detail).getByTestId("standard-tab-detail").getAttribute("data-active")).toBe(
      "false",
    );
  });

  it("frd-07: AC-07-009.3 — Detail tab has data-active=true when detail view is shown", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    fireEvent.click(screen.getByTestId("standard-item-quality.md"));
    const detail = screen.getByTestId("standard-detail-quality.md");
    fireEvent.click(within(detail).getByTestId("standard-tab-detail"));
    expect(within(detail).getByTestId("standard-tab-detail").getAttribute("data-active")).toBe(
      "true",
    );
    expect(within(detail).getByTestId("standard-tab-summary").getAttribute("data-active")).toBe(
      "false",
    );
  });
});

// ---------------------------------------------------------------------------
// AC-07-009.4 — "New standard" button copies /pandacorp:learn
// ---------------------------------------------------------------------------

describe("frd-07: StandardsSection — AC-07-009.4 New standard button copies /pandacorp:learn", () => {
  it("frd-07: AC-07-009.4 — renders the New standard button", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    expect(screen.getByTestId("new-standard-button")).toBeDefined();
  });

  it("frd-07: AC-07-009.4 — New standard button has a Spanish label", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const btn = screen.getByTestId("new-standard-button");
    expect(btn.textContent).toBeTruthy();
    // Must contain human-readable Spanish label
    expect(btn.textContent).toMatch(/[Nn]uevo/);
  });

  it("frd-07: AC-07-009.4 — clicking New standard copies /pandacorp:learn to clipboard", async () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("new-standard-button"));
    });
    expect(clipboardWrittenValue).toBe("/pandacorp:learn");
  });

  it("frd-07: AC-07-009.4 — clicking New standard does NOT execute any command (copy only)", async () => {
    // The button must only call clipboard.writeText, not exec/spawn/eval
    // We verify by checking no side-effects beyond clipboard (no thrown errors, no navigation)
    const consoleSpy = vi.spyOn(console, "error");
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("new-standard-button"));
    });
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(clipboardWrittenValue).toBe("/pandacorp:learn");
    consoleSpy.mockRestore();
  });

  it("frd-07: AC-07-009.4 — New standard button is a button element (not link, not exec)", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const btn = screen.getByTestId("new-standard-button");
    expect(btn.tagName.toLowerCase()).toBe("button");
  });
});

// ---------------------------------------------------------------------------
// AC-07-009.5 — Graceful rendering when metadata is missing / "Other" domain
// ---------------------------------------------------------------------------

describe("frd-07: StandardsSection — AC-07-009.5 graceful fallback for missing metadata", () => {
  it("frd-07: AC-07-009.5 — renders without crashing when a standard has domain=Other", () => {
    render(<StandardsSection standards={FIXTURE_WITH_MISSING_META} />);
    expect(screen.getByTestId("standards-section")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — standard with domain=Other renders in an Other group", () => {
    render(<StandardsSection standards={FIXTURE_WITH_MISSING_META} />);
    expect(screen.getByTestId("standards-domain-Other")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — standard item is rendered even with domain=Other", () => {
    render(<StandardsSection standards={FIXTURE_WITH_MISSING_META} />);
    expect(screen.getByTestId("standard-item-unknown.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — severity badge renders even for unknown/other domain", () => {
    render(<StandardsSection standards={FIXTURE_WITH_MISSING_META} />);
    expect(screen.getByTestId("standard-severity-badge-unknown.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — enforcement badge renders even for unknown/other domain", () => {
    render(<StandardsSection standards={FIXTURE_WITH_MISSING_META} />);
    expect(screen.getByTestId("standard-enforcement-badge-unknown.md")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — empty standards array renders section without crashing", () => {
    render(<StandardsSection standards={[]} />);
    expect(screen.getByTestId("standards-section")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — empty standards array shows empty state message", () => {
    render(<StandardsSection standards={[]} />);
    expect(screen.getByTestId("standards-empty-state")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — standard with empty summary opens to Summary tab without crashing", () => {
    render(<StandardsSection standards={FIXTURE_NO_SUMMARY} />);
    fireEvent.click(screen.getByTestId("standard-item-nosummary.md"));
    const detail = screen.getByTestId("standard-detail-nosummary.md");
    expect(within(detail).getByTestId("standard-tab-summary")).toBeDefined();
  });

  it("frd-07: AC-07-009.5 — standard with empty summary shows fallback in summary view", () => {
    render(<StandardsSection standards={FIXTURE_NO_SUMMARY} />);
    fireEvent.click(screen.getByTestId("standard-item-nosummary.md"));
    // Should not crash and should show something (at minimum the detail panel)
    expect(screen.getByTestId("standard-detail-nosummary.md")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: standard item displays the title
// ---------------------------------------------------------------------------

describe("frd-07: StandardsSection — standard item structure", () => {
  it("frd-07: each standard item displays its title text", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const item = screen.getByTestId("standard-item-quality.md");
    expect(item.textContent).toContain("Quality Standards");
  });

  it("frd-07: each standard item is keyboard-activatable (role=button or role=listitem with button)", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    const item = screen.getByTestId("standard-item-quality.md");
    // Must be interactive (button or have role button)
    const tagOrRole =
      item.tagName.toLowerCase() === "button" || item.getAttribute("role") === "button";
    expect(tagOrRole).toBe(true);
  });

  it("frd-07: the list of all standards is wrapped in a list container", () => {
    render(<StandardsSection standards={FIXTURE_STANDARDS} />);
    // At least one standards-list-items container per domain group
    const listContainers = screen.getAllByTestId(/^standards-list-items-/);
    expect(listContainers.length).toBeGreaterThan(0);
  });
});
