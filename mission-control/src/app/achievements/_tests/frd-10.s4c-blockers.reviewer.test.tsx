/**
 * FRD-10 reviewer gate on WO-10-016: RED until the listed clauses hold. The approved prototype
 * (`docs/design/prototype/prototype.js:1967,1971,2103`, `prototype.css:1016`) outranks the FRD for
 * visual wording and hue, per the owner's close-out rule.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ChainState, Secret, Unique } from "@/lib/achievements/achievements";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { MissionCard } from "../_components/missions/MissionCard";
import { MissionsTab } from "../_components/missions/MissionsTab";
import { TrophiesTab } from "../_components/trophies/TrophiesTab";
import { RankLadder } from "../RankLadder/RankLadder";

afterEach(cleanup);

function chain(overrides: Partial<ChainState>): ChainState {
  return {
    statKey: "workorders",
    label: "Work orders completados",
    saga: "La Construcción",
    currentTierIndex: 1,
    currentTierName: "Jefe de fábrica",
    nextTier: { name: "El fordismo digital", threshold: 200 },
    pctToNext: 84,
    lowerIsBetter: false,
    unlocks: [],
    value: 176,
    ...overrides,
  };
}
function unique(index: number): Unique {
  return {
    name: `Trofeo ${index}`,
    category: "Discovery",
    rarity: "Común",
    unlocked: false,
    condition: "Condición real.",
  };
}
const noop = (): void => undefined;

describe("FRD-10 Misiones", () => {
  it("FRD-10 sagas keep every mission: the spotlight chain also stays in its saga («5 misiones»)", () => {
    const chains = [chain({}), chain({ statKey: "b", label: "B", pctToNext: 30, value: 3 })];
    render(<MissionsTab chains={chains} />);
    const saga = screen.getByRole("region", { name: "La Construcción" });
    expect(within(saga).getByText("2 misiones")).toBeInTheDocument();
    expect(within(saga).getAllByRole("article")).toHaveLength(2);
  });

  it("AC-10-028.2 a chain that just crossed a tier is touched: not muted, ahead of a zero chain", () => {
    const crossed = chain({
      statKey: "crossed",
      label: "Cruzada",
      pctToNext: 0,
      value: 50,
      currentTierIndex: 1,
    });
    const zero = chain({
      statKey: "zero",
      label: "Intacta",
      pctToNext: 0,
      value: 0,
      currentTierIndex: -1,
      currentTierName: null,
    });
    render(<MissionsTab chains={[zero, crossed]} />);
    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual(["Cruzada", "Intacta"]);
    expect(cards[0]).toHaveAttribute("data-untouched", "false");
    expect(cards[1]).toHaveAttribute("data-untouched", "true");
  });

  it("FRD-10 chain card: goal row separates the next tier from «valor / umbral»", () => {
    render(<MissionCard chain={chain({})} />);
    const value = screen.getByText("176 / 200");
    expect(value.parentElement).toHaveTextContent(/^El fordismo digital\s*176 \/ 200$/);
  });

  it("FRD-10 chain card: a lower-is-better goal keeps the prototype's «valor / umbral»", () => {
    render(
      <MissionCard
        chain={chain({
          statKey: "speed",
          label: "Récord idea→launch (días)",
          lowerIsBetter: true,
          value: 22,
          nextTier: { name: "Sprint serio", threshold: 14 },
        })}
      />,
    );
    const value = screen.getByText("22 / 14");
    expect(value.parentElement).toHaveTextContent(/^Sprint serio\s*22 \/ 14$/);
  });

  it("FRD-10 chain card: the bar stays gold whatever the tier's rarity hue", () => {
    render(
      <MissionCard
        chain={chain({ statKey: "shipped", currentTierIndex: 2, currentTierName: "Raro" })}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-tone", "gold");
  });
});

describe("FRD-10 Trofeos", () => {
  it("Por conquistar counts every locked trophy listed, not the visible page", () => {
    const uniques = Array.from({ length: 40 }, (_, index) => unique(index));
    render(<TrophiesTab uniques={uniques} secrets={[]} seals={[]} onOpen={noop} />);
    const section = screen.getByRole("region", { name: "Por conquistar" });
    expect(within(section).getByText("39")).toBeInTheDocument();
  });

  it("FRD-10 an unlocked secret moves to Conquistados as a tile showing its condition", () => {
    const secret: Secret = { hint: "La cripta", unlocked: true, criterion: "Abriste la cripta." };
    render(<TrophiesTab uniques={[]} secrets={[secret]} seals={[]} onOpen={noop} />);
    const won = screen.getByRole("region", { name: "Conquistados" });
    expect(within(won).getByText("Abriste la cripta.")).toBeInTheDocument();
  });

  it("FRD-10 a conquered tile shows a readable date and its project", () => {
    const won: Unique = {
      ...unique(1),
      unlocked: true,
      date: "2026-10-06T12:00:00Z",
      project: "PersonalPage v2",
    };
    render(<TrophiesTab uniques={[won]} secrets={[]} seals={[]} onOpen={noop} />);
    const tile = within(screen.getByRole("region", { name: "Conquistados" })).getByRole("button");
    expect(tile).toHaveTextContent("PersonalPage v2");
    expect(tile).toHaveTextContent("6 oct");
    expect(tile.textContent).not.toContain("T12:00");
  });
});

describe("FRD-10 Rangos", () => {
  it("FRD-10 the first rank's XP threshold reads «0 XP», never a stand-in label", () => {
    const level = { level: 2, title: "x", xp: 20, next: 40, pctToNext: 30 } as GuildLevel;
    render(<RankLadder level={level} />);
    const [first] = screen.getAllByTestId("rank-row");
    expect(first).toHaveTextContent(/(?<!\d)0 XP$/);
    expect(first).not.toHaveTextContent("Inicio");
  });
});
