import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { ChangeCard } from "../ChangeCard";

function makeItem(over: Partial<ChangeQueueItem>): ChangeQueueItem {
  return {
    id: "mc-export-csv",
    type: "feature",
    cls: "standard",
    status: "ready",
    date: "2026-07-01",
    frd: "",
    rebuildsVerified: false,
    dependsOn: "",
    implementedSha: "",
    closingAt: "",
    title: "Agrega exportar a CSV",
    body: "## Qué se quiere\nUn botón que exporte a CSV.",
    ...over,
  };
}

const NOW = new Date("2026-09-24T12:00:00.000Z");

describe("ChangeCard — relative date (REQ-04-011)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the relative label instead of the raw ISO date, with the raw date as a tooltip", () => {
    render(<ChangeCard item={makeItem({ date: "2026-09-23" })} />);
    const dateEl = screen.getByTestId("change-card-date");
    expect(dateEl).toHaveTextContent("ayer");
    expect(dateEl).not.toHaveTextContent("2026-09-23");
    expect(dateEl).toHaveAttribute("title", "2026-09-23");
  });

  it("shows the relative label plus the FRD when both are present", () => {
    render(<ChangeCard item={makeItem({ date: "2026-09-24", frd: "FRD-04" })} />);
    const dateEl = screen.getByTestId("change-card-date");
    expect(dateEl).toHaveTextContent("hoy");
    expect(screen.getByText("FRD-04")).toBeInTheDocument();
  });

  it("falls back to the raw string when the date is unparseable, never hiding it (DR-078)", () => {
    render(<ChangeCard item={makeItem({ date: "not-a-real-date" })} />);
    const dateEl = screen.getByTestId("change-card-date");
    expect(dateEl).toHaveTextContent("not-a-real-date");
  });

  it("omits the date entirely when the item carries no date at all", () => {
    render(<ChangeCard item={makeItem({ date: "" })} />);
    expect(screen.queryByTestId("change-card-date")).not.toBeInTheDocument();
  });
});
