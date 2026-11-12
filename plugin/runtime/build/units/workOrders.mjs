// units/workOrders.mjs: work orders read at the unit's base commit and the owned AC lines of an FRD.
import path from "node:path";
import { frontmatterList, parseYamlSubset, splitFrontmatter } from "../card.mjs";
import { err } from "./common.mjs";
import { git } from "./git.mjs";

const WO_PATH_RE = /^docs\/frds\/([^/]+)\/work-orders\/([^/]+)\.md$/;
export const AC_ID_RE = /AC-\d+-\d+\.\d+/g;

/** Is this repo-relative path a work-order file (`docs/frds/<frd>/work-orders/<file>.md`, not the README)? */
export const isWorkOrderPath = (rel) => {
  const m = WO_PATH_RE.exec(rel);
  return Boolean(m) && m[2].toLowerCase() !== "readme";
};

/** Frontmatter block text of a document (`null` when it has none). */
export const frontmatterBlock = (text) => splitFrontmatter(text)?.fm.replace(/\r\n/g, "\n").trimEnd() ?? null;

/**
 * Read the work orders of a unit from the BASE commit (HEAD of a fresh unit worktree), never from the worktree, so
 * a worker cannot widen its own allowlist by editing `artifacts`.
 * @param {string} root product root inside the unit worktree
 * @param {string[]} wos work order ids (`WO-05-002`)
 * @param {{ref?: string}} [deps] `ref` = the commit to read (default `HEAD`; `report` passes the unit's base sha)
 * @returns {Promise<{id: string, file: string, frd: string, artifacts: string[], text: string}[]>}
 * @throws INVALID_STATE when an id has no work order file
 */
export async function readUnitWorkOrders(root, wos, deps = {}) {
  if (!wos.length) return [];
  const ref = deps.ref ?? "HEAD";
  const tree = await git(deps, root, ["ls-tree", "-r", "--name-only", ref, "--", "docs/frds"]);
  const files = tree.stdout.split("\n").filter(isWorkOrderPath);
  const show = async (file) => (await git(deps, root, ["show", `${ref}:./${file}`])).stdout;
  const parse = (file, text) => {
    const fm = parseYamlSubset(splitFrontmatter(text)?.fm ?? "").data;
    return { id: String(fm.id ?? path.basename(file, ".md")), file, frd: WO_PATH_RE.exec(file)[1], artifacts: frontmatterList(fm.artifacts), text };
  };
  const out = [];
  for (const id of wos) {
    const key = String(id).toLowerCase();
    let file = files.find((f) => { const stem = path.basename(f, ".md").toLowerCase(); return stem === key || stem.startsWith(`${key}-`); });
    let found = file ? parse(file, await show(file)) : null;
    if (!found) {
      for (const f of files) {
        const candidate = parse(f, await show(f));
        if (candidate.id.toLowerCase() === key) { file = f; found = candidate; break; }
      }
    }
    if (!found) throw err("INVALID_STATE", `work order ${id} has no file under docs/frds/*/work-orders/`);
    out.push(found);
  }
  return out;
}

/** Union of the `artifacts` of work orders (order kept, unique). */
export const artifactsOf = (workOrders) => [...new Set(workOrders.flatMap((w) => w.artifacts))];

/** AC lines (verbatim, with indented continuation lines) of an FRD text for the given AC ids. */
export function extractAcLines(frdText, ids) {
  const wanted = new Set(ids);
  const lines = String(frdText).split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const hit = (lines[i].match(AC_ID_RE) ?? []).some((id) => wanted.has(id));
    if (!hit) continue;
    let text = lines[i].trim().replace(/^[-*+]\s+/, "");
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) { i += 1; text += ` ${lines[i].trim()}`; }
    out.push(text);
  }
  return out;
}
