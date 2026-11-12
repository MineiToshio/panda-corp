// Planner disk reader (BUILD-9): work orders and FRD acceptance criteria from a checkout.
import path from "node:path";
import { frontmatterList, parseYamlSubset, resolveDeps, splitFrontmatter } from "../card.mjs";
import { naturalCompare, norm } from "./common.mjs";
import { extractAcIds } from "./pathRules.mjs";

/**
 * Read every work order under `<root>/docs/frds/<frd>/work-orders/` into planner nodes, plus the AC ids each `frd.md` defines.
 * @param {string} root the integration worktree (or any checkout)
 * @param {{fs?: object, readFrd?: (frd: string) => Promise<string|null>}} [deps] `readFrd` returns an FRD's text at another revision
 *   (the CLI passes `git show <base_sha>:...`); default: the working tree's `frd.md`
 * @returns {Promise<{wos: object[], frds: string[], frd_acs: Record<string, string[]>, errors: {file: string, reason: string}[]}>}
 *   `wos` items: `{id, frd, file, status, deps, artifacts (array or null when the key is absent), order, reopen_count, acs, source_change}`
 */
export async function readPlanWorkOrders(root, deps = {}) {
  const { fs } = resolveDeps(deps);
  const wos = [];
  const errors = [];
  const frdAcs = {};
  const base = path.join(root, "docs", "frds");
  let frds;
  try { frds = (await fs.readdir(base)).filter((n) => /^frd-/i.test(n)).sort(naturalCompare); } catch (error) {
    if (error.code === "ENOENT") return { wos, frds: [], frd_acs: frdAcs, errors };
    throw error;
  }
  for (const frd of frds) {
    const frdName = frd.toLowerCase();
    const text = deps.readFrd ? await deps.readFrd(frd) : await fs.readFile(path.join(base, frd, "frd.md"), "utf8").catch(() => null);
    if (text !== null) frdAcs[frdName] = extractAcIds(text);
    let names;
    try { names = (await fs.readdir(path.join(base, frd, "work-orders"))).filter((n) => /^wo-.*\.md$/i.test(n)).sort(naturalCompare); } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const name of names) {
      const file = `docs/frds/${frd}/work-orders/${name}`;
      const raw = await fs.readFile(path.join(base, frd, "work-orders", name), "utf8").catch(() => null);
      const parts = raw === null ? null : splitFrontmatter(raw);
      if (!parts) { errors.push({ file, reason: raw === null ? "unreadable" : "missing frontmatter" }); continue; }
      const { data } = parseYamlSubset(parts.fm);
      const status = typeof data.implementation_status === "string" ? data.implementation_status : "";
      if (!status) { errors.push({ file, reason: "implementation_status missing" }); continue; }
      const id = (typeof data.id === "string" && /^wo-/i.test(data.id) ? data.id : name.replace(/^(wo-\d+-\d+).*$/i, "$1")).toLowerCase();
      wos.push({
        id, frd: frdName, file, status, deps: frontmatterList(data.dependsOn ?? data.depends_on).map(norm),
        artifacts: Object.hasOwn(data, "artifacts") ? frontmatterList(data.artifacts) : null,
        order: Number(/(\d+)$/.exec(id)?.[1] ?? wos.length), reopen_count: Number.parseInt(String(data.reopen_count ?? 0), 10) || 0,
        acs: extractAcIds(parts.body), source_change: frontmatterList(data.source_change).map(norm),
      });
    }
  }
  return { wos, frds: frds.map((f) => f.toLowerCase()), frd_acs: frdAcs, errors };
}
