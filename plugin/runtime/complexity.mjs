// Task complexity is independent of deterministic risk; risk can only raise the allocation.
export const COMPLEXITIES = Object.freeze(["trivial", "normal", "complex"]);
export function maxComplexity(values) {
  return values.length ? COMPLEXITIES[Math.max(0, ...values.map(v => COMPLEXITIES.indexOf(v ?? "normal")))] : "normal";
}
/** Legacy WO heuristic, using only existing planning metadata. Explicit complexity always wins. */
export function workOrderComplexity(wo = {}) {
  if (wo.complexity !== undefined) {
    if (!COMPLEXITIES.includes(wo.complexity)) throw new TypeError("complexity must be trivial, normal or complex");
    return wo.complexity;
  }
  const artifacts = [...new Set(wo.artifacts ?? [])], acs = new Set(wo.acs ?? []).size;
  const deps = new Set(wo.deps ?? wo.dependsOn ?? wo.depends_on ?? []).size;
  const areas = new Set(artifacts.map(p => p.replace(/^\.\//, "").replace(/^src\//, "").split("/")[0]));
  const frds = new Set((wo.source_requirements ?? []).map(r => /^REQ-(\d+)-/i.exec(r)?.[1]).filter(Boolean));
  if (wo.difficulty === "high" || artifacts.length >= 6 || acs >= 5 || deps >= 3 || areas.size >= 3 || frds.size >= 2) return "complex";
  if ((wo.difficulty === "low" || wo.size === "touch") && artifacts.length > 0 && artifacts.length <= 2 &&
      !artifacts.some(p => /[*?\[{]/.test(p)) && acs <= 2 && deps === 0 && areas.size === 1) return "trivial";
  return "normal";
}
