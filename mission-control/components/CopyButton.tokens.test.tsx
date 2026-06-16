/**
 * CopyButton — design-token & quality adversarial tests (WO-02-002, reviewer / Opus 4.8, DR-015).
 *
 * Gap not covered by CopyButton.test.tsx / .adversarial.test.tsx / .contract.test.tsx:
 *   AGENTS.md rule 4 + architecture.md ("styles only with design tokens, never hardcoded
 *   colors"). The contract says "Styling via design tokens only." None of the existing
 *   suites pin this — a future mutant that hardcodes a brand hex (e.g. background:"#7c3aed")
 *   would survive every current test. This file kills that mutant.
 *
 * Also pins two reuse invariants the existing suites leave implicit:
 *   - the testid is on the <button> itself (so callers can target it), and
 *   - whitespace-only / unicode values are copied verbatim (commands may contain them).
 *
 * Anchored in: AC-02-003.x / AC-02-004.x, WO-02-002 contract ("design tokens only").
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

function mockClipboard(): { writeText: ReturnType<typeof vi.fn> } {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
  return { writeText };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. No hardcoded hex colors leak into the button's inline style
//    Mutation killed: background/border/color set to a raw #rrggbb brand value.
// ---------------------------------------------------------------------------
describe("ADVERSARIAL frd-02: styling uses no hardcoded hex colors", () => {
  it("frd-02: the rendered button's inline style contains no #rgb / #rrggbb / #rrggbbaa color", () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:explore" />);
    const style = screen.getByTestId("copy-button").getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("frd-02: no rgb()/rgba()/hsl() literal color is hardcoded in the inline style", () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:explore" />);
    const style = screen.getByTestId("copy-button").getAttribute("style") ?? "";
    expect(style).not.toMatch(/\b(rgb|rgba|hsl|hsla)\s*\(/i);
  });
});

// ---------------------------------------------------------------------------
// 2. testid is on the interactive element itself (callers target the button)
//    Mutation killed: moving data-testid onto a wrapper span/div.
// ---------------------------------------------------------------------------
describe("ADVERSARIAL frd-02: data-testid is on the clickable <button>", () => {
  it("frd-02: clicking the testid element directly triggers the copy", async () => {
    const { writeText } = mockClipboard();
    render(<CopyButton value="/pandacorp:new-idea" />);
    const el = screen.getByTestId("copy-button");
    expect(el.tagName.toLowerCase()).toBe("button");
    fireEvent.click(el);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/pandacorp:new-idea"));
  });
});

// ---------------------------------------------------------------------------
// 3. Whitespace-only and unicode values are copied verbatim (no trim/normalize)
//    Mutation killed: a .trim() or normalization sneaking into the copy path.
// ---------------------------------------------------------------------------
describe("ADVERSARIAL frd-02: value is copied verbatim (no trimming/normalization)", () => {
  it("frd-02: a value with leading/trailing whitespace is copied unchanged", async () => {
    const { writeText } = mockClipboard();
    const padded = "   /pandacorp:spec idea   ";
    render(<CopyButton value={padded} />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(padded));
  });

  it("frd-02: a unicode/emoji value is copied byte-for-byte", async () => {
    const { writeText } = mockClipboard();
    const unicode = "/pandacorp:spec café-niño-🚀";
    render(<CopyButton value={unicode} />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(unicode));
  });
});
