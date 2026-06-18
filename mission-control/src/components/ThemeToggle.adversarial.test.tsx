/**
 * WO-13-004 — ThemeToggle (CMP-13-theme-toggle) — ADVERSARIAL review tests (DR-015)
 *
 * Written by the reviewer (Opus) — edge cases, abuse and mutation-killers the
 * implementer (sonnet/haiku) did NOT cover in ThemeToggle.test.tsx.
 *
 * Focus areas the original suite leaves loose:
 *   A. EXACT cycle order (light→dark→high-contrast→light). The original suite
 *      only asserts "set membership over 3 clicks" and "returns to start after 3",
 *      which survives a mutated NEXT_THEME that swaps light<->dark. We pin the
 *      precise ordering from each of the three starting points → kills mutants
 *      of the NEXT_THEME ring.
 *   B. REAL cross-remount persistence with a SHARED store (the original §6 sets the
 *      store before mount but never does a click → unmount → remount → read round
 *      trip on the same backing store).
 *   C. matchMedia query specificity: getSystemPreference must key off
 *      "(prefers-color-scheme: light)", not blindly trust matches:true for any query.
 *   D. Whitespace-padded persisted values (" light ", "dark\n") must be rejected,
 *      not silently applied.
 *   E. aria-label actually reflects the ACTIVE mode (not a constant string) —
 *      the original §2 explicitly allows a generic label, so a mutant that returns
 *      a constant label would pass. We require the label to change across modes.
 *   F. SSR-ish safety: render must not write a junk attribute when matchMedia
 *      is entirely absent (defaults to "dark").
 *
 * Stack: Vitest + @testing-library/react + jsdom. No I/O.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/ThemeToggle";

type ThemeMode = "light" | "dark" | "high-contrast";
const STORAGE_KEY = "mc:theme";

function getRootTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

/** Install a localStorage backed by the given (shared) Map so it survives remounts. */
function installLocalStorage(store: Map<string, string>): void {
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
}

/** matchMedia mock that ONLY matches the exact prefers-color-scheme query passed. */
function mockMatchMedia(prefers: "light" | "dark"): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      // Specific: matches only when the queried scheme equals the preference.
      matches: query === `(prefers-color-scheme: ${prefers})`,
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

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  installLocalStorage(new Map());
  mockMatchMedia("dark");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

// ---------------------------------------------------------------------------
// A. EXACT cycle order — mutation-killer for the NEXT_THEME ring
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004 ADVERSARIAL: exact cycle order light→dark→high-contrast→light", () => {
  function seed(persisted: ThemeMode): HTMLElement {
    const store = new Map<string, string>();
    store.set(STORAGE_KEY, persisted);
    installLocalStorage(store);
    render(<ThemeToggle />);
    return screen.getByTestId("theme-toggle");
  }

  it("from 'light' the next mode is exactly 'dark'", () => {
    const btn = seed("light");
    expect(getRootTheme()).toBe("light");
    fireEvent.click(btn);
    expect(getRootTheme()).toBe("dark");
  });

  it("from 'dark' the next mode is exactly 'high-contrast'", () => {
    const btn = seed("dark");
    expect(getRootTheme()).toBe("dark");
    fireEvent.click(btn);
    expect(getRootTheme()).toBe("high-contrast");
  });

  it("from 'high-contrast' the next mode is exactly 'light' (wraps)", () => {
    const btn = seed("high-contrast");
    expect(getRootTheme()).toBe("high-contrast");
    fireEvent.click(btn);
    expect(getRootTheme()).toBe("light");
  });

  it("three clicks from 'light' walk the precise sequence and return to 'light'", () => {
    const btn = seed("light");
    const seen: string[] = [getRootTheme() ?? ""];
    fireEvent.click(btn);
    seen.push(getRootTheme() ?? "");
    fireEvent.click(btn);
    seen.push(getRootTheme() ?? "");
    fireEvent.click(btn);
    seen.push(getRootTheme() ?? "");
    expect(seen).toEqual(["light", "dark", "high-contrast", "light"]);
  });

  it("a mode never maps to itself (no fixed point in the ring)", () => {
    for (const start of ["light", "dark", "high-contrast"] as ThemeMode[]) {
      const store = new Map<string, string>();
      store.set(STORAGE_KEY, start);
      installLocalStorage(store);
      const { unmount } = render(<ThemeToggle />);
      const btn = screen.getAllByTestId("theme-toggle")[0] as HTMLElement;
      fireEvent.click(btn);
      expect(getRootTheme()).not.toBe(start);
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// B. REAL cross-remount persistence on a SHARED store
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004 ADVERSARIAL: persistence survives a real unmount→remount", () => {
  it("a click writes the new mode and a fresh mount reads it back (shared store)", () => {
    const store = new Map<string, string>();
    installLocalStorage(store);
    mockMatchMedia("dark"); // first mount resolves to dark

    const first = render(<ThemeToggle />);
    expect(getRootTheme()).toBe("dark");
    fireEvent.click(screen.getByTestId("theme-toggle")); // dark → high-contrast
    const persisted = getRootTheme();
    expect(persisted).toBe("high-contrast");
    expect(store.get(STORAGE_KEY)).toBe("high-contrast");

    first.unmount();
    document.documentElement.removeAttribute("data-theme");

    // Now the system prefers LIGHT; the persisted high-contrast must still win.
    mockMatchMedia("light");
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("high-contrast");
  });

  it("a full cycle persists the last applied mode (not an intermediate one)", () => {
    const store = new Map<string, string>();
    store.set(STORAGE_KEY, "light");
    installLocalStorage(store);
    const { unmount } = render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    fireEvent.click(btn); // → dark
    fireEvent.click(btn); // → high-contrast
    expect(store.get(STORAGE_KEY)).toBe("high-contrast");
    unmount();
    document.documentElement.removeAttribute("data-theme");
    mockMatchMedia("dark");
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("high-contrast");
  });
});

// ---------------------------------------------------------------------------
// C. matchMedia query specificity
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004 ADVERSARIAL: system preference keys off the light query specifically", () => {
  it("WHEN only '(prefers-color-scheme: light)' matches THEN default is 'light'", () => {
    installLocalStorage(new Map());
    mockMatchMedia("light");
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("light");
  });

  it("WHEN matchMedia matches NOTHING THEN default falls back to 'dark'", () => {
    installLocalStorage(new Map());
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false, // nothing matches
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    render(<ThemeToggle />);
    expect(getRootTheme()).toBe("dark");
  });

  it("WHEN matchMedia throws THEN render does not crash and default is 'dark'", () => {
    installLocalStorage(new Map());
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: () => {
        throw new Error("matchMedia unavailable");
      },
    });
    expect(() => render(<ThemeToggle />)).not.toThrow();
    expect(getRootTheme()).toBe("dark");
  });
});

// ---------------------------------------------------------------------------
// D. Whitespace-padded / malformed persisted values are rejected
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004 ADVERSARIAL: whitespace-padded persisted values are rejected", () => {
  for (const bad of [" light ", "dark\n", "\thigh-contrast", "LIGHT", "Dark"]) {
    it(`rejects persisted value ${JSON.stringify(bad)} and falls back to system (dark)`, () => {
      const store = new Map<string, string>();
      store.set(STORAGE_KEY, bad);
      installLocalStorage(store);
      mockMatchMedia("dark");
      render(<ThemeToggle />);
      // Must not echo the malformed value onto the root attribute.
      expect(getRootTheme()).toBe("dark");
      expect(getRootTheme()).not.toBe(bad);
    });
  }
});

// ---------------------------------------------------------------------------
// E. aria-label reflects the ACTIVE mode (kills a constant-label mutant)
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004 ADVERSARIAL: aria-label is mode-specific, not constant", () => {
  it("the three modes produce three DISTINCT aria-labels", () => {
    const store = new Map<string, string>();
    store.set(STORAGE_KEY, "light");
    installLocalStorage(store);
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const labels = new Set<string>();
    labels.add(btn.getAttribute("aria-label") ?? "");
    fireEvent.click(btn);
    labels.add(btn.getAttribute("aria-label") ?? "");
    fireEvent.click(btn);
    labels.add(btn.getAttribute("aria-label") ?? "");
    expect(labels.size).toBe(3);
  });

  it("the active aria-label mentions the active mode in Spanish", () => {
    const store = new Map<string, string>();
    store.set(STORAGE_KEY, "high-contrast");
    installLocalStorage(store);
    render(<ThemeToggle />);
    const label = (
      screen.getByTestId("theme-toggle").getAttribute("aria-label") ?? ""
    ).toLowerCase();
    // Spanish term for high-contrast — must not be the English word.
    expect(label).toContain("contraste");
    expect(label).not.toContain("theme");
  });
});

// ---------------------------------------------------------------------------
// F. Icon is decorative (aria-hidden) so it never adds a competing accessible name
// ---------------------------------------------------------------------------

describe("frd-13/wo-13-004 ADVERSARIAL: the inline icon is decorative", () => {
  it("the rendered svg is aria-hidden (button keeps the single accessible name)", () => {
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    const svg = btn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("the button exposes exactly one accessible name (aria-label), no nested text leak", () => {
    render(<ThemeToggle />);
    const btn = screen.getByTestId("theme-toggle");
    // No visible text content — the icon carries no text node.
    expect((btn.textContent ?? "").trim()).toBe("");
    expect(btn.getAttribute("aria-label")?.trim()).toBeTruthy();
  });
});
