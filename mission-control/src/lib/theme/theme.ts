/** Theme preference (IF-13-theme): two themes, the system default, a browser-local choice. */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "orbita-theme";
export const SIDEBAR_STORAGE_KEY = "orbita-sidebar";
export const SYSTEM_LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Type guard for a persisted theme value. */
export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Resolve the theme to paint: a valid stored choice wins, anything else follows the system
 * (light preference -> light, otherwise dark, as the prototype).
 */
export function resolveTheme(
  stored: string | null | undefined,
  systemPrefersLight: boolean,
): Theme {
  if (isTheme(stored)) return stored;
  return systemPrefersLight ? "light" : "dark";
}

function readSystemPrefersLight(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(SYSTEM_LIGHT_QUERY).matches
    : false;
}

function readStored(storage: Pick<Storage, "getItem">): string | null {
  try {
    return storage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null; // storage unavailable (private mode, blocked): fall back to the system preference
  }
}

/** The theme currently in effect for this browser: stored choice, else the system preference. */
export function currentTheme(storage: Pick<Storage, "getItem"> = window.localStorage): Theme {
  return resolveTheme(readStored(storage), readSystemPrefersLight());
}

/** Set `data-theme` on the document element. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.setAttribute("data-theme", theme);
}

/**
 * Remember the choice for this browser.
 * @returns false when storage is unavailable; the choice then lasts for the current view only.
 */
export function persistTheme(
  theme: Theme,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): boolean {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
