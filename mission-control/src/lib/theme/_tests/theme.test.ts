/** WO-13-010 — IF-13-theme: resolver matrix, apply/persist, storage failure, boot script in jsdom. AC-13-010.2 (themes feed the token layer). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_BOOT_SCRIPT } from "../bootScript";
import { applyTheme, currentTheme, persistTheme, resolveTheme, type Theme } from "../theme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-sidebar-pref");
  vi.unstubAllGlobals();
});

function stubSystem(light: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: light && query.includes("light") }));
}

describe("AC-13-010.2: theme resolution", () => {
  it.each<[string | null, boolean, Theme]>([
    ["light", false, "light"],
    ["dark", true, "dark"],
    ["garbage", true, "light"],
    ["garbage", false, "dark"],
    [null, true, "light"],
    [null, false, "dark"],
    ["high-contrast", false, "dark"],
  ])("stored %s with system light=%s resolves to %s", (stored, systemLight, expected) => {
    expect(resolveTheme(stored, systemLight)).toBe(expected);
  });

  it("applies, persists and survives an unavailable storage", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(persistTheme("light")).toBe(true);
    stubSystem(false);
    expect(currentTheme()).toBe("light");
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(persistTheme("dark", broken)).toBe(false);
    expect(currentTheme(broken)).toBe("dark");
  });
});

describe("AC-13-010.2: boot script", () => {
  const boot = () => new Function(THEME_BOOT_SCRIPT)();

  it("a stored choice wins over the system and mirrors the sidebar preference", () => {
    stubSystem(false);
    localStorage.setItem("orbita-theme", "light");
    localStorage.setItem("orbita-sidebar", "collapsed");
    boot();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.sidebarPref).toBe("collapsed");
  });

  it("falls back to the system preference on absent or unreadable values", () => {
    stubSystem(true);
    boot();
    expect(document.documentElement.dataset.theme).toBe("light");
    localStorage.setItem("orbita-theme", "nonsense");
    stubSystem(false);
    boot();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.sidebarPref).toBeUndefined();
  });
});
