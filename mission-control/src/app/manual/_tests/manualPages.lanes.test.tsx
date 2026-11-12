/** Reconciled to FRD-08 REQ-08-021; the v1 execution flags were retired. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

describe("Day 1: adaptive admission", () => {
  it.each(["construccion-desatendida"])("%s explains the current contract", (slug) => {
    const Page = getManualPageComponent(slug);
    if (!Page) throw new Error(slug);
    render(
      <article aria-label="Explicación">
        <Page />
      </article>,
    );
    const text = screen.getByRole("article", { name: "Explicación" }).textContent;
    expect(text).toContain("1/2/3/5/8");
    expect(text).toContain("admission.json");
    expect(text).toContain("techo");
    expect(text).toContain("disco");
    expect(text).toContain("nunca 0");
    expect(text).not.toMatch(/--lanes|--lane classic|maxAgents|reviewBudget|builderEffort/);
  });
});
