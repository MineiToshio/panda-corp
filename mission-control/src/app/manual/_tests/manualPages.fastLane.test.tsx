/**
 * Manual vs DR-124 (plugin 9.119.0): `implement` builds on the fast lane by default. The
 * unattended-build page and the implement skill flow must say USABLE vs VERIFIED, the sensitive
 * features that wait, the two switches and the clean pause/resume on a usage limit.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

function renderText(slug: string): string {
  const Component = getManualPageComponent(slug);
  if (Component === null) throw new Error(`expected a bespoke renderer for ${slug}`);
  return render(<Component />).container.textContent ?? "";
}

describe("unattended-build page, fast lane by default", () => {
  const text = renderText("construccion-desatendida");

  it("explains the fast lane, USABLE vs VERIFIED and the sensitive-feature wait", () => {
    expect(text).toContain("El carril rápido");
    expect(text).toMatch(/USABLE no es VERIFIED/);
    expect(text).toMatch(/Las features sensibles esperan/);
  });

  it("lists the lane and reviewBudget args with their defaults", () => {
    expect(text).toContain("'fast' (desde 9.119.0)");
    expect(text).toContain("reviewBudget");
    expect(text).toContain("--lane classic");
    expect(text).toContain("--review-budget defer");
  });

  it("describes the pause on a usage limit and the --resume relaunch", () => {
    expect(text).toMatch(/se pausa limpio/);
    expect(text).toContain("--resume <run-id>");
  });

  it("keeps the measured maxAgents rule and maxAgents auto", () => {
    expect(text).toContain("maxAgents");
    expect(text).toContain("maxAgents auto");
  });
});

describe("pandacorp-build workflow page", () => {
  it("flags the fast lane as the default and the global waves as classic", () => {
    const text = renderText("wf-pandacorp-build");

    expect(text).toContain("carril rápido");
    expect(text).toMatch(/carril classic/);
  });
});
