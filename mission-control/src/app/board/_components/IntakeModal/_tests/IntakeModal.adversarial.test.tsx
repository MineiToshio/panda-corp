/**
 * WO-02-006 — IntakeModal ADVERSARIAL tests (reviewer, DR-015).
 *
 * Written by the reviewer (Opus) — a DIFFERENT model from the implementer —
 * to probe edges, errors and abuse the implementer's own suite did NOT cover.
 * These are derived from the EARS criteria (AC-02-003.1/.2/.3) and from the
 * WO-02-006 design contract ("Focus trap + aria-modal for accessibility",
 * "Escape also closes (a11y)", "close on backdrop click").
 *
 * Goal: find behavior the existing IntakeModal.test.tsx (60 green tests) does
 * not assert. Tests that pass too easily are flagged in the review; tests that
 * FAIL surface real defects.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntakeModal } from "@/app/board/_components/IntakeModal/IntakeModal";

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
// A. Stale-closure regression — onClose identity changes between renders.
//    The Escape useEffect depends on [open, onClose]; a stale closure would
//    call the PREVIOUS onClose. The implementer tested re-open but not a live
//    onClose swap while the modal stays open.
// ---------------------------------------------------------------------------

describe("adversarial: Escape uses the CURRENT onClose, never a stale one", () => {
  it("WHEN onClose prop is swapped while open=true THEN Escape calls the NEW handler", () => {
    mockClipboard();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<IntakeModal open={true} onClose={first} />);
    // Swap the handler WITHOUT closing the modal.
    rerender(<IntakeModal open={true} onClose={second} />);

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("WHEN onClose is swapped while open THEN backdrop click calls the NEW handler", () => {
    mockClipboard();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<IntakeModal open={true} onClose={first} />);
    rerender(<IntakeModal open={true} onClose={second} />);

    fireEvent.click(screen.getByTestId("intake-backdrop"));

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// B. Document-level Escape listener must be UNREGISTERED when unmounted.
//    A leaked listener would keep calling onClose after the component is gone
//    (memory leak + ghost callbacks). The implementer tested open=false but
//    not a full unmount + post-unmount keypress.
// ---------------------------------------------------------------------------

describe("adversarial: Escape listener does not leak past unmount", () => {
  it("WHEN the modal is unmounted THEN a later Escape press does NOT call onClose", () => {
    mockClipboard();
    const onClose = vi.fn();
    const { unmount } = render(<IntakeModal open={true} onClose={onClose} />);
    unmount();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("WHEN toggled open=false THEN Escape no longer reaches the now-removed handler", () => {
    mockClipboard();
    const onClose = vi.fn();
    const { rerender } = render(<IntakeModal open={true} onClose={onClose} />);
    rerender(<IntakeModal open={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// C. Clicking a CopyButton (or any interactive element) INSIDE the panel must
//    NOT bubble up and close the modal. The implementer asserted the panel
//    container does not close, but never clicked a real child control.
// ---------------------------------------------------------------------------

describe("adversarial: interactions INSIDE the panel never close the modal", () => {
  it("WHEN a CopyButton inside the panel is clicked THEN onClose is NOT called", () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);

    const row = screen.getByTestId("intake-command-explore");
    fireEvent.click(within(row).getByTestId("copy-button"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("WHEN the command list / a title inside the panel is clicked THEN onClose is NOT called", () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("intake-command-discover-title"));
    fireEvent.click(screen.getByTestId("intake-command-recommend-description"));

    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// D. Uniqueness — there must be exactly ONE dialog, ONE backdrop, ONE close
//    button and ONE copy-button per command. Duplicates break getByTestId and
//    indicate a double-render bug. Implementer used getByTestId (which throws
//    on duplicates) but never asserted the *count* explicitly.
// ---------------------------------------------------------------------------

describe("adversarial: no duplicated singleton elements", () => {
  it("renders exactly one dialog, one backdrop and one close button", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    expect(screen.getAllByTestId("intake-modal")).toHaveLength(1);
    expect(screen.getAllByTestId("intake-backdrop")).toHaveLength(1);
    expect(screen.getAllByTestId("intake-close")).toHaveLength(1);
  });

  it("renders exactly four copy-buttons (one per command, no more)", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    expect(screen.getAllByTestId("copy-button")).toHaveLength(4);
  });

  it("the four command slugs are all distinct (no slug collision)", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    const codes = screen.getAllByText(/^\/pandacorp:/).map((el) => el.textContent?.trim());
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
    expect(unique).toEqual(
      new Set([
        "/pandacorp:explore",
        "/pandacorp:new-idea",
        "/pandacorp:discover",
        "/pandacorp:recommend",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// E. The board behind must NOT be unmounted/hidden by a click that closes.
//    AC-02-003.3 — overlay, not replacement. Also a repeated open→close→open
//    must not accumulate stacked backdrops.
// ---------------------------------------------------------------------------

describe("adversarial: overlay semantics across rapid toggles", () => {
  it("rapid open/close/open does not stack multiple backdrops", () => {
    mockClipboard();
    const { rerender } = render(<IntakeModal open={true} onClose={() => {}} />);
    rerender(<IntakeModal open={false} onClose={() => {}} />);
    rerender(<IntakeModal open={true} onClose={() => {}} />);
    rerender(<IntakeModal open={false} onClose={() => {}} />);
    rerender(<IntakeModal open={true} onClose={() => {}} />);
    expect(screen.getAllByTestId("intake-backdrop")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// F. ACCESSIBILITY — aria-modal="true" is a CONTRACT. It promises focus is
//    trapped inside the dialog (WO design: "Focus trap + aria-modal"). If the
//    component sets aria-modal but does NOT trap, screen-reader/keyboard users
//    can Tab onto the board behind while the AT believes they are trapped.
//    This is the adversarial probe the implementer's "focus management" test
//    (which only asserts focus STARTS inside) does not cover.
// ---------------------------------------------------------------------------

describe("adversarial: aria-modal focus-trap is real, not just an attribute", () => {
  it("WHEN focus is on the last focusable element and Tab is pressed THEN focus stays INSIDE the dialog", async () => {
    mockClipboard();
    const user = userEvent.setup();
    // Board control AFTER the modal in DOM order so a forward Tab from the last
    // modal element would naturally land on it (or on body) without a trap.
    render(
      <div>
        <IntakeModal open={true} onClose={() => {}} />
        <button type="button" data-testid="behind-button">
          board control
        </button>
      </div>,
    );

    const modal = screen.getByTestId("intake-modal");
    // Focus the last focusable control inside the modal (the last copy button).
    const copyButtons = screen.getAllByTestId("copy-button");
    const lastCopy = copyButtons[copyButtons.length - 1];
    if (!lastCopy) throw new Error("No copy buttons found");
    lastCopy.focus();
    expect(modal.contains(document.activeElement)).toBe(true);

    // Tab forward from the last element. With a real focus trap, focus wraps
    // back into the modal; WITHOUT one, it leaves the dialog (to the board
    // control or to document.body). The CONTRACT promised by aria-modal="true"
    // is that focus never leaves the dialog.
    await user.tab();

    expect(
      modal.contains(document.activeElement),
      "aria-modal='true' but focus left the dialog on Tab — focus trap is missing (a11y contract violated)",
    ).toBe(true);
  });
});
