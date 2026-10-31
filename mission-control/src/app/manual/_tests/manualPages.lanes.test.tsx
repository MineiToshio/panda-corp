/**
 * Manual vs DR-125 (plugin 9.120.0, proposal 40): `implement` builds independent work orders in
 * parallel worktree lanes by default (2, more in powerful mode, automatically 1 on a narrow
 * dependency tree, `--lanes N` to change it), the review is cheaper (gate effort high off the
 * sensitive features, xhigh on sensitive or injection-risk code) and a production-build smoke runs.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

function renderText(slug: string): string {
  const Component = getManualPageComponent(slug);
  if (Component === null) throw new Error(`expected a bespoke renderer for ${slug}`);
  return render(<Component />).container.textContent ?? "";
}

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
