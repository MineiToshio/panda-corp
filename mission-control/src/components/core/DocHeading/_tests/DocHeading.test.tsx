/**
 * WO-13-007 — DocHeading (CMP-13-docheading) — TDD tests
 *
 * Reading heading: accent ledge + title (docH).
 * Aliases: docH.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocHeading, type DocHeadingProps } from "@/components/core/DocHeading/DocHeading";

function renderHeading(props: DocHeadingProps) {
  return render(<DocHeading {...props} />);
}

describe("frd-13/wo-13-007: DocHeading — rendering", () => {
  it("frd-13: DocHeading — renders title text", () => {
    renderHeading({ title: "Guía de inicio rápido" });
    expect(screen.getByText("Guía de inicio rápido")).toBeDefined();
  });

  it("frd-13: DocHeading — has data-testid='doc-heading'", () => {
    renderHeading({ title: "Título" });
    expect(screen.getByTestId("doc-heading")).toBeDefined();
  });

  it("frd-13: DocHeading — default level is h2", () => {
    renderHeading({ title: "Título" });
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
  });

  it("frd-13: DocHeading — level=1 renders h1", () => {
    renderHeading({ title: "Título principal", level: 1 });
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });

  it("frd-13: DocHeading — level=3 renders h3", () => {
    renderHeading({ title: "Sub-sección", level: 3 });
    expect(screen.getByRole("heading", { level: 3 })).toBeDefined();
  });
});

describe("frd-13/wo-13-007: DocHeading — accent ledge", () => {
  it("frd-13: DocHeading — renders accent ledge element", () => {
    renderHeading({ title: "Con acento" });
    expect(screen.getByTestId("doc-heading-ledge")).toBeDefined();
  });
});

describe("frd-13/wo-13-007: DocHeading — tokens only", () => {
  it("frd-13: DocHeading — inline style uses var() not hardcoded hex", () => {
    const { container } = renderHeading({ title: "Tokens" });
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No element");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
