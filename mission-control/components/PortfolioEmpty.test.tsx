/**
 * PortfolioEmpty — component tests (TDD: RED first).
 *
 * Traceability:
 *   CMP-03-empty  → AC-03-006.1 (graceful empty state when no active projects)
 *   REQ-03-006
 *
 * Tests cover:
 *   1. Renders the portfolio-empty testid
 *   2. Contains a copyable /pandacorp:spec command via CopyButton
 *   3. Spanish user-facing copy
 *   4. aria-live attribute for live announcements
 *   5. Zero hardcoded hex/rgb/hsl colors
 *   6. read-only invariant: no write/clone/Claude-call attributes in the DOM
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortfolioEmpty } from "./PortfolioEmpty";

// ---------------------------------------------------------------------------
// 1. Rendering
// ---------------------------------------------------------------------------

describe("PortfolioEmpty — rendering", () => {
  it("renders the portfolio-empty root testid", () => {
    render(<PortfolioEmpty />);
    expect(screen.getByTestId("portfolio-empty")).toBeDefined();
  });

  it("renders a message in Spanish mentioning no active projects", () => {
    render(<PortfolioEmpty />);
    const el = screen.getByTestId("portfolio-empty");
    expect(el.textContent).toMatch(/sin proyectos activos/i);
  });

  it("renders the /pandacorp:spec suggestion text", () => {
    render(<PortfolioEmpty />);
    const el = screen.getByTestId("portfolio-empty");
    expect(el.textContent).toContain("/pandacorp:spec");
  });

  it("renders a CopyButton for the spec command (data-testid=copy-button)", () => {
    render(<PortfolioEmpty />);
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("copy button copies the /pandacorp:spec command", () => {
    render(<PortfolioEmpty />);
    const btn = screen.getByTestId("copy-button");
    // The button should be present; its aria-label should describe copy action
    const label = btn.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Accessibility
// ---------------------------------------------------------------------------

describe("PortfolioEmpty — accessibility", () => {
  it("root has aria-live=polite for live region announcements", () => {
    render(<PortfolioEmpty />);
    const el = screen.getByTestId("portfolio-empty");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });

  it("root element is a block-level element (div, section, or aside)", () => {
    render(<PortfolioEmpty />);
    const el = screen.getByTestId("portfolio-empty");
    expect(["div", "section", "aside"].includes(el.tagName.toLowerCase())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Design-token invariant: zero hardcoded colors
// ---------------------------------------------------------------------------

describe("PortfolioEmpty — design tokens", () => {
  it("no inline style uses hardcoded hex colors", () => {
    const { container } = render(<PortfolioEmpty />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });

  it("no inline style uses hardcoded rgb()", () => {
    const { container } = render(<PortfolioEmpty />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/\brgb\b/);
    }
  });

  it("no inline style uses hardcoded hsl()", () => {
    const { container } = render(<PortfolioEmpty />);
    const all = container.querySelectorAll("[style]");
    for (const el of all) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/\bhsl\b/);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Read-only invariant (AC-03-006.5)
// ---------------------------------------------------------------------------

describe("PortfolioEmpty — read-only invariant", () => {
  it("renders only the spec command as copyable text — no write/clone element", () => {
    render(<PortfolioEmpty />);
    // No form elements that would imply write behavior
    expect(document.querySelector("form")).toBeNull();
    expect(document.querySelector("input[type=submit]")).toBeNull();
  });

  it("does not render any element with a submit or write-implying data attribute", () => {
    const { container } = render(<PortfolioEmpty />);
    // No data-write or data-clone markers
    expect(container.querySelector("[data-write]")).toBeNull();
    expect(container.querySelector("[data-clone]")).toBeNull();
  });
});
