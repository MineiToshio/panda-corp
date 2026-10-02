/**
 * Manual vs DR-124 (plugin 9.119.0): `implement` builds on the fast lane by default. The
 * unattended-build page and the implement skill flow must say USABLE vs VERIFIED, the sensitive
 * features that wait, the two switches and the clean pause/resume on a usage limit.
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

const FAST_LANE_STEP_TITLES: readonly string[] = [
  "Lanzar el workflow + fijar el techo",
  "Construir cada FRD (carril rápido)",
  "Hito USABLE y gate de revisión por FRD",
  "Reanudar para varias pasadas + apagado garantizado",
];

const FLOW = ((): NonNullable<ReturnType<typeof getSkillFlow>> => {
  const flow = getSkillFlow("implement");
  if (flow === undefined) throw new Error("expected an implement flow");
  return flow;
})();

const FLOW_TEXT = [
  FLOW.explainer,
  ...FLOW.steps.flatMap((step) => [step.title, step.detail ?? "", step.note ?? ""]),
].join("\n");

const FAST_LANE_COPY = [
  FLOW.explainer,
  ...FLOW.steps
    .filter((step) => FAST_LANE_STEP_TITLES.includes(step.title))
    .flatMap((step) => [step.title, step.detail ?? "", step.note ?? ""]),
].join("\n");

describe("implement skill flow, fast lane by default", () => {
  it("promises a USABLE milestone first and the opus review afterwards", () => {
    expect(FLOW_TEXT).toMatch(/USABLE/);
    expect(FLOW_TEXT).toMatch(/VERIFIED/);
    expect(FLOW_TEXT).toMatch(/en segundo plano/);
  });

  it("names the sensitive features that wait for VERIFIED", () => {
    expect(FLOW_TEXT).toMatch(/NO son usables hasta quedar VERIFIED/);
    for (const topic of ["dinero", "datos personales", "secretos", "borrados de datos"]) {
      expect(FLOW_TEXT).toContain(topic);
    }
  });

  it("documents the switches and the clean resume", () => {
    expect(FLOW_TEXT).toContain("--lane classic");
    expect(FLOW_TEXT).toContain("--review-budget defer");
    expect(FLOW_TEXT).toContain("--resume <run-id>");
  });

  it("keeps the maxAgents rule and the auto option", () => {
    expect(FLOW_TEXT).toContain("maxAgents");
    expect(FLOW_TEXT).toMatch(/auto/);
  });

  it("has every fast-lane step and no em or en dash in the new copy", () => {
    for (const title of FAST_LANE_STEP_TITLES) {
      expect(FLOW.steps.map((step) => step.title)).toContain(title);
    }
    expect(FAST_LANE_COPY).not.toMatch(/[\u2013\u2014]/);
  });
});

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
