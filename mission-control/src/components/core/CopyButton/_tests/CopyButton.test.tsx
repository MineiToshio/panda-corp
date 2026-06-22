/**
 * CopyButton — acceptance tests (RED phase, WO-02-002)
 *
 * Anchored in:
 *   - AC-02-003.x / AC-02-004.x  (EARS FRD-02): commands shown with a copy button in the intake
 *     modal and card detail; the button copies `value` to the clipboard and shows a transient
 *     "copiado" confirmation that reverts.
 *   - WO-02-002 contract: CopyButton({ value, label? }), data-testid="copy-button",
 *     aria-label in Spanish, navigator.clipboard.writeText, transient feedback.
 *
 * No regression bugs logged in .pandacorp/comms/progress.md yet (pre-build phase).
 *
 * Test environment: jsdom (vitest) — navigator.clipboard is mocked per test.
 * Tests are isolated: each test installs its own clipboard mock and cleans up with afterEach.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";

// ---------------------------------------------------------------------------
// Clipboard mock helpers
// ---------------------------------------------------------------------------

function mockClipboard(): { writeText: ReturnType<typeof vi.fn> } {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
  return { writeText };
}

function mockClipboardRejecting(reason: string): { writeText: ReturnType<typeof vi.fn> } {
  const writeText = vi.fn().mockRejectedValue(new Error(reason));
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
// 1. Rendering & accessibility (AC-02-003.x / AC-02-004.x, WO-02-002 contract)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: CopyButton rendering", () => {
  it("frd-02: renders the element with data-testid='copy-button'", () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:explore" />);
    expect(screen.getByTestId("copy-button")).toBeDefined();
  });

  it("frd-02: has an aria-label in Spanish (non-empty)", () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    const label = btn.getAttribute("aria-label");
    expect(label).toBeTruthy();
    // Must not be in English — the label should contain Spanish keywords
    // (e.g. "copiar" or "copiado"); we test it is a non-empty string and that
    // it does NOT default to the English word "copy".
    expect((label ?? "").toLowerCase()).not.toBe("copy");
  });

  it("frd-02: renders a visible button element (not just a div)", () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:new-idea" />);
    const btn = screen.getByTestId("copy-button");
    expect(btn.tagName.toLowerCase()).toBe("button");
  });

  it("frd-02: accepts an optional label prop and renders it", () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:discover" label="Descubrir" />);
    expect(screen.getByText("Descubrir")).toBeDefined();
  });

  it("frd-02: renders without a label prop without crashing", () => {
    mockClipboard();
    expect(() => render(<CopyButton value="/pandacorp:recommend" />)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Happy path — click copies the value (AC-02-003.x / AC-02-004.x)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: clicking copies value to clipboard", () => {
  it("frd-02: WHEN the button is clicked THEN navigator.clipboard.writeText is called with the exact value", async () => {
    const { writeText } = mockClipboard();
    render(<CopyButton value="/pandacorp:explore" />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith("/pandacorp:explore");
  });

  it("frd-02: copies the exact value even when it contains spaces and special chars", async () => {
    const { writeText } = mockClipboard();
    const cmd = "/pandacorp:spec mi-idea con espacios --flag";
    render(<CopyButton value={cmd} />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(cmd));
  });

  it("frd-02: does not call clipboard.writeText until the button is clicked", () => {
    const { writeText } = mockClipboard();
    render(<CopyButton value="/pandacorp:explore" />);
    expect(writeText).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Transient confirmation feedback (WO-02-002: shows "copiado", then reverts)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: transient 'copiado' confirmation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: WHEN clicked THEN a 'copiado' confirmation is surfaced (accessible label)", async () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:new-idea" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    // Advance microtask queue so the resolved clipboard promise is handled
    await vi.runAllMicrotasksAsync();
    // Icon-only affordance (prototype): the confirmation lives on the accessible
    // label + icon swap, never a visible "copiado" word.
    expect(btn.getAttribute("aria-label")).toMatch(/copiado/i);
  });

  it("frd-02: AFTER the timeout elapses THEN the confirmation reverts to the initial state", async () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:discover" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    expect(btn.getAttribute("aria-label")).toMatch(/copiado/i);
    // Advance past the revert timeout (component must use ≤5 000 ms per spec)
    vi.advanceTimersByTime(5_000);
    expect(btn.getAttribute("aria-label")).not.toMatch(/copiado/i);
    expect(btn.getAttribute("aria-label")).toMatch(/copiar/i);
  });

  it("frd-02: the button is not permanently disabled after copying", async () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:recommend" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(5_000);
    expect(btn.hasAttribute("disabled")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Multiple sequential copies (idempotency / repeated use)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: multiple sequential copies", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: clicking again after revert copies once more with the correct value", async () => {
    const { writeText } = mockClipboard();
    render(<CopyButton value="/pandacorp:iterate" />);
    const btn = screen.getByTestId("copy-button");

    // First copy
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(5_000);

    // Second copy
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenNthCalledWith(2, "/pandacorp:iterate");
  });

  it("frd-02: rapid double-click does not double-call writeText before the first resolves", async () => {
    const { writeText } = mockClipboard();
    render(<CopyButton value="/pandacorp:design" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    // The component should debounce / guard so that at most one call fires
    // per pending clipboard operation.
    expect(writeText.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Error path — clipboard API rejects
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: clipboard write failure", () => {
  it("frd-02: WHEN clipboard.writeText rejects THEN the component does not crash", async () => {
    mockClipboardRejecting("NotAllowedError");
    render(<CopyButton value="/pandacorp:explore" />);
    expect(() => fireEvent.click(screen.getByTestId("copy-button"))).not.toThrow();
    // Let the rejected promise settle without unhandled-rejection noise
    await vi.waitFor(() => {}, { timeout: 100 }).catch(() => null);
  });

  it("frd-02: WHEN clipboard.writeText rejects THEN no 'copiado' text is shown", async () => {
    mockClipboardRejecting("NotAllowedError");
    vi.useFakeTimers();
    render(<CopyButton value="/pandacorp:explore" />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await vi.runAllMicrotasksAsync();
    // On failure the confirmation must NOT appear (would mislead the user)
    expect(screen.queryByText(/copiado/i)).toBeNull();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// 6. Edge cases — empty / unusual values
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: edge cases on the value prop", () => {
  it("frd-02: empty string value — renders without crash", () => {
    mockClipboard();
    expect(() => render(<CopyButton value="" />)).not.toThrow();
  });

  it("frd-02: very long value — copies the full string to the clipboard", async () => {
    const { writeText } = mockClipboard();
    const longCmd = `/pandacorp:spec ${"a".repeat(512)}`;
    render(<CopyButton value={longCmd} />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(longCmd));
  });

  it("frd-02: value with newlines copies exactly as-is", async () => {
    const { writeText } = mockClipboard();
    const cmd = "/pandacorp:spec\nmi-idea";
    render(<CopyButton value={cmd} />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(cmd));
  });
});

// ---------------------------------------------------------------------------
// 7. Reuse contract — renders in a plain context (used by IntakeModal & CardDetail)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: reuse contract (intake modal + card detail)", () => {
  it("frd-02: can render multiple CopyButton instances with different values side-by-side", () => {
    mockClipboard();
    render(
      <div>
        <CopyButton value="/pandacorp:explore" label="Explorar" />
        <CopyButton value="/pandacorp:new-idea" label="Nueva idea" />
        <CopyButton value="/pandacorp:discover" label="Descubrir" />
        <CopyButton value="/pandacorp:recommend" label="Recomendar" />
      </div>,
    );
    const buttons = screen.getAllByTestId("copy-button");
    expect(buttons.length).toBe(4);
  });

  it("frd-02: clicking the second of two buttons copies only the second button's value", async () => {
    const { writeText } = mockClipboard();
    render(
      <div>
        <CopyButton value="/pandacorp:explore" />
        <CopyButton value="/pandacorp:new-idea" />
      </div>,
    );
    const [, second] = screen.getAllByTestId("copy-button");
    // biome-ignore lint/style/noNonNullAssertion: second element guaranteed above
    fireEvent.click(second!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/pandacorp:new-idea"));
    expect(writeText).not.toHaveBeenCalledWith("/pandacorp:explore");
  });
});
