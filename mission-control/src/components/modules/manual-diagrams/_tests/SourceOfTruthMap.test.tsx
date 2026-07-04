/**
 * SourceOfTruthMap (FRD-08 · multi-runtime) — the single-source-of-truth map.
 *
 * Covers: it renders the 5 mechanism rows, each mechanism carries a TEXT label
 * (never color alone), and the only derived copy (Codex TOMLs) is flagged.
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
    for (const label of ["symlink", "import", "compartido", "generado", "espejo"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByTestId("sot-row-symlink")).toBeTruthy();
    expect(screen.getByTestId("sot-row-generated")).toBeTruthy();
  });

  it("flags the único derived copy (the generated Codex agent TOMLs)", () => {
    render(<SourceOfTruthMap />);
    const flag = screen.getByTestId("sot-derived-flag");
    expect(flag.textContent).toContain("única copia derivada");
  });
});
