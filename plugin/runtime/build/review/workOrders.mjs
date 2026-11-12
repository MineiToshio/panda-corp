// review-record work orders of a worktree: their artifacts, and which of them a `reopen` verdict reopens.
import * as fsp from "node:fs/promises";
import path from "node:path";
import { unique } from "./common.mjs";

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;

function readArtifacts(block) {
  const lines = block.split(/\r?\n/);
  const at = lines.findIndex((l) => /^artifacts:/.test(l));
  if (at < 0) return [];
  const inline = lines[at].replace(/^artifacts:\s*/, "").trim();
  const clean = (s) => s.trim().replace(/^['"]|['"]$/g, "");
  if (inline.startsWith("[")) return inline.replace(/^\[|\]$/g, "").split(",").map(clean).filter(Boolean);
  const out = [];
  for (const line of lines.slice(at + 1)) {
    const m = line.match(/^\s+-\s+(.+)$/);
    if (!m) break;
    out.push(clean(m[1]));
  }
  return out;
}

/** Work orders of a worktree: `{id (lowercase), rel, artifacts[]}` for every `docs/frds/<frd>/work-orders/*.md`. */
export async function scanWorkOrders(root, fs = fsp) {
  const found = [];
  const frdsDir = path.join(root, "docs", "frds");
  let frds;
  try { frds = await fs.readdir(frdsDir); } catch (error) { if (error.code === "ENOENT") return found; throw error; }
  for (const frd of frds.sort()) {
    const dir = path.join(frdsDir, frd, "work-orders");
    let names;
    try { names = await fs.readdir(dir); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const name of names.sort()) {
      if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") continue;
      const block = (await fs.readFile(path.join(dir, name), "utf8")).match(FM_BLOCK)?.[1] ?? "";
      const id = (block.match(/^id:[ \t]*(.+?)[ \t]*$/m)?.[1] ?? name.replace(/\.md$/, "")).replace(/^['"]|['"]$/g, "").toLowerCase();
      found.push({ id, rel: `docs/frds/${frd}/work-orders/${name}`, artifacts: readArtifacts(block) });
    }
  }
  return found;
}

// D30 literal-prefix rule, conservative: a finding file belongs to a WO when it sits under one of its artifact globs.
function underArtifact(file, glob) {
  const wild = glob.search(/[*?[{]/);
  if (wild < 0) return file === glob || file.startsWith(glob.endsWith("/") ? glob : `${glob}/`);
  return file.startsWith(glob.slice(0, wild));
}

/**
 * Which work orders a `reopen` verdict reopens: the reviewed WOs whose artifacts contain a finding's file; when no
 * finding can be placed (or no artifacts parse), every WO of the reviewed units (the reviewer cannot be second-guessed).
 * @param {object[]} reviewed reviewed units
 * @param {object[]} findings report findings
 * @param {Array<{id: string, artifacts: string[]}>} workOrders from scanWorkOrders
 * @returns {string[]} lowercase WO ids, in unit order
 */
export function pickReopenWos(reviewed, findings, workOrders) {
  const all = unique(reviewed.flatMap((u) => u.wos.map((w) => w.toLowerCase())));
  const byId = new Map(workOrders.map((w) => [w.id, w]));
  const hit = all.filter((id) => findings.some((f) => (byId.get(id)?.artifacts ?? []).some((g) => underArtifact(f.file, g))));
  return hit.length > 0 ? hit : all;
}
