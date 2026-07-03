/**
 * DiscardChangeButton tests (mirrors DiscardButton's pattern, FRD-04, REQ-04-008).
 *
 * The confirm step is INLINE (no nested Modal — this button lives inside a modal
 * already), so we assert on the inline confirm/cancel buttons instead of a dialog.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DiscardChangeResult } from "@/lib/changes/discard-change";
import { DiscardChangeButton } from "../DiscardChangeButton";

function makeAction(result: DiscardChangeResult) {
  return vi.fn().mockResolvedValue(result);
}

const BASE_PROPS = { projectPath: "/tmp/proj", id: "mc-export-csv", slug: "mission-control" };

describe("DiscardChangeButton — rendering", () => {
  it("renders the trigger button with a Spanish label", () => {
    render(<DiscardChangeButton {...BASE_PROPS} discardAction={makeAction({ ok: true })} />);
    const btn = screen.getByTestId("discard-change-button");
    expect(btn.textContent?.toLowerCase()).toContain("descartar");
  });

  it("does NOT show the inline confirm step initially", () => {
    render(<DiscardChangeButton {...BASE_PROPS} discardAction={makeAction({ ok: true })} />);
    expect(screen.queryByTestId("discard-change-confirm-button")).not.toBeInTheDocument();
  });
});

describe("DiscardChangeButton — inline confirm (no nested modal)", () => {
  it("shows an inline confirm/cancel row after clicking the trigger, with no dialog role", async () => {
    const user = userEvent.setup();
    render(<DiscardChangeButton {...BASE_PROPS} discardAction={makeAction({ ok: true })} />);

    await user.click(screen.getByTestId("discard-change-button"));

    expect(screen.getByTestId("discard-change-confirm-button")).toBeInTheDocument();
    expect(screen.getByTestId("discard-change-cancel-button")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancel returns to the idle trigger without calling the action", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardChangeButton {...BASE_PROPS} discardAction={action} />);

    await user.click(screen.getByTestId("discard-change-button"));
    await user.click(screen.getByTestId("discard-change-cancel-button"));

    expect(screen.getByTestId("discard-change-button")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});

describe("DiscardChangeButton — confirm calls the action", () => {
  it("calls discardAction with projectPath, id and slug on confirm", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true });
    render(<DiscardChangeButton {...BASE_PROPS} discardAction={action} />);

    await user.click(screen.getByTestId("discard-change-button"));
    await user.click(screen.getByTestId("discard-change-confirm-button"));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith("/tmp/proj", "mc-export-csv", "mission-control");
    });
  });

  it("shows a done state and calls onDiscarded on success", async () => {
    const user = userEvent.setup();
    const onDiscarded = vi.fn();
    render(
      <DiscardChangeButton
        {...BASE_PROPS}
        discardAction={makeAction({ ok: true })}
        onDiscarded={onDiscarded}
      />,
    );

    await user.click(screen.getByTestId("discard-change-button"));
    await user.click(screen.getByTestId("discard-change-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-change-done")).toBeInTheDocument();
    });
    expect(onDiscarded).toHaveBeenCalledTimes(1);
  });

  it("reverts to idle with an error message when the action fails, and does not call onDiscarded", async () => {
    const user = userEvent.setup();
    const onDiscarded = vi.fn();
    render(
      <DiscardChangeButton
        {...BASE_PROPS}
        discardAction={makeAction({ ok: false, reason: "not-discardable" })}
        onDiscarded={onDiscarded}
      />,
    );

    await user.click(screen.getByTestId("discard-change-button"));
    await user.click(screen.getByTestId("discard-change-confirm-button"));

    await waitFor(() => {
      expect(screen.getByTestId("discard-change-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("discard-change-button")).toBeInTheDocument();
    expect(onDiscarded).not.toHaveBeenCalled();
  });
});
