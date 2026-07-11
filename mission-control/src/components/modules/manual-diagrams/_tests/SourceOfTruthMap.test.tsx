/**
 * SourceOfTruthMap (FRD-08 · multi-runtime) — the single-source-of-truth map.
 *
 * Covers: mechanisms carry readable labels and generated projections are flagged.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceOfTruthMap } from "../SourceOfTruthMap";

describe("SourceOfTruthMap", () => {
  it("renders the map root", () => {
    render(<SourceOfTruthMap />);
    expect(screen.getByTestId("manual-diagram-sot-map")).toBeTruthy();
  });

  it("renders one row per mechanism with a readable label", () => {
    render(<SourceOfTruthMap />);
    for (const label of ["symlink", "import", "compartido"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("generado")).toHaveLength(3);
    expect(screen.getByTestId("sot-row-symlink")).toBeTruthy();
    expect(screen.getAllByTestId("sot-row-generated")).toHaveLength(3);
  });

  it("flags every verified generated projection", () => {
    render(<SourceOfTruthMap />);
    const flags = screen.getAllByTestId("sot-derived-flag");
    expect(flags).toHaveLength(3);
    expect(flags[0]?.textContent).toContain("proyección derivada verificada");
    expect(screen.getByText("Vocabulario de eventos")).toBeTruthy();
  });
});
