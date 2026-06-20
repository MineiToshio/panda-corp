/**
 * WO-13-006 — Tabs / SubTabs (CMP-13-tabs) tests
 *
 * Acceptance criteria:
 *   AC-13-006.15  Renders a role="tablist" element.
 *   AC-13-006.16  Each tab has role="tab" and aria-selected.
 *   AC-13-006.17  Active tab has aria-selected="true"; others "false".
 *   AC-13-006.18  Clicking a tab calls onChange with its id.
 *   AC-13-006.19  Arrow-key navigation moves focus through tabs.
 *   AC-13-006.20  level="top" applies .tab visual class; level="sub" applies .stab.
 *   AC-13-006.21  data-testid="tabs-root" on root; "tab-<id>" on each tab button.
 *   AC-13-006.22  No hardcoded colors — CSS vars only.
 *   AC-13-006.23  SubTabs is a convenience alias for level="sub".
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubTabs, Tabs } from "../Tabs";

const SAMPLE_TABS = [
  { id: "inicio", label: "Inicio" },
  { id: "tablero", label: "Tablero" },
  { id: "portfolio", label: "Portfolio" },
];

describe("Tabs (CMP-13-tabs) — top level", () => {
  // AC-13-006.15: tablist role
  it("renders a role='tablist' element", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  // AC-13-006.16: each tab has role="tab"
  it("renders each tab with role='tab'", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  // AC-13-006.17: aria-selected
  it("marks active tab with aria-selected='true', others 'false'", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="tablero" onChange={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    const [inicio, tablero, portfolio] = tabs;
    expect(inicio).toHaveAttribute("aria-selected", "false");
    expect(tablero).toHaveAttribute("aria-selected", "true");
    expect(portfolio).toHaveAttribute("aria-selected", "false");
  });

  // AC-13-006.18: click calls onChange
  it("calls onChange with the tab id when clicked", () => {
    const onChange = vi.fn();
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("tab-tablero"));
    expect(onChange).toHaveBeenCalledWith("tablero");
  });

  // AC-13-006.19: arrow-key navigation — ArrowRight moves to next
  it("ArrowRight moves focus to the next tab", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    const tablist = screen.getByRole("tablist");
    const [first, second] = screen.getAllByRole("tab") as [HTMLElement, HTMLElement, HTMLElement];
    // Focus first tab, fire ArrowRight
    first.focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
  });

  it("ArrowLeft moves focus to the previous tab", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="tablero" onChange={vi.fn()} />);
    const tablist = screen.getByRole("tablist");
    const [first, second] = screen.getAllByRole("tab") as [HTMLElement, HTMLElement, HTMLElement];
    // Focus second tab, fire ArrowLeft
    second.focus();
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(first);
  });

  it("ArrowRight wraps to first tab from last", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="portfolio" onChange={vi.fn()} />);
    const tablist = screen.getByRole("tablist");
    const [first, , third] = screen.getAllByRole("tab") as [HTMLElement, HTMLElement, HTMLElement];
    third.focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(document.activeElement).toBe(first);
  });

  // AC-13-006.20: level="top" applies top-tab class
  it("applies 'tab-top' data-level attribute for level='top'", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    const root = screen.getByTestId("tabs-root");
    expect(root).toHaveAttribute("data-level", "top");
  });

  // AC-13-006.21: data-testid on root and tabs
  it("has data-testid='tabs-root' on root", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    expect(screen.getByTestId("tabs-root")).toBeInTheDocument();
  });

  it("has data-testid='tab-<id>' on each tab button", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    expect(screen.getByTestId("tab-inicio")).toBeInTheDocument();
    expect(screen.getByTestId("tab-tablero")).toBeInTheDocument();
    expect(screen.getByTestId("tab-portfolio")).toBeInTheDocument();
  });

  // AC-13-006.22: no hardcoded colors
  it("uses CSS custom properties — no bare hex in inline style", () => {
    render(<Tabs level="top" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    const root = screen.getByTestId("tabs-root");
    expect(root.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(root.outerHTML).not.toMatch(/\brgb\s*\(/);
  });
});

describe("Tabs (CMP-13-tabs) — sub level", () => {
  // AC-13-006.20: level="sub" applies sub-tab class
  it("applies 'sub' data-level attribute for level='sub'", () => {
    render(<Tabs level="sub" tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    const root = screen.getByTestId("tabs-root");
    expect(root).toHaveAttribute("data-level", "sub");
  });

  it("renders tabs with role='tab' for sub level", () => {
    render(<Tabs level="sub" tabs={SAMPLE_TABS} active="tablero" onChange={vi.fn()} />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("active sub-tab has aria-selected='true'", () => {
    render(<Tabs level="sub" tabs={SAMPLE_TABS} active="tablero" onChange={vi.fn()} />);
    expect(screen.getByTestId("tab-tablero")).toHaveAttribute("aria-selected", "true");
  });
});

describe("SubTabs convenience alias", () => {
  // AC-13-006.23: SubTabs is level="sub" alias
  it("renders SubTabs as a level=sub Tabs", () => {
    render(<SubTabs tabs={SAMPLE_TABS} active="inicio" onChange={vi.fn()} />);
    const root = screen.getByTestId("tabs-root");
    expect(root).toHaveAttribute("data-level", "sub");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});

describe("Tabs — optional icon on tabs", () => {
  it("renders icon class inside tab when icon provided", () => {
    const tabsWithIcons = [
      { id: "a", label: "Alpha", icon: "ti-bolt" },
      { id: "b", label: "Beta" },
    ];
    render(<Tabs level="sub" tabs={tabsWithIcons} active="a" onChange={vi.fn()} />);
    const tabA = screen.getByTestId("tab-a");
    expect(tabA.querySelector(".ti-bolt")).not.toBeNull();
  });
});

describe("Tabs — optional count badge on tab", () => {
  it("renders count inside tab when provided", () => {
    const tabsWithCount = [
      { id: "propuestas", label: "Propuestas", count: 5 },
      { id: "logros", label: "Logros" },
    ];
    render(<Tabs level="top" tabs={tabsWithCount} active="propuestas" onChange={vi.fn()} />);
    const tabBtn = screen.getByTestId("tab-propuestas");
    expect(tabBtn).toHaveTextContent("5");
  });
});
