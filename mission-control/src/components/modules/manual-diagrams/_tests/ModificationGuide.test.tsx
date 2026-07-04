/**
 * ModificationGuide (FRD-08 · multi-runtime) — "si cambias X, haz también Y".
 *
 * Covers: it renders, and the key cross-runtime actions (regenerate TOMLs, keep
 * AGENTS.md self-contained) are present.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModificationGuide } from "../ModificationGuide";

describe("ModificationGuide", () => {
  it("renders the guide root", () => {
    render(<ModificationGuide />);
    expect(screen.getByTestId("manual-diagram-modification-guide")).toBeTruthy();
  });

  it("lists the key cross-runtime change rows", () => {
    render(<ModificationGuide />);
    expect(screen.getByText("Un agente (plugin/agents/*.md)")).toBeTruthy();
    expect(screen.getByText("La versión del plugin")).toBeTruthy();
    // The agent-regeneration action names the generator script.
    const root = screen.getByTestId("manual-diagram-modification-guide");
    expect(root.textContent).toContain("generate-codex-agents.mjs");
  });
});
