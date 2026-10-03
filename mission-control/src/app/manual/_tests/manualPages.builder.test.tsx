/**
 * Manual vs DR-126 (plugin 9.121.0, proposal 41): the fast-lane builder writes its tests with the
 * code under a budget (one behaviour e2e spec per UI feature), gets a per-work-order brief, runs one
 * narrowed self-verify and runs sonnet at effort medium (`--builder-effort default` opts out).
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getSkillFlow } from "@/lib/manual/skill-flows";
import { getManualPageComponent } from "../manualPages";

function renderText(slug: string): string {
  const Component = getManualPageComponent(slug);
  if (Component === null) throw new Error(`expected a bespoke renderer for ${slug}`);
  return render(<Component />).container.textContent ?? "";
}

const DASHES = /[–—]/;

describe("implement skill flow, lighter fast-lane builder (DR-126)", () => {
  const flow = getSkillFlow("implement");
  const step = flow?.steps.find((s) => s.title === "Construir cada FRD (carril rápido)");

  it("says tests are written with the code under a budget, at effort medium, with the opt-out", () => {
    const copy = `${step?.detail ?? ""}\n${step?.note ?? ""}`;
    expect(copy).toMatch(/tests escritos junto al código/);
    expect(copy).toMatch(/spec e2e de comportamiento/);
    expect(copy).toMatch(/esfuerzo medium/);
    expect(copy).toContain("--builder-effort default");
    expect(copy).toContain("DR-126");
    expect(copy).not.toMatch(DASHES);
  });
});

describe("unattended-build page, lighter fast-lane builder (DR-126)", () => {
  const text = renderText("construccion-desatendida");

  it("has the builder section, the builderEffort arg and the measured result", () => {
    expect(text).toContain("Builder más ligero");
    expect(text).toContain("'medium' (desde 9.121.0)");
    expect(text).toContain("--builder-effort default");
    expect(text).toMatch(/43,5 minutos/);
  });
});
