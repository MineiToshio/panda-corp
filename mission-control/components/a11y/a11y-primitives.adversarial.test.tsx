/**
 * WO-13-003 — ADVERSARIAL review tests (reviewer, opus).
 *
 * These probe edges the implementer's own RED suite did NOT cover, derived from
 * AC-13-003.1 / AC-13-008.1 and the WO scope ("Focus-ring utility respecting
 * border-radius"), not from what is already green.
 *
 * Findings under test:
 *   F1 (blocking) — FOCUS_RING_CLASS = "focus-ring" points at a class that is
 *      NOT defined in app/globals.css. The implementer's tests only assert the
 *      string is non-empty and matches /focus|ring/ and that classList contains
 *      it — they never assert the class resolves to any CSS rule. Applying
 *      className="focus-ring" therefore yields NO focus ring. The WO scope
 *      required a "Focus-ring utility"; the constant doc claims it is used for
 *      "programmatic focus … applied explicitly on elements that need the ring
 *      outside :focus-visible context" — that path is dead.
 *
 *   F2 — useKeyboardNav ref/state desync when `count` shrinks at runtime
 *      (dynamic list). The indexRef is seeded once from the initial count and is
 *      never reconciled when count changes, so selectedIndex can point past the
 *      end of a shrunk list.
 *
 *   F3 — imperative data-selected vs React aria-activedescendant consistency:
 *      after a keydown the hot-path writes the container attribute imperatively;
 *      the item aria-selected must still agree after React flushes.
 */

import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { FOCUS_RING_CLASS } from "@/components/a11y";
import { useKeyboardNav } from "@/components/a11y/useKeyboardNav";

const GLOBALS_CSS = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../app/globals.css"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// F1 — FOCUS_RING_CLASS must resolve to an actual CSS rule (not a dead string)
// ---------------------------------------------------------------------------
describe("ADVERSARIAL F1: FOCUS_RING_CLASS resolves to a real CSS rule", () => {
  it("globals.css defines a `.focus-ring` class selector matching FOCUS_RING_CLASS", () => {
    // The constant is "focus-ring". A consumer that does className={FOCUS_RING_CLASS}
    // expects a visible ring. If no `.focus-ring { … }` rule exists, the class is dead.
    const selector = `.${FOCUS_RING_CLASS}`;
    // Tolerant match: `.focus-ring` possibly followed by whitespace/comma/`:`/`{`.
    const hasRule = new RegExp(`\\${selector}(\\s|,|:|\\{)`.replace("\\.", "\\.")).test(
      GLOBALS_CSS,
    );
    expect(
      hasRule,
      `globals.css has no "${selector}" rule — className={FOCUS_RING_CLASS} produces no focus ring. ` +
        "Either define `.focus-ring { outline: var(--focus-ring); outline-offset: 2px; border-radius: var(--radius); }` " +
        "in globals.css, or remove FOCUS_RING_CLASS and rely solely on :focus-visible.",
    ).toBe(true);
  });

  it("the focus-ring rule (if present) respects border-radius (AC-13-008.1: ring must respect border-radius)", () => {
    const idx = GLOBALS_CSS.indexOf(`.${FOCUS_RING_CLASS}`);
    if (idx === -1) {
      // Surfaced by the test above as the primary failure; do not double-count here.
      return;
    }
    const block = GLOBALS_CSS.slice(idx, idx + 240);
    expect(
      /border-radius/.test(block),
      "the `.focus-ring` rule must set border-radius so the ring respects the element shape (AC-13-008.1).",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F2 — dynamic count shrink: selectedIndex must not point past the new end
// ---------------------------------------------------------------------------
function ShrinkableNavHost() {
  const [n, setN] = useState(5);
  const { selectedIndex, listProps, getItemProps } = useKeyboardNav({ count: n });
  return (
    <div>
      <button type="button" data-testid="shrink" onClick={() => setN(2)}>
        shrink
      </button>
      <ul {...listProps} data-testid="nav-list" data-selected={selectedIndex} data-count={n}>
        {Array.from({ length: n }, (_, i) => {
          const label = `shrink-item-${i}`;
          return (
            <li key={label} {...getItemProps(i)} data-testid={`item-${i}`}>
              Item {i}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

describe("ADVERSARIAL F2: useKeyboardNav reconciles when count shrinks", () => {
  it("after moving to the end and shrinking the list, selectedIndex stays within bounds", () => {
    render(<ShrinkableNavHost />);
    const list = screen.getByTestId("nav-list");
    // Move to the last item of the 5-element list.
    fireEvent.keyDown(list, { key: "End" });
    expect(list.getAttribute("data-selected")).toBe("4");
    // Shrink to 2 items (valid indices 0..1).
    fireEvent.click(screen.getByTestId("shrink"));
    const selected = Number(list.getAttribute("data-selected"));
    expect(
      selected,
      "selectedIndex must not exceed count-1 after the list shrinks (stale ref / no clamp on count change).",
    ).toBeLessThanOrEqual(1);
    expect(selected).toBeGreaterThanOrEqual(0);
  });

  it("after shrinking, the next ArrowDown does not produce an out-of-range index", () => {
    render(<ShrinkableNavHost />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "End" }); // index 4
    fireEvent.click(screen.getByTestId("shrink")); // now count=2
    fireEvent.keyDown(list, { key: "ArrowDown" });
    const selected = Number(list.getAttribute("data-selected"));
    expect(selected).toBeLessThanOrEqual(1);
    expect(selected).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// F3 — imperative container attr and React item aria-selected must agree
// ---------------------------------------------------------------------------
function AriaNavHost() {
  const items = ["A", "B", "C", "D"];
  const { selectedIndex, listProps, getItemProps } = useKeyboardNav({ count: items.length });
  return (
    <ul {...listProps} data-testid="nav-list" data-selected={selectedIndex}>
      {items.map((it, i) => (
        <li key={it} {...getItemProps(i)} data-testid={`item-${i}`}>
          {it}
        </li>
      ))}
    </ul>
  );
}

describe("ADVERSARIAL F3: aria-activedescendant points at the aria-selected item", () => {
  it("after ArrowDown twice, the container aria-activedescendant id equals the selected item id", () => {
    render(<AriaNavHost />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    const activeDesc = list.getAttribute("aria-activedescendant");
    const selectedItem = screen.getByTestId("item-2");
    expect(selectedItem.getAttribute("aria-selected")).toBe("true");
    expect(
      activeDesc,
      "aria-activedescendant must reference the id of the aria-selected item (consistent AT wiring).",
    ).toBe(selectedItem.getAttribute("id"));
  });

  it("exactly one item has aria-selected=true at a time", () => {
    render(<AriaNavHost />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    const selectedCount = [0, 1, 2, 3]
      .map((i) => screen.getByTestId(`item-${i}`).getAttribute("aria-selected"))
      .filter((v) => v === "true").length;
    expect(selectedCount).toBe(1);
  });
});
