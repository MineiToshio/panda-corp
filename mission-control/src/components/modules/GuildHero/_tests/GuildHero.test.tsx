import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { GuildHero } from "../GuildHero";

afterEach(cleanup);
it("renders actual rank, level, XP, trophy/secret/tier counts without the retired roster and records", () => {
  render(
    <GuildHero
      level={6}
      title="Rank name"
      xp={160}
      next={200}
      pctToNext={30}
      trophiesCount={3}
      trophiesTotal={50}
      secretsCount={2}
      secretsTotal={8}
      tiersReached={12}
    />,
  );
  expect(screen.getByRole("heading", { name: "Rank name" })).toBeInTheDocument();
  expect(screen.getByText("160 XP · 40 para el nivel 7")).toBeInTheDocument();
  expect(screen.getByText("3/50")).toBeInTheDocument();
  expect(screen.getByText("2/8")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  expect(screen.queryByText("TU PARTY")).not.toBeInTheDocument();
});
