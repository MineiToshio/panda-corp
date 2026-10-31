/**
 * Manual vs DR-126 (plugin 9.121.0, proposal 41): the fast-lane builder writes its tests with the
 * code under a budget (one behaviour e2e spec per UI feature), gets a per-work-order brief, runs one
 * narrowed self-verify and runs sonnet at effort medium (`--builder-effort default` opts out).
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

function renderText(slug: string): string {
  const Component = getManualPageComponent(slug);
  if (Component === null) throw new Error(`expected a bespoke renderer for ${slug}`);
  return render(<Component />).container.textContent ?? "";
}

describe("unattended-build page, lighter fast-lane builder (DR-126)", () => {
  const text = renderText("construccion-desatendida");

  it("has the builder section, the builderEffort arg and the measured result", () => {
    expect(text).toContain("Builder más ligero");
    expect(text).toContain("'medium' (desde 9.121.0)");
    expect(text).toContain("--builder-effort default");
    expect(text).toMatch(/43,5 minutos/);
  });
});
