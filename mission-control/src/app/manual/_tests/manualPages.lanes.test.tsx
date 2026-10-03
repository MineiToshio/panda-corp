/**
 * Manual vs DR-125 (plugin 9.120.0, proposal 40): `implement` builds independent work orders in
 * parallel worktree lanes by default (2, more in powerful mode, automatically 1 on a narrow
 * dependency tree, `--lanes N` to change it), the review is cheaper (gate effort high off the
 * sensitive features, xhigh on sensitive or injection-risk code) and a production-build smoke runs.
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

const FLOW = ((): NonNullable<ReturnType<typeof getSkillFlow>> => {
  const flow = getSkillFlow("implement");
  if (flow === undefined) throw new Error("expected an implement flow");
  return flow;
})();

const FLOW_TEXT = [
  FLOW.explainer,
  ...FLOW.steps.flatMap((step) => [step.title, step.detail ?? "", step.note ?? ""]),
].join("\n");

const LANES_STEP_TITLES: readonly string[] = [
  "Lanzar el workflow + fijar el techo",
  "Construir cada FRD (carril rápido)",
  "Hito USABLE y gate de revisión por FRD",
  "Smoke del build de producción",
];

const LANES_COPY = [
  FLOW.explainer,
  ...FLOW.steps
    .filter((step) => LANES_STEP_TITLES.includes(step.title))
    .flatMap((step) => [step.title, step.detail ?? "", step.note ?? ""]),
].join("\n");

const DASHES = /[\u2013\u2014]/;

describe("implement skill flow, lanes by default (DR-125)", () => {
  it("says independent work orders build in parallel, 2 lanes by default", () => {
    expect(FLOW_TEXT).toMatch(/en paralelo/);
    expect(FLOW_TEXT).toMatch(/2 carriles por defecto/);
    expect(FLOW_TEXT).toMatch(/powerful/);
    expect(FLOW_TEXT).toMatch(/árbol de dependencias es estrecho/);
  });

  it("documents --lanes N and the --lanes 1 opt-out", () => {
    expect(FLOW_TEXT).toContain("--lanes N");
    expect(FLOW_TEXT).toContain("--lanes 1");
  });

  it("explains the cheaper review and the production-build smoke", () => {
    expect(FLOW_TEXT).toMatch(/esfuerzo high/);
    expect(FLOW_TEXT).toMatch(/xhigh/);
    expect(FLOW_TEXT).toMatch(/inyección/);
    expect(FLOW_TEXT).toMatch(/smoke del build de producción/);
  });

  it("has the production-smoke step, cites DR-125 and keeps the new copy free of em and en dashes", () => {
    for (const title of LANES_STEP_TITLES) {
      expect(FLOW.steps.map((step) => step.title)).toContain(title);
    }
    expect(FLOW_TEXT).toContain("DR-125");
    expect(LANES_COPY).not.toMatch(DASHES);
  });
});

describe("unattended-build page, lanes by default (DR-125)", () => {
  const text = renderText("construccion-desatendida");

  it("has a lanes section and the lanes arg with its default", () => {
    expect(text).toContain("Carriles en paralelo");
    expect(text).toContain("2 (desde 9.120.0)");
    expect(text).toContain("--lanes N");
    expect(text).toContain("--lanes 1");
  });

  it("says the lanes narrow to 1 on a narrow dependency tree and widen in powerful mode", () => {
    expect(text).toMatch(/árbol de dependencias es estrecho/);
    expect(text).toMatch(/powerful/);
  });

  it("explains the cheaper review and the production-build smoke", () => {
    expect(text).toMatch(/esfuerzo high/);
    expect(text).toMatch(/xhigh/);
    expect(text).toMatch(/smoke del build de producción/);
  });
});

describe("pandacorp-build workflow page, lanes by default (DR-125)", () => {
  it("mentions the parallel lanes of the fast lane", () => {
    const text = renderText("wf-pandacorp-build");
    expect(text).toMatch(/carriles en paralelo/i);
    expect(text).toContain("--lanes");
  });
});
