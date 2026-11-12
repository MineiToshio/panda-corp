import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadFraguaScene } from "@/lib/fragua/scene-data";
import { readSummary } from "../readSummary";
import { summaryFixture } from "./summaryFixture";

let fixture: ReturnType<typeof summaryFixture>;
beforeEach(() => {
  fixture = summaryFixture();
  vi.stubEnv("PANDACORP_HOST_DIR", `${fixture.root}/host`);
});
afterEach(() => {
  fixture.cleanup();
  vi.unstubAllEnvs();
});

function writeRun(epoch = 2): void {
  fixture.write(
    ".pandacorp/run/build/state.json",
    JSON.stringify({
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
      scope: { card: null, frds: ["FRD-01"], wos: ["WO-01-001"], out_of_scope: [] },
      integration: { branch: "lane/run-a/integration", worktree: "/removed", base_sha: "abc" },
      last_safe_point: null,
      units: [
        {
          id: "u-build",
          chain: null,
          zone: "none",
          risk_rules: [],
          token_hash: null,
          worktree: null,
          evidence_hash: null,
          doubt_id: null,
          test_hashes: {},
          probe_hashes: {},
          review: null,
          kind: "build",
          wos: ["WO-01-001"],
          frd: "FRD-01",
          state: "verified",
          attempt: 1,
          worker: null,
          branch: "lane/run-a/u-build",
          depends_on: [],
          pending_answer: null,
          parked: null,
          waiting_gate: null,
        },
      ],
      jobs: [],
      handbacks_in_a_row: 0,
      doubts_consulted: 0,
      answers: {},
      quota_at_unit: {},
    }),
  );
  fixture.write(
    ".pandacorp/run/build.lease/lease.json",
    JSON.stringify({
      run_id: "run-a",
      epoch,
      renewed_at: "2026-10-31T11:45:00Z",
      ttl_seconds: 1800,
      token_hash: "never-public",
    }),
  );
}

it("REQ-04-020 / REQ-05-009 shares branch review counts between summary and Fragua with running false", () => {
  writeRun();
  const summary = readSummary(fixture.item.path);
  const scene = loadFraguaScene({ path: fixture.item.path, slug: "demo", name: "Demo" });
  expect(summary.buildRun.errors).toEqual([]);
  expect(summary.orders.value[0]).toMatchObject({
    state: "review",
    durableState: "todo",
    inBuild: true,
  });
  expect(scene.orders).toEqual(summary.orders.value);
  expect(scene.stations.map((station) => station.count)).toEqual([0, 0, 1, 0]);
  expect(scene.signal.kind).toBe("live");
  expect(scene.progress.done).toBe(0);
  expect(JSON.stringify(summary.buildRun)).not.toContain("never-public");
});

it("AC-04-020.3 leaves durable work intact on contradictory epochs and exposes the source", () => {
  writeRun(3);
  const summary = readSummary(fixture.item.path);
  const scene = loadFraguaScene({ path: fixture.item.path, slug: "demo", name: "Demo" });
  expect(summary.buildRun.live).toBe(false);
  expect(summary.buildRun.errors[0]?.path).toContain("lease.json");
  expect(summary.orders.value[0]?.state).toBe("todo");
  expect(scene.stations.map((station) => station.count)).toEqual([1, 0, 0, 0]);
  expect(scene.signal.kind).toBe("no-signal");
});

it("REQ-04-023 identifies a local handback as a draft", () => {
  fixture.write(".pandacorp/run/build/handback/engine-backlog-run-a.md", "# Draft\n");
  expect(readSummary(fixture.item.path).handbackDrafts).toEqual([
    ".pandacorp/run/build/handback/engine-backlog-run-a.md",
  ]);
});
