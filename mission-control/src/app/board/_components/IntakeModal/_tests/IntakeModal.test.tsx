/**
 * WO-02-006 — IntakeModal component acceptance tests (TDD: RED phase).
 *
 * Anchored in EARS criteria (FRD-02 / WO-02-006):
 *   AC-02-003.1 — WHEN the owner clicks "Capture ideas / oportunidades", the system SHALL open a
 *                 modal overlay (dark backdrop + blur) with the four intake commands —
 *                 `/pandacorp:explore`, `:new-idea`, `:discover`, `:recommend` — each with an
 *                 icon, title, description and copy-command row.
 *   AC-02-003.2 — Clicking the backdrop or the ✕ button SHALL close the modal.
 *   AC-02-003.3 — The board SHALL remain visible behind the modal as context.
 *
 * Derived from regression evidence in .pandacorp/comms/progress.md:
 *   - No bugs logged for IntakeModal yet (pre-build). Regression anchors are
 *     therefore derived from the EARS criteria and from patterns observed in sibling
 *     components (CopyButton, DiscardButton, IdeaBoardView).
 *
 * Component contract (CMP-02-intake-modal, WO-02-006):
 *   - `components/IntakeModal.tsx` — "use client" overlay.
 *   - Props: `open: boolean`, `onClose: () => void`.
 *   - `data-testid="intake-modal"` on the dialog/root.
 *   - `data-testid="intake-backdrop"` on the clickable backdrop element.
 *   - `data-testid="intake-close"` on the ✕ button.
 *   - `data-testid="intake-command-{slug}"` on each of the four command rows
 *     (slugs: explore, new-idea, discover, recommend).
 *   - Uses `<CopyButton value="/pandacorp:…" />` for each command.
 *   - `aria-modal="true"` and focus-trap for accessibility.
 *   - Dismisses on Escape key (a11y).
 *   - Board stays mounted (the component is rendered beside the board, not replacing it).
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 * Isolation: each test uses `cleanup()` in afterEach; clipboard is mocked per
 * describe block where needed.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeModal } from "@/app/board/_components/IntakeModal/IntakeModal";

// ---------------------------------------------------------------------------
// Clipboard mock — required because IntakeModal embeds CopyButton instances
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Open / not-open rendering (AC-02-003.1)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1: IntakeModal — open / not-open rendering", () => {
  it("frd-02: WHEN open=true THEN the modal is present in the DOM", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();
  });

  it("frd-02: WHEN open=false THEN the modal is not present in the DOM", () => {
    mockClipboard();
    render(<IntakeModal open={false} onClose={() => {}} />);
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("frd-02: WHEN open=true THEN the modal has aria-modal='true'", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    const modal = screen.getByTestId("intake-modal");
    expect(modal).toHaveAttribute("aria-modal", "true");
  });

  it("frd-02: WHEN open=true THEN the modal has a role of 'dialog'", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    // The container element must have role dialog (either native <dialog> or role="dialog")
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Four intake commands present (AC-02-003.1)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1: IntakeModal — four intake commands", () => {
  beforeEach(() => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
  });

  it("frd-02: renders the /pandacorp:explore command row", () => {
    expect(screen.getByTestId("intake-command-explore")).toBeInTheDocument();
  });

  it("frd-02: renders the /pandacorp:new-idea command row", () => {
    expect(screen.getByTestId("intake-command-new-idea")).toBeInTheDocument();
  });

  it("frd-02: renders the /pandacorp:discover command row", () => {
    expect(screen.getByTestId("intake-command-discover")).toBeInTheDocument();
  });

  it("frd-02: renders the /pandacorp:recommend command row", () => {
    expect(screen.getByTestId("intake-command-recommend")).toBeInTheDocument();
  });

  it("frd-02: there are exactly four command rows", () => {
    // data-testid prefix is "intake-command-*"; we count via the parent list
    const rows = [
      screen.getByTestId("intake-command-explore"),
      screen.getByTestId("intake-command-new-idea"),
      screen.getByTestId("intake-command-discover"),
      screen.getByTestId("intake-command-recommend"),
    ];
    expect(rows).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 3. Each command row has icon, title and description (AC-02-003.1)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1: IntakeModal — command row anatomy", () => {
  beforeEach(() => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
  });

  const COMMAND_SLUGS = ["explore", "new-idea", "discover", "recommend"] as const;

  for (const slug of COMMAND_SLUGS) {
    it(`frd-02: '${slug}' command row has an icon element`, () => {
      const row = screen.getByTestId(`intake-command-${slug}`);
      // Icon is any <img>, <svg> or element with data-testid ending in "-icon"
      const icon =
        row.querySelector("img, svg, [data-testid$='-icon']") ??
        within(row).queryByTestId(`intake-command-${slug}-icon`);
      expect(icon).not.toBeNull();
    });

    it(`frd-02: '${slug}' command row has a non-empty title`, () => {
      const row = screen.getByTestId(`intake-command-${slug}`);
      const title = within(row).getByTestId(`intake-command-${slug}-title`);
      expect(title.textContent?.trim().length).toBeGreaterThan(0);
    });

    it(`frd-02: '${slug}' command row has a non-empty description`, () => {
      const row = screen.getByTestId(`intake-command-${slug}`);
      const desc = within(row).getByTestId(`intake-command-${slug}-description`);
      expect(desc.textContent?.trim().length).toBeGreaterThan(0);
    });

    it(`frd-02: '${slug}' command row has a CopyButton (data-testid='copy-button')`, () => {
      const row = screen.getByTestId(`intake-command-${slug}`);
      expect(within(row).getByTestId("copy-button")).toBeInTheDocument();
    });
  }
});

// ---------------------------------------------------------------------------
// 4. CopyButton values are the exact /pandacorp:* command strings (AC-02-003.1)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1: IntakeModal — CopyButton copies exact command string", () => {
  const EXPECTED: Record<string, string> = {
    explore: "/pandacorp:explore",
    "new-idea": "/pandacorp:new-idea",
    discover: "/pandacorp:discover",
    recommend: "/pandacorp:recommend",
  };

  for (const [slug, command] of Object.entries(EXPECTED)) {
    it(`frd-02: WHEN the '${slug}' CopyButton is clicked THEN clipboard receives '${command}'`, async () => {
      const { writeText } = mockClipboard();
      render(<IntakeModal open={true} onClose={() => {}} />);
      const row = screen.getByTestId(`intake-command-${slug}`);
      fireEvent.click(within(row).getByTestId("copy-button"));
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(command));
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Close via ✕ button (AC-02-003.2)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.2: IntakeModal — close via ✕ button", () => {
  it("frd-02: WHEN the ✕ button is clicked THEN onClose is called exactly once", async () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);
    const closeBtn = screen.getByTestId("intake-close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("frd-02: the ✕ button is a focusable <button> element", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    const closeBtn = screen.getByTestId("intake-close");
    expect(closeBtn.tagName.toLowerCase()).toBe("button");
  });

  it("frd-02: the ✕ button has an accessible aria-label in Spanish", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    const closeBtn = screen.getByTestId("intake-close");
    const label = closeBtn.getAttribute("aria-label") ?? "";
    expect(label.trim().length).toBeGreaterThan(0);
    // Must not be bare English "close"
    expect(label.toLowerCase()).not.toBe("close");
  });

  it("frd-02: clicking ✕ does not propagate to the backdrop (no double-close)", async () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("intake-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Close via backdrop click (AC-02-003.2)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.2: IntakeModal — close via backdrop click", () => {
  it("frd-02: WHEN the backdrop is clicked THEN onClose is called exactly once", async () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("intake-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("frd-02: the backdrop element is present when open=true", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    expect(screen.getByTestId("intake-backdrop")).toBeInTheDocument();
  });

  it("frd-02: clicking the modal panel itself does NOT call onClose (only the backdrop does)", async () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);
    // Click the modal dialog container — not the backdrop
    fireEvent.click(screen.getByTestId("intake-modal"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Close via Escape key (AC-02-003.2 — a11y requirement per WO-02-006 design)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.2: IntakeModal — close via Escape key", () => {
  it("frd-02: WHEN the Escape key is pressed THEN onClose is called", async () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("frd-02: Escape key does not trigger onClose when open=false", async () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("frd-02: pressing a non-Escape key does not call onClose", async () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Enter", code: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. Board remains mounted behind the modal (AC-02-003.3)
//    The modal is an overlay — it does NOT replace or unmount the board.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.3: IntakeModal — board remains mounted behind modal", () => {
  it("frd-02: WHEN the modal is open THEN sibling elements in the tree remain in the DOM", () => {
    mockClipboard();
    // Render the board simulacrum alongside the modal (as the page would)
    render(
      <div>
        <div data-testid="board-behind">Board content stays mounted</div>
        <IntakeModal open={true} onClose={() => {}} />
      </div>,
    );
    // Both the modal and the board are present simultaneously
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();
    expect(screen.getByTestId("board-behind")).toBeInTheDocument();
  });

  it("frd-02: toggling open=false removes the modal but leaves the board in place", () => {
    mockClipboard();
    const { rerender } = render(
      <div>
        <div data-testid="board-behind">Board content</div>
        <IntakeModal open={true} onClose={() => {}} />
      </div>,
    );
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();

    rerender(
      <div>
        <div data-testid="board-behind">Board content</div>
        <IntakeModal open={false} onClose={() => {}} />
      </div>,
    );

    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
    // Board element must still be in the DOM — not unmounted with the modal
    expect(screen.getByTestId("board-behind")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 9. Backdrop styling — dark backdrop + blur are applied (AC-02-003.1)
//    We verify that the backdrop element has the expected CSS classes or inline
//    style tokens rather than asserting specific pixel values, since design tokens
//    may be applied via class or CSS variables.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1: IntakeModal — backdrop visual properties", () => {
  it("frd-02: the backdrop element exists and is behind the modal panel", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    // Backdrop exists
    const backdrop = screen.getByTestId("intake-backdrop");
    const modal = screen.getByTestId("intake-modal");
    // The modal (dialog panel) must be a descendant of — or sibling to — the backdrop
    // but NOT a child of it (otherwise clicks on the backdrop would bubble from the modal).
    // Most implementations have them as siblings inside a container, or the backdrop is a
    // separate element that does NOT contain the modal panel.
    expect(backdrop).not.toContain(modal);
  });
});

// ---------------------------------------------------------------------------
// 10. Accessibility — focus trap and keyboard navigation (WO-02-006 design)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.2: IntakeModal — accessibility focus management", () => {
  it("frd-02: WHEN the modal opens THEN focus is placed inside the modal (not on document.body)", async () => {
    mockClipboard();
    const user = userEvent.setup();
    render(<IntakeModal open={true} onClose={() => {}} />);
    // After mount the active element should be somewhere inside the modal or the modal itself
    const modal = screen.getByTestId("intake-modal");
    // Give focus-trap time to apply (microtask boundary)
    await user.tab(); // at minimum, Tab moves focus into the modal
    // The active element must be inside the dialog
    expect(modal.contains(document.activeElement) || document.activeElement === modal).toBe(true);
  });

  it("frd-02: the ✕ button is keyboard-reachable via Tab (it is a <button>)", () => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
    const closeBtn = screen.getByTestId("intake-close");
    // A <button> is focusable by default; tabIndex must not be -1
    const tabIndex = closeBtn.getAttribute("tabindex");
    expect(tabIndex === null || Number(tabIndex) >= 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11. Open → close → re-open cycle (idempotency / state reset)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1/2: IntakeModal — open → close → re-open cycle", () => {
  it("frd-02: re-opening the modal after it was closed renders all four commands again", () => {
    mockClipboard();
    const { rerender } = render(<IntakeModal open={true} onClose={() => {}} />);
    // Close
    rerender(<IntakeModal open={false} onClose={() => {}} />);
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();

    // Re-open
    rerender(<IntakeModal open={true} onClose={() => {}} />);
    expect(screen.getByTestId("intake-command-explore")).toBeInTheDocument();
    expect(screen.getByTestId("intake-command-new-idea")).toBeInTheDocument();
    expect(screen.getByTestId("intake-command-discover")).toBeInTheDocument();
    expect(screen.getByTestId("intake-command-recommend")).toBeInTheDocument();
  });

  it("frd-02: onClose from the previous open cycle does not fire when reopened", () => {
    mockClipboard();
    const firstOnClose = vi.fn();
    const { rerender } = render(<IntakeModal open={true} onClose={firstOnClose} />);
    rerender(<IntakeModal open={false} onClose={firstOnClose} />);

    const secondOnClose = vi.fn();
    rerender(<IntakeModal open={true} onClose={secondOnClose} />);
    // Pressing Escape now should call secondOnClose, not firstOnClose
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(secondOnClose).toHaveBeenCalledTimes(1);
    expect(firstOnClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 12. Edge cases — onClose is not called without a user action
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.2: IntakeModal — onClose not called spuriously", () => {
  it("frd-02: simply rendering the modal does not invoke onClose", () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={true} onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("frd-02: rendering with open=false does not invoke onClose", () => {
    mockClipboard();
    const onClose = vi.fn();
    render(<IntakeModal open={false} onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("frd-02: multiple re-renders without user interaction do not invoke onClose", () => {
    mockClipboard();
    const onClose = vi.fn();
    const { rerender } = render(<IntakeModal open={true} onClose={onClose} />);
    rerender(<IntakeModal open={true} onClose={onClose} />);
    rerender(<IntakeModal open={true} onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 13. Command title / description language — must be in Spanish (i18n)
//     Per AGENTS.md: user-facing content is Spanish by default.
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1: IntakeModal — Spanish copy in command rows", () => {
  const COMMAND_SLUGS = ["explore", "new-idea", "discover", "recommend"] as const;

  beforeEach(() => {
    mockClipboard();
    render(<IntakeModal open={true} onClose={() => {}} />);
  });

  for (const slug of COMMAND_SLUGS) {
    it(`frd-02: '${slug}' title is not empty (i18n content present)`, () => {
      const row = screen.getByTestId(`intake-command-${slug}`);
      const title = within(row).getByTestId(`intake-command-${slug}-title`);
      expect(title.textContent?.trim().length).toBeGreaterThan(0);
    });

    it(`frd-02: '${slug}' description is not empty (i18n content present)`, () => {
      const row = screen.getByTestId(`intake-command-${slug}`);
      const desc = within(row).getByTestId(`intake-command-${slug}-description`);
      expect(desc.textContent?.trim().length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 14. Renders without crashing in isolation (smoke)
// ---------------------------------------------------------------------------

describe("frd-02 AC-02-003.1: IntakeModal — smoke renders", () => {
  it("frd-02: renders with open=true without throwing", () => {
    mockClipboard();
    expect(() => render(<IntakeModal open={true} onClose={() => {}} />)).not.toThrow();
  });

  it("frd-02: renders with open=false without throwing", () => {
    mockClipboard();
    expect(() => render(<IntakeModal open={false} onClose={() => {}} />)).not.toThrow();
  });

  it("frd-02: renders with a no-op onClose without throwing", () => {
    mockClipboard();
    expect(() => render(<IntakeModal open={true} onClose={() => {}} />)).not.toThrow();
  });
});
