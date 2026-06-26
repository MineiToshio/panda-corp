/**
 * WO-02-009 — DiscardButton component tests (TDD: RED → GREEN → refactor).
 *
 * Tests the DiscardButton client component which:
 *   1. Shows a "Descartar idea" trigger button.
 *   2. On click, shows a confirmation step (destructive action safety net).
 *   3. On confirm, calls the discardIdeaAction Server Action with the slug.
 *   4. Implements optimistic UI: moves to "discarded" state optimistically,
 *      reverts if the action returns { ok: false }.
 *
 * Traceability:
 *   CMP-02-discard-action → REQ-02-007
 *   AC-02-007.1 — WHEN the owner presses "Discard idea", the system SHALL rewrite
 *                 `status: discarded` in the `.md` frontmatter.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * Mocks: discardIdeaAction (the Server Action dependency).
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Server Action — the component receives it as a prop so no module
// mock is needed; we pass a vi.fn() directly as the action prop.
// ---------------------------------------------------------------------------

import { DiscardButton } from "@/components/core/DiscardButton/DiscardButton";
import type { DiscardResult } from "@/lib/discard/discard";

// Helper: build a mock action that returns a given result
function makeAction(result: DiscardResult) {
  return vi.fn().mockResolvedValue(result);
}

// ---------------------------------------------------------------------------
// Rendering + data-testid contract
// ---------------------------------------------------------------------------

describe("DiscardButton — rendering", () => {
  it("renders without throwing", () => {
    const action = makeAction({ ok: true });
    expect(() =>
      render(<DiscardButton slug="idea-discovered" discardAction={action} />),
    ).not.toThrow();
  });

  it("has data-testid='discard-button' on the trigger button", () => {
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);
    expect(screen.getByTestId("discard-button")).toBeInTheDocument();
  });

  it("trigger button label is in Spanish", () => {
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);
    const btn = screen.getByTestId("discard-button");
    expect(btn.textContent?.toLowerCase()).toContain("descartar");
  });

  it("does NOT show confirmation step initially", () => {
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);
    expect(screen.queryByTestId("discard-confirm-button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Confirmation step (destructive action safety net)
// ---------------------------------------------------------------------------

describe("DiscardButton — confirmation step", () => {
  it("shows confirmation step after clicking the trigger button", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));

    expect(screen.getByTestId("discard-confirm-button")).toBeInTheDocument();
  });

  it("shows a cancel option in the confirmation step", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));

    expect(screen.getByTestId("discard-cancel-button")).toBeInTheDocument();
  });

  it("cancelling the confirmation reverts to the idle trigger state", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-cancel-button"));

    expect(screen.queryByTestId("discard-confirm-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("discard-button")).toBeInTheDocument();
  });

  it("does NOT call the action when the user cancels", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-cancel-button"));

    expect(action).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Happy path: confirm → action called → success state
// ---------------------------------------------------------------------------

describe("DiscardButton — confirm and success", () => {
  it("calls the action with the slug when the user confirms", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      // reason is the 2nd arg; empty string when the owner picks no tag/text.
      expect(action).toHaveBeenCalledWith("idea-discovered", "");
    });
  });

  it("calls the action exactly once per confirmation", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a discarded/done state after a successful action", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-done")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Failure path: confirm → action fails → revert to idle
// ---------------------------------------------------------------------------

describe("DiscardButton — failure and revert", () => {
  it("reverts to idle state when the action returns { ok: false, reason: 'not-found' }", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: false, reason: "not-found" });
    render(<DiscardButton slug="idea-missing" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-button")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("discard-done")).not.toBeInTheDocument();
  });

  it("reverts to idle state when the action returns { ok: false, reason: 'parse-error' }", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: false, reason: "parse-error" });
    render(<DiscardButton slug="idea-malformed" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-button")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("discard-done")).not.toBeInTheDocument();
  });

  it("shows an error message when the action fails", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: false, reason: "not-found" });
    render(<DiscardButton slug="idea-missing" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-error")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Pending/loading state during async action
// ---------------------------------------------------------------------------

describe("DiscardButton — pending state", () => {
  it("disables the confirm button while the action is in-flight", async () => {
    const user = userEvent.setup();
    // A promise that never resolves so we can inspect the in-flight state.
    const action = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    // The confirm button should be disabled while the action is pending.
    expect(screen.getByTestId("discard-confirm-button")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("DiscardButton — accessibility", () => {
  it("trigger button has an aria-label in Spanish", () => {
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);
    const btn = screen.getByTestId("discard-button");
    const label = btn.getAttribute("aria-label") ?? btn.textContent ?? "";
    expect(label.toLowerCase()).toMatch(/descartar/i);
  });

  it("trigger button is a button element (keyboard accessible)", () => {
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);
    expect(screen.getByTestId("discard-button").tagName).toBe("BUTTON");
  });

  it("confirm button has an aria-label", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));

    const confirmBtn = screen.getByTestId("discard-confirm-button");
    const label = confirmBtn.getAttribute("aria-label") ?? confirmBtn.textContent ?? "";
    expect(label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Discard reason capture (AC-02-007.2) — the owner can say WHY on confirm
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reason capture opens in a MODAL, not an inline expand (owner rule, FRD-02)
// ---------------------------------------------------------------------------

describe("DiscardButton — confirmation opens in a modal", () => {
  it("does NOT render the modal until the trigger is clicked", () => {
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);
    expect(screen.queryByTestId("discard-modal")).not.toBeInTheDocument();
  });

  it("opens a dialog modal (with the reason form inside) after clicking the trigger", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));

    const modal = screen.getByTestId("discard-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("role", "dialog");
    expect(modal).toContainElement(screen.getByTestId("discard-reason-form"));
    expect(modal).toContainElement(screen.getByTestId("discard-confirm-button"));
  });

  it("keeps the trigger button mounted while the modal is open (no layout jump)", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));

    expect(screen.getByTestId("discard-button")).toBeInTheDocument();
  });

  it("closes the modal and does NOT call the action when dismissed via the ✕ button", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-close"));

    expect(screen.queryByTestId("discard-modal")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("closes the modal and does NOT call the action when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-backdrop"));

    expect(screen.queryByTestId("discard-modal")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("dismissing via the ✕ clears the captured reason (re-open is clean)", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByRole("button", { name: "muy complejo" }));
    await user.click(screen.getByTestId("discard-close"));
    await user.click(screen.getByTestId("discard-button"));

    expect(screen.getByRole("button", { name: "muy complejo" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("closes the modal after a successful discard", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-done")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("discard-modal")).not.toBeInTheDocument();
  });
});

describe("DiscardButton — discard reason capture", () => {
  it("shows the reason form (tags + free text) in the confirmation step", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-discovered" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));

    expect(screen.getByTestId("discard-reason-form")).toBeInTheDocument();
    expect(screen.getByTestId("discard-reason-text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "no me interesa el tema" })).toBeInTheDocument();
  });

  it("passes the composed reason (tag + free text) to the action on confirm", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByRole("button", { name: "no me interesa el tema" }));
    await user.type(screen.getByTestId("discard-reason-text"), "no es mi nicho");
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith("idea-x", "no me interesa el tema — no es mi nicho");
    });
  });

  it("combines multiple tags with a separator", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByRole("button", { name: "muy complejo" }));
    await user.click(screen.getByRole("button", { name: "no monetiza en Perú" }));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith("idea-x", "muy complejo · no monetiza en Perú");
    });
  });

  it("passes an empty reason when the owner confirms without choosing one", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("discard-confirm-button"));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith("idea-x", "");
    });
  });

  it("clears the captured reason when the owner cancels", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardButton slug="idea-x" discardAction={action} />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByRole("button", { name: "muy complejo" }));
    await user.click(screen.getByTestId("discard-cancel-button"));
    // Re-open: the previously selected tag must not still be pressed.
    await user.click(screen.getByTestId("discard-button"));

    expect(screen.getByRole("button", { name: "muy complejo" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
