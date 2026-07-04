/**
 * MultiRuntimeDiagram (FRD-08 · multi-runtime) — the "dos puertas, un núcleo" picture.
 *
 * Covers: it renders, both doors are present and labelled (meaning not by color
 * alone), and the shared core is present.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MultiRuntimeDiagram } from "../MultiRuntimeDiagram";

describe("MultiRuntimeDiagram", () => {
  it("renders the diagram root", () => {
    render(<MultiRuntimeDiagram />);
    expect(screen.getByTestId("manual-diagram-multi-runtime")).toBeTruthy();
  });

  it("renders both doors, each with a text label", () => {
    render(<MultiRuntimeDiagram />);
    expect(screen.getByTestId("multi-runtime-door-claude")).toBeTruthy();
    expect(screen.getByTestId("multi-runtime-door-codex")).toBeTruthy();
    expect(screen.getByText("Puerta Claude Code")).toBeTruthy();
    expect(screen.getByText("Puerta Codex")).toBeTruthy();
  });

  it("renders the shared core with its pieces", () => {
    render(<MultiRuntimeDiagram />);
    const core = screen.getByTestId("multi-runtime-core");
    expect(core).toBeTruthy();
    expect(core.textContent).toContain("AGENTS.md + factory/");
    expect(core.textContent).toContain("estado en ficheros");
  });
});
