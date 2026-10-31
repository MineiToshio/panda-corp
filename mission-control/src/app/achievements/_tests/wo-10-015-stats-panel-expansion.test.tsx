import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CharacterSheet } from "../_components/Stats/CharacterSheet";
import { LedgerCard } from "../_components/Stats/LedgerCard";
import { RecordTile } from "../_components/Stats/RecordTile";

afterEach(cleanup);
it("AC-10-026.1 AC-10-027.1: the replacement character sheet has six records and three eight-row ledgers", () => {
  render(
    <CharacterSheet
      readerData={{ ideas: [], statuses: [], eventsSnapshot: null }}
      scalars={{ frds: 21, commits: 823, projects: 2, decisions: 99, testsPassing: null }}
      records={{ peakWeek: 78, capturedLessons: 131, subagents: 0 }}
    />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(6);
  for (const card of ["Producción", "Calidad", "Ritmo y alcance"].map((name) =>
    screen.getByRole("region", { name }),
  ))
    expect(within(card).getAllByRole("listitem")).toHaveLength(8);
  expect(screen.getByText("823")).toBeVisible();
  expect(screen.getByText("99")).toBeVisible();
  expect(screen.getByRole("listitem", { name: "Tests en verde" })).toHaveTextContent(
    "— no cableado",
  );
});
it("AC-10-026.2: measured zero stays numeric and levels continue beyond five", () => {
  render(
    <LedgerCard
      title="Ledger"
      tone="teal"
      rows={[
        { key: "gates", label: "Observed failed gates", value: 0, level: 0 },
        { key: "orders", label: "Work orders", value: 10000, level: 12 },
        { key: "never", label: "Unobserved", value: 0, noData: true },
        { key: "unwired", label: "Unwired", value: null },
      ]}
    />,
  );
  expect(screen.getByRole("listitem", { name: "Observed failed gates" })).toHaveTextContent("0");
  expect(screen.getByRole("listitem", { name: "Observed failed gates" })).toHaveTextContent(
    "sin nivel",
  );
  expect(screen.queryByText("Nv 0")).not.toBeInTheDocument();
  expect(screen.getByText("Nv 12")).toBeVisible();
  expect(screen.getByRole("listitem", { name: "Unobserved" })).toHaveTextContent("sin datos aún");
  expect(screen.getByRole("listitem", { name: "Unwired" })).toHaveTextContent("— no cableado");
});

it("FRD-10 U14: a measured zero record has no level, while positive levels keep their text", () => {
  render(<RecordTile label="Zero record" value={0} sub="Observed" level={0} />);
  expect(screen.getByRole("article", { name: "Zero record" })).toHaveTextContent("sin nivel");
  expect(screen.queryByText("Nv 0")).not.toBeInTheDocument();
});
it("AC-10-026.2: unavailable commit counts render no cableado", () => {
  render(
    <CharacterSheet
      readerData={{ ideas: [], statuses: [], eventsSnapshot: null }}
      scalars={{ frds: 0, commits: null, projects: 0, decisions: 0, testsPassing: null }}
    />,
  );
  expect(screen.getByRole("listitem", { name: "Commits" })).toHaveTextContent("no cableado");
});
