/**
 * CopyButton — ADVERSARIAL review tests (WO-02-002, reviewer / DR-015)
 *
 * Written by the reviewer (a different model from the implementer) to probe edge
 * cases, abuse and failure modes the implementer's own suite did NOT cover:
 *
 *  1. aria-label MUST flip to its "Copiado…" Spanish state after a successful copy
 *     (the WO contract requires it; the implementer only asserted visible text).
 *  2. The in-flight guard is REAL, not decorative — a synchronous double-click
 *     while the first write is pending must call writeText EXACTLY once
 *     (the implementer's test used `toBeLessThanOrEqual(2)`, which passes even
 *     with NO guard — a decorative assertion).
 *  3. navigator.clipboard being entirely absent (insecure context / old browser)
 *     must NOT crash and must NOT show the confirmation.
 *  4. A slow (later-rejecting) clipboard must NOT leave the button permanently
 *     stuck (pendingRef must reset so a later click works).
 *  5. After an error, no revert timer leaks a stale "copiado" into the DOM.
 *
 * Anchored in: AC-02-003.x / AC-02-004.x, WO-02-002 behaviour contract.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";

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
// 1. aria-label must reflect the copied state (contract: flips to "Copiado…")
// ---------------------------------------------------------------------------

describe("ADVERSARIAL frd-02: aria-label reflects copied state", () => {
  it("frd-02: AFTER a successful copy the aria-label switches to the Spanish 'Copiado…' form", async () => {
    mockClipboard();
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    expect(btn.getAttribute("aria-label")?.toLowerCase()).toContain("copiar");
    fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute("aria-label")?.toLowerCase()).toContain("copiado"));
  });
});

// ---------------------------------------------------------------------------
// 2. In-flight guard is REAL — exactly one writeText on a synchronous double-click
// ---------------------------------------------------------------------------

describe("ADVERSARIAL frd-02: in-flight guard is enforced (not decorative)", () => {
  it("frd-02: two synchronous clicks before the first write resolves call writeText EXACTLY once", () => {
    // A pending (never-resolving) clipboard keeps the first write in flight,
    // so the guard must reject the second click outright.
    const writeText = vi.fn(() => new Promise<void>(() => {}));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<CopyButton value="/pandacorp:design" />);
    const btn = screen.getByTestId("copy-button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 3. navigator.clipboard entirely absent (insecure context) — no crash
// ---------------------------------------------------------------------------

describe("ADVERSARIAL frd-02: clipboard API missing entirely", () => {
  it("frd-02: WHEN navigator.clipboard is undefined THEN click does not crash and shows no 'copiado'", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    render(<CopyButton value="/pandacorp:explore" />);
    const btn = screen.getByTestId("copy-button");
    expect(() => fireEvent.click(btn)).not.toThrow();
    // Give any microtasks a chance to settle, then assert no false confirmation.
    await Promise.resolve();
    expect(screen.queryByText(/copiado/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. After a rejection the button is NOT permanently stuck (guard resets)
// ---------------------------------------------------------------------------

describe("ADVERSARIAL frd-02: guard resets after failure so the button stays usable", () => {
  it("frd-02: a failed copy then a successful copy both reach the clipboard", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<CopyButton value="/pandacorp:iterate" />);
    const btn = screen.getByTestId("copy-button");

    fireEvent.click(btn);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    // After the rejection, the guard must have reset — a second click must fire.
    fireEvent.click(btn);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    // And THIS time the confirmation should appear.
    await waitFor(() => expect(screen.getByText(/copiado/i)).toBeDefined());
  });
});

// ---------------------------------------------------------------------------
// 5. No stale revert timer leaks "copiado" after an error path
// ---------------------------------------------------------------------------

describe("ADVERSARIAL frd-02: error path schedules no revert timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("frd-02: after a rejected write, advancing time never surfaces a 'copiado'", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<CopyButton value="/pandacorp:explore" />);
    fireEvent.click(screen.getByTestId("copy-button"));
    await vi.runAllMicrotasksAsync();
    vi.advanceTimersByTime(10_000);
    expect(screen.queryByText(/copiado/i)).toBeNull();
  });
});
