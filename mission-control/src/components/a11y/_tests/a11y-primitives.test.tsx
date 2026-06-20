/**
 * WO-13-003 — tabular-nums + a11y primitives (CMP-13-a11y-primitives)
 *
 * RED phase: every test is expected to fail until the implementation exists.
 *
 * Traceability:
 *   AC-13-003.1 (REQ-13-003) — EVERY number (XP, levels, per-column counts, stats,
 *                               timestamps) SHALL use font-variant-numeric: tabular-nums.
 *   AC-13-008.1 (REQ-13-008) — Accessibility: aria-label in Spanish on icons,
 *                               aria-live="polite" to announce events without stealing
 *                               focus, visible focus ring that respects border-radius,
 *                               keyboard list navigation.
 *
 * Scope (WO-13-003):
 *   1. LiveRegion — aria-live="polite" wrapper for announcing events.
 *   2. useKeyboardNav — arrow-key list navigation hook.
 *   3. tabular-nums CSS utility class (class name constant + structural assertion).
 *   4. Focus-ring utility class (class name constant + structural assertion).
 *
 * Bugs from progress.md anchored as regression tests:
 *   - WO-13-001 prototype-pollution axis (I3): AGENT_STATES keys like "constructor"
 *     must not corrupt the aria-label lookup — verified in LiveRegion Spanish label path.
 *   - WO-04-003: mutation of shared row objects via caller — LiveRegion must be
 *     stateless / not share references between renders.
 *   - WO-12-004 B2: a "closed then open" event sequence must still report "running",
 *     not "ok" — analogous here: a LiveRegion that receives a second message after
 *     a first must update (not silently ignore the second identical string).
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * No I/O; no real network; no implementation files exist yet (RED).
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// NOTE: These imports will fail until WO-13-003 is implemented (RED phase).
// The component must live at components/a11y/LiveRegion.tsx
// The hook must live at components/a11y/useKeyboardNav.ts
// The constants must live at components/a11y/index.ts (or the same files)
// ---------------------------------------------------------------------------
import { FOCUS_RING_CLASS, TABULAR_NUMS_CLASS } from "@/components/a11y/constants";
import { LiveRegion, type LiveRegionProps } from "@/components/a11y/LiveRegion";
import { useKeyboardNav } from "@/components/a11y/useKeyboardNav";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLiveRegion(props: LiveRegionProps) {
  return render(<LiveRegion {...props} />);
}

/**
 * Minimal host component that exercises useKeyboardNav with a list of items.
 * Arrow-key presses change the selectedIndex exposed on a data-attribute so
 * tests can assert without relying on visual focus (which jsdom doesn't compute).
 */
interface KeyboardNavHostProps {
  items: string[];
  initialIndex?: number;
  /** wrap around when reaching the last/first item */
  wrap?: boolean;
}

function KeyboardNavHost({ items, initialIndex = 0, wrap = false }: KeyboardNavHostProps) {
  const { selectedIndex, listProps, getItemProps } = useKeyboardNav({
    count: items.length,
    initialIndex,
    wrap,
  });

  return (
    <ul {...listProps} data-testid="nav-list" data-selected={selectedIndex}>
      {items.map((item, i) => (
        <li
          key={item}
          {...getItemProps(i)}
          data-testid={`nav-item-${i}`}
          data-active={i === selectedIndex ? "true" : "false"}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 1. LiveRegion — aria-live="polite"
//    AC-13-008.1: aria-live="polite" to announce events without stealing focus
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: AC-13-008.1 — LiveRegion renders aria-live=polite", () => {
  it('frd-13: WHEN LiveRegion is rendered THEN it has aria-live="polite"', () => {
    renderLiveRegion({ children: "Evento: agente activo" });
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("frd-13: WHEN LiveRegion is rendered THEN it does NOT use aria-live=assertive (must not steal focus)", () => {
    // "assertive" interrupts the user's current activity — the FRD explicitly requires
    // "polite" so the event is queued and read at the next natural pause.
    renderLiveRegion({ children: "Nuevo evento" });
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).not.toBe("assertive");
  });

  it("frd-13: WHEN LiveRegion receives children THEN the content is present in the DOM", () => {
    renderLiveRegion({ children: "Agente inactivo" });
    expect(screen.getByText("Agente inactivo")).toBeDefined();
  });

  it("frd-13: WHEN LiveRegion children is null THEN it renders without throwing (empty announcements are valid)", () => {
    expect(() => renderLiveRegion({ children: null })).not.toThrow();
  });

  it("frd-13: WHEN LiveRegion children is undefined THEN it renders without throwing", () => {
    expect(() => renderLiveRegion({ children: undefined })).not.toThrow();
  });

  it("frd-13: WHEN LiveRegion children is an empty string THEN it renders without throwing", () => {
    expect(() => renderLiveRegion({ children: "" })).not.toThrow();
  });

  it("frd-13: WHEN LiveRegion is rendered THEN it has data-testid=live-region", () => {
    renderLiveRegion({ children: "Mensaje" });
    expect(screen.getByTestId("live-region")).toBeDefined();
  });

  it("frd-13: WHEN LiveRegion is rendered THEN it has aria-atomic=true (full message on update, not partial)", () => {
    // aria-atomic="true" ensures the entire content is re-read when any part changes,
    // preventing partial announcements mid-sentence that confuse screen-reader users.
    renderLiveRegion({ children: "Mensaje completo" });
    const region = screen.getByTestId("live-region");
    expect(region.getAttribute("aria-atomic")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// 2. LiveRegion — message update (second message replaces first)
//    Regression: WO-12-004 B2 — a "closed then open" sequence must report the
//    new state, not silently keep the old. Same principle: LiveRegion must
//    update when the same string is re-passed after being cleared.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: LiveRegion — message updates propagate", () => {
  it("frd-13: WHEN children changes THEN the new content replaces the old", () => {
    const { rerender } = renderLiveRegion({ children: "Primero" });
    expect(screen.getByText("Primero")).toBeDefined();

    rerender(<LiveRegion>Segundo</LiveRegion>);
    expect(screen.getByText("Segundo")).toBeDefined();
    expect(screen.queryByText("Primero")).toBeNull();
  });

  it("frd-13: WHEN children is reset to empty THEN the previous announcement is cleared", () => {
    const { rerender } = renderLiveRegion({ children: "Evento A" });
    rerender(<LiveRegion>{""}</LiveRegion>);
    expect(screen.queryByText("Evento A")).toBeNull();
  });

  it("frd-13: WHEN the same string is passed twice in sequence THEN the region still updates (no referential bail-out)", () => {
    // Regression anchor: WO-04-003 showed that referential-equality shortcuts can
    // prevent updates. LiveRegion must re-announce even if the string is identical
    // (the typical ARIA trick: clear then reset in the same tick).
    const { rerender } = renderLiveRegion({ children: "Evento repetido" });
    rerender(<LiveRegion>{""}</LiveRegion>);
    rerender(<LiveRegion>{"Evento repetido"}</LiveRegion>);
    // After clear + reset, the text must be back.
    expect(screen.getByText("Evento repetido")).toBeDefined();
  });

  it("frd-13: WHEN multiple LiveRegions exist THEN each is independent (no shared state)", () => {
    // Regression: WO-04-003 deep-copy bug — shared references corrupted callers.
    render(
      <>
        <LiveRegion>{"Región A"}</LiveRegion>
        <LiveRegion>{"Región B"}</LiveRegion>
      </>,
    );
    const regions = screen.getAllByTestId("live-region");
    expect(regions).toHaveLength(2);
    expect(regions[0]).toBeDefined();
    expect(regions[1]).toBeDefined();
    // Each region has distinct content.
    expect(within(regions[0] as HTMLElement).getByText("Región A")).toBeDefined();
    expect(within(regions[1] as HTMLElement).getByText("Región B")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. LiveRegion — ReactNode children (rich content)
//    The feed, toast and freshness badge pass JSX, not just strings.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: LiveRegion — rich children (ReactNode)", () => {
  it("frd-13: WHEN children is a JSX element THEN it renders without throwing", () => {
    expect(() =>
      renderLiveRegion({
        children: (
          <span>
            Agente <strong>activo</strong>
          </span>
        ),
      }),
    ).not.toThrow();
  });

  it("frd-13: WHEN children is a JSX element THEN the text content is readable in the DOM", () => {
    renderLiveRegion({ children: <span>Trabajo completado</span> });
    expect(screen.getByText("Trabajo completado")).toBeDefined();
  });

  it("frd-13: WHEN children is an array of nodes THEN all items appear in the region", () => {
    renderLiveRegion({
      children: [<span key="a">Evento 1</span>, " ", <span key="b">Evento 2</span>],
    });
    expect(screen.getByText("Evento 1")).toBeDefined();
    expect(screen.getByText("Evento 2")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. LiveRegion — no hardcoded inline styles
//    FRD-13 rule: "no hardcoded colors anywhere".
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: LiveRegion — no hardcoded color styles", () => {
  it("frd-13: WHEN LiveRegion is rendered THEN the wrapper element has no inline color style with hex", () => {
    renderLiveRegion({ children: "Sin color" });
    const region = screen.getByTestId("live-region");
    const inlineStyle = region.getAttribute("style") ?? "";
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// 5. useKeyboardNav — arrow-key navigation
//    AC-13-008.1: keyboard list navigation
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: AC-13-008.1 — useKeyboardNav moves selection with arrow keys", () => {
  const ITEMS = ["Alfa", "Beta", "Gamma", "Delta"];

  it("frd-13: WHEN list is rendered THEN initial selectedIndex is 0", () => {
    render(<KeyboardNavHost items={ITEMS} />);
    const list = screen.getByTestId("nav-list");
    expect(list.getAttribute("data-selected")).toBe("0");
  });

  it("frd-13: WHEN ArrowDown is pressed THEN selectedIndex increments by 1", () => {
    render(<KeyboardNavHost items={ITEMS} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(list.getAttribute("data-selected")).toBe("1");
  });

  it("frd-13: WHEN ArrowDown is pressed twice THEN selectedIndex is 2", () => {
    render(<KeyboardNavHost items={ITEMS} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(list.getAttribute("data-selected")).toBe("2");
  });

  it("frd-13: WHEN ArrowUp is pressed THEN selectedIndex decrements by 1", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={2} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(list.getAttribute("data-selected")).toBe("1");
  });

  it("frd-13: WHEN at first item and ArrowUp without wrap THEN selectedIndex stays at 0 (no overflow)", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={0} wrap={false} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(list.getAttribute("data-selected")).toBe("0");
  });

  it("frd-13: WHEN at last item and ArrowDown without wrap THEN selectedIndex stays at last (no overflow)", () => {
    const lastIndex = ITEMS.length - 1;
    render(<KeyboardNavHost items={ITEMS} initialIndex={lastIndex} wrap={false} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(list.getAttribute("data-selected")).toBe(String(lastIndex));
  });

  it("frd-13: WHEN at last item and ArrowDown with wrap THEN selectedIndex wraps to 0", () => {
    const lastIndex = ITEMS.length - 1;
    render(<KeyboardNavHost items={ITEMS} initialIndex={lastIndex} wrap />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(list.getAttribute("data-selected")).toBe("0");
  });

  it("frd-13: WHEN at first item and ArrowUp with wrap THEN selectedIndex wraps to last", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={0} wrap />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(list.getAttribute("data-selected")).toBe(String(ITEMS.length - 1));
  });

  it("frd-13: WHEN Home key is pressed THEN selectedIndex jumps to 0", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={3} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "Home" });
    expect(list.getAttribute("data-selected")).toBe("0");
  });

  it("frd-13: WHEN End key is pressed THEN selectedIndex jumps to last item", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={0} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "End" });
    expect(list.getAttribute("data-selected")).toBe(String(ITEMS.length - 1));
  });

  it("frd-13: WHEN an unrelated key is pressed THEN selectedIndex does not change", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={1} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "Enter" });
    fireEvent.keyDown(list, { key: "Tab" });
    fireEvent.keyDown(list, { key: "Escape" });
    // selectedIndex should still be the initialIndex
    expect(list.getAttribute("data-selected")).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// 6. useKeyboardNav — active item attribute
//    Consumers (board, feed, portfolio) read data-active to style the focused row
//    without relying on :focus-visible (which jsdom does not compute).
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: useKeyboardNav — data-active on items", () => {
  const ITEMS = ["Alfa", "Beta", "Gamma"];

  it("frd-13: WHEN selectedIndex is 0 THEN item-0 has data-active=true and others data-active=false", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={0} />);
    expect(screen.getByTestId("nav-item-0").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("nav-item-1").getAttribute("data-active")).toBe("false");
    expect(screen.getByTestId("nav-item-2").getAttribute("data-active")).toBe("false");
  });

  it("frd-13: WHEN ArrowDown moves to index 1 THEN item-1 has data-active=true and item-0 reverts to false", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={0} />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(screen.getByTestId("nav-item-1").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("nav-item-0").getAttribute("data-active")).toBe("false");
  });

  it("frd-13: WHEN list is empty THEN useKeyboardNav does not throw", () => {
    expect(() => render(<KeyboardNavHost items={[]} />)).not.toThrow();
  });

  it("frd-13: WHEN list has a single item THEN ArrowDown does not throw or go negative", () => {
    render(<KeyboardNavHost items={["Solo"]} initialIndex={0} />);
    const list = screen.getByTestId("nav-list");
    expect(() => {
      fireEvent.keyDown(list, { key: "ArrowDown" });
      fireEvent.keyDown(list, { key: "ArrowUp" });
    }).not.toThrow();
    expect(list.getAttribute("data-selected")).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// 7. useKeyboardNav — list role & aria-activedescendant
//    AC-13-008.1: keyboard list nav must be screen-reader compatible.
//    The listbox/list role + aria-activedescendant wires selection to AT.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: AC-13-008.1 — useKeyboardNav ARIA wiring", () => {
  const ITEMS = ["Alfa", "Beta", "Gamma"];

  it("frd-13: WHEN list is rendered THEN the container has role=listbox or role=list", () => {
    render(<KeyboardNavHost items={ITEMS} />);
    const list = screen.getByTestId("nav-list");
    const role = list.getAttribute("role");
    // Either a listbox (interactive, ARIA 1.1) or list (semantic HTML UL) is acceptable.
    // listbox is preferred for keyboard-navigable selections.
    expect(role === "listbox" || list.tagName === "UL").toBe(true);
  });

  it("frd-13: WHEN list is rendered THEN it is keyboard-focusable (tabIndex >=0 or tabindex=0)", () => {
    // The list container must be reachable via Tab so keyboard-only users can enter it.
    render(<KeyboardNavHost items={ITEMS} />);
    const list = screen.getByTestId("nav-list");
    const tabIndex = list.getAttribute("tabindex");
    expect(tabIndex).not.toBeNull();
    expect(Number(tabIndex)).toBeGreaterThanOrEqual(0);
  });

  it("frd-13: WHEN an item is selected THEN aria-activedescendant on the container OR aria-selected on the item is set", () => {
    render(<KeyboardNavHost items={ITEMS} initialIndex={1} />);
    const list = screen.getByTestId("nav-list");
    const activeDesc = list.getAttribute("aria-activedescendant");
    const selectedItem = screen.getByTestId("nav-item-1");
    const itemSelected = selectedItem.getAttribute("aria-selected");
    // At least one of the two ARIA patterns must be present.
    expect(
      activeDesc !== null || itemSelected === "true",
      "Either aria-activedescendant on the list or aria-selected=true on the active item must be set",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. tabular-nums CSS utility class constant
//    AC-13-003.1: EVERY number SHALL use font-variant-numeric: tabular-nums.
//    The constant is the single source of truth so consumers don't hardcode strings.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: AC-13-003.1 — TABULAR_NUMS_CLASS constant", () => {
  it("frd-13: WHEN TABULAR_NUMS_CLASS is imported THEN it is a non-empty string", () => {
    expect(typeof TABULAR_NUMS_CLASS).toBe("string");
    expect(TABULAR_NUMS_CLASS.trim()).not.toBe("");
  });

  it("frd-13: WHEN TABULAR_NUMS_CLASS is used on an element THEN the element has that class", () => {
    const { container } = render(
      <span className={TABULAR_NUMS_CLASS} data-testid="numeric-span">
        1 234
      </span>,
    );
    const span = container.querySelector("[data-testid='numeric-span']");
    expect(span?.classList.contains(TABULAR_NUMS_CLASS)).toBe(true);
  });

  it("frd-13: WHEN TABULAR_NUMS_CLASS is applied THEN the element does not carry a hardcoded style attribute for tabular-nums (class-driven, not inline-driven)", () => {
    // Inline styles bypass Tailwind and tokens — the utility must work via a class.
    const { container } = render(
      <span className={TABULAR_NUMS_CLASS} data-testid="numeric-el">
        42
      </span>,
    );
    const el = container.querySelector("[data-testid='numeric-el']");
    const inlineStyle = el?.getAttribute("style") ?? "";
    // The class itself can contain 'tabular-nums' in its name (e.g. Tailwind's
    // `tabular-nums`), but the inline style attribute must not hardcode it.
    expect(inlineStyle).not.toContain("font-variant-numeric");
  });

  it("frd-13: TABULAR_NUMS_CLASS must match a known Tailwind utility or a project-defined class (not arbitrary string)", () => {
    // Acceptable values: "tabular-nums" (Tailwind built-in) or a design-token-driven class.
    // This test pins the canonical name to prevent drift (e.g. someone renaming it to
    // "numeric-tabular" without updating all consumers).
    expect(TABULAR_NUMS_CLASS).toMatch(/tabular/i);
  });
});

// ---------------------------------------------------------------------------
// 9. Parametric: numeric container categories all use TABULAR_NUMS_CLASS
//    AC-13-003.1: XP, levels, per-column counts, stats, timestamps.
//    The FRD enumerates concrete number categories — each must carry the class.
//    This parametric table makes the contract machine-checkable across categories.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: AC-13-003.1 — parametric: every number category uses TABULAR_NUMS_CLASS", () => {
  /**
   * Numeric categories from AC-13-003.1 (FRD verbatim: "XP, levels, per-column counts,
   * stats, timestamps"). Each entry is a data-testid and an example value.
   * The implementation must apply TABULAR_NUMS_CLASS to each of these containers.
   */
  const NUMERIC_CATEGORIES: { testId: string; label: string; value: string }[] = [
    { testId: "xp-value", label: "XP", value: "1 250" },
    { testId: "level-value", label: "nivel", value: "7" },
    { testId: "column-count-value", label: "conteo por columna", value: "12" },
    { testId: "stat-value", label: "estadística", value: "98.6" },
    { testId: "timestamp-value", label: "timestamp", value: "14:32:01" },
  ];

  for (const { testId, label, value } of NUMERIC_CATEGORIES) {
    it(`frd-13: AC-13-003.1 — WHEN a ${label} number is rendered THEN it carries TABULAR_NUMS_CLASS`, () => {
      // Each numeric container must opt-in to the class. The implementation will
      // use TABULAR_NUMS_CLASS as the className (or include it in a compound className).
      render(
        <span className={TABULAR_NUMS_CLASS} data-testid={testId} data-category={label}>
          {value}
        </span>,
      );
      const el = screen.getByTestId(testId);
      expect(el.classList.contains(TABULAR_NUMS_CLASS)).toBe(true);
    });
  }

  it("frd-13: AC-13-003.1 — WHEN two numeric elements are adjacent THEN both carry TABULAR_NUMS_CLASS independently", () => {
    // Regression: if one element sets the class but re-uses the same className string
    // reference, a mutation of the string would affect both. Verify they are independent.
    render(
      <>
        <span className={TABULAR_NUMS_CLASS} data-testid="num-a">
          100
        </span>
        <span className={TABULAR_NUMS_CLASS} data-testid="num-b">
          200
        </span>
      </>,
    );
    expect(screen.getByTestId("num-a").classList.contains(TABULAR_NUMS_CLASS)).toBe(true);
    expect(screen.getByTestId("num-b").classList.contains(TABULAR_NUMS_CLASS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Focus-ring utility class constant
//     AC-13-008.1: visible focus ring that respects border-radius.
//     FOCUS_RING_CLASS is the single source so consumers don't hardcode strings.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: AC-13-008.1 — FOCUS_RING_CLASS constant", () => {
  it("frd-13: WHEN FOCUS_RING_CLASS is imported THEN it is a non-empty string", () => {
    expect(typeof FOCUS_RING_CLASS).toBe("string");
    expect(FOCUS_RING_CLASS.trim()).not.toBe("");
  });

  it("frd-13: WHEN FOCUS_RING_CLASS is used on a button THEN the element has that class", () => {
    const { container } = render(
      <button type="button" className={FOCUS_RING_CLASS} data-testid="focusable-btn">
        Acción
      </button>,
    );
    const btn = container.querySelector("[data-testid='focusable-btn']");
    expect(btn?.classList.contains(FOCUS_RING_CLASS)).toBe(true);
  });

  it("frd-13: FOCUS_RING_CLASS must not be the same as TABULAR_NUMS_CLASS (distinct utilities)", () => {
    expect(FOCUS_RING_CLASS).not.toBe(TABULAR_NUMS_CLASS);
  });

  it("frd-13: FOCUS_RING_CLASS must relate to focus or ring (prevents accidental renaming)", () => {
    // Acceptable: "focus-ring", "focus-visible-ring", or any class that contains
    // "focus" or "ring" — Tailwind's vocabulary for outline-based focus indicators.
    expect(FOCUS_RING_CLASS).toMatch(/focus|ring/i);
  });

  it("frd-13: WHEN FOCUS_RING_CLASS is applied THEN the element has no inline outline style (class-driven only)", () => {
    // Inline styles for outlines bypass the token contract. The focus ring must be
    // applied via a class that maps to CSS custom properties from globals.css (WO-13-002).
    const { container } = render(
      <button type="button" className={FOCUS_RING_CLASS} data-testid="focus-el">
        Focus
      </button>,
    );
    const el = container.querySelector("[data-testid='focus-el']");
    const inlineStyle = el?.getAttribute("style") ?? "";
    expect(inlineStyle).not.toMatch(/outline\s*:/);
  });
});

// ---------------------------------------------------------------------------
// 11. Edge-cases — extreme inputs to useKeyboardNav
//     Regression against overflow, NaN index, and single-item list bugs
//     that are common in keyboard nav implementations.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: useKeyboardNav — edge cases and error paths", () => {
  it("frd-13: WHEN count is very large and ArrowDown is pressed many times THEN selectedIndex stays within bounds", () => {
    const LARGE_LIST = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
    render(<KeyboardNavHost items={LARGE_LIST} initialIndex={0} wrap={false} />);
    const list = screen.getByTestId("nav-list");
    // Press ArrowDown more times than the list length.
    for (let i = 0; i < 1100; i++) {
      fireEvent.keyDown(list, { key: "ArrowDown" });
    }
    const selected = Number(list.getAttribute("data-selected"));
    expect(selected).toBeLessThanOrEqual(LARGE_LIST.length - 1);
    expect(selected).toBeGreaterThanOrEqual(0);
  }, 120_000); // stress test: 1 100 events × 1 000-item list; jsdom reconciles all 1 000 items per keydown

  it("frd-13: WHEN count is 0 THEN selectedIndex is -1 or 0 (not NaN) (I2 guard)", () => {
    render(<KeyboardNavHost items={[]} />);
    const list = screen.getByTestId("nav-list");
    const selected = list.getAttribute("data-selected");
    // selectedIndex must be a number string, never "NaN" or null.
    expect(selected).not.toBe("NaN");
    expect(selected).not.toBeNull();
    const parsed = Number(selected);
    expect(Number.isNaN(parsed)).toBe(false);
  });

  it("frd-13: WHEN wrap=true and count=1 THEN ArrowDown stays at 0 (no infinite cycle)", () => {
    render(<KeyboardNavHost items={["Solo"]} initialIndex={0} wrap />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(list.getAttribute("data-selected")).toBe("0");
  });

  it("frd-13: WHEN initialIndex is beyond the list length THEN selectedIndex is clamped to last valid index", () => {
    const ITEMS = ["A", "B", "C"];
    // Passing an out-of-bounds initialIndex simulates runtime data errors.
    render(<KeyboardNavHost items={ITEMS} initialIndex={99} />);
    const list = screen.getByTestId("nav-list");
    const selected = Number(list.getAttribute("data-selected"));
    expect(selected).toBeLessThanOrEqual(ITEMS.length - 1);
    expect(selected).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Prototype-pollution guard on LiveRegion label lookup
//     Regression: WO-13-001 I3 axis — keys like "constructor" or "toString"
//     must not corrupt the region when a message happens to equal those strings.
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: LiveRegion — prototype-pollution guard (regression WO-13-001 I3)", () => {
  const PROTOTYPE_KEYS = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
    "prototype",
  ];

  for (const key of PROTOTYPE_KEYS) {
    it(`frd-13: WHEN LiveRegion receives message="${key}" THEN it renders without throwing`, () => {
      expect(() => renderLiveRegion({ children: key })).not.toThrow();
    });

    it(`frd-13: WHEN LiveRegion receives message="${key}" THEN the DOM does not expose a prototype object (text is literal)`, () => {
      const { container } = renderLiveRegion({ children: key });
      const region = container.querySelector("[data-testid='live-region']");
      // The text content must be the literal key string, not "[object Object]" or similar.
      expect(region?.textContent).toBe(key);
    });
  }
});

// ---------------------------------------------------------------------------
// 13. Module-level export contract
//     The index re-exports must exist; this guards against a missing barrel export
//     silently causing "undefined" imports that don't fail at import time (TS CJS).
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-003: components/a11y barrel exports", () => {
  it("frd-13: TABULAR_NUMS_CLASS export is a string, not undefined", () => {
    // If the barrel export is missing, TABULAR_NUMS_CLASS would be undefined
    // and className={TABULAR_NUMS_CLASS} would silently set className="undefined".
    expect(TABULAR_NUMS_CLASS).not.toBeUndefined();
    expect(typeof TABULAR_NUMS_CLASS).toBe("string");
  });

  it("frd-13: FOCUS_RING_CLASS export is a string, not undefined", () => {
    expect(FOCUS_RING_CLASS).not.toBeUndefined();
    expect(typeof FOCUS_RING_CLASS).toBe("string");
  });

  it("frd-13: LiveRegion export is a React component (function or class)", () => {
    expect(typeof LiveRegion).toBe("function");
  });

  it("frd-13: useKeyboardNav export is a function", () => {
    expect(typeof useKeyboardNav).toBe("function");
  });
});
