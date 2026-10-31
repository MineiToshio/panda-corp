import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { WoStateFilter } from "../wo-state-filter";

it("AC-05-008.2 toggles an OR set in canonical URL order and hides the absent blocker tile", async () => {
  const select = vi.fn();
  render(
    <WoStateFilter selected={null} states={["done"]} onSelect={() => {}} onStatesChange={select} />,
  );
  expect(screen.getByRole("button", { name: /Verificado/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.queryByRole("button", { name: /Bloqueado/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /En revisión/ }));
  expect(select).toHaveBeenCalledWith(["review", "done"]);
});
