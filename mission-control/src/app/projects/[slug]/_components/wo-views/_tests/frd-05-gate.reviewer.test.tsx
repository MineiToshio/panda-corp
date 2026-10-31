/**
 * FRD-05 stream gate (Opus, builder-blind): the integration edges of WO-05-008 and WO-05-009 over
 * the real readers, on fixtures the implementer did not see.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dependencyChain } from "@/lib/deps-layout/chain";
import { frdLayout } from "@/lib/deps-layout/frd-layout";
import { workOrderLayout } from "@/lib/deps-layout/work-order-layout";
import { extractSections } from "@/lib/work-orders/sections";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import ObservabilidadPanel from "../../../_panels/ObservabilidadPanel";
import type { PanelProps } from "../../../_panels/types";
import { DependencyCanvas } from "../../deps/DependencyCanvas";
import { CriterionList } from "../../wo-detail/CriterionList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../../_observability/WoLiveRefresh/wo-live-refresh", () => ({
  WoLiveRefresh: () => null,
}));

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  window.history.replaceState(null, "", "/");
});
function project(projectPath: string): PanelProps["project"] {
  return {
    slug: "demo",
    folder: "demo",
    name: "Demo",
    projectPath,
    frds: [],
  } as unknown as PanelProps["project"];
}
const route = {
  navigationBaseHref: "/portfolio/demo/observability",
  state: {},
  woTabParam: "summary",
} as unknown as PanelProps["route"];

describe("FRD-05 edge case: a project with no work orders yet", () => {
  it("a design-phase project with no docs/frds folder reads as empty, not as a read error", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wo-nofrds-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "docs/product"), { recursive: true });
    render(<ObservabilidadPanel project={project(root)} route={route} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/todavía no tiene work orders publicadas/)).toBeInTheDocument();
  });

  it("a real docs/frds with folders but no orders reads as empty", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wo-empty-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "docs/frds/frd-01-a"), { recursive: true });
    render(<ObservabilidadPanel project={project(root)} route={route} />);
    expect(screen.getByText(/todavía no tiene work orders publicadas/)).toBeInTheDocument();
  });
});

describe("AC-12-006.1 scoped FRD carried from the Por FRD select into Dependencias", () => {
  const order = (id: string, frd: string): WorkOrder => ({
    id,
    frd,
    title: `${id} — T`,
    state: "todo",
    relPath: "docs/x.md",
  });
  const orders = [order("WO-01-001", "frd-01-a"), order("WO-02-001", "frd-02-b")];
  const frds = [
    { slug: "frd-01-a", code: "FRD-01", title: "A" },
    { slug: "frd-02-b", code: "FRD-02", title: "B" },
  ];
  const data = {
    orders,
    frds,
    frdGeometry: frdLayout(orders, frds),
    workLayouts: Object.fromEntries(
      ["", ...frds.map((f) => f.slug)].map((slug) => [slug, workOrderLayout(orders, slug)]),
    ),
    chains: Object.fromEntries(orders.map((o) => [o.id, dependencyChain(orders, o.id)])),
  };
  it("the canonical frd=FRD-01 the select writes scopes the work-order graph", () => {
    window.history.replaceState(
      null,
      "",
      "/portfolio/demo/observability?view=deps&dag=wo&frd=FRD-01",
    );
    render(<DependencyCanvas data={data} />);
    expect(screen.getByRole("combobox")).toHaveValue("frd-01-a");
    expect(document.querySelector('[data-wo="WO-02-001"]')).toBeNull();
  });
});

describe("AC-05-008.4 criterion cards over the real work-order heading shape", () => {
  it("a paragraph after the last bullet is not part of that criterion's card", () => {
    const { criteria } = extractSections(
      "## Requirements & Acceptance Criteria\n\n- **AC-05-008.4** — THE Resumen SHALL read in order.\n\n**Completeness and NFRs.** Error path: an unknown id.\n",
    );
    expect(criteria).toEqual([{ id: "AC-05-008.4", text: "THE Resumen SHALL read in order." }]);
  });

  it("shows no raw markdown markers in a criterion card", () => {
    const { criteria } = extractSections(
      '## Requirements & Acceptance Criteria\n\n- **AC-12-003.3 (pre-existing drift badge, DR-122)** — WHEN a FRD is verified THE row SHALL show **"Verificado"** with `code`.\n',
    );
    render(<CriterionList criteria={criteria} />);
    expect(document.body.textContent).not.toMatch(/\*\*|`/);
    expect(screen.getByText("AC-12-003.3")).toBeInTheDocument();
  });
});
