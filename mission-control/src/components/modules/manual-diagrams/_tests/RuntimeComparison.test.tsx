/**
 * RuntimeComparison (FRD-08 · multi-runtime) — per-capability Claude vs Codex table.
 *
 * Covers: it renders, key capability rows are present, each status has a TEXT label
 * (never color alone), and the highlighted "identical governance" row is present.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuntimeComparison } from "../RuntimeComparison";

describe("RuntimeComparison", () => {
  it("renders the comparison root", () => {
    render(<RuntimeComparison />);
    expect(screen.getByTestId("manual-diagram-runtime-comparison")).toBeTruthy();
  });

  it("shows key capability rows", () => {
    render(<RuntimeComparison />);
    expect(screen.getByText("Build (implement)")).toBeTruthy();
    expect(screen.getByText("Subagentes")).toBeTruthy();
    expect(screen.getByText("Enforcement")).toBeTruthy();
    expect(screen.getByText("Claude Design")).toBeTruthy();
  });

  it("labels each status with readable text, not color alone", () => {
    render(<RuntimeComparison />);
    expect(screen.getAllByText("idéntico").length).toBeGreaterThan(0);
    expect(screen.getAllByText("degrada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("solo Claude").length).toBeGreaterThan(0);
    // The data attribute carries the same meaning for non-visual consumers.
    const [firstDegrades] = screen.getAllByTestId("runtime-status-degrades");
    expect(firstDegrades?.getAttribute("data-status")).toBe("degrades");
  });

  it("highlights the identical-governance row (change queue, gates, Spanish)", () => {
    render(<RuntimeComparison />);
    const identical = screen.getByTestId("runtime-row-identical");
    expect(within(identical).getByText(/idéntico en ambas puertas/)).toBeTruthy();
    expect(identical.textContent).toContain("gates humanos");
  });
});
