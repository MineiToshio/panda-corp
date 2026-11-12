#!/usr/bin/env node
// test-build-v2-risk-backtest.mjs (T-D04): backtest of the real risk module against the G 3.1
// counterexamples, the Mission Control tracked change card and the D8 r1/floor split.
// Uses the REAL computeRisk with default deps (real git, real classify-change.mjs, real product-floor).
// Zone expectations come from D8 (r1 iff product floor P1-P5; floor iff classifier S5-S9,S17 or a
// risk-paths match; none otherwise), never from observed output. The owner-labeled set is PENDING.
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeRisk } from "../runtime/build/risk.mjs";

const FX = fileURLToPath(new URL("./fixtures/build-v2/risk-backtest/", import.meta.url));
const loadJson = async (n) => JSON.parse(await readFile(path.join(FX, n), "utf8"));
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z" };
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: GIT_ENV, encoding: "utf8" }).trim();

let passed = 0; let failed = 0;
const failures = [];
const rows = [];
const check = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failures.push(name); failed++; } };
const ok = (v, m) => { if (!v) throw new Error(m); };

const writeTree = async (root, files) => {
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    if (body === null) { await rm(abs, { force: true }); continue; }
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, body);
  }
};

/** Builds a throwaway git repo: commit base (+ risk-paths manifest), then head; returns {root, base, head}. */
const makeRepo = async (parent, c) => {
  const root = await mkdtemp(path.join(parent, "rb-"));
  git(root, "init", "-q", "-b", "main");
  const baseFiles = { ...c.base };
  if (c.riskPaths) baseFiles[".pandacorp/risk-paths"] = await readFile(path.join(FX, c.riskPaths), "utf8");
  await writeTree(root, baseFiles);
  git(root, "add", "-A"); git(root, "commit", "-qm", "base");
  const base = git(root, "rev-parse", "HEAD");
  if (c.head) {
    await writeTree(root, c.head);
    git(root, "add", "-A"); git(root, "commit", "-qm", "head");
  }
  return { root, base, head: git(root, "rev-parse", "HEAD") };
};

const judge = (c, r) => {
  const e = c.expect;
  if (e.zone) ok(r.zone === e.zone, `expected zone ${e.zone}, got ${r.zone} (rules ${JSON.stringify(r.rules)})`);
  if (e.zone_not) ok(r.zone !== e.zone_not, `zone must not be ${e.zone_not} (rules ${JSON.stringify(r.rules)})`);
  if (e.irreversible !== undefined) ok(r.irreversible === e.irreversible, `expected irreversible ${e.irreversible}, got ${r.irreversible}`);
  if (e.audit !== undefined) ok(r.audit === e.audit, `expected audit ${e.audit}, got ${r.audit}`);
  ok(r.failclosed === false, "unexpected failclosed on a well-formed fixture");
  ok(r.zone !== "r1" || r.audit === true, "r1 must imply audit");
};

const run = async (parent, group, c) => {
  await check(`${group}: ${c.id}`, async () => {
    const repo = await makeRepo(parent, c);
    try {
      const input = c.files ? { root: repo.root, files: c.files } : { root: repo.root, range: `${repo.base}..${repo.head}` };
      const r = await computeRisk(input);
      rows.push({ group, id: c.id, zone: r.zone, rules: r.rules, expect: c.expect, audit: r.audit, known_gap: c.known_gap });
      judge(c, r);
    } finally { await rm(repo.root, { recursive: true, force: true }); }
  });
};

const parent = await mkdtemp(path.join(process.env.TMPDIR || os.tmpdir(), "pc-riskbt-"));
try {
  const g31 = await loadJson("g31-counterexamples.json");
  const split = await loadJson("r1-floor-split.json");
  const cards = await loadJson("mc-tracked-cards.json");
  const owner = await loadJson("owner-labeled.json");

  for (const c of g31.cases) await run(parent, "g31", c);
  for (const c of split.cases) await run(parent, "split", c);
  for (const c of cards.cases) await run(parent, "mc-card", { ...cards, ...c, head: null });

  // D8 split invariants over the whole known set
  await check("d8 split: every case labeled r1 is r1, no case labeled floor/none/zone_not-r1 is r1", async () => {
    for (const row of rows) {
      const e = row.expect;
      if (e.zone === "r1") ok(row.zone === "r1", `${row.id}: labeled r1, got ${row.zone}`);
      else ok(row.zone !== "r1", `${row.id}: not an r1 case but classified r1 (rules ${JSON.stringify(row.rules)})`);
    }
  });
  await check("d8 split: Mission Control counterexamples and card are never r1 (no Astra zone in MC)", async () => {
    for (const row of rows.filter((x) => /^g31-[1-5]|^g31-8|^mc-card/.test(x.id))) ok(row.zone !== "r1", `${row.id} classified r1`);
  });
  await check("d8 split: at least one r1 row exists and every r1 row has audit true", async () => {
    const r1rows = rows.filter((x) => x.zone === "r1");
    ok(r1rows.length > 0, "no r1 row at all");
    for (const x of r1rows) ok(x.audit === true, `${x.id}: r1 without audit`);
  });

  // fail-closed contract: a classifier failure is r1
  await check("failclosed: classifier exit 3 yields r1 with failclosed:true", async () => {
    const repo = await makeRepo(parent, { base: { "src/a.ts": "export const a = 1;\n" }, head: { "src/a.ts": "export const a = 2;\n" } });
    try {
      const r = await computeRisk({ root: repo.root, range: `${repo.base}..${repo.head}` }, { exec: async (file, args) => (args.some((a) => /classify/.test(a)) ? { code: 3, stdout: "", stderr: "boom" } : { code: 0, stdout: execFileSync(file, args, { cwd: repo.root, env: GIT_ENV, encoding: "utf8" }), stderr: "" }) });
      ok(r.zone === "r1" && r.failclosed === true, `got zone ${r.zone} failclosed ${r.failclosed}`);
    } finally { await rm(repo.root, { recursive: true, force: true }); }
  });

  // report
  const r1 = rows.filter((x) => x.zone === "r1").length;
  const fl = rows.filter((x) => x.zone === "floor").length;
  const no = rows.filter((x) => x.zone === "none").length;
  console.log("\nzone table (group id -> zone [rules])");
  for (const row of rows) console.log(`  ${row.group.padEnd(7)} ${row.id.padEnd(40)} ${row.zone.padEnd(6)} ${JSON.stringify(row.rules)}`);
  for (const row of rows.filter((x) => x.known_gap)) console.log(`KNOWN-GAP ${row.id}: zone ${row.zone}, audit ${row.audit}. ${row.known_gap}`);
  console.log(`\nr1 share (known set): ${r1}/${rows.length} = ${((100 * r1) / rows.length).toFixed(1)}%   floor ${fl}   none ${no}`);
  const mcRows = rows.filter((x) => /^g31-[1-5]|^g31-8|^mc-card/.test(x.id));
  console.log(`r1 share (Mission Control rows): ${mcRows.filter((x) => x.zone === "r1").length}/${mcRows.length}`);
  console.log(owner.status === "pending" && owner.cases.length === 0 ? "owner-labeled set: PENDING (0 cases; not asserted)" : `owner-labeled set: ${owner.cases.length} cases (status ${owner.status})`);
  for (const c of owner.cases ?? []) await run(parent, "owner", c);
} finally { await rm(parent, { recursive: true, force: true }); }

console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"} passed=${passed} failed=${failed}${failures.length ? ` failing=${failures.join("|")}` : ""}`);
process.exit(failed === 0 ? 0 : 1);
