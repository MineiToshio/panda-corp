import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeSeals } from "@/lib/achievements/achievements";
import { RANKS } from "@/lib/gamification/gamification";
import { HallTabs } from "../_components/HallTabs";
import { MissionCard } from "../_components/missions/MissionCard";
import { MissionsTab } from "../_components/missions/MissionsTab";
import { NextRankCard } from "../_components/summary/NextRankCard";
import { SecretTile } from "../_components/trophies/SecretTile";
import { TrophiesTab } from "../_components/trophies/TrophiesTab";
import { guildLevel, mission, trophy } from "../_utils/_tests/fixtures";

beforeEach(() => window.history.replaceState(null, "", "/achievements"));
afterEach(cleanup);
describe("Orbita hall surfaces", () => {
  it("AC-10-028.1 summary offers next rank, evidence radar, four recent trophies and links onward", () => {
    const uniques = Array.from({ length: 6 }, (_, index) =>
      trophy(`Earned ${index}`, { unlocked: true, date: `2026-10-${20 + index}T00:00:00Z` }),
    );
    render(
      <HallTabs
        chains={[]}
        uniques={uniques}
        secrets={[]}
        readerData={{ ideas: [], statuses: [], eventsSnapshot: null }}
        level={guildLevel()}
        hero={<p>Guild hero</p>}
        trophiesCount={6}
      />,
    );
    expect(screen.getByRole("heading", { name: "Tu siguiente rango" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Atributos del gremio:/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver el escalafón" })).toHaveAttribute(
      "href",
      "/achievements/ranks",
    );
    expect(screen.getByRole("link", { name: "Ver todas las estadísticas" })).toHaveAttribute(
      "href",
      "/achievements/statistics",
    );
    expect(screen.getAllByRole("button", { name: /Earned/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole("tab", { name: "Misiones" }));
    expect(window.location.pathname).toBe("/achievements/missions");
    expect(screen.getByText("Guild hero")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Misiones", selected: true })).toBeInTheDocument();
  });
  it("at the highest rank there is no promised next rank", () => {
    const highest = RANKS.at(-1);
    if (!highest) throw new Error("Rank catalogue is empty");
    render(<NextRankCard level={{ ...guildLevel(), level: highest.minLevel }} />);
    expect(screen.getByText("Has alcanzado el rango más alto del gremio.")).toBeInTheDocument();
    expect(screen.queryByText(/Faltan/)).not.toBeInTheDocument();
  });
  it("AC-10-028.2 saga order keeps the spotlight then follows 80%, 30%, 0%", () => {
    const chains = [
      mission({ statKey: "C", label: "C", pctToNext: 0 }),
      mission({ statKey: "B", label: "B", pctToNext: 30 }),
      mission({ statKey: "A", label: "A", pctToNext: 80 }),
      mission({ statKey: "spot", label: "Spot", pctToNext: 90 }),
    ];
    render(<MissionsTab chains={chains} />);
    const saga = screen.getByRole("region", { name: "La Construcción" });
    expect(
      within(saga)
        .getAllByRole("article")
        .map((element) => element.getAttribute("aria-label")),
    ).toEqual(["Spot", "A", "B", "C"]);
    expect(within(saga).getByRole("article", { name: "C" })).toHaveAttribute(
      "data-untouched",
      "true",
    );
    expect(screen.getByRole("progressbar", { name: /A: 80%/ })).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
  });
  it("completed missions retain a full progress bar without date, project or crown", () => {
    render(
      <MissionCard
        chain={mission({
          nextTier: null,
          pctToNext: 100,
          value: 100,
          currentTierIndex: 4,
          currentTierName: "Legendary",
        })}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100 acumulado")).toBeInTheDocument();
    expect(screen.queryByText(/Cadena legendaria completada/)).not.toBeInTheDocument();
  });
  it("AC-10-028.3 locks use 12 + 24 reveal, remaining labels, category reset and secret concealment", () => {
    const uniques = Array.from({ length: 50 }, (_, index) => trophy(`Locked ${index}`));
    render(
      <TrophiesTab
        uniques={uniques}
        secrets={[{ hint: "Cryptic hint", unlocked: false }]}
        seals={computeSeals(uniques)}
        onOpen={() => {}}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "Por conquistar" })).getAllByRole("button"),
    ).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 24 más · quedan 37" }));
    expect(
      within(screen.getByRole("region", { name: "Por conquistar" })).getAllByRole("button"),
    ).toHaveLength(36);
    expect(screen.getByRole("button", { name: "Mostrar 13 más · quedan 13" })).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("group", { name: "Categoría" })).getByRole("button", {
        name: /Descubrimiento/,
      }),
    );
    expect(window.location.search).toContain("category=Discovery");
    expect(screen.queryByText("Cryptic hint")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Por conquistar" })).getAllByRole("button"),
    ).toHaveLength(12);
  });
  it("earned secrets render their actual condition with no invented rarity", () => {
    render(
      <SecretTile
        secret={{ hint: "Cryptic hint", unlocked: true, criterion: "Actual condition" }}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Cryptic hint/ })).toHaveTextContent(
      "Actual condition",
    );
    expect(screen.queryByText("Épico")).not.toBeInTheDocument();
  });
  it("trophy URL restores a native dialog; cancellation clears it and returns focus", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(
      <HallTabs
        chains={[]}
        uniques={[trophy("Real trophy")]}
        secrets={[]}
        readerData={{ ideas: [], statuses: [], eventsSnapshot: null }}
        level={guildLevel()}
        hero={null}
        trophiesCount={0}
      />,
    );
    await user.click(screen.getByRole("tab", { name: /Trofeos/ }));
    const trigger = screen.getByRole("button", { name: /Real trophy/ });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Real trophy" }).tagName).toBe("DIALOG");
    expect(new URLSearchParams(window.location.search).get("trophy")).toBe("Real trophy");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    act(() => {
      window.history.replaceState(null, "", "/achievements/trophies?trophy=Real+trophy");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("dialog", { name: "Real trophy" })).toBeInTheDocument();
  });
});
