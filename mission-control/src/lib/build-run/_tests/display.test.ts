import { expect, it } from "vitest";
import type { WorkOrder } from "../../work-orders/work-orders";
import { buildWorkOrderDisplay } from "../display";
import type { BuildRun, BuildRunUnit } from "../types";

const unit = (overrides: Partial<BuildRunUnit> = {}): BuildRunUnit => ({
  id: "u-build",
  kind: "build",
  wos: ["WO-04-001"],
  frd: "FRD-04",
  state: "running",
  attempt: 1,
  worker: null,
  branch: "lane/run-a/u-build",
  depends_on: [],
  pending_answer: null,
  parked: null,
  waiting_gate: null,
  ...overrides,
});
const orders: WorkOrder[] = [
  { id: "WO-04-001", title: "First", state: "todo", frd: "FRD-04", relPath: "one.md" },
  { id: "WO-04-002", title: "Delivered", state: "done", frd: "FRD-04", relPath: "two.md" },
];
function run(units: BuildRunUnit[]): BuildRun {
  return {
    present: true,
    state: {
      schema: 2,
      engine: "v2",
      run_id: "run-a",
      epoch: 2,
      coordinator: "codex-session",
      label: "codex",
      size: "feature",
      status: "active",
      status_reason: null,
      tranche: null,
      scope: { card: null, frds: [], wos: [], out_of_scope: [] },
      integration: { branch: "lane/run-a/integration" },
      last_safe_point: null,
      units,
      jobs: [],
    },
    admission: null,
    lease: null,
    matchesLease: true,
    live: true,
    stateMtimeMs: null,
    admissionMtimeMs: null,
    performance: [],
    performanceIdentity: "basename-only",
    errors: [],
  };
}
it.each([
  ["running", "in_progress"],
  ["admitted", "in_progress"],
  ["verified", "review"],
  ["reported", "review"],
  ["committed", "review"],
  ["integrated", "review"],
  ["reviewing", "review"],
  ["queued", "todo"],
  ["patching", "todo"],
  ["landed", "done"],
  ["blocked", "fail"],
] as const)("maps %s to %s while retaining durable main", (state, expected) => {
  const model = buildWorkOrderDisplay(orders, run([unit({ state })]));
  expect(model.items).toHaveLength(2);
  expect(model.items[0]).toMatchObject({ state: expected, durableState: "todo", inBuild: true });
  expect(model.items[1]).toMatchObject({ state: "done", durableState: "done", inBuild: false });
});
it("the latest patch supersedes builds, never adding WOs for reviews or jobs", () => {
  const model = buildWorkOrderDisplay(
    orders,
    run([
      unit({ state: "landed" }),
      unit({ id: "patch-1", kind: "patch", state: "verified" }),
      unit({ id: "review-1", kind: "review", state: "landed" }),
      unit({ id: "patch-2", kind: "patch", state: "queued", wos: ["WO-04-001", "WO-99-999"] }),
    ]),
  );
  expect(model.items[0]).toMatchObject({ state: "todo", buildUnit: { id: "patch-2" } });
  expect(model.errors[0]?.reason).toContain("WO-99-999");
  expect(model.items).toHaveLength(2);
});
it.each([
  "parked",
  "waiting_gate",
] as const)("retains durable columns and reason for %s", (state) => {
  const model = buildWorkOrderDisplay(orders, run([unit({ state, pending_answer: "d-1" })]));
  expect(model.items[0]).toMatchObject({ state: "todo", buildUnit: { state, reason: "d-1" } });
});
it("mismatched or expired runs cannot overlay durable delivery", () => {
  const current = run([unit()]);
  expect(buildWorkOrderDisplay(orders, { ...current, matchesLease: false }).items[0]?.inBuild).toBe(
    false,
  );
  expect(buildWorkOrderDisplay(orders, { ...current, live: false }).items[0]?.state).toBe("todo");
});
