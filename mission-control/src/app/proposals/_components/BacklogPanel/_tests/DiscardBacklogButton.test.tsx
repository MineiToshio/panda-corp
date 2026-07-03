/**
 * DiscardBacklogButton tests (mirrors DiscardChangeButton's pattern, FRD-22, REQ-22-007).
 *
 * The confirm step is INLINE (no nested Modal — this button lives inside a modal
 * already), so we assert on the inline confirm/cancel buttons instead of a dialog.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DiscardBacklogResult } from "@/lib/backlog/discard-backlog";
import { DiscardBacklogButton } from "../DiscardBacklogButton";

function makeAction(result: DiscardBacklogResult) {
  return vi.fn().mockResolvedValue(result);
}

const BASE_PROPS = { id: "BL-0007" };

describe("DiscardBacklogButton — rendering", () => {
  it("renders the trigger button with a Spanish label", () => {
    render(<DiscardBacklogButton {...BASE_PROPS} discardAction={makeAction({ ok: true })} />);
    const btn = screen.getByTestId("discard-backlog-button");
    expect(btn.textContent?.toLowerCase()).toContain("descartar");
  });

  it("does NOT show the inline confirm step initially", () => {
    render(<DiscardBacklogButton {...BASE_PROPS} discardAction={makeAction({ ok: true })} />);
    expect(screen.queryByTestId("discard-backlog-confirm-button")).not.toBeInTheDocument();
  });
});

describe("DiscardBacklogButton — inline confirm (no nested modal)", () => {
  it("shows an inline confirm/cancel row after clicking the trigger, with no dialog role", async () => {
    const user = userEvent.setup();
    render(<DiscardBacklogButton {...BASE_PROPS} discardAction={makeAction({ ok: true })} />);

    await user.click(screen.getByTestId("discard-backlog-button"));

    expect(screen.getByTestId("discard-backlog-confirm-button")).toBeInTheDocument();
    expect(screen.getByTestId("discard-backlog-cancel-button")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancel returns to the idle trigger without calling the action", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardBacklogButton {...BASE_PROPS} discardAction={action} />);

    await user.click(screen.getByTestId("discard-backlog-button"));
    await user.click(screen.getByTestId("discard-backlog-cancel-button"));

    expect(screen.getByTestId("discard-backlog-button")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});

describe("DiscardBacklogButton — confirm calls the action", () => {
  it("calls discardAction with the item id on confirm", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardBacklogButton {...BASE_PROPS} discardAction={action} />);

    await user.click(screen.getByTestId("discard-backlog-button"));
    await user.click(screen.getByTestId("discard-backlog-confirm-button"));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith("BL-0007");
    });
  });

  it("shows a done state and calls onDiscarded on success", async () => {
    const user = userEvent.setup();
    const onDiscarded = vi.fn();
    render(
      <DiscardBacklogButton
        {...BASE_PROPS}
        discardAction={makeAction({ ok: true })}
        onDiscarded={onDiscarded}
      />,
    );

    await user.click(screen.getByTestId("discard-backlog-button"));
    await user.click(screen.getByTestId("discard-backlog-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-backlog-done")).toBeInTheDocument();
    });
    expect(onDiscarded).toHaveBeenCalledTimes(1);
  });

  it("reverts to idle with an error message when the action fails, and does not call onDiscarded", async () => {
    const user = userEvent.setup();
    const onDiscarded = vi.fn();
    render(
      <DiscardBacklogButton
        {...BASE_PROPS}
        discardAction={makeAction({ ok: false, reason: "not-discardable" })}
        onDiscarded={onDiscarded}
      />,
    );

    await user.click(screen.getByTestId("discard-backlog-button"));
    await user.click(screen.getByTestId("discard-backlog-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-backlog-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("discard-backlog-button")).toBeInTheDocument();
    expect(onDiscarded).not.toHaveBeenCalled();
  });
});
