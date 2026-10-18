#!/usr/bin/env node
/**
 * Build waves from the work orders' `dependsOn` (architecture readiness gate, DR-050/DR-060/DR-087).
 * Reads every docs/frds/<frd>/work-orders/wo-*.md frontmatter and, fail-closed:
 *  1. read      every work order has frontmatter and a WO-NN-MMM id (no silent skip, DR-078)
 *  2. unknown   every `dependsOn` id names a live work order
 *  3. cycles    the dependency graph is acyclic
 *  4. overlap   no two work orders of the same wave declare overlapping `artifacts` (brace groups are expanded,
 *               so `src/app/{a,b}/**` and `src/app/c/**` are disjoint; `[id]` and `(group)` are literal folders)
 * Wave = 1 + the highest wave among its dependencies; W0 when it has none. SUPERSEDED work orders are ignored.
 *
 * Usage (from the project root, or pass it): node waves.mjs [root] [--json]
 *   -> prints the wave table; exit 0 when every check passes, 1 otherwise, 2 when the plan cannot be read.
 */
import { computeWaves, emit, globsOverlap, liveWos, loadPlan, parseArgs, reporter, runCli } from "./lib-plan.mjs";

/**
 * Analyzes the plan's waves.
 * @param {ReturnType<typeof loadPlan>} plan
 * @returns {{byWave: Map<number, string[]>, results: object[], waves: Map<string, number>}}
 */
export function analyzeWaves(plan) {
  const r = reporter();
  const { wave, unknown, cycles } = computeWaves(plan);
  r.check("every work order has frontmatter and an id", plan.errors);
  r.check("every dependsOn id names a live work order", unknown.map((u) => `${u.from} depends on unknown ${u.to}`));
  r.check("the dependency graph is acyclic", cycles.map((c) => `cycle: ${c.join(" -> ")}`));
  const byWave = new Map();
  for (const [id, w] of [...wave].sort()) byWave.set(w, [...(byWave.get(w) ?? []), id]);
  const overlaps = [];
  for (const ids of byWave.values())
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = plan.wos.get(ids[i]);
        const b = plan.wos.get(ids[j]);
        for (const ga of a.artifacts)
          for (const gb of b.artifacts) {
            const hit = globsOverlap(ga, gb);
            if (hit) overlaps.push(`W${wave.get(a.id)}: ${a.id} \`${ga}\` <-> ${b.id} \`${gb}\` (${hit})`);
          }
      }
  r.check("no two work orders of one wave declare overlapping artifacts", overlaps);
  const noArtifacts = liveWos(plan).filter((w) => w.artifacts.length === 0).map((w) => `${w.id} declares no artifacts`);
  r.check("every work order declares its artifacts (DR-060)", noArtifacts);
  return { byWave: new Map([...byWave].sort((x, y) => x[0] - y[0])), results: r.results, waves: wave };
}

runCli(import.meta.url, () => {
  const args = parseArgs(process.argv.slice(2), ["json"]);
  const plan = loadPlan(args._[0] ?? ".");
  const { byWave, results } = analyzeWaves(plan);
  const header = [...byWave].map(([w, ids]) => `W${w}: ${ids.join(", ")}`);
  const live = liveWos(plan).length;
  const last = byWave.size ? Math.max(...byWave.keys()) : 0;
  header.push(`${live} work orders, ${byWave.size} waves${byWave.size ? ` (W0-W${last})` : ""}`);
  return emit(results, { json: args.json, header, verdictOk: "WAVES OK", verdictBad: "WAVES NOT OK" });
});
