/** Reconciled to FRD-08 REQ-08-021; the v1 execution flags were retired. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

describe("Day 1: fenced resume and delivered state", () => {
  it.each(["construccion-desatendida"])("%s explains the current contract", (slug) => {
    const Page = getManualPageComponent(slug);
    if (!Page) throw new Error(slug);
    render(
      <article aria-label="Explicación">
        <Page />
      </article>,
    );
    const text = screen.getByRole("article", { name: "Explicación" }).textContent;
    expect(text).toContain("--resume <run-id>");
    expect(text).toContain("lease");
    expect(text).toContain("epoch");
    expect(text).toContain("merge-queue");
    expect(text).toContain("waiting_gate");
    expect(text).not.toMatch(/--lanes|--lane classic|maxAgents|reviewBudget|builderEffort/);
  });
});
