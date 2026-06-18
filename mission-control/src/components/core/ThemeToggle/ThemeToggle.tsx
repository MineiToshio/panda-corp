/**
 * WO-13-004 — ThemeToggle (CMP-13-theme-toggle)
 *
 * Light / dark / high-contrast toggle that:
 *   1. Reads the persisted preference from localStorage (key: "mc:theme").
 *   2. Falls back to the system `prefers-color-scheme` when no valid preference is stored.
 *   3. Sets [data-theme] on `document.documentElement` so globals.css theme vars activate.
 *   4. Persists the chosen mode back to localStorage on every click.
 *   5. Cycles: light → dark → high-contrast → light (three-mode ring).
 *
 * Traceability:
 *   AC-13-001.1 (REQ-13-001) — derives from few OKLCH tokens; high-contrast without redesign.
 *   AC-13-008.1 (REQ-13-008) — Spanish aria-label; keyboard-operable.
 *   Architecture §4.8         — localStorage persistence; survives refresh.
 *   WO-13-002 contract        — [data-theme="light"|"dark"|"high-contrast"] on :root.
 *
 * Isolation notes:
 *   - "use client" — this component owns a browser DOM side-effect (data-theme on root).
 *   - No hardcoded hex colours — all styles reference CSS custom properties.
 *   - localStorage access is wrapped in try/catch to survive SecurityError (incognito, iOS).
 */

"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The three canonical theme modes — must match globals.css [data-theme=...] selectors. */
const THEMES = ["light", "dark", "high-contrast"] as const;

type ThemeMode = (typeof THEMES)[number];

/** localStorage key for the persisted theme choice (architecture §4.8). */
const STORAGE_KEY = "mc:theme";

/** The cycling order: light → dark → high-contrast → light. */
const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "high-contrast",
  "high-contrast": "light",
};

/** Spanish aria-label text per mode (AC-13-008.1: labels in Spanish, never hardcoded English). */
const ARIA_LABELS: Record<ThemeMode, string> = {
  light: "Cambiar tema: claro activo",
  dark: "Cambiar tema: oscuro activo",
  "high-contrast": "Cambiar tema: alto contraste activo",
};

// ---------------------------------------------------------------------------
// Helpers (pure — no side-effects, safe to call in tests)
// ---------------------------------------------------------------------------

/**
 * Returns true if the value is one of the three canonical theme strings.
 * Rejects prototype-pollution attempts ("constructor", "toString", etc.)
 * because we check membership in the frozen THEMES tuple, not in Object.prototype.
 */
function isValidTheme(value: unknown): value is ThemeMode {
  if (typeof value !== "string" || value.trim() === "") return false;
  return (THEMES as readonly string[]).includes(value);
}

/** Reads the preferred color scheme from window.matchMedia; defaults to "dark" if unavailable. */
function getSystemPreference(): ThemeMode {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  } catch {
    // matchMedia not available (SSR, test environment without mock, old browser)
  }
  return "dark";
}

/**
 * Reads the stored theme from localStorage.
 * Returns undefined when:
 *   - localStorage is unavailable (SecurityError in incognito/iOS)
 *   - the key is absent
 *   - the stored value is not a valid theme string (corrupted / prototype-pollution)
 */
function readStoredTheme(): ThemeMode | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null && isValidTheme(raw)) return raw;
  } catch {
    // SecurityError, QuotaExceededError, or any storage access failure
  }
  return undefined;
}

/** Writes the active theme to localStorage; silently ignores write failures. */
function writeStoredTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // QuotaExceededError or SecurityError — the preference is lost across refresh,
    // but the in-memory state remains valid for the current session.
  }
}

/** Sets [data-theme] on the document root element so globals.css vars activate. */
function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ThemeToggleProps {
  /**
   * Optional CSS class forwarded to the button for layout consumers
   * (e.g. `className="ml-auto"` in a header).
   * No required props — usage: <ThemeToggle />
   */
  className?: string;
}

/**
 * ThemeToggle — CMP-13-theme-toggle
 *
 * A button that cycles light / dark / high-contrast. Sets [data-theme] on
 * `document.documentElement`; persists the choice to `localStorage["mc:theme"]`.
 *
 * Guarantees (WO-13-004 TDD contract):
 *   - data-testid="theme-toggle" — always present on the button.
 *   - aria-label in Spanish — non-empty; reflects the active mode.
 *   - Default: reads localStorage → system preference (prefers-color-scheme).
 *   - On click: advances to the next mode in the ring.
 *   - On mount: applies the resolved theme to document.documentElement.
 *   - localStorage failures are silently ignored — component never throws.
 *   - No inline hex colours — only CSS custom property references.
 */
export function ThemeToggle({ className }: ThemeToggleProps): React.JSX.Element {
  /**
   * We resolve the initial theme synchronously on the client only.
   * useState initialiser runs once; the resolved value is the authoritative
   * starting point for the cycle.
   *
   * NOTE: Using a lazy initialiser (function form) ensures that localStorage
   * and matchMedia are accessed only in the browser, not during SSR.
   */
  const [theme, setTheme] = useState<ThemeMode>(() => {
    // 1. Persisted preference wins (architecture §4.8: localStorage wins over system).
    const stored = readStoredTheme();
    if (stored !== undefined) return stored;
    // 2. Fall back to system color-scheme preference.
    return getSystemPreference();
  });

  /**
   * Sync the resolved/updated theme to the document root.
   * Runs after every render where `theme` changes (including the first mount).
   * Intentionally does NOT remove [data-theme] on unmount — the attribute must
   * survive across remounts so the page doesn't flash back to unstyled (test §5.d).
   */
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleClick(): void {
    const next = NEXT_THEME[theme];
    setTheme(next);
    writeStoredTheme(next);
  }

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={ARIA_LABELS[theme]}
      onClick={handleClick}
      className={className}
      style={{
        // Layout — compact icon-button appearance using CSS custom properties only.
        // No hardcoded hex colours (FRD-13 project rule 4).
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.25rem",
        borderRadius: "var(--radius)",
        border: "var(--hairline) solid currentColor",
        background: "transparent",
        color: "var(--color-text, currentColor)",
        cursor: "pointer",
      }}
    >
      <ThemeIcon mode={theme} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icon (decorative SVG — aria-hidden; shape signals the active mode)
// ---------------------------------------------------------------------------

/**
 * Inline SVG shape that reflects the current theme mode.
 * Decorative only — the button's aria-label carries the accessible name.
 * Each shape is geometrically distinct so no two modes share the same icon.
 *
 * aria-hidden="true" and role="presentation" are stated explicitly on each
 * <svg> element — biome's noSvgWithoutTitle rule does not peer through spreads
 * so the attrs must appear literally on the JSX element (same pattern as StateBadge).
 */
function ThemeIcon({ mode }: { mode: ThemeMode }): React.JSX.Element {
  const size = 16;
  const c = size / 2;

  if (mode === "light") {
    // Sun: circle with 8 rays
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        role="presentation"
      >
        <circle cx={c} cy={c} r={3} />
        <line x1={c} y1={1} x2={c} y2={3} />
        <line x1={c} y1={13} x2={c} y2={15} />
        <line x1={1} y1={c} x2={3} y2={c} />
        <line x1={13} y1={c} x2={15} y2={c} />
        <line x1={3.5} y1={3.5} x2={5} y2={5} />
        <line x1={11} y1={11} x2={12.5} y2={12.5} />
        <line x1={12.5} y1={3.5} x2={11} y2={5} />
        <line x1={5} y1={11} x2={3.5} y2={12.5} />
      </svg>
    );
  }

  if (mode === "high-contrast") {
    // Half-filled circle: distinct from sun and moon
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        role="presentation"
      >
        <circle cx={c} cy={c} r={c - 1} />
        <path
          d={`M ${c} 1 A ${c - 1} ${c - 1} 0 0 1 ${c} ${size - 1}`}
          fill="currentColor"
          stroke="none"
        />
      </svg>
    );
  }

  // dark — crescent moon
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="presentation"
    >
      <path d={`M ${c + 2} 2 A 7 7 0 1 0 ${c + 2} ${size - 2} A 5 5 0 1 1 ${c + 2} 2`} />
    </svg>
  );
}
