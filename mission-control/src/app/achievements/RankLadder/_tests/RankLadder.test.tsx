import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { guildLevel } from "../../_utils/_tests/fixtures";
import { RankLadder } from "../RankLadder";

afterEach(cleanup);
it("AC-10-028.4 collapses far eras, opens their same rows, persists expansion and has no special summit", () => {
  window.history.replaceState(null, "", "/achievements/ranks");
  const view = render(<RankLadder level={guildLevel()} />);
  const trigger = screen.getByRole("button", { name: /Los guardianes/ });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.getAllByTestId("rank-row")).toHaveLength(7);
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(
    within(screen.getByRole("region", { name: "Los guardianes" })).getAllByTestId("rank-row"),
  ).toHaveLength(9);
  expect(window.location.search).toBe("?eras=guardians");
  view.unmount();
  render(<RankLadder level={guildLevel()} />);
  expect(screen.getByRole("button", { name: /Los guardianes/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: /La trascendencia/ }));
  expect(screen.getByRole("img", { name: "Portador del Juramento Eterno" })).toBeInTheDocument();
  expect(screen.queryByText("LA CIMA")).not.toBeInTheDocument();
  expect(screen.getByText("Estás aquí")).toBeInTheDocument();
});
