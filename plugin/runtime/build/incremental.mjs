// Incremental change preparation: specialist ownership, design provenance and the bounded WO amendment contract.
import { frontmatterList, parseYamlSubset, splitFrontmatter } from "./card.mjs";
import { newUnit } from "./state.mjs";

export const DESIGN_SOURCES = Object.freeze(["agreed", "existing", "pending", "not-applicable"]);
export const hasDesignSource = (value) => ["agreed", "existing"].includes(value?.design_source)
  && Array.isArray(value?.design_refs) && value.design_refs.some(ref => typeof ref === "string" && ref.trim());

/** UI metadata is authoritative when true; common view artifacts are a conservative legacy fallback. */
export const designPaths = (frd, key) => {
  const base = frd ? `docs/frds/${frd}` : `docs/design/changes/${key}`;
  return [`${base}/fdd.md`, `${base}/mocks/${key}.html`];
};
export const workOrderHasUi = (wo) => wo.ui === true || (wo.artifacts ?? []).some(p => /\.(?:tsx|jsx|vue|svelte|html|css|scss)$|(?:^|\/)(?:pages?|views?|components)\//i.test(p));

/** One writer at a time. The architect owns the final WO handoff, never a generic implementation worker. */
export function changePreparationUnits(card, slug) {
  const frd = card?.frd || null;
  const product = newUnit({ id: `u-product-${slug}`, kind: "docs", role: "product-manager", frd });
  const units = [product];
  if (card?.ui === true && !hasDesignSource(card)) units.push(newUnit({
    id: `u-design-${slug}`, kind: "docs", role: "designer", frd, ui: true, design_source: "pending",
    design_refs: designPaths(frd, slug), depends_on: [product.id],
  }));
  units.push(newUnit({ id: `u-docs-${slug}`, kind: "docs", role: "architect", frd, depends_on: [units.at(-1).id] }));
  return units;
}

const AMEND_KEYS = new Set(["implementation_status", "source_change", "reopen_count", "artifacts", "dependsOn", "depends_on", "source_requirements", "complexity", "last_updated", "ui", "design_source", "design_refs", "design_decision_by"]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Report-compatible planning operation: only the card's architect may reopen/amend an ACTIVE WO.
 * Identity/activation stay fixed, previous provenance is retained, and reopening is explicit and counted.
 * Other workers still cannot change any existing WO frontmatter.
 */
export function existingWoAmendmentProblem({ unit, card, before, after, claimed = false }) {
  const original = splitFrontmatter(before);
  const updated = splitFrontmatter(after ?? "");
  if (!after || !original || !updated) return "an existing work order cannot be deleted or lose frontmatter";
  if (original.fm === updated.fm) return null;
  if (unit.kind !== "docs" || unit.role !== "architect" || !card) return "the frontmatter of an existing work order must never change outside a card architect planning unit";
  if (claimed) return "a work order already claimed by a build/patch unit cannot be amended";
  const old = parseYamlSubset(original.fm); const next = parseYamlSubset(updated.fm);
  if ([...old.errors, ...old.unsupported, ...next.errors, ...next.unsupported].length) return "work-order amendment frontmatter must use supported, unambiguous YAML";
  const a = old.data; const b = next.data;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (!AMEND_KEYS.has(key) && !same(a[key], b[key])) return `work-order amendment cannot change identity/activation field ${key}`;
  if (a.status !== "ACTIVE" || b.status !== "ACTIVE") return "work-order amendment requires an ACTIVE work order";
  if (!["PLANNED", "VERIFIED", "IN_REVIEW"].includes(a.implementation_status) || b.implementation_status !== "PLANNED") return "work-order amendment must reopen PLANNED, VERIFIED or IN_REVIEW as PLANNED";
  const previous = frontmatterList(a.source_change); const sources = frontmatterList(b.source_change);
  if (!sources.includes(card) || previous.some(s => !sources.includes(s))) return "work-order amendment must retain previous source_change entries and add the current card";
  const count = Number(a.reopen_count ?? 0) + (a.implementation_status === "PLANNED" ? 0 : 1);
  if (!Number.isInteger(count) || Number(b.reopen_count ?? 0) !== count) return `work-order amendment requires reopen_count: ${count}`;
  if (!/^##\s+Status Note\s*$/im.test(updated.body) || !updated.body.includes(card)) return "work-order amendment requires a Status Note citing the change card and reason";
  if (b.ui === true && b.design_source !== "pending" && !hasDesignSource({ design_source: b.design_source, design_refs: frontmatterList(b.design_refs) })) return "a UI work-order amendment must record design_source with refs, or pending";
  return null;
}
