import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "../Tabs";

const TABS = [
  { id: "a", label: "Alfa", icon: "check", tone: "teal" },
  { id: "b", label: "Beta" },
] as const;

function renderTabs(): void {
  render(<Tabs tabs={TABS} active="a" onChange={vi.fn()} />);
}

describe("Tabs independent review (WO-13-012)", () => {
  it("does not scroll the page to a strip that mounts below the fold", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    renderTabs();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("never references a panel the caller did not declare", () => {
    renderTabs();
    for (const tab of screen.getAllByRole("tab")) {
      const panel = tab.getAttribute("aria-controls");
      if (panel !== null) expect(document.getElementById(panel)).not.toBeNull();
    }
  });

  it("tints the selected icon through a selector that survives CSS-module scoping", () => {
    const css = readFileSync("src/components/core/Tabs/Tabs.module.css", "utf8");
    expect(css).not.toMatch(/\.tabs button(\[aria-selected="true"\])? \.i\b/);
    expect(css).toMatch(/\[aria-selected="true"\][^{]*\{\s*color: var\(--tone\)/);
  });
});
