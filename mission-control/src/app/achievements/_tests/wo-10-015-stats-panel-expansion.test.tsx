/**
 * WO-10-015 — StatsPanel ledger expansion (8 rows × 3 cols) + records grid (2×3).
 *
 * Traceability:
 *   AC-10-015.7 — ledger = exactly 8 rows in each of 3 columns (aligned, no staircase);
 *                 records = a 2×3 grid of 6 records (adds Peak week, Lessons, Subagents).
 *
 * Blueprint: CMP-10-stats-panel (FRD-10 blueprint §4)
 * Source-of-truth hierarchy: FRD > FDD > design-tokens > blueprint > work order
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReportScalars } from "@/lib/achievements/report/types";
import type { ReaderData } from "@/lib/achievements/stats";
import { StatsPanel } from "../StatsPanel";

afterEach(cleanup);

const READER: ReaderData = { ideas: [], statuses: [], eventsSnapshot: null };

const SCALARS: ReportScalars = {
  frds: 21,
  commits: 823,
  decisions: 99,
  projects: 2,
  testsPassing: 7134,
};

const RECORDS = { peakWeek: 78, capturedLessons: 131, subagents: 3171 } as const;

describe("WO-10-015: StatsPanel ledger + records expansion (AC-10-015.7)", () => {
  it("renders exactly 8 ledger rows in each of the 3 columns", () => {
    render(<StatsPanel readerData={READER} scalars={SCALARS} records={RECORDS} />);
    const columns = screen.getAllByTestId("stat-ledger-column");
    expect(columns).toHaveLength(3);
    for (const col of columns) {
      expect(within(col).getAllByTestId("stat-ledger-row")).toHaveLength(8);
    }
  });

  it("wires the new Producción rows (FRDs 21, Commits 823, Projects 2)", () => {
    render(<StatsPanel readerData={READER} scalars={SCALARS} records={RECORDS} />);
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("823")).toBeInTheDocument();
  });

  it("wires the new Calidad rows (Tests 7134, DR 99)", () => {
    render(<StatsPanel readerData={READER} scalars={SCALARS} records={RECORDS} />);
    expect(screen.getByText("7134")).toBeInTheDocument();
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("renders Tests passing as 'no cableado' when the scalar source is absent", () => {
    render(
      <StatsPanel
        readerData={READER}
        scalars={{ ...SCALARS, testsPassing: null }}
        records={RECORDS}
      />,
    );
    expect(screen.getAllByText(/no cablead|sin cablear/i).length).toBeGreaterThan(0);
  });

  it("renders a 2×3 records grid of 6 record tiles", () => {
    render(<StatsPanel readerData={READER} scalars={SCALARS} records={RECORDS} />);
    const heroStats = screen.getAllByTestId("hero-stat");
    expect(heroStats).toHaveLength(6);
    expect(screen.getByText("Pico semanal")).toBeInTheDocument();
    expect(screen.getByText("Lecciones")).toBeInTheDocument();
    expect(screen.getByText("Subagentes")).toBeInTheDocument();
  });
});
