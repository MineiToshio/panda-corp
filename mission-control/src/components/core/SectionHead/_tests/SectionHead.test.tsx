/**
 * WO-13-006 — SectionHead (CMP-13-sectionhead) tests
 *
 * Acceptance criteria:
 *   AC-13-006.8   Renders label in display-font style.
 *   AC-13-006.9   Renders trailing rule (the 1px separator line).
 *   AC-13-006.10  Renders count when provided; absent when not.
 *   AC-13-006.11  Renders optional icon; absent when not.
 *   AC-13-006.12  Renders rightHtml slot when provided; absent when not.
 *   AC-13-006.13  data-testid="section-head" on root.
 *   AC-13-006.14  No hardcoded colors — CSS vars only.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHead } from "../SectionHead";

describe("SectionHead (CMP-13-sectionhead)", () => {
  // AC-13-006.8: label text visible
  it("renders the label text", () => {
    render(<SectionHead label="Tu turno" />);
    expect(screen.getByText("Tu turno")).toBeInTheDocument();
  });

  // AC-13-006.9: trailing rule (ln element)
  it("renders a trailing horizontal rule element", () => {
    render(<SectionHead label="Pulso" />);
    const root = screen.getByTestId("section-head");
    // The rule is a non-semantic separator div/span with role presentation or aria-hidden
    const rule = root.querySelector("[data-testid='section-head-rule']");
    expect(rule).not.toBeNull();
  });

  // AC-13-006.10: count optional
  it("renders count when provided", () => {
    render(<SectionHead label="Logros" count={7} />);
    expect(screen.getByTestId("section-head-count")).toBeInTheDocument();
    expect(screen.getByTestId("section-head-count")).toHaveTextContent("7");
  });

  it("does NOT render count element when not provided", () => {
    render(<SectionHead label="Logros" />);
    expect(screen.queryByTestId("section-head-count")).not.toBeInTheDocument();
  });

  // AC-13-006.11: optional icon
  it("renders icon when provided", () => {
    render(<SectionHead label="En la fábrica" icon="ti-building-castle" />);
    const root = screen.getByTestId("section-head");
    const icon = root.querySelector(".ti-building-castle");
    expect(icon).not.toBeNull();
  });

  it("does NOT render icon element when not provided", () => {
    render(<SectionHead label="Sin icono" />);
    const root = screen.getByTestId("section-head");
    // No .ti class present when no icon given
    const tiIcons = root.querySelectorAll("[class*='ti-']");
    expect(tiIcons).toHaveLength(0);
  });

  // AC-13-006.12: rightHtml slot
  it("renders rightHtml slot content when provided", () => {
    render(
      <SectionHead label="Con badge" rightHtml={<span data-testid="right-slot">badge</span>} />,
    );
    expect(screen.getByTestId("right-slot")).toBeInTheDocument();
  });

  it("does NOT render rightHtml container when not provided", () => {
    render(<SectionHead label="Sin badge" />);
    expect(screen.queryByTestId("section-head-right")).not.toBeInTheDocument();
  });

  // AC-13-006.13: data-testid on root
  it("has data-testid='section-head' on root", () => {
    render(<SectionHead label="Construcción" />);
    expect(screen.getByTestId("section-head")).toBeInTheDocument();
  });

  // AC-13-006.14: no hardcoded colors
  it("uses CSS custom properties — no bare hex colors in style attribute", () => {
    render(<SectionHead label="Test" icon="ti-flame" count={3} />);
    const root = screen.getByTestId("section-head");
    expect(root.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(root.outerHTML).not.toMatch(/\brgb\s*\(/);
  });
});
