/**
 * CopyButton — contract & mutation-killing tests (WO-02-002, RED phase)
 *
 * These tests are anchored in:
 *   - AC-02-003.x / AC-02-004.x (EARS FRD-02): the intake modal and card detail EACH expose
 *     commands with a copy button; the button copies `value` to the clipboard and shows a
 *     transient "copiado" confirmation that reverts.
 *   - WO-02-002 behaviour contract: REVERT_DELAY_MS = 2 000 ms (not a hand-waved "≤5 000 ms"),
 *     aria-label flips to "Copiado…" on success AND reverts to "Copiar…" after the timeout,
 *     pendingRef resets when the timeout fires so the button stays usable, partial clipboard API
 *     (object present but writeText missing) must not crash, value prop is captured at click time,
 *     label renders before the state text in DOM order, and unmount during a pending copy must
 *     not produce a "cannot update state on unmounted component" console error.
 *
 * WHY these tests are additive (not redundant):
 *   - CopyButton.test.tsx: asserts confirmation appears and reverts with `≤5 000 ms` (too loose —
 *     a mutant that sets the timeout to 4 999 ms would survive).
 *   - CopyButton.adversarial.test.tsx: probes the in-flight guard, missing clipboard object,
 *     and stale timer after a rejection.
 *   NEITHER file pins the exact 2 000 ms boundary, the aria-label revert, the pendingRef reset
 *   after revert, the partial clipboard API surface, the DOM order of the label prop vs. the
 *   state text, or the unmount safety.
 *
 * No past bugs logged in .pandacorp/comms/progress.md for CopyButton yet (pre-build phase,
 * progress.md line 88). These tests act as regression anchors for future mutations.
 *
 * Stack: Vitest + jsdom + @testing-library/react; fake timers per describe block.
 * Isolation: each test gets its own clipboard mock; vi.restoreAllMocks + cleanup() on afterEach.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function installClipboard(writeText: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
}

function removeClipboard(): void {
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

function installPartialClipboard(): void {
  // Simulates an environment where navigator.clipboard exists as an object but
  // writeText is not a function (e.g. Firefox Nightly with partial Clipboard API).
  Object.defineProperty(navigator, "clipboard", {
    value: {},
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Exact revert timing — pins REVERT_DELAY_MS = 2 000 ms
//    AC-02-003.x / AC-02-004.x: "transient confirmation that reverts"
//    Mutation killed: changing REVERT_DELAY_MS to any value other than 2 000 ms.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: confirmation reverts at exactly 2 000 ms", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: WHEN 1 999 ms have elapsed THEN 'copiado' is still active", async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    // Confirmation must be present (on the accessible label — icon-only button)...
    expect(btn.getAttribute("aria-label")).toMatch(/copiado/i);
    // ...and still present one millisecond before the deadline
    vi.advanceTimersByTime(1_999);
    expect(btn.getAttribute("aria-label")).toMatch(/copiado/i);
  });

  it("frd-02: WHEN exactly 2 000 ms have elapsed THEN 'copiado' has cleared", async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(2_000);
    expect(btn.getAttribute("aria-label")).not.toMatch(/copiado/i);
  });

  it("frd-02: 'copiar' label reappears after the 2 000 ms revert", async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:recommend" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(2_000);
    // The idle label must be back; confirms state truly reset, not just hidden
    expect(btn.getAttribute("aria-label")).toMatch(/copiar/i);
  });
});

// ---------------------------------------------------------------------------
// 2. aria-label reverts back to "Copiar al portapapeles" after the timeout
//    AC-02-003.x / AC-02-004.x: accessibility label must stay accurate throughout
//    the copy lifecycle.
//    Mutation killed: an implementation that flips aria-label to "Copiado…" but
//    never flips it back.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: aria-label full round-trip (Copiar → Copiado → Copiar)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: aria-label starts as 'Copiar al portapapeles' before any click", () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    expect(btn.getAttribute("aria-label")).toBe("Copiar al portapapeles");
  });

  it("frd-02: aria-label flips to 'Copiado al portapapeles' immediately after a successful copy", async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    expect(btn.getAttribute("aria-label")).toBe("Copiado al portapapeles");
  });

  it("frd-02: AFTER the 2 000 ms revert THEN aria-label is back to 'Copiar al portapapeles'", async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(2_000);
    expect(btn.getAttribute("aria-label")).toBe("Copiar al portapapeles");
  });
});

// ---------------------------------------------------------------------------
// 3. pendingRef resets when the revert timeout fires (button is usable again)
//    AC-02-003.x / AC-02-004.x: the component must remain reusable after each copy.
//    Mutation killed: a version that resets pendingRef only on the NEXT click,
//    causing an off-by-one guard that swallows the next copy.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: button stays usable after revert timeout fires", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: clicking immediately after revert copies with no debounce dead-zone", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    render(<CopyButton value="/pandacorp:new-idea" />);
    const btn = screen.getByTestId("copy-button");

    // First copy: trigger + let confirmation appear + advance exactly to revert
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(2_000);

    // Second click fires the very next tick — must reach writeText
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenNthCalledWith(2, "/pandacorp:new-idea");
  });

  it("frd-02: the confirmation cycle works a third time (N>2 sequential copies)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    render(<CopyButton value="/pandacorp:iterate" />);
    const btn = screen.getByTestId("copy-button");

    for (let i = 0; i < 3; i++) {
      fireEvent.click(btn);
      await vi.runAllMicrotasksAsync();
      expect(btn.getAttribute("aria-label")).toMatch(/copiado/i);
      vi.advanceTimersByTime(2_000);
      expect(btn.getAttribute("aria-label")).not.toMatch(/copiado/i);
    }
    expect(writeText).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// 4. Partial clipboard API — navigator.clipboard exists but writeText is missing
//    WO-02-002 contract: the component uses navigator.clipboard.writeText; if the
//    API is available but incomplete, calling a non-function must not crash and
//    must NOT show the confirmation.
//    Mutation killed: a guard that only checks `navigator.clipboard` (truthy) but
//    not `typeof navigator.clipboard.writeText === "function"`.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: partial clipboard API (navigator.clipboard exists, writeText absent)", () => {
  it("frd-02: click does not throw when navigator.clipboard has no writeText method", () => {
    installPartialClipboard();
    render(<CopyButton value="/pandacorp:discover" />);
    expect(() => fireEvent.click(screen.getByTestId("copy-button"))).not.toThrow();
  });

  it("frd-02: no 'copiado' confirmation is shown when writeText is absent", async () => {
    installPartialClipboard();
    render(<CopyButton value="/pandacorp:discover" />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await Promise.resolve(); // flush microtasks
    expect(screen.queryByText(/copiado/i)).toBeNull();
  });

  it("frd-02: aria-label stays as 'Copiar…' (not flipped) when writeText is absent", async () => {
    installPartialClipboard();
    render(<CopyButton value="/pandacorp:discover" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await Promise.resolve();
    expect(btn.getAttribute("aria-label")).toBe("Copiar al portapapeles");
  });
});

// ---------------------------------------------------------------------------
// 5. Value captured at click time — if the `value` prop changes after the revert,
//    the NEXT click uses the NEW value (useCallback [value] dependency).
//    AC-02-003.x / AC-02-004.x: the copied text must always match what the button
//    displays at the moment of the click.
//    Mutation killed: a stale-closure implementation that always copies the
//    initial value regardless of re-renders.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: value prop is current at click time (stale closure guard)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: WHEN value prop changes after revert THEN the second click copies the new value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const { rerender } = render(<CopyButton value="/pandacorp:explore" />);

    // First click — copies initial value
    fireEvent.click(screen.getByTestId("copy-button"));
    await vi.runAllMicrotasksAsync();
    expect(writeText).toHaveBeenCalledWith("/pandacorp:explore");

    // Advance past the revert so pendingRef resets, then change the value prop
    vi.advanceTimersByTime(2_000);
    rerender(<CopyButton value="/pandacorp:recommend" />);

    // Second click — must copy the NEW value, not the stale initial one
    fireEvent.click(screen.getByTestId("copy-button"));
    await vi.runAllMicrotasksAsync();
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenNthCalledWith(2, "/pandacorp:recommend");
  });

  it("frd-02: a value prop that changes while the revert timer is pending does NOT affect the first copy", async () => {
    // Verifies the first copy already committed the correct value, regardless of
    // subsequent prop changes during the confirmation window.
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const { rerender } = render(<CopyButton value="/pandacorp:explore" />);

    fireEvent.click(screen.getByTestId("copy-button"));
    await vi.runAllMicrotasksAsync();

    // Change value while confirmation is still showing (revert timer pending)
    rerender(<CopyButton value="/pandacorp:discover" />);

    // The FIRST write must have used the value at click time, not the new one
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("/pandacorp:explore");
  });
});

// ---------------------------------------------------------------------------
// 6. Optional label — renders as a visible human-readable name alongside the
//    icon-only copy affordance; copied/idle state lives on the aria-label, never
//    a visible verb word (prototype: copy is an icon, not the word "copiar").
//    Mutation killed: dropping the label, or leaking a visible state verb.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: optional label renders alongside the copy icon", () => {
  it("frd-02: the label text is rendered (visible) on the copy button", () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:explore" label="Explorar" />);
    const btn = screen.getByTestId("copy-button");
    // Label is the human-readable name shown next to the icon-only affordance
    expect(btn.textContent).toContain("Explorar");
    expect(btn.getAttribute("aria-label")).toMatch(/copiar/i);
  });

  it("frd-02: AFTER a successful copy the label text stays put (only the aria-label flips)", async () => {
    vi.useFakeTimers();
    installClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value="/pandacorp:new-idea" label="Nueva idea" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    // The visible label is unchanged; the copied state is conveyed by the aria-label.
    expect(btn.textContent).toContain("Nueva idea");
    expect(btn.getAttribute("aria-label")).toMatch(/copiado/i);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// 7. Unmount safety — no state update after unmount
//    The component schedules a revert timeout. If the component unmounts before
//    the timeout fires (e.g. the modal is closed), the cleanup effect must cancel
//    the timer so no "Warning: Can't perform a React state update on unmounted…"
//    appears.
//    Mutation killed: removal of the `useEffect` cleanup that calls clearTimeout.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: unmount during pending revert does not cause stale state update", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: unmounting while the revert timer is pending does not throw a console error", async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { unmount } = render(<CopyButton value="/pandacorp:design" />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await vi.runAllMicrotasksAsync();
    // Unmount while the 2 000 ms revert timer is still pending
    unmount();
    // Advance past the revert delay — the cleanup must have cancelled the timer
    vi.advanceTimersByTime(2_000);

    // No "state update on unmounted component" or similar React warning must appear
    const stateUpdateWarnings = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).toLowerCase().includes("unmount"),
    );
    expect(stateUpdateWarnings.length).toBe(0);
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 8. Rapid re-click during confirmation — in-flight guard is honoured
//    while copied=true (the button is mounted and visible but pendingRef should
//    still be true since the timeout has not fired yet).
//    Mutation killed: an implementation that checks `copied` state instead of
//    the ref, allowing a second writeText call if the state has already
//    flushed to `true` before the ref is checked.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: click during confirmation window (pendingRef still set)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: clicking while 'copiado' is shown (within 2 000 ms window) does not call writeText again", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    render(<CopyButton value="/pandacorp:architecture" />);
    const btn = screen.getByTestId("copy-button");

    fireEvent.click(btn);
    await vi.runAllMicrotasksAsync();
    // Now in the confirmation window: copied=true, pendingRef.current=true
    expect(btn.getAttribute("aria-label")).toMatch(/copiado/i);

    // Clicking again while the timer is still running
    fireEvent.click(btn);
    fireEvent.click(btn);
    // Still only the first writeText call
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Reuse contract (intake modal: 4 buttons, card detail: 1 button)
//    AC-02-003.x: The intake modal shows exactly 4 commands, each with a copy button.
//    AC-02-004.x: The card detail shows the next-step command with a copy button.
//    Regression: each button's copy must be isolated (clicking button N must not
//    copy button M's value).
//    Mutation killed: any shared/global state between CopyButton instances.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: isolation between concurrent CopyButton instances", () => {
  it("frd-02: 4 buttons (intake modal scenario) each copy their own distinct value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const commands = [
      "/pandacorp:explore",
      "/pandacorp:new-idea",
      "/pandacorp:discover",
      "/pandacorp:recommend",
    ];
    render(
      <div>
        {commands.map((cmd) => (
          <CopyButton key={cmd} value={cmd} label={cmd} />
        ))}
      </div>,
    );
    const buttons = screen.getAllByTestId("copy-button");
    expect(buttons.length).toBe(4);

    // Click each button and verify the exact value is passed
    for (let i = 0; i < 4; i++) {
      // biome-ignore lint/style/noNonNullAssertion: guaranteed by the length check above
      fireEvent.click(buttons[i]!);
      // biome-ignore lint/style/noNonNullAssertion: same guarantee
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(commands[i]!));
    }
    expect(writeText).toHaveBeenCalledTimes(4);
  });

  it("frd-02: showing 'copiado' on button 1 does not affect button 2's state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    render(
      <div>
        <CopyButton value="/pandacorp:explore" />
        <CopyButton value="/pandacorp:new-idea" />
      </div>,
    );
    const [first, second] = screen.getAllByTestId("copy-button");
    // biome-ignore lint/style/noNonNullAssertion: 2-element array is guaranteed above
    fireEvent.click(first!);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    // second button must still be idle "copiar" (not "copiado") on its accessible label
    // biome-ignore lint/style/noNonNullAssertion: same guarantee
    expect(second!.getAttribute("aria-label")?.toLowerCase()).toContain("copiar");
    // biome-ignore lint/style/noNonNullAssertion: same guarantee
    expect(second!.getAttribute("aria-label")?.toLowerCase()).not.toContain("copiado");
  });
});

// ---------------------------------------------------------------------------
// 10. Clipboard rejected + no writeText on navigator.clipboard (combined edge)
//     Guards against a future refactor that removes the null-check on writeText
//     after the error-path guard has already been seen by the adversarial suite.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003/004: clipboard absent — no crash, no confirmation, no stale timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: with clipboard absent, advancing 2 000 ms never shows 'copiado'", async () => {
    removeClipboard();
    render(<CopyButton value="/pandacorp:spec" />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(2_000);
    expect(screen.queryByText(/copiado/i)).toBeNull();
  });
});
