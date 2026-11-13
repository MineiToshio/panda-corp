import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

function page(slug: string): void {
  const Page = getManualPageComponent(slug);
  if (!Page) throw new Error(slug);
  render(
    <article aria-label="Página">
      <Page />
    </article>,
  );
}

describe("FRD-08 REQ-08-021 Day 1 build truth", () => {
  it.each([
    "g-modo",
    "g-cambio",
    "construccion-desatendida",
  ])("%s uses scoped CLI builds", (slug) => {
    page(slug);
    const text = screen.getByRole("article", { name: "Página" }).textContent;
    expect(text).toContain("/pandacorp:implement");
    expect(text).not.toMatch(
      /implement (pro|balanced|powerful|deep)|--lanes|--lane classic|Dynamic Workflow|pandacorp:ch[a]nge|maxAgents/,
    );
  });
  it("documents fencing, adaptive admission, selective repair and landing", () => {
    page("construccion-desatendida");
    const text = screen.getByRole("article").textContent;
    for (const term of [
      "pandacorp-build.mjs",
      "epoch",
      "30 minutos",
      "1/2/3/5/8",
      "disco",
      "journal.jsonl",
      "tres ejecuciones",
      "build y patch",
      "decisions.pending.md",
      "lane/<run_id>/integration",
      "merge-queue",
      "waiting_gate",
      "drive",
    ])
      expect(text).toContain(term);
  });
  it("keeps captured work outside the running scope", () => {
    page("g-cambio");
    const text = screen.getByRole("article").textContent;
    expect(text).toContain("draft");
    expect(text).toContain("card check");
    expect(text).toContain("no drena");
  });
});
