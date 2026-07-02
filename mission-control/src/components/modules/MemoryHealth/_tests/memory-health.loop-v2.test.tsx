/**
 * WO-17-005 — MemoryHealth loop-v2 signals (CMP-17-health).
 *
 * Traceability (FRD-17 EARS → AC → test):
 *   AC-17-006.2  lastSweepAt (the daily sweep marker) replaces the approximate mtime
 *                sub-line when present; harvestOrphans reflects release-without-harvest.
 *   AC-17-006.3  The orphan banner renders ONLY when orphans exist, names each project,
 *                and carries the harvest command; absent otherwise (honest empty).
 *
 * Stack: Vitest + @testing-library/react (jsdom). No fs access — fixture props only.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MemoryHealth as MemoryHealthData } from "@/lib/memory/memory-health";
import { MemoryHealth } from "../MemoryHealth";

const BASE: MemoryHealthData = {
  rawNotes: 2,
  candidates: 1,
  lastMemoryRunAt: "2026-06-30T10:00:00.000Z",
  staleDays: 2,
  lastSweepAt: null,
  harvestOrphans: [],
};

describe("MemoryHealth — loop v2 signals (WO-17-005)", () => {
  it("AC-17-006.3: renders the orphan danger banner naming each un-harvested project", () => {
    render(<MemoryHealth health={{ ...BASE, harvestOrphans: ["proj-a", "proj-b"] }} />);

    const orphans = screen.getByTestId("memory-health-orphans");
    expect(orphans.textContent).toContain("proj-a");
    expect(orphans.textContent).toContain("proj-b");
    expect(orphans.textContent).toContain("/pandacorp:memory harvest");
  });

  it("AC-17-006.3: no orphan banner when harvestOrphans is empty (honest empty)", () => {
    render(<MemoryHealth health={BASE} />);

    expect(screen.queryByTestId("memory-health-orphans")).toBeNull();
  });

  it("AC-17-006.2: shows the real daily-sweep timestamp instead of the (aprox.) mtime proxy", () => {
    render(<MemoryHealth health={{ ...BASE, lastSweepAt: "2026-07-02T09:03:00Z" }} />);

    const panel = screen.getByTestId("memory-health-panel");
    expect(panel.textContent).toContain("barrido diario");
    expect(panel.textContent).not.toContain("(aprox.)");
  });

  it("AC-17-006.2: keeps the approximate mtime sub-line when the sweep marker is absent", () => {
    render(<MemoryHealth health={BASE} />);

    const panel = screen.getByTestId("memory-health-panel");
    expect(panel.textContent).toContain("(aprox.)");
  });
});
