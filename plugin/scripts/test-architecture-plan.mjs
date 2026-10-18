#!/usr/bin/env node
// test-architecture-plan.mjs — the architecture phase's deterministic plan checks (skills/architecture/scripts/), run as
// real processes against fixtures/architecture-plan/good (two FRDs, three DRAFT work orders, three gate reports, one of
// them FAIL + a PASS resolution addendum). `good` must be GREEN everywhere; each RED case copies it to a temp dir and
// breaks one thing the funko-tracker architecture run (2026-10-16/17) actually hit: a missing dependsOn edge, a stale
// wave label, a README row lost to a blank line, an AC owned twice or by nobody, a removed AC still planned, a gate
// report still FAIL. resolve-versions runs offline on fixtures/architecture-plan/packuments (a prerelease `latest`
// tag, a version inside the cooldown, a peer conflict, a family on two majors, @types/node pinned to the Node major).
// Run: node plugin/scripts/test-architecture-plan.mjs

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures/architecture-plan");
const SCRIPTS = path.resolve(__dirname, "../skills/architecture/scripts");
const { globsOverlap, expandBraces, parseFrontmatter } = await import(path.join(SCRIPTS, "lib-plan.mjs"));
const { lastVerdict } = await import(path.join(SCRIPTS, "flip-active.mjs"));
const { satisfies, pickVersion } = await import(path.join(SCRIPTS, "resolve-versions.mjs"));

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
const mkProject = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "architecture-plan-"));
  tmpDirs.push(dir);
  cpSync(path.join(FIXTURES, "good"), dir, { recursive: true });
  return dir;
};
const edit = (dir, rel, from, to) => {
  const p = path.join(dir, rel);
  const s = readFileSync(p, "utf8");
  if (!s.includes(from)) throw new Error(`fixture edit: "${from}" not in ${rel}`);
  writeFileSync(p, s.replace(from, to));
};
const run = (script, ...args) => {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { encoding: "utf8" });
  return { status: r.status, out: r.stdout, err: r.stderr };
};
const WO11 = "docs/frds/frd-01-shell/work-orders/wo-01-001-app-shell.md";
const WO12 = "docs/frds/frd-01-shell/work-orders/wo-01-002-settings.md";
const WO21 = "docs/frds/frd-02-list/work-orders/wo-02-001-list.md";
const BP1 = "docs/frds/frd-01-shell/blueprint.md";
const BP2 = "docs/frds/frd-02-list/blueprint.md";
const RM1 = "docs/frds/frd-01-shell/work-orders/README.md";

console.log("lib: frontmatter, brace expansion and glob overlap");
{
  const fm = parseFrontmatter('id: WO-01-001\nfoundation: true   # comment\nartifacts: [src/app/{a,b}/**, "src/app/[id]/**"]\ndependsOn:\n  - WO-01-002\n  - WO-01-003\nblocked_reason:');
  ok(fm.foundation === "true" && fm.blocked_reason === "", "scalars drop trailing comments; an empty key stays empty");
  ok(fm.artifacts.length === 2 && fm.artifacts[0] === "src/app/{a,b}/**", "an inline list keeps a brace glob whole");
  ok(fm.dependsOn.join() === "WO-01-002,WO-01-003", "a block list is read");
  ok(expandBraces("src/{a,b{c,d}}/x").join() === "src/a/x,src/bc/x,src/bd/x", "nested brace groups expand");
  ok(globsOverlap("src/app/{ayuda,privacidad}/**", "src/app/contacto/**") === null, "brace-expanded distinct folders are disjoint (the waves.py false positive)");
  ok(globsOverlap("src/app/{ayuda,contacto}/**", "src/app/contacto/page.tsx") !== null, "a brace alternative that contains the other path overlaps");
  ok(globsOverlap("src/app/pieza/[id]/**", "src/app/pieza/x/page.tsx") === null, "[id] is a literal route folder, not a character class");
  ok(globsOverlap("src/queries/_tests/goal.test.ts", "src/queries/_tests/*.test.ts") !== null, "a single-segment wildcard overlaps a matching file");
  ok(globsOverlap("src/queries/_tests/goal.test.ts", "src/queries/_tests/wishlist.test.ts") === null, "two distinct files in one folder are disjoint");
  ok(globsOverlap("src/lib/", "src/lib/env.ts") !== null, "a trailing-slash folder covers its files");
  ok(globsOverlap("src/**/env.ts", "src/lib/env.ts") !== null && globsOverlap("src/**/env.ts", "src/lib/x.ts") === null, "** matches any depth, only for the matching tail");
}

console.log("good: every check is green and the flip is ready");
{
  const dir = mkProject();
  const w = run("waves.mjs", dir);
  ok(w.status === 0 && /^W0: WO-01-001$/m.test(w.out) && /^W1: WO-01-002, WO-02-001$/m.test(w.out), `waves exit 0, W0/W1 as planned (got ${w.status})`);
  ok(/3 work orders, 2 waves \(W0-W1\)/.test(w.out), "the summary counts work orders and waves");
  const a = run("ac-matrix.mjs", dir, "--matrix");
  ok(a.status === 0 && /3 live ACs across 2 FRDs/.test(a.out), `ac-matrix exit 0, the struck-out AC is not live (got ${a.status})`);
  ok(/AC-01-001\.2 -> WO-01-002/.test(a.out), "--matrix prints AC -> WO (a continuation line belongs to its bullet)");
  ok(run("plan-consistency.mjs", dir).status === 0, "plan-consistency exit 0");
  const d = run("flip-active.mjs", dir, "--dry-run", "--date", "2026-10-02");
  ok(d.status === 0 && /FLIP READY \(dry run\)/.test(d.out) && /5 file\(s\) would change/.test(d.out), "flip --dry-run is ready and names 5 files");
  ok(readFileSync(path.join(dir, BP1), "utf8").includes("status: DRAFT"), "--dry-run writes nothing");
  const f = run("flip-active.mjs", dir, "--date", "2026-10-02");
  const bp = readFileSync(path.join(dir, BP1), "utf8");
  ok(f.status === 0 && /^status: ACTIVE$/m.test(bp), "the flip sets the blueprint ACTIVE");
  ok(/^readiness_gate: passed 2026-10-02$/m.test(bp) && /^grounding_gate: passed 2026-10-02$/m.test(bp) && /^consistency_gate: passed 2026-10-02$/m.test(bp), "and stamps the three gate fields");
  ok(/^last_updated: 2026-10-02$/m.test(bp) && bp.includes("## Build Plan"), "last_updated is bumped and the body is untouched");
  ok(/^status: ACTIVE$/m.test(readFileSync(path.join(dir, WO21), "utf8")), "the work orders flip DRAFT -> ACTIVE");
  ok(/^implementation_status: PLANNED$/m.test(readFileSync(path.join(dir, WO21), "utf8")), "implementation_status is not touched");
  const again = run("flip-active.mjs", dir, "--date", "2026-10-03");
  ok(again.status === 0 && /0 file\(s\) changed/.test(again.out) && /passed 2026-10-02/.test(readFileSync(path.join(dir, BP1), "utf8")), "re-running is a no-op (stamps keep their date)");
}

console.log("waves: unknown id, cycle, same-wave overlap");
{
  const dir = mkProject();
  edit(dir, WO12, "dependsOn: [WO-01-001]", "dependsOn: [WO-01-001, WO-09-001]");
  const r = run("waves.mjs", dir);
  ok(r.status === 1 && /WO-01-002 depends on unknown WO-09-001/.test(r.out), "an unknown dependsOn id fails");
}
{
  const dir = mkProject();
  edit(dir, WO11, "dependsOn: []", "dependsOn: [WO-02-001]");
  const r = run("waves.mjs", dir);
  ok(r.status === 1 && /cycle: WO-01-001 -> WO-02-001 -> WO-01-001/.test(r.out), "a cycle fails and prints its path");
}
{
  const dir = mkProject();
  edit(dir, WO21, "src/app/{list,detail}/**", "src/app/{list,settings}/**");
  const r = run("waves.mjs", dir);
  ok(r.status === 1 && /W1: WO-01-002 `src\/app\/settings\/\*\*` <-> WO-02-001 `src\/app\/\{list,settings\}\/\*\*`/.test(r.out), "a same-wave artifact overlap fails (after brace expansion)");
}
{
  const dir = mkProject();
  writeFileSync(path.join(dir, "docs/frds/frd-02-list/work-orders/wo-02-002-broken.md"), "# no frontmatter\n");
  const r = run("waves.mjs", dir);
  ok(r.status === 1 && /wo-02-002-broken\.md: no frontmatter/.test(r.out), "a work order without frontmatter is a read failure, never skipped");
}
{
  const r = run("waves.mjs", path.join(os.tmpdir(), "no-such-project-architecture-plan"));
  ok(r.status === 2 && /no docs\/frds folder/.test(r.err), "an unreadable project exits 2 with the reason");
}

console.log("ac-matrix: gap, duplicate, removed id, drift, README");
{
  const dir = mkProject();
  edit(dir, WO12, "- **AC-01-001.2:**", "- AC-01-001.2:");
  const r = run("ac-matrix.mjs", dir);
  ok(r.status === 1 && /AC-01-001\.2 \(frd-01-shell\) is owned by no work order/.test(r.out), "an AC no work order copies is a gap");
}
{
  const dir = mkProject();
  edit(dir, WO11, "Related: AC-01-001.2", "- **AC-01-001.2:** WHEN the visitor opens the menu THE SYSTEM SHALL list Inicio and Ajustes, in that order.\n\nRelated: AC-01-001.2");
  const r = run("ac-matrix.mjs", dir);
  ok(r.status === 1 && /AC-01-001\.2 is owned by 2 work orders: WO-01-001, WO-01-002/.test(r.out), "an AC two work orders copy is a duplicate");
  ok(/AC-01-001\.2 -> WO-01-002, but owned by WO-01-001, WO-01-002/.test(r.out), "and the README table no longer agrees");
}
{
  const dir = mkProject();
  edit(dir, WO12, "## Requirements & Acceptance Criteria\n", "## Requirements & Acceptance Criteria\n\n- **AC-01-002.1:** WHEN anything THE SYSTEM SHALL do the removed thing.\n");
  const r = run("ac-matrix.mjs", dir);
  ok(r.status === 1 && /WO-01-002 owns AC-01-002\.1, which no FRD defines/.test(r.out), "a work order that still plans a removed AC fails");
}
{
  const dir = mkProject();
  edit(dir, WO11, "show the top bar with the menu.", "show the top bar.");
  const r = run("ac-matrix.mjs", dir);
  ok(r.status === 1 && /WO-01-001 AC-01-001\.1: the copied criterion differs/.test(r.out), "a stale copied criterion fails (anti spec-drift)");
  ok(run("ac-matrix.mjs", mkProject()).status === 0, "a DR-130 `(drawn in FRD-NN's ...)` note in a copied criterion is allowed (good fixture)");
}
{
  const dir = mkProject();
  edit(dir, RM1, "| AC-01-001.2 | WO-01-002 |", "| AC-01-001.2 | WO-01-001 |");
  const r = run("ac-matrix.mjs", dir);
  ok(r.status === 1 && /AC-01-001\.2 -> WO-01-001, but owned by WO-01-002/.test(r.out), "a README AC table that disagrees fails");
}

console.log("plan-consistency: dependsOn, artifacts, foundation, wave label, rows");
{
  const dir = mkProject();
  edit(dir, RM1, "| WO-01-002 | settings | PLANNED | WO-01-001 |", "| WO-01-002 | settings | PLANNED | — |");
  const r = run("plan-consistency.mjs", dir);
  ok(r.status === 1 && /WO-01-002: frontmatter dependsOn \[WO-01-001\] != README \[\(none\)\]/.test(r.out), "a README Depends on that drifted fails");
}
{
  const dir = mkProject();
  edit(dir, WO12, "dependsOn: [WO-01-001]", "dependsOn: [WO-01-001, WO-02-001]");
  const r = run("plan-consistency.mjs", dir);
  ok(r.status === 1 && /WO-01-002: frontmatter dependsOn \[WO-01-001, WO-02-001\] != Build Plan \[WO-01-001\]/.test(r.out), "a dependsOn edge added only in frontmatter fails");
}
{
  const dir = mkProject();
  edit(dir, BP1, "`src/app/settings/**`, `e2e/settings/**`", "`src/app/settings/**`");
  edit(dir, BP1, "| WO-01-001 | — | `src/app/layout.tsx`, `src/components/core/**` | true |", "| WO-01-001 | — | `src/app/layout.tsx`, `src/components/core/**` | false |");
  const r = run("plan-consistency.mjs", dir);
  ok(r.status === 1 && /WO-01-002: frontmatter only \[e2e\/settings\/\*\*\]; Build Plan only \[\(none\)\]/.test(r.out), "artifacts that differ from the Build Plan fail");
  ok(/WO-01-001: frontmatter foundation true != Build Plan "false"/.test(r.out), "a foundation flag that differs fails");
}
{
  const dir = mkProject();
  edit(dir, BP2, "| WO-01-002 | W1 |", "| WO-01-002 | W2 |");
  const r = run("plan-consistency.mjs", dir);
  ok(r.status === 1 && /WO-02-001: Build Plan says W2, dependsOn puts it in W1/.test(r.out), "a stale wave label fails");
}
{
  const dir = mkProject();
  edit(dir, RM1, "| WO-01-001 | app-shell | PLANNED | — | The persistent shell and core primitives |\n", "| WO-01-001 | app-shell | PLANNED | — | The persistent shell and core primitives |\n\n");
  const r = run("plan-consistency.mjs", dir);
  ok(r.status === 1 && /the README row for WO-01-002 sits outside the table \(a blank line splits it\)/.test(r.out), "a row split off by a blank line fails with that reason");
}
{
  const dir = mkProject();
  edit(dir, RM1, "| WO-01-002 | settings | PLANNED | WO-01-001 | The settings page |\n", "");
  const r = run("plan-consistency.mjs", dir);
  ok(r.status === 1 && /no README row for WO-01-002/.test(r.out), "a missing README row fails");
}

console.log("flip-active: refuses on a gate that still fails or a red plan check");
{
  const verdict = lastVerdict("## Verdict: FAIL\n\n## Resolution addendum\n\nre-verified. Verdict after\nresolution: **PASS**.");
  ok(verdict === "PASS", "the last verdict wins, across a line break and markdown emphasis");
  ok(lastVerdict("---\nverdict: FAIL\n---\n# Gate") === "FAIL" && lastVerdict("# Gate\nno verdict here") === null, "a frontmatter verdict counts; no verdict is null");
}
{
  const dir = mkProject();
  edit(dir, "docs/reviews/architecture-grounding-gate.md", "Verdict: **PASS**.", "Verdict: **FAIL** (1 blocker).");
  const r = run("flip-active.mjs", dir, "--date", "2026-10-02");
  ok(r.status === 1 && /grounding_gate: .*ends with verdict FAIL/.test(r.out) && /FLIP REFUSED/.test(r.out), "a FAIL report without its addendum refuses the flip");
  ok(/^status: DRAFT$/m.test(readFileSync(path.join(dir, BP1), "utf8")), "a refused flip writes nothing");
}
{
  const dir = mkProject();
  rmSync(path.join(dir, "docs/reviews/architecture-consistency-gate.md"));
  const r = run("flip-active.mjs", dir, "--dry-run");
  ok(r.status === 1 && /consistency_gate: docs\/reviews\/architecture-consistency-gate\.md is missing/.test(r.out), "a missing report refuses the flip");
}
{
  const dir = mkProject();
  edit(dir, WO12, "dependsOn: [WO-01-001]", "dependsOn: [WO-01-001, WO-02-001]");
  const r = run("flip-active.mjs", dir, "--dry-run");
  ok(r.status === 1 && /the deterministic plan checks are green/.test(r.out) && /FLIP REFUSED/.test(r.out), "a red plan check refuses the flip (re-verification is part of it)");
}

console.log("resolve-versions: stable only, cooldown, peers, families, Node types");
{
  ok(satisfies("19.3.0", "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0") === true, "a range with an exact prerelease alternative is understood");
  ok(satisfies("2.0.0", ">=1.0.0 <2") === false && satisfies("0.2.9", "^0.2.1") === true && satisfies("0.3.0", "^0.2.1") === false, "comparators, caret on 0.x");
  ok(satisfies("6.5.0", "4 - 6") === true && satisfies("1.4.0", "~1.3.0") === false, "hyphen ranges and tilde");
  const doc = { "dist-tags": { latest: "2.0.0-rc.1" }, versions: { "1.1.0": {}, "2.0.0-rc.1": {} }, time: { "1.1.0": "2026-08-01T00:00:00Z", "2.0.0-rc.1": "2026-09-01T00:00:00Z" } };
  const p = pickVersion(doc, "", Date.parse("2026-10-09T00:00:00Z"));
  ok(p.pick === "1.1.0" && /latest tag 2\.0\.0-rc\.1 is a prerelease: skipped/.test(p.notes.join()), "a prerelease that holds the latest tag is never picked");
  const now = ["--now", "2026-10-16T00:00:00Z", "--packuments", path.join(FIXTURES, "packuments")];
  const r = run("resolve-versions.mjs", ...now, "--node", "24", "--json", "alpha", "beta", "delta", "@fam/one", "@fam/two", "@types/node");
  const out = JSON.parse(r.out);
  const pick = (n) => out.rows.find((x) => x.name === n);
  ok(pick("alpha").pick === "1.1.0" && pick("alpha").command === "pnpm add --save-exact alpha@1.1.0", "alpha: the highest stable version, with its exact install command");
  ok(pick("beta").pick === "3.1.0" && /latest 3\.2\.0 \(2026-10-14\) is inside the cooldown/.test(pick("beta").notes.join()), "beta: a version inside the 7-day cooldown is skipped");
  ok(pick("@types/node").pick === "24.19.1", "@types/node follows --node 24, not the newer major");
  ok(r.status === 1 && out.failures.some((f) => /beta@3\.1\.0 needs peer alpha \^2\.0\.0, but alpha resolves to 1\.1\.0/.test(f)), "a peer range the picks do not satisfy fails");
  ok(!out.failures.some((f) => f.startsWith("delta")), "delta's `>=1.0.0 <3` peer accepts alpha 1.1.0");
  ok(out.warnings.some((w) => /family @fam: different majors \(@fam\/one@4\.2\.0, @fam\/two@5\.0\.1\)/.test(w)), "packages of one scope on different majors get an alignment warning");
  const fam = run("resolve-versions.mjs", ...now, "--json", "@fam/one", "@fam/two@4");
  ok(fam.status === 0 && JSON.parse(fam.out).warnings.length === 0, "pinning the major aligns the family");
  const none = run("resolve-versions.mjs", ...now, "gamma@9");
  ok(none.status === 1 && /FAIL {2}gamma@9: no stable version published before 2026-10-09/.test(none.out), "a requested major with no eligible version fails");
  const md = run("resolve-versions.mjs", ...now, "alpha");
  ok(md.status === 0 && /^\| alpha \| 1\.1\.0 \| 2026-08-01 \| 2\.0\.0-rc\.1 \|/m.test(md.out) && /VERSIONS RESOLVED/.test(md.out), "the default output is a markdown table row per package");
  const missing = run("resolve-versions.mjs", ...now, "nope");
  ok(missing.status === 2 && /no packument fixture for nope/.test(missing.err), "an unreadable registry entry exits 2 (fail loud)");
}

for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
