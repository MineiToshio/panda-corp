#!/usr/bin/env node
// test-architecture-packs.mjs — the architecture phase's context-pack extractor (skills/architecture/scripts/
// build-packs.mjs, DR-131 v3), run as a real process against fixtures/architecture-packs/good (two FRDs, a route map
// with per-FRD / shared / "all" / platform rows, a data model, keyed microcopy, oracle states, one ADR and a
// work-order map). `good` must produce complete packs and leave docs/ untouched; the RED cases copy it to a temp dir
// and break one thing: an FRD with no live AC (exit 1, never a silent empty pack) and an unparsable data model (exit 2).
// Run: node plugin/scripts/test-architecture-packs.mjs

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures/architecture-packs/good");
const SCRIPT = path.resolve(__dirname, "../skills/architecture/scripts/build-packs.mjs");
const { frdsInCell, frdCriteria, namedEntities } = await import(SCRIPT);

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`);
  }
};
const tmpDirs = [];
const tmp = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "architecture-packs-"));
  tmpDirs.push(dir);
  return dir;
};
const mkProject = () => {
  const dir = tmp();
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
};
const run = (...args) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  return { status: r.status, out: r.stdout, err: r.stderr };
};
const treeHash = (dir) => {
  const h = createHash("sha256");
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(`${path.relative(dir, p)}\0${readFileSync(p)}`);
    }
  };
  walk(dir);
  return h.digest("hex");
};

console.log("helpers: route FRD cells, criteria, entity names");
{
  ok(frdsInCell("01").join() === "01" && frdsInCell("03, 04").join() === "03,04", "a route cell `01` / `03, 04` cites those FRDs");
  ok(frdsInCell("all").join() === "*", "`all` cites every FRD");
  ok(frdsInCell("platform (owner: WO-01-001, the media resolver's WO)").length === 0, "`platform (owner: WO-01-001 ...)` cites no FRD (the WO id inside the note is not an FRD)");
  const crit = frdCriteria(readFileSync(path.join(FIXTURE, "docs/frds/frd-01-shell/frd.md"), "utf8"));
  ok(crit.acIds.join() === "AC-01-001.1,AC-01-001.2" && crit.removed === 1, "live ACs kept, the struck-out one counted and omitted");
  const model = { entities: [{ name: "Account" }, { name: "CompletionGoal" }, { name: "Item" }] };
  const names = namedEntities("Every Item of their completion goal, and your account settings.", model).map((e) => e.name);
  ok(names.join() === "CompletionGoal,Item", "compound names match in spaced form, one-word names only as written (not `account`)");
}

console.log("good fixture: complete packs, docs untouched");
{
  const dir = mkProject();
  const before = treeHash(dir);
  const out = path.join(tmp(), "packs");
  const r = run(dir, "--out", out, "--map", path.join(dir, "wo-map.md"));
  ok(r.status === 0, `exit 0 (got ${r.status}) ${r.err}`);
  ok(treeHash(dir) === before, "the project tree is byte-identical after the run (read-only on docs)");
  ok(["frd-01.md", "frd-02.md", "_global.md"].every((f) => existsSync(path.join(out, f))), "one pack per FRD plus _global.md");
  ok(/full doc set \(\d+ files/.test(r.out) && /PACKS OK/.test(r.out), "prints the pack sizes next to the full doc set");
  const p1 = readFileSync(path.join(out, "frd-01.md"), "utf8");
  const p2 = readFileSync(path.join(out, "frd-02.md"), "utf8");
  const g = readFileSync(path.join(out, "_global.md"), "utf8");
  ok(p1.includes("- **AC-01-001.2:** WHEN the visitor opens the menu THE SYSTEM SHALL list Inicio and Ajustes,\n  in that order."), "AC bullets copied verbatim, continuation line included");
  ok(p1.includes("### REQ-01-001 Navigation") && !p1.includes("AC-01-002.1"), "REQ headings kept, struck-out AC absent");
  ok(p1.includes("| `/` | public | 01 |") && p1.includes("| `/lista` |") && p1.includes("| `/oracle/*` |") && !p1.includes("/api/health"), "FRD-01 routes: its own, the shared and the `all` rows, not the platform row");
  ok(p2.includes("| `/lista` |") && !p2.includes("| `/` | public"), "FRD-02 routes: only the rows citing it");
  ok(p2.includes("- `CompletionGoal`: id:uuid [PK]") && p2.includes("- `Item`: id:uuid [PK], goalId?:uuid [FK]") && !p2.includes("`Account`"), "FRD-02 entities with attributes, no prose false positive");
  ok(p1.includes("- `shell` · screen · Top bar · build /") && p2.includes("- `list-empty` · state · Empty list · build /lista?empty=1"), "oracle states by frd_slug, and by the key prefix when frd_slug is absent");
  ok(p1.includes('- `nav.home`: "Inicio"') && p1.includes('- `nav.settings`: "Ajustes"') && p2.includes('- `list.empty`: "Nada aún"'), "microcopy keys the FDD cites (backticked key or quoted label) with their value");
  ok(p1.includes("**WO-01-001 App shell**") && !p1.includes("WO-02-001 List") && p2.includes("Reads the goal from FRD-01's seam."), "map slice: the FRD's own §2 catalogue and §5 notes only");
  ok(g.includes("- L3 Golden path & stack") && g.includes("`docs/adr/adr-0001-stack.md` · ACCEPTED · Stack A golden path"), "global: architecture outline with line numbers and the ADR index");
  ok(g.includes("| `/api/health` | public | platform |") && g.includes("| next | 16.0.0 |"), "global: platform routes and the Pinned versions table");
  ok(g.includes("| `package.json` | WO-01-001 (W0) |") && g.includes("1. The list route is `/lista`.") && g.includes("| W1 | WO-02-001 |"), "global: map §0 shared-file owners, §3 DAG and §8 binding resolutions");
}

console.log("--frd, --json, default paths, absent map");
{
  const dir = mkProject();
  const out = path.join(tmp(), "packs");
  const r = run(dir, "--out", out, "--frd", "frd-02", "--json");
  const j = JSON.parse(r.out);
  ok(r.status === 0 && j.ok === true && j.docSet.files > 0, "--json reports ok, the packs and the doc-set size");
  ok(!existsSync(path.join(out, "frd-01.md")) && existsSync(path.join(out, "frd-02.md")) && existsSync(path.join(out, "_global.md")), "--frd frd-02 writes only that pack and _global.md");
  ok(readFileSync(path.join(out, "frd-02.md"), "utf8").includes("no work-order map yet"), "without a map the slice says so explicitly (regenerate after the map)");
  const r2 = run(dir);
  ok(r2.status === 0 && existsSync(path.join(dir, ".pandacorp/run/architecture/packs/frd-01.md")), "default --out is <root>/.pandacorp/run/architecture/packs");
}

console.log("RED: an FRD with no live AC fails loud (exit 1)");
{
  const dir = mkProject();
  const f = path.join(dir, "docs/frds/frd-02-list/frd.md");
  writeFileSync(f, readFileSync(f, "utf8").replace("- **AC-02-001.1:**", "- AC-02-001.1:"));
  const r = run(dir, "--out", path.join(tmp(), "packs"));
  ok(r.status === 1 && /frd-02-list: frd\.md defines no live/.test(r.out), `exit 1 naming the FRD (got ${r.status})`);
}

console.log("RED: an unparsable data model is a read error (exit 2)");
{
  const dir = mkProject();
  writeFileSync(path.join(dir, "docs/product/data-model.json"), "{ not json");
  const r = run(dir, "--out", path.join(tmp(), "packs"));
  ok(r.status === 2 && /data-model\.json: unreadable JSON/.test(r.err), `exit 2 naming the file (got ${r.status})`);
}

for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
