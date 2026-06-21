/**
 * FRD-11 REVIEWER — adversarial integration tests for the build-mode selector (DR-015).
 *
 * Reviewer-authored (Opus), exercising WO-11-001 (BUILD_MODES catalog + mode-store)
 * and WO-11-002 (ModeSelector) TOGETHER through the real component, probing edges the
 * implementers' own suites did NOT cover:
 *
 *   1. The "exact command to copy" (EARS REQ-11-002) handed to CopyButton must equal the
 *      catalog `command` for EVERY mode — not just for balanced/powerful spot-checks. A drift
 *      between the i18n COPY map and `BUILD_MODES` would surface here.
 *   2. The command actually MUTATES when the owner picks each of the four modes in turn
 *      (real interaction, not isolated default render).
 *   3. The active description in the command row equals the picked mode's description (no
 *      stale description after switching).
 *   4. Memory is genuinely per-project: a stored mode for slug A must not leak into slug B,
 *      and switching back restores A's choice (AC-11-003.1/.2) — through the real component.
 *   5. A corrupt localStorage value for the slug must NOT crash the mounted component; it
 *      must fall back to Balanced (FREEZE-ON-RED mindset, B1' coercion family).
 *
 * The CopyButton's clipboard is mocked so we can assert the EXACT value it would copy.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUILD_MODES, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { ModeSelector } from "../mode-selector";

const keyFor = (slug: string) => `mc:build-mode:${slug}`;

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
  it("the command shown equals the catalog command for every mode (no i18n/catalog drift)", () => {
    for (const mode of BUILD_MODES) {
      localStorage.clear();
      const { unmount } = render(<ModeSelector slug="consistency" />);
      fireEvent.click(screen.getByTestId(`mode-option-${mode.id}`));
      // DR-057: command is now inside the shared CmdRow primitive (data-testid="cmd-row")
      const shown = screen.getByTestId("cmd-row").textContent?.trim();
      expect(shown).toContain(mode.command);
      unmount();
    }
  });

  it("the command MUTATES through all four modes in one session (not frozen at default)", () => {
    render(<ModeSelector slug="mutate" />);
    const seen = new Set<string>();
    for (const mode of BUILD_MODES) {
      fireEvent.click(screen.getByTestId(`mode-option-${mode.id}`));
      // DR-057: CmdRow holds the command text
      seen.add(screen.getByTestId("cmd-row").textContent?.trim() ?? "");
    }
    // Four distinct command strings must have appeared.
    expect(seen.size).toBe(BUILD_MODES.length);
  });

  it("the active description in the command row tracks the picked mode (no stale text)", () => {
    render(<ModeSelector slug="desc-track" />);
    const descById = new Map<string, string>();
    for (const mode of BUILD_MODES) {
      fireEvent.click(screen.getByTestId(`mode-option-${mode.id}`));
      const optionDesc = screen.getByTestId(`mode-description-${mode.id}`).textContent?.trim();
      const rowDesc = screen.getByTestId("mode-active-description").textContent?.trim();
      // The command-row description must equal the option's own description.
      expect(rowDesc).toBe(optionDesc);
      descById.set(mode.id, rowDesc ?? "");
    }
    expect(new Set(descById.values()).size).toBe(BUILD_MODES.length);
  });
});

describe("frd-11 reviewer: the exact value handed to the clipboard (REQ-11-002)", () => {
  it("clicking copy on a selected mode copies that mode's exact catalog command", async () => {
    const writeText = (navigator.clipboard as unknown as { writeText: ReturnType<typeof vi.fn> })
      .writeText;
    render(<ModeSelector slug="copy-exact" />);

    fireEvent.click(screen.getByTestId("mode-option-deep"));
    // DR-057: CopyButton is inside the shared CmdRow (data-testid="cmd-row"), not a bespoke wrapper
    const cmdRow = screen.getByTestId("cmd-row");
    const button = cmdRow.querySelector("button");
    expect(button).not.toBeNull();
    if (button) fireEvent.click(button);

    // Flush the async clipboard write.
    await Promise.resolve();
    const deep = BUILD_MODES.find((m) => m.id === "deep");
    expect(writeText).toHaveBeenCalledWith(deep?.command);
    expect(writeText).toHaveBeenCalledWith("/pandacorp:implement deep");
  });
});

describe("frd-11 reviewer: per-project memory isolation through the real component", () => {
  it("a choice for slug A does not leak into slug B; A is restored on return", () => {
    // Pick deep for project A.
    const a1 = render(<ModeSelector slug="proj-A" />);
    fireEvent.click(screen.getByTestId("mode-option-deep"));
    a1.unmount();

    // Project B starts fresh at Balanced (no bleed).
    const b = render(<ModeSelector slug="proj-B" />);
    const balancedB = screen.getByTestId("mode-option-balanced").querySelector("input");
    expect(balancedB?.getAttribute("aria-checked")).toBe("true");
    b.unmount();

    // Return to A — deep restored.
    render(<ModeSelector slug="proj-A" />);
    const deepA = screen.getByTestId("mode-option-deep").querySelector("input");
    expect(deepA?.getAttribute("aria-checked")).toBe("true");
  });
});

describe("frd-11 reviewer: corrupt storage must not crash the mounted component", () => {
  it("a hostile stored value for the slug falls back to Balanced without throwing", () => {
    localStorage.setItem(keyFor("hostile"), "__proto__");
    expect(() => render(<ModeSelector slug="hostile" />)).not.toThrow();
    const balanced = screen.getByTestId("mode-option-balanced").querySelector("input");
    expect(balanced?.getAttribute("aria-checked")).toBe("true");
    // DR-057: command is now inside the shared CmdRow primitive (data-testid="cmd-row")
    const expectedCommand = BUILD_MODES.find((m) => m.id === DEFAULT_BUILD_MODE)?.command ?? "";
    expect(screen.getByTestId("cmd-row").textContent?.trim()).toContain(expectedCommand);
  });
});
