/**
 * WO-01-008 — OnboardingGate ADVERSARIAL tests (reviewer / DR-015, DR-016).
 *
 * Why this file exists (gap the implementer AND the prior contract tests missed):
 *
 *   AC-01-001.1 requires the gate to present the /pandacorp:onboarding command
 *   "with a copy button". Every existing test verifies the DISPLAY side:
 *     - the <code> textContent is "/pandacorp:onboarding"  (OnboardingGate.test.tsx)
 *     - the copy-button is co-located with the <code>      (OnboardingGate.contract.test.tsx CONT-1)
 *     - the copy-button is in idle state                    (CONT-1)
 *
 *   NONE of them verify the BEHAVIOR that actually matters to the user: that
 *   clicking the button copies the EXACT command to the clipboard. The display
 *   text and the CopyButton `value` prop are TWO independent wires. A refactor
 *   that fed CopyButton an empty string, a stale constant, or a different command
 *   while leaving the <code> text correct would leave the whole suite GREEN and
 *   ship a gate whose copy button copies garbage — the single affordance the EARS
 *   criterion calls out would be silently broken.
 *
 *   Mutation proof (DR-016): change
 *       <CopyButton value={ONBOARDING_COMMAND} ... />
 *   to  <CopyButton value="" ... />   (or any other string)
 *   and the entire existing suite stays green. The tests below turn RED.
 *
 * Traceability:
 *   CMP-01-onboarding-gate → REQ-01-001 → AC-01-001.1 (the "copy button" clause)
 *
 * Stack: Vitest + @testing-library/react (fireEvent). We stub
 * navigator.clipboard.writeText and assert the argument it was called with —
 * the real end-to-end contract from the user's click to the clipboard payload.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingGate } from "@/app/_components/OnboardingGate/OnboardingGate";

const EXPECTED_COMMAND = "/pandacorp:onboarding";

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  // jsdom does not implement navigator.clipboard; define it explicitly.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("frd-01 AC-01-001.1: clicking the copy button copies the EXACT onboarding command (not just displays it)", () => {
  it("frd-01 AC-01-001.1: WHEN the user clicks the copy button THEN navigator.clipboard.writeText receives '/pandacorp:onboarding'", async () => {
    render(<OnboardingGate />);

    fireEvent.click(screen.getByTestId("copy-button"));

    // The behavior contract: the clipboard payload equals the command, regardless
    // of what the <code> happens to display. This is the wire the EARS criterion
    // actually cares about — and the one no other test exercises.
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText).toHaveBeenCalledWith(EXPECTED_COMMAND);
  });

  it("frd-01 AC-01-001.1: the clipboard payload MATCHES the visibly displayed command (display and copy cannot diverge)", async () => {
    render(<OnboardingGate />);

    const displayed = screen.getByTestId("onboarding-gate-command").textContent;
    fireEvent.click(screen.getByTestId("copy-button"));

    // Display and clipboard must be the same string — kills a mutant that changes
    // the CopyButton value without changing the <code> text (or vice-versa).
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(displayed);
    });
  });

  it('frd-01 AC-01-001.1: the copied value is non-empty and is a slash command (guards against value="")', async () => {
    render(<OnboardingGate />);

    fireEvent.click(screen.getByTestId("copy-button"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const copiedArg = writeText.mock.calls[0]?.[0] as string;
    expect(copiedArg).toBeTruthy();
    expect(copiedArg.length).toBeGreaterThan(0);
    expect(copiedArg.startsWith("/")).toBe(true);
  });
});
