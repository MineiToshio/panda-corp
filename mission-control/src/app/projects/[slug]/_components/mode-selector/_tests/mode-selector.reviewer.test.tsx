/**
 * FRD-11 REVIEWER — adversarial integration tests for the build-mode selector (DR-015).
 *
 * Exercises WO-11-001 (BUILD_MODES catalog + mode-store) and WO-11-002 (ModeSelector)
 * TOGETHER through the real component (now the compact CmdRow `<select>`), probing edges:
 *
 *   1. The command shown (and copied, REQ-11-002) must equal the catalog `command` for
 *      EVERY mode — a drift between the labels and `BUILD_MODES` would surface here.
 *   2. The command MUTATES when the owner picks each mode (not frozen at default).
 *   3. The active description (the select hint) tracks the picked mode (no stale text).
 *   4. Memory is genuinely per-project (A must not leak into B; A restored on return).
 *   5. A corrupt localStorage value must NOT crash — fall back to Balanced.
 *
 * The CopyButton's clipboard is mocked so we can assert the EXACT value it would copy.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildModeFlag } from "@/lib/command-modes";
import { BUILD_MODES } from "@/lib/constants";
import { ModeSelector } from "../mode-selector";

const keyFor = (slug: string) => `mc:build-mode:${slug}`;

function getSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Modo del comando" }) as HTMLSelectElement;
}

function pickMode(id: (typeof BUILD_MODES)[number]["id"]): void {
  fireEvent.change(getSelect(), { target: { value: buildModeFlag(id) } });
}

beforeEach(() => {
  localStorage.clear();
  // Stub clipboard so CopyButton's writeText resolves and we can read its argument.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("frd-11 reviewer: catalog ⇄ UI command consistency across ALL modes", () => {
  it("the command shown equals the catalog command for every mode (no drift)", () => {
    for (const mode of BUILD_MODES) {
      localStorage.clear();
      const { unmount } = render(<ModeSelector slug="consistency" />);
      pickMode(mode.id);
      expect(screen.getByTestId("cmd-row").textContent?.trim()).toContain(mode.command);
      unmount();
    }
  });

  it("the command MUTATES through all four modes in one session (not frozen)", () => {
    render(<ModeSelector slug="mutate" />);
    const seen = new Set<string>();
    for (const mode of BUILD_MODES) {
      pickMode(mode.id);
      seen.add(screen.getByTestId("cmd-row").textContent?.trim() ?? "");
    }
    expect(seen.size).toBe(BUILD_MODES.length);
  });

  it("the active description (select hint) tracks the picked mode (no stale text)", () => {
    render(<ModeSelector slug="desc" />);
    const seen = new Set<string>();
    for (const mode of BUILD_MODES) {
      pickMode(mode.id);
      seen.add(screen.getByTestId("cmd-row-hint").textContent?.trim() ?? "");
    }
    // Every mode has its own distinct description.
    expect(seen.size).toBe(BUILD_MODES.length);
  });
});

describe("frd-11 reviewer: the exact value handed to the clipboard (REQ-11-002)", () => {
  it("clicking copy on a selected mode copies that mode's exact catalog command", async () => {
    render(<ModeSelector slug="clip" />);
    pickMode("deep");
    const copyBtn = screen.getByTestId("cmd-row").querySelector("[data-testid='copy-button']");
    expect(copyBtn).not.toBeNull();
    fireEvent.click(copyBtn as HTMLElement);
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("/pandacorp:implement deep");
    });
  });
});

describe("frd-11 reviewer: per-project memory isolation through the real component", () => {
  it("a choice for slug A does not leak into slug B; A is restored on return", () => {
    const a1 = render(<ModeSelector slug="A" />);
    pickMode("deep");
    a1.unmount();

    const b = render(<ModeSelector slug="B" />);
    expect(getSelect().value).toBe(""); // B is fresh → Balanced (no flag)
    b.unmount();

    render(<ModeSelector slug="A" />);
    expect(getSelect().value).toBe("deep"); // A's choice restored
  });
});

describe("frd-11 reviewer: corrupt storage must not crash the mounted component", () => {
  it("a hostile stored value for the slug falls back to Balanced without throwing", () => {
    localStorage.setItem(keyFor("hostile"), "{not-a-mode]");
    expect(() => render(<ModeSelector slug="hostile" />)).not.toThrow();
    expect(getSelect().value).toBe("");
    expect(screen.getByTestId("cmd-row").textContent?.trim()).toContain("/pandacorp:implement");
  });
});
