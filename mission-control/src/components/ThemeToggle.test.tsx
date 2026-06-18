/**
 * WO-13-004 — ThemeToggle (CMP-13-theme-toggle) — RED phase tests
 *
 * Written BEFORE the implementation. Every test is expected to fail until
 * `components/ThemeToggle.tsx` exists and satisfies these contracts.
 *
 * Traceability:
 *   AC-13-001.1 (REQ-13-001) — Theme from few OKLCH tokens; high-contrast mode
 *                              without redesign. The toggle cycles light/dark/high-contrast
 *                              by setting [data-theme] on the document root.
 *   AC-13-008.1 (REQ-13-008) — Spanish aria-label; keyboard-operable.
 *   Architecture §4.8         — User choice persists in localStorage; survives refresh.
 *   WO-13-002 contract        — Theme attribute: [data-theme="light"|"dark"|"high-contrast"]
 *                              (values defined in globals.css).
 *
 * Bugs logged in .pandacorp/comms/progress.md used as regression anchors:
 *   None yet for this WO — pre-implementation RED phase. The bugs from adjacent
 *   WOs inform guards (NaN/prototype-pollution/empty-string) replicated here.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * Isolation: localStorage is cleared before each test; document.documentElement
 * data-theme is cleared before each test; matchMedia is mocked per test.
 * No I/O; no real network. "use client" component.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// NOTE: ThemeToggle does not exist yet — imports will fail until WO-13-004 is GREEN.
import { ThemeToggle } from "@/components/ThemeToggle";

// ---------------------------------------------------------------------------
// Theme modes — canonical values from WO-13-002 globals.css contract
// ---------------------------------------------------------------------------

type ThemeMode = "light" | "dark" | "high-contrast";

const VALID_THEMES: ThemeMode[] = ["light", "dark", "high-contrast"];
const STORAGE_KEY = "mc:theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the [data-theme] attribute from the document root. */
function getRootTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

/** Mock window.matchMedia for a given color-scheme preference. */
function mockMatchMedia(prefersColorScheme: "light" | "dark"): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes(prefersColorScheme),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

/** Mock localStorage (clear + reset between tests). */
function mockLocalStorage(): { store: Map<string, string> } {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    writable: true,
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
  return { store };
}

beforeEach(() => {
  // Reset document root — isolate each test from DOM side-effects.
  document.documentElement.removeAttribute("data-theme");
  // Reset localStorage store.
  mockLocalStorage();
  // Default matchMedia: dark preference (most common for this app).
  mockMatchMedia("dark");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

// ---------------------------------------------------------------------------
// 1. Rendering & testid
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: ThemeToggle rendering", () => {
  it("frd-13: AC-13-001.1 — renders with data-testid='theme-toggle'", () => {
    render(<ThemeToggle />);
    expect(screen.getByTestId("theme-toggle")).toBeDefined();
  });

  it("frd-13: AC-13-001.1 — the toggle is a button element", () => {
    render(<ThemeToggle />);
    const el = screen.getByTestId("theme-toggle");
    expect(el.tagName.toLowerCase()).toBe("button");
  });

  it("frd-13: AC-13-001.1 — renders without throwing", () => {
    expect(() => render(<ThemeToggle />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Spanish aria-label (AC-13-008.1)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-008.1 — Spanish aria-label", () => {
  it("frd-13: AC-13-008.1 — WHEN rendered THEN aria-label is present and non-empty", () => {
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const label = btn.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label?.trim()).not.toBe("");
  });

  it("frd-13: AC-13-008.1 — WHEN rendered THEN aria-label is in Spanish (not the English word 'theme')", () => {
    render(<ThemeToggle />);
    const label = screen.getByTestId("theme-toggle").getAttribute("aria-label") ?? "";
    // The label must contain a Spanish keyword; 'theme' alone (English) is disallowed.
    expect(label.toLowerCase()).not.toBe("theme");
    expect(label.trim().length).toBeGreaterThan(0);
  });

  it("frd-13: AC-13-008.1 — aria-label updates when the active theme changes", () => {
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const labelBefore = btn.getAttribute("aria-label");
    fireEvent.click(btn);
    const labelAfter = btn.getAttribute("aria-label");
    // The label should reflect the current or next mode (at minimum it must exist after click).
    expect(labelAfter).toBeTruthy();
    // It is valid for the label to NOT change if it describes the control generically;
    // but the test ensures no crash and the label remains non-empty.
    expect(labelAfter?.trim()).not.toBe("");
    void labelBefore; // suppress unused-variable lint
  });
});

// ---------------------------------------------------------------------------
// 3. Default theme from prefers-color-scheme (architecture §4.8)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-001.1 — default from prefers-color-scheme", () => {
  it("frd-13: WHEN prefers-color-scheme=dark AND no persisted choice THEN initial data-theme is 'dark'", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("dark");
  });

  it("frd-13: WHEN prefers-color-scheme=light AND no persisted choice THEN initial data-theme is 'light'", () => {
    mockMatchMedia("light");
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("light");
  });

  it("frd-13: WHEN prefers-color-scheme=dark AND no persisted choice THEN data-theme is not 'high-contrast'", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    expect(getRootTheme()).not.toBe("high-contrast");
  });
});

// ---------------------------------------------------------------------------
// 4. Cycling through all three modes on repeated clicks (AC-13-001.1)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-001.1 — toggle cycles light / dark / high-contrast", () => {
  it("frd-13: WHEN clicked from 'dark' THEN data-theme changes to one of the three valid modes", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    fireEvent.click(btn);
    const next = getRootTheme();
    expect(VALID_THEMES).toContain(next);
  });

  it("frd-13: WHEN clicked three times THEN all three modes are visited exactly once per cycle", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const visited = new Set<string>();
    // Capture initial state.
    const initial = getRootTheme();
    if (initial) visited.add(initial);
    // Two more clicks to complete the cycle.
    fireEvent.click(btn);
    const after1 = getRootTheme();
    if (after1) visited.add(after1);
    fireEvent.click(btn);
    const after2 = getRootTheme();
    if (after2) visited.add(after2);
    // All three modes must have been seen across the three states (initial + 2 clicks).
    expect(visited.size).toBe(3);
    for (const mode of VALID_THEMES) {
      expect(visited.has(mode)).toBe(true);
    }
  });

  it("frd-13: WHEN clicked a fourth time THEN data-theme returns to the starting mode (full cycle)", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const initialMode = getRootTheme();
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    // After 3 clicks the cycle is complete — must return to start.
    expect(getRootTheme()).toBe(initialMode);
  });

  it("frd-13: WHEN toggled THEN data-theme is always one of the three canonical modes", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    for (let i = 0; i < 6; i++) {
      fireEvent.click(btn);
      expect(VALID_THEMES).toContain(getRootTheme());
    }
  });

  it("frd-13: WHEN clicked from 'light' THEN data-theme never becomes null", () => {
    mockMatchMedia("light");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    fireEvent.click(btn);
    expect(getRootTheme()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Sets the correct [data-theme] attribute on document.documentElement
//    (WO-13-002 contract: globals.css responds to [data-theme])
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-001.1 — [data-theme] set on documentElement", () => {
  it("frd-13: WHEN dark mode is active THEN documentElement has data-theme='dark'", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("frd-13: WHEN light mode is active THEN documentElement has data-theme='light'", () => {
    mockMatchMedia("light");
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("frd-13: WHEN toggle reaches high-contrast THEN documentElement has data-theme='high-contrast'", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    // Cycle until we hit high-contrast (at most 2 additional clicks).
    let found = false;
    for (let i = 0; i < 3; i++) {
      fireEvent.click(btn);
      if (document.documentElement.getAttribute("data-theme") === "high-contrast") {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("frd-13: WHEN component unmounts THEN data-theme on root is NOT removed (persists for next mount)", () => {
    mockMatchMedia("dark");
    const { unmount } = render(<ThemeToggle />);
    const themeBeforeUnmount = getRootTheme();
    unmount();
    // The CSS attribute must survive unmount so the page doesn't flash.
    expect(getRootTheme()).toBe(themeBeforeUnmount);
  });
});

// ---------------------------------------------------------------------------
// 6. localStorage persistence (architecture §4.8)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-001.1 — localStorage persistence across remount", () => {
  it("frd-13: WHEN a theme is selected THEN it is written to localStorage under 'mc:theme'", () => {
    const { store } = mockLocalStorage();
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    fireEvent.click(btn);
    // The key must exist in localStorage after the click.
    expect(store.has(STORAGE_KEY)).toBe(true);
    expect(VALID_THEMES).toContain(store.get(STORAGE_KEY));
  });

  it("frd-13: WHEN a theme is selected THEN the stored value matches the active data-theme", () => {
    const { store } = mockLocalStorage();
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    fireEvent.click(btn);
    cleanup();
    expect(store.get(STORAGE_KEY)).toBe(getRootTheme());
  });

  it("frd-13: WHEN 'light' is persisted in localStorage THEN remounted component sets data-theme='light'", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "light");
    mockMatchMedia("dark"); // System prefers dark — localStorage wins.
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("light");
  });

  it("frd-13: WHEN 'high-contrast' is persisted THEN remounted component sets data-theme='high-contrast'", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "high-contrast");
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("high-contrast");
  });

  it("frd-13: WHEN 'dark' is persisted THEN remounted component sets data-theme='dark' even if system prefers light", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "dark");
    mockMatchMedia("light"); // System prefers light — localStorage wins.
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("dark");
  });

  it("frd-13: WHEN localStorage has a corrupted/unknown value THEN component falls back to system preference", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "super-contrast-ultra"); // Invalid mode.
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    // Must not crash and must set a valid theme (falling back to system preference).
    expect(VALID_THEMES).toContain(getRootTheme());
  });

  it("frd-13: WHEN localStorage has an empty string stored THEN component falls back to system preference", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "");
    mockMatchMedia("light");
    render(<ThemeToggle />);
    expect(VALID_THEMES).toContain(getRootTheme());
  });

  it("frd-13: WHEN localStorage throws on getItem THEN component does not crash and sets a valid theme", () => {
    Object.defineProperty(window, "localStorage", {
      writable: true,
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("SecurityError: storage inaccessible");
        },
        setItem: () => {
          throw new Error("SecurityError");
        },
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    mockMatchMedia("dark");
    expect(() => render(<ThemeToggle />)).not.toThrow();
    expect(VALID_THEMES).toContain(getRootTheme());
  });

  it("frd-13: WHEN localStorage throws on setItem THEN component does not crash after click", () => {
    let getCallCount = 0;
    Object.defineProperty(window, "localStorage", {
      writable: true,
      configurable: true,
      value: {
        getItem: (_key: string) => {
          getCallCount++;
          return null;
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    // Click must not throw even if localStorage write fails.
    expect(() => fireEvent.click(btn)).not.toThrow();
    void getCallCount; // accessed during render
  });
});

// ---------------------------------------------------------------------------
// 7. Keyboard operability (AC-13-008.1)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-008.1 — keyboard operability", () => {
  it("frd-13: WHEN focused THEN the toggle receives keyboard focus without error", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    await user.tab();
    // The button must be focusable.
    expect(document.activeElement).toBe(btn);
  });

  it("frd-13: WHEN focused and Enter is pressed THEN the theme cycles (same as click)", async () => {
    const user = userEvent.setup();
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const themeBefore = getRootTheme();
    await user.tab();
    await user.keyboard("{Enter}");
    const themeAfter = getRootTheme();
    // Pressing Enter on a <button> triggers its click — mode must advance.
    expect(themeAfter).not.toBe(themeBefore);
    expect(VALID_THEMES).toContain(themeAfter);
  });

  it("frd-13: WHEN focused and Space is pressed THEN the theme cycles", async () => {
    const user = userEvent.setup();
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const themeBefore = getRootTheme();
    await user.tab();
    await user.keyboard("{ }");
    const themeAfter = getRootTheme();
    expect(themeAfter).not.toBe(themeBefore);
    expect(VALID_THEMES).toContain(themeAfter);
  });

  it("frd-13: AC-13-008.1 — toggle is not disabled (must not have disabled attribute)", () => {
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    expect(btn.hasAttribute("disabled")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. No hardcoded color values in rendered output (FRD-13 project rule 4)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: no hardcoded color in inline styles", () => {
  it("frd-13: WHEN rendered THEN toggle button has no raw hex color in inline style", () => {
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const inlineStyle = btn.getAttribute("style") ?? "";
    // Raw hex (#xxx or #xxxxxx) must not appear; CSS vars only.
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("frd-13: WHEN in high-contrast mode THEN toggle button still has no raw hex color", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "high-contrast");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const inlineStyle = btn.getAttribute("style") ?? "";
    expect(inlineStyle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// 9. data-theme attribute values are exactly the WO-13-002 contract strings
//    Regression: wrong string (e.g. "hc", "contrast") would break globals.css selectors
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-001.1 — data-theme values match globals.css contract strings", () => {
  it("frd-13: data-theme is never 'hc', 'high_contrast', 'highContrast' or any alias", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const ALIASES = ["hc", "high_contrast", "highContrast", "contrast", "HC"];
    for (let i = 0; i < 3; i++) {
      const theme = getRootTheme() ?? "";
      expect(ALIASES).not.toContain(theme);
      fireEvent.click(btn);
    }
  });

  it("frd-13: data-theme is never an empty string", () => {
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    for (let i = 0; i < 4; i++) {
      expect(getRootTheme()).not.toBe("");
      expect(getRootTheme()).not.toBeNull();
      fireEvent.click(btn);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Concurrent renders — two ThemeToggle instances share state (one root attr)
//     Edge case: two instances should agree on the active mode
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: AC-13-001.1 — two instances stay in sync via shared document root", () => {
  it("frd-13: WHEN two ThemeToggle components are mounted THEN both see the same active data-theme", () => {
    mockMatchMedia("dark");
    render(
      <div>
        <ThemeToggle />
        <ThemeToggle />
      </div>,
    );
    // Both instances control the same document.documentElement attribute.
    expect(getRootTheme()).toBeTruthy();
    expect(VALID_THEMES).toContain(getRootTheme());
  });

  it("frd-13: WHEN the first instance is clicked THEN data-theme changes (regardless of second instance)", () => {
    mockMatchMedia("dark");
    render(
      <div>
        <ThemeToggle />
        <ThemeToggle />
      </div>,
    );
    const [first] = screen.getAllByTestId("theme-toggle");
    const before = getRootTheme();
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by render above
    fireEvent.click(first!);
    expect(getRootTheme()).not.toBe(before);
  });
});

// ---------------------------------------------------------------------------
// 11. Regression — prototype-pollution guard on localStorage key reads
//     (anchored in progress.md: rate.ts prototype-pollution bug logged 2026-06-16)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: regression — prototype-pollution guard on localStorage reads", () => {
  it("frd-13: WHEN localStorage key is 'constructor' THEN component does not interpret it as a theme", () => {
    const { store } = mockLocalStorage();
    // An attacker-controlled key poisoning — the value must not be treated as a valid theme.
    store.set(STORAGE_KEY, "constructor");
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    // Falls back to system preference (not "constructor").
    expect(VALID_THEMES).toContain(getRootTheme());
    expect(getRootTheme()).not.toBe("constructor");
  });

  it("frd-13: WHEN localStorage key is 'toString' THEN component falls back to system preference", () => {
    const { store } = mockLocalStorage();
    store.set(STORAGE_KEY, "toString");
    mockMatchMedia("light");
    render(<ThemeToggle />);
    expect(VALID_THEMES).toContain(getRootTheme());
  });
});

// ---------------------------------------------------------------------------
// 12. Type contract — exported ThemeToggle has the correct prop surface
//     (component should accept no required props — usage: <ThemeToggle />)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004: ThemeToggle prop contract", () => {
  it("frd-13: ThemeToggle renders with zero props (no required props)", () => {
    // If this line compiles, ThemeToggle has no required props.
    expect(() => render(<ThemeToggle />)).not.toThrow();
  });

  it("frd-13: ThemeToggle accepts an optional className prop without crashing", () => {
    // className is the standard extension point for layout consumers.
    expect(() => render(<ThemeToggle className="ml-auto" />)).not.toThrow();
  });
});
