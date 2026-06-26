/**
 * DiscardedModal — the discarded-ideas list, in a modal (built on the shared Modal).
 * Tests: open/closed, the list + reasons, the empty state, row → onSelect, and close.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DiscardedModal } from "@/app/board/_components/DiscardedModal/DiscardedModal";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";

function entry(over: Partial<BoardCardEntry> & { slug: string; title: string }): BoardCardEntry {
  return { status: "discarded", body: "", ...over };
}

const CARDS: BoardCardEntry[] = [
  entry({ slug: "alpha", title: "Idea Alpha", discardReason: "saturado · muy complejo" }),
  entry({ slug: "beta", title: "Idea Beta" }),
];

describe("DiscardedModal", () => {
  it("renders nothing when closed", () => {
    render(<DiscardedModal open={false} onClose={vi.fn()} cards={CARDS} onSelect={vi.fn()} />);
    expect(screen.queryByTestId("discarded-modal")).not.toBeInTheDocument();
  });

  it("lists every discarded idea with its title and reason", () => {
    render(<DiscardedModal open onClose={vi.fn()} cards={CARDS} onSelect={vi.fn()} />);
    expect(screen.getByTestId("discarded-modal")).toBeInTheDocument();
    expect(screen.getByTestId("discarded-item-alpha")).toHaveTextContent("Idea Alpha");
    expect(screen.getByTestId("discarded-item-alpha")).toHaveTextContent("saturado · muy complejo");
    expect(screen.getByTestId("discarded-item-beta")).toHaveTextContent("Sin motivo registrado");
  });

  it("shows an empty state when there are no discarded ideas", () => {
    render(<DiscardedModal open onClose={vi.fn()} cards={[]} onSelect={vi.fn()} />);
    expect(screen.getByTestId("discarded-empty")).toBeInTheDocument();
  });

  it("calls onSelect with the slug when a row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DiscardedModal open onClose={vi.fn()} cards={CARDS} onSelect={onSelect} />);
    await user.click(screen.getByTestId("discarded-item-alpha"));
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("closes on the ✕ button (shared Modal chrome)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DiscardedModal open onClose={onClose} cards={CARDS} onSelect={vi.fn()} />);
    await user.click(screen.getByTestId("discarded-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
