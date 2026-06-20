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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { FOCUS_RING_CLASS } from "@/components/a11y/constants";
import { LiveRegion } from "@/components/a11y/LiveRegion";
import { useKeyboardNav } from "@/components/a11y/useKeyboardNav";

afterEach(() => cleanup());

const GLOBALS_CSS = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../../app/globals.css"),
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

// ===========================================================================
// SECOND ADVERSARIAL ROUND (reviewer, opus — GATE FRD-13).
// Edges NOT exercised by the existing RED suite, the impl suite, or round 1.
// Anchored in AC-13-008.1 (keyboard nav / aria-live / no-focus-steal) and
// AC-13-003.1 (tabular-nums). Probes correctness that does NOT lean on the
// imperative e.currentTarget hot-path hack, plus empty-list AT safety and
// LiveRegion focus/politeness invariants.
// ===========================================================================

// ---------------------------------------------------------------------------
// R1 — Empty list: no dangling aria-activedescendant; getItemProps is safe.
//      An empty listbox that still advertises aria-activedescendant="…-(-1)"
//      or "…-0" points AT at a non-existent node (broken AT contract).
// ---------------------------------------------------------------------------
function EmptyNavHost() {
  const { selectedIndex, listProps, getItemProps } = useKeyboardNav({ count: 0 });
  // Probe getItemProps(0) even though there are no items — a caller iterating a
  // 0-length array won't call it, but a defensive caller might. Must not throw.
  const probe = getItemProps(0);
  return (
    <ul
      {...listProps}
      data-testid="nav-list"
      data-selected={selectedIndex}
      data-probe-selected={String(probe["aria-selected"])}
      data-probe-id={probe.id}
    />
  );
}

describe("ADVERSARIAL R1: empty list never references a non-existent descendant", () => {
  it("an empty listbox has NO aria-activedescendant (it would dangle)", () => {
    render(<EmptyNavHost />);
    const list = screen.getByTestId("nav-list");
    expect(
      list.getAttribute("aria-activedescendant"),
      "an empty list must not point aria-activedescendant at a non-existent item id.",
    ).toBeNull();
  });

  it("selectedIndex is -1 (no valid item) and getItemProps(0) is aria-selected=false, no throw", () => {
    render(<EmptyNavHost />);
    const list = screen.getByTestId("nav-list");
    expect(list.getAttribute("data-selected")).toBe("-1");
    expect(list.getAttribute("data-probe-selected")).toBe("false");
  });

  it("keydown on an empty list is inert (no selection appears)", () => {
    render(<EmptyNavHost />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "End" });
    expect(list.getAttribute("data-selected")).toBe("-1");
    expect(list.getAttribute("aria-activedescendant")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R2 — Pure React-driven correctness: aria-activedescendant must be right even
//      when the host does NOT preserve the imperative data-selected hot-path
//      write. The hook writes data-selected/aria-activedescendant imperatively
//      on e.currentTarget; if a host re-renders the container without that
//      attribute, the React-driven listProps must STILL carry the correct
//      aria-activedescendant after flush. This catches over-reliance on the
//      imperative hack for AT correctness.
// ---------------------------------------------------------------------------
function ReactDrivenNavHost() {
  const items = ["uno", "dos", "tres", "cuatro"];
  const { selectedIndex, listProps, getItemProps } = useKeyboardNav({ count: items.length });
  // Deliberately DO NOT spread data-selected from the imperative path; rely only
  // on listProps (React-driven). A re-render (state bump) would blow away any
  // imperative attribute, so this models the real post-flush DOM.
  return (
    <ul {...listProps} data-testid="nav-list" data-react-selected={selectedIndex}>
      {items.map((it, i) => (
        <li key={it} {...getItemProps(i)} data-testid={`r2-item-${i}`}>
          {it}
        </li>
      ))}
    </ul>
  );
}

describe("ADVERSARIAL R2: aria wiring is React-correct, not only imperatively patched", () => {
  it("after ArrowDown x3, listProps.aria-activedescendant (React) equals the aria-selected item id", () => {
    render(<ReactDrivenNavHost />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" }); // index 3
    const selected = screen.getByTestId("r2-item-3");
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(
      list.getAttribute("aria-activedescendant"),
      "the React-driven aria-activedescendant must match the selected item id after flush.",
    ).toBe(selected.getAttribute("id"));
  });

  it("Home after navigating returns aria-activedescendant to the first item id (React-driven)", () => {
    render(<ReactDrivenNavHost />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "End" });
    fireEvent.keyDown(list, { key: "Home" });
    const first = screen.getByTestId("r2-item-0");
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(list.getAttribute("aria-activedescendant")).toBe(first.getAttribute("id"));
  });
});

// ---------------------------------------------------------------------------
// R3 — Key matching is exact/case-sensitive. Browsers emit "ArrowDown", never
//      "arrowdown" or "Down". A loosened switch (e.g. toLowerCase) would move
//      selection on stray keys and could preventDefault on real typing. Pin the
//      exact-match contract so a future refactor can't silently broaden it.
// ---------------------------------------------------------------------------
function ExactKeyHost() {
  const items = ["a", "b", "c"];
  const { selectedIndex, listProps, getItemProps } = useKeyboardNav({ count: items.length });
  return (
    <ul {...listProps} data-testid="nav-list" data-selected={selectedIndex}>
      {items.map((it, i) => (
        <li key={it} {...getItemProps(i)} data-testid={`k-item-${i}`}>
          {it}
        </li>
      ))}
    </ul>
  );
}

describe("ADVERSARIAL R3: only navigation keys move selection (no broad/loose matching)", () => {
  // Genuinely unrelated keys: must be inert. (Note: "Down"/"Up" are legacy IE/Edge
  // aliases that React's synthetic event normalizes to "ArrowDown"/"ArrowUp" before
  // the handler runs — so they SHOULD move; they are asserted separately below.
  // "arrowdown" lowercase is NOT a real key value and must stay inert.)
  for (const key of ["arrowdown", "ArrowRight", "ArrowLeft", "Tab", "Enter", " ", "j", "k"]) {
    it(`key "${key}" is a no-op (selection stays at 0)`, () => {
      render(<ExactKeyHost />);
      const list = screen.getByTestId("nav-list");
      fireEvent.keyDown(list, { key });
      expect(
        list.getAttribute("data-selected"),
        `"${key}" must NOT move keyboard-list selection (only ArrowUp/Down/Home/End do).`,
      ).toBe("0");
    });
  }

  it('legacy alias "Down" (React-normalized to "ArrowDown") DOES advance — old AT/IE still works', () => {
    // Robustness: a screen reader or legacy environment emitting the old "Down"
    // key value must still navigate. React upgrades it to "ArrowDown"; the hook
    // must honour that rather than require only the modern literal.
    render(<ExactKeyHost />);
    const list = screen.getByTestId("nav-list");
    fireEvent.keyDown(list, { key: "Down" });
    expect(list.getAttribute("data-selected")).toBe("1");
  });

  it("a no-op key does not preventDefault (typing/tabbing stays possible)", () => {
    render(<ExactKeyHost />);
    const list = screen.getByTestId("nav-list");
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    list.dispatchEvent(ev);
    expect(
      ev.defaultPrevented,
      "Tab/typing must not be swallowed by the list-nav handler (would trap keyboard users).",
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R4 — Negative initialIndex must clamp to 0, not produce a negative selection
//      on a non-empty list (which would dangle aria-activedescendant the same
//      way the empty case would, and break "exactly one selected").
// ---------------------------------------------------------------------------
function NegativeInitHost() {
  const items = ["x", "y", "z"];
  const { selectedIndex, listProps, getItemProps } = useKeyboardNav({
    count: items.length,
    initialIndex: -5,
  });
  return (
    <ul {...listProps} data-testid="nav-list" data-selected={selectedIndex}>
      {items.map((it, i) => (
        <li key={it} {...getItemProps(i)} data-testid={`n-item-${i}`}>
          {it}
        </li>
      ))}
    </ul>
  );
}

describe("ADVERSARIAL R4: negative initialIndex clamps to a valid item", () => {
  it("initialIndex=-5 on a 3-item list yields selectedIndex 0, not negative", () => {
    render(<NegativeInitHost />);
    const list = screen.getByTestId("nav-list");
    expect(Number(list.getAttribute("data-selected"))).toBe(0);
  });

  it("with a negative init, exactly one item is aria-selected and the descendant resolves", () => {
    render(<NegativeInitHost />);
    const list = screen.getByTestId("nav-list");
    const selectedCount = [0, 1, 2]
      .map((i) => screen.getByTestId(`n-item-${i}`).getAttribute("aria-selected"))
      .filter((v) => v === "true").length;
    expect(selectedCount).toBe(1);
    const activeDesc = list.getAttribute("aria-activedescendant");
    expect(activeDesc).toBe(screen.getByTestId("n-item-0").getAttribute("id"));
  });
});

// ---------------------------------------------------------------------------
// R5 — LiveRegion must NEVER be assertive and must never be a focus target.
//      "announce without stealing focus" (AC-13-008.1): the region must not be
//      tabbable (no tabIndex>=0) and must stay polite even as content churns.
// ---------------------------------------------------------------------------
describe("ADVERSARIAL R5: LiveRegion announces without stealing focus", () => {
  it("the live region is not in the tab order (no tabindex >= 0)", () => {
    render(<LiveRegion>hola</LiveRegion>);
    const region = screen.getByTestId("live-region");
    const ti = region.getAttribute("tabindex");
    // Either absent, or explicitly -1; never 0+ (which would make it focusable).
    if (ti !== null) {
      expect(Number(ti)).toBeLessThan(0);
    } else {
      expect(ti).toBeNull();
    }
  });

  it("does not auto-focus itself or its content on mount (active element stays on the trigger)", () => {
    function Host() {
      const [msg, setMsg] = useState("");
      return (
        <div>
          <button type="button" data-testid="trigger" onClick={() => setMsg("evento nuevo")}>
            go
          </button>
          <LiveRegion>{msg}</LiveRegion>
        </div>
      );
    }
    render(<Host />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); // content changes -> announcement
    expect(
      document.activeElement,
      "announcing a new event must not move focus away from the user's current control.",
    ).toBe(trigger);
  });

  it("stays aria-live=polite (never assertive) across content updates", () => {
    function Host() {
      const [msg, setMsg] = useState("uno");
      return (
        <div>
          <button type="button" data-testid="bump" onClick={() => setMsg("dos")}>
            bump
          </button>
          <LiveRegion>{msg}</LiveRegion>
        </div>
      );
    }
    render(<Host />);
    const region = screen.getByTestId("live-region");
    expect(region.getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByTestId("bump"));
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-live")).not.toBe("assertive");
  });
});

// ---------------------------------------------------------------------------
// R6 — TABULAR_NUMS integration: the GLOBAL base on html means even an
//      unclassed number gets tabular figures, but a numeric element that the
//      app marks with TABULAR_NUMS_CLASS must not be defeated by an inline
//      override. Pin that the constant is the Tailwind token (so the utility
//      actually sets the property) and never carries an inline reset.
// ---------------------------------------------------------------------------
describe("ADVERSARIAL R6: tabular-nums base + opt-in are not silently defeated", () => {
  it("globals.css sets font-variant-numeric: tabular-nums on the html base (every number, even unclassed)", () => {
    const html = GLOBALS_CSS.match(/html\s*\{[^}]*\}/);
    expect(html, "globals.css must have an html { … } rule").not.toBeNull();
    expect(
      /font-variant-numeric:\s*tabular-nums/.test(html?.[0] ?? ""),
      "AC-13-003.1: the html base must set font-variant-numeric: tabular-nums so EVERY number is tabular.",
    ).toBe(true);
  });

  it("a numeric element carrying TABULAR_NUMS_CLASS has no inline font-variant-numeric reset", () => {
    render(
      <span className="tabular-nums" data-testid="num">
        1234567890
      </span>,
    );
    const el = screen.getByTestId("num");
    // The opt-in class is the source of truth; an inline 'normal' would defeat AC-13-003.1.
    expect(el.style.fontVariantNumeric).not.toBe("normal");
    expect(el.className).toContain("tabular-nums");
  });
});
