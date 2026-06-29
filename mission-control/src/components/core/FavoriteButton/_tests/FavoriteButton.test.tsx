/**
 * FavoriteButton component tests (TDD: RED → GREEN → refactor).
 *
 * The star toggle that marks an idea card as a favourite (REQ-02-012):
 *   1. Renders an outline star when not a favourite, a filled star when it is.
 *   2. Exposes the state via aria-pressed (not colour alone — accessibility.md).
 *   3. On click, calls the favoriteAction Server Action with the TOGGLED value.
 *   4. Optimistic UI: flips immediately (the star/aria-pressed update before the action settles).
 *
 * Traceability:
 *   CMP-02-favorite-action → REQ-02-012
 *   AC-02-012.3 — clicking the star toggles the favourite flag via the Server Action.
 *
 * Stack: Vitest + @testing-library/react (jsdom). The Server Action is injected as a prop.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "@/components/core/FavoriteButton/FavoriteButton";
import type { FavoriteResult } from "@/lib/favorite/favorite";

function makeAction(result: FavoriteResult = { ok: true, favorite: true }) {
  return vi
    .fn<(slug: string, favorite: boolean) => Promise<FavoriteResult>>()
    .mockResolvedValue(result);
}

describe("FavoriteButton — rendering", () => {
  it("renders a button with data-testid='favorite-button'", () => {
    render(<FavoriteButton slug="idea-x" favorite={false} favoriteAction={makeAction()} />);
    expect(screen.getByTestId("favorite-button")).toBeInTheDocument();
  });

  it("is not pressed and labelled 'Marcar como favorita' when not a favourite", () => {
    render(<FavoriteButton slug="idea-x" favorite={false} favoriteAction={makeAction()} />);
    const btn = screen.getByTestId("favorite-button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAccessibleName("Marcar como favorita");
  });

  it("is pressed and labelled 'Quitar de favoritas' when already a favourite", () => {
    render(<FavoriteButton slug="idea-x" favorite={true} favoriteAction={makeAction()} />);
    const btn = screen.getByTestId("favorite-button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAccessibleName("Quitar de favoritas");
  });
});

describe("FavoriteButton — toggle (AC-02-012.3)", () => {
  it("calls the action with favorite=true when marking", async () => {
    const action = makeAction({ ok: true, favorite: true });
    const user = userEvent.setup();
    render(<FavoriteButton slug="idea-x" favorite={false} favoriteAction={action} />);
    await user.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(action).toHaveBeenCalledWith("idea-x", true));
  });

  it("calls the action with favorite=false when unmarking", async () => {
    const action = makeAction({ ok: true, favorite: false });
    const user = userEvent.setup();
    render(<FavoriteButton slug="idea-x" favorite={true} favoriteAction={action} />);
    await user.click(screen.getByTestId("favorite-button"));
    await waitFor(() => expect(action).toHaveBeenCalledWith("idea-x", false));
  });

  it("optimistically flips aria-pressed to true while the action is in flight", async () => {
    // Hold the action open so the optimistic state stays observable (useOptimistic reflects the
    // optimistic value only during the pending transition; it reverts once it settles with an
    // unchanged prop — in production revalidatePath updates the prop, here we just assert pending).
    let resolveAction!: (r: FavoriteResult) => void;
    const action = vi
      .fn<(slug: string, favorite: boolean) => Promise<FavoriteResult>>()
      .mockReturnValue(
        new Promise<FavoriteResult>((resolve) => {
          resolveAction = resolve;
        }),
      );
    const user = userEvent.setup();
    render(<FavoriteButton slug="idea-x" favorite={false} favoriteAction={action} />);
    await user.click(screen.getByTestId("favorite-button"));
    await waitFor(() =>
      expect(screen.getByTestId("favorite-button")).toHaveAttribute("aria-pressed", "true"),
    );
    resolveAction({ ok: true, favorite: true });
  });
});
