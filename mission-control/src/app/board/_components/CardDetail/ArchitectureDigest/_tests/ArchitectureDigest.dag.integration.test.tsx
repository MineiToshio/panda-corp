/**
 * ArchitectureDigest × WoDag integration test — proves the implementation-plan DAG (the reused,
 * UN-mocked WoDag) renders inside the Arquitectura tab from REAL work-order data: the 11 work
 * orders of personal-page-v2 in 3 waves with their `dependsOn` edges. Only the live transport
 * (useLiveSnapshot) is mocked, exactly as WoDag's own suite does — everything else is real, so a
 * crash in the board context (the risk a mocked-DAG test can't catch) would fail here.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({ snapshot: null, connected: false, lastEventAt: null }),
}));

import { ArchitectureDigest } from "../ArchitectureDigest";

// The real personal-page-v2 graph: Wave 0 foundation → Wave 1 fan-out (6 parallel) → Wave 2 join.
function wo(id: string, frd: string, dependsOn: string[]): WorkOrder & { dependsOn?: string[] } {
  return {
    id,
    title: `${id} task`,
    frd,
    state: "todo",
    relPath: `docs/frds/${frd}/work-orders/${id}.md`,
    dependsOn,
  };
}
const WORK_ORDERS: Array<WorkOrder & { dependsOn?: string[] }> = [
  wo("WO-00-001", "frd-01-site-shell", []),
  wo("WO-01-002", "frd-01-site-shell", ["WO-00-001"]),
  wo("WO-00-002", "frd-01-site-shell", ["WO-00-001"]),
  wo("WO-01-001", "frd-01-site-shell", ["WO-00-001", "WO-01-002"]),
  wo("WO-02-001", "frd-02-home", ["WO-00-001", "WO-00-002", "WO-01-001", "WO-01-002"]),
  wo("WO-03-001", "frd-03-projects", ["WO-00-001", "WO-00-002", "WO-01-001", "WO-01-002"]),
  wo("WO-04-001", "frd-04-about-now", ["WO-00-001", "WO-00-002", "WO-01-001", "WO-01-002"]),
  wo("WO-05-001", "frd-05-blog", ["WO-00-001", "WO-00-002", "WO-01-001", "WO-01-002"]),
  wo("WO-07-001", "frd-07-contact", ["WO-00-001", "WO-00-002", "WO-01-001", "WO-01-002"]),
  wo("WO-08-001", "frd-08-ai-skill", ["WO-00-002"]),
  wo("WO-06-001", "frd-06-seo", ["WO-00-002", "WO-02-001", "WO-03-001", "WO-05-001"]),
];

const DIGEST = `---
proyecto: "personal-page-v2"
fase: arquitectura
stack: "Next.js 16"
---

## 🧩 Por FRD

### FRD-01 · Site shell
**Blueprint:** la fundación.
`;

describe("ArchitectureDigest × WoDag (real DAG)", () => {
  it("renders the implementation-plan DAG with the real 11 work-order nodes (no crash)", () => {
    render(<ArchitectureDigest body={DIGEST} title="personal-page-v2" workOrders={WORK_ORDERS} />);
    // The reused WoDag mounted inside the Plan band.
    expect(screen.getByTestId("arch-plan")).toBeInTheDocument();
    expect(screen.getByTestId("wo-dag")).toBeInTheDocument();
    expect(screen.getByLabelText("Grafo de dependencias entre work orders")).toBeInTheDocument();
    // Every one of the 11 work orders is a node in the graph (the join node WO-06-001 included).
    for (const w of WORK_ORDERS) {
      expect(screen.getByTestId(`dag-node-${w.id}`)).toBeInTheDocument();
    }
  });
});
