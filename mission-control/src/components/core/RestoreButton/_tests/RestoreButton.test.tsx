/**
 * RestoreButton — "Restaurar" (un-discard). Tests the single-click optimistic
 * flow: action called with the slug, success → done, failure → error + revert to idle.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RestoreButton } from "@/components/core/RestoreButton/RestoreButton";
import type { RestoreResult } from "@/lib/discard/restore";

function makeAction(result: RestoreResult) {
  return vi.fn().mockResolvedValue(result);
}

describe("RestoreButton", () => {
  it("renders a Spanish 'Restaurar' trigger", () => {
    render(
      <RestoreButton
        slug="idea-x"
        restoreAction={makeAction({ ok: true, restoredTo: "discovered" })}
      />,
    );
    const btn = screen.getByTestId("restore-button");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent?.toLowerCase()).toContain("restaurar");
  });

  it("calls the action with the slug after confirmation", async () => {
    const user = userEvent.setup();
    const action = makeAction({ ok: true, restoredTo: "recommended" });
    render(<RestoreButton slug="idea-x" restoreAction={action} />);

    await user.click(screen.getByTestId("restore-button"));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar" }));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith("idea-x");
    });
  });

  it("shows a done state after a successful restore", async () => {
    const user = userEvent.setup();
    render(
      <RestoreButton
        slug="idea-x"
        restoreAction={makeAction({ ok: true, restoredTo: "discovered" })}
      />,
    );

    await user.click(screen.getByTestId("restore-button"));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar" }));

    await waitFor(() => {
      expect(screen.getByTestId("restore-done")).toBeInTheDocument();
    });
  });

  it("reverts to idle when the action fails", async () => {
    const user = userEvent.setup();
    render(
      <RestoreButton
        slug="idea-x"
        restoreAction={makeAction({ ok: false, reason: "not-found" })}
      />,
    );

    await user.click(screen.getByTestId("restore-button"));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar" }));

    await waitFor(() => {
      expect(screen.getByTestId("restore-button")).toBeEnabled();
    });
    expect(screen.getByTestId("restore-button")).toBeInTheDocument();
    expect(screen.queryByTestId("restore-done")).not.toBeInTheDocument();
  });
});
