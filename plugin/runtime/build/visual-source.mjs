// One visual-source contract for the planner and the worker context, checked in the consuming checkout.
import path from "node:path";
import { resolveDeps } from "./card.mjs";
import { hasDesignSource, workOrderHasUi } from "./incremental.mjs";
import { defaultExec } from "./fsx.mjs";

const DONE = new Set(["integrated", "reviewing", "patching", "verified", "landed"]);
const norm = value => String(value ?? "").toLowerCase();

/** Citations/URLs are evidence; file references must name a nonempty file inside the consuming product checkout. */
export function designRefPath(ref) {
  const text = String(ref).trim();
  if (/^(?:owner|conversation|chat)(?:\s|:)|^https?:\/\//i.test(text)) return null;
  return text.replace(/#.*$/, "").replace(/:\d+(?::\d+)?$/, "").replace(/^\.\//, "");
}
const safePath = rel => rel && !path.isAbsolute(rel) && !rel.split(/[\\/]/).includes("..") && !rel.includes("\0");

export async function readVisualFiles(root, { wos = [], card = null, units = [] } = {}, deps = {}) {
  const { fs } = resolveDeps(deps);
  const refs = [...wos, card, ...units].flatMap(source => source?.design_refs ?? []);
  const files = {};
  for (const ref of new Set(refs)) {
    const rel = designRefPath(ref);
    if (rel === null) continue;
    files[rel] = Boolean(safePath(rel) && (await fs.readFile(path.join(root, rel), "utf8").catch(() => "")).trim());
  }
  return files;
}

export const designerMatches = (unit, wo) => unit.kind === "docs" && unit.role === "designer"
  && (!(unit.wos ?? []).length ? !unit.frd || norm(unit.frd) === norm(wo.frd) : unit.wos.some(id => norm(id) === norm(wo.id)));

/** WO intent wins over card-wide intent. A pending card suppresses only an inferred legacy FDD, not explicit WO evidence. */
export function resolveVisualSource(wo, { card = null, units = [], files = {} } = {}) {
  const ui = workOrderHasUi(wo);
  if (!ui) return { ui: false, design_source: "not-applicable", design_refs: [] };
  const available = source => hasDesignSource(source) && source.design_refs.every(ref => {
    const rel = designRefPath(ref);
    return rel === null || (safePath(rel) && files[rel] === true);
  });
  const prepared = units.filter(unit => DONE.has(unit.state) && designerMatches(unit, wo)).reverse()
    .map(unit => ({ design_source: "existing", design_refs: unit.design_refs ?? [] })).find(available);
  const scopedCard = !card?.frd || norm(card.frd) === norm(wo.frd) ? card : null;
  const candidates = [prepared, wo.design_inferred ? null : wo, scopedCard,
    wo.design_inferred && scopedCard?.design_source !== "pending" ? wo : null];
  const source = candidates.find(available);
  return source ? { ui, design_source: source.design_source, design_refs: [...source.design_refs] }
    : { ui, design_source: "pending", design_refs: [] };
}

/** Standalone design is handed off by the conversation before a run, never by a worker bypassing report. */
export async function assertDesignHandoff(project, source, deps = {}, revision = "HEAD") {
  if (!hasDesignSource(source)) return null;
  const refs = source.design_refs.map(designRefPath).filter(ref => ref !== null);
  if (!refs.length) return null;
  const { fs } = resolveDeps(deps);
  const run = args => (deps.exec ?? defaultExec)("git", args, { cwd: project, env: deps.env });
  const rev = await run(["rev-parse", "--verify", `${revision}^{commit}`]);
  const prefix = await run(["rev-parse", "--show-prefix"]);
  const sha = rev.stdout.trim();
  for (const rel of refs) {
    const file = safePath(rel) ? await fs.readFile(path.join(project, rel), "utf8").catch(() => null) : null;
    // Compare blob identities, never decoded text: distinct image bytes may decode to the same UTF-8 replacement character.
    const recorded = file?.trim() && rev.code === 0 && prefix.code === 0
      ? await run(["rev-parse", "--verify", `${sha}:${prefix.stdout.trim()}${rel}`]) : null;
    const current = recorded?.code === 0 ? await run(["hash-object", "--no-filters", "--", path.join(project, rel)]) : null;
    if (!recorded || recorded.code !== 0 || current?.code !== 0 || recorded.stdout.trim() !== current.stdout.trim()) throw Object.assign(
      new Error(`Design handoff incomplete: ${rel} must be nonempty and identical to the committed source revision. Before start, the conversation must commit the standalone design delta in the source checkout; design itself never commits or writes into an active run.`),
      { code: "INVALID_INPUT" },
    );
  }
  return sha;
}
