/** Reconciled to FRD-08 REQ-08-021; the v1 execution flags were retired. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

describe("Day 1: cross-company review and selective repair", () => {
  it.each(["construccion-desatendida"])("%s explains the current contract", (slug) => {
    const Page = getManualPageComponent(slug);
    if (!Page) throw new Error(slug);
    render(
      <article aria-label="Explicación">
        <Page />
      </article>,
    );
    const text = screen.getByRole("article", { name: "Explicación" }).textContent;
    expect(text).toContain("otra compañía");
    expect(text).toContain("FRD completo");
    expect(text).toContain("tres ejecuciones");
    expect(text).toContain("solo build y patch");
    expect(text).toContain("conservando el trabajo sano");
    expect(text).not.toMatch(/--lanes|--lane classic|maxAgents|reviewBudget|builderEffort/);
  });
});
