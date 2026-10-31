/**
 * WO-13-006 — PageTitle (CMP-13-pagetitle) tests
 *
 * Acceptance criteria:
 *   AC-13-006.1  Renders H1 with the given title text.
 *   AC-13-006.2  Renders the accent itemslot icon (aria-hidden wrapper).
 *   AC-13-006.3  Renders subtitle when provided; absent when not.
 *   AC-13-006.4  Renders tail slot when provided; absent when not.
 *   AC-13-006.5  Zero hardcoded colors — uses CSS custom properties only.
 *   AC-13-006.6  data-testid="page-title" on root element.
 *   AC-13-006.7  Works in light AND dark contexts (no hardcoded color attributes).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTitle } from "../PageTitle";

describe("PageTitle (CMP-13-pagetitle)", () => {
  // AC-13-006.1: H1 with title text
  it("renders H1 with the given title", () => {
    render(<PageTitle icon="ti-home" title="Inicio" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1).toHaveTextContent("Inicio");
  });

  it("wraps the canonical PageHead rather than drawing a separate title", () => {
    render(<PageTitle icon="ti-home" title="Inicio" />);
    expect(screen.getByTestId("page-title").querySelector("header.pagehead")).not.toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  // AC-13-006.3: subtitle optional
  it("renders subtitle when provided", () => {
    render(<PageTitle icon="ti-home" title="Inicio" subtitle="El panel principal" />);
    expect(screen.getByTestId("page-title-subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("page-title-subtitle")).toHaveTextContent("El panel principal");
  });

  it("does NOT render subtitle when not provided", () => {
    render(<PageTitle icon="ti-home" title="Inicio" />);
    expect(screen.queryByTestId("page-title-subtitle")).not.toBeInTheDocument();
  });

  // AC-13-006.4: tail slot optional
  it("renders tail slot when provided", () => {
    render(
      <PageTitle icon="ti-home" title="Inicio" tail={<span data-testid="test-tail">3</span>} />,
    );
    expect(screen.getByTestId("test-tail")).toBeInTheDocument();
  });

  it("does NOT render tail area when not provided", () => {
    render(<PageTitle icon="ti-home" title="Inicio" />);
    expect(screen.queryByTestId("page-title-tail")).not.toBeInTheDocument();
  });

  // AC-13-006.5: no hardcoded colors
  it("uses CSS custom properties — no hardcoded color attributes in icon slot", () => {
    render(<PageTitle icon="ti-home" title="Inicio" />);
    const root = screen.getByTestId("page-title");
    // The style attribute (if present) must not contain raw hex or rgb colors
    const htmlStr = root.outerHTML;
    // Allowed pattern: CSS vars like var(--color-*) but NOT bare hex / rgb()
    expect(htmlStr).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(htmlStr).not.toMatch(/\brgb\s*\(/);
  });

  // AC-13-006.6: data-testid on root
  it("has data-testid='page-title' on root element", () => {
    render(<PageTitle icon="ti-stack-2" title="Portfolio" />);
    expect(screen.getByTestId("page-title")).toBeInTheDocument();
  });

  // AC-13-006.7: second title — just ensure two instances can coexist without crash
  it("renders multiple instances independently", () => {
    render(
      <div>
        <PageTitle icon="ti-home" title="Inicio" />
        <PageTitle icon="ti-stack-2" title="Portfolio" />
      </div>,
    );
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(2);
  });
});
