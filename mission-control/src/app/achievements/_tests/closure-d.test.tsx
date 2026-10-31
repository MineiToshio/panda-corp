import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TrophiesTab } from "../_components/trophies/TrophiesTab";
import { TrophyCard } from "../_components/trophies/TrophyCard";
import { trophy } from "../_utils/_tests/fixtures";

afterEach(cleanup);
it("shows the earned percentage alongside the trophy progress", () => {
  render(
    <TrophiesTab
      uniques={[trophy("Won", { unlocked: true }), trophy("Locked")]}
      secrets={[]}
      seals={[]}
      onOpen={() => {}}
    />,
  );
  expect(screen.getByText("50%")).toBeInTheDocument();
});
it("identifies the category in the nearest trophy rarity line and preserves opening", () => {
  render(<TrophyCard trophy={trophy("Near")} variant="near" onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: /Near/ })).toHaveTextContent("Común · Descubrimiento");
});

it("names locked cards without losing their trophy title", () => {
  render(<TrophyCard trophy={trophy("Locked trophy")} onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: /Locked trophy.*Bloqueado/ })).toBeInTheDocument();
});
it("orders the remaining locked catalogue by rarity", () => {
  render(
    <TrophiesTab
      uniques={[
        trophy("Nearest"),
        trophy("Legend", { rarity: "Leyenda" }),
        trophy("Common"),
        trophy("Rare", { rarity: "Raro" }),
      ]}
      secrets={[]}
      seals={[]}
      onOpen={() => {}}
    />,
  );
  expect(
    within(screen.getByRole("region", { name: "Por conquistar" }))
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual([
    expect.stringContaining("Common"),
    expect.stringContaining("Rare"),
    expect.stringContaining("Legend"),
  ]);
});
it("omits project names from recent tiles", () => {
  render(
    <TrophyCard
      trophy={trophy("Recent", { unlocked: true, project: "Project evidence" })}
      variant="recent"
      onOpen={() => {}}
    />,
  );
  expect(screen.queryByText("Project evidence")).not.toBeInTheDocument();
});
