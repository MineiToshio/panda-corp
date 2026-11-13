#!/usr/bin/env node
// test-build-v2-g2-leftover.mjs: BL-0316. A G2 snapshot the engine created (a DETACHED checkout of a pin reachable from
// the run's integration ref, under build/g2/) is removable even when its bootstrap and verify run left ignored files in
// it (.env.local, copied prototype assets, .pandacorp/run/*, node_modules). Everything else keeps the DR-157 protection:
// untracked or tracked changes, an unreachable pin, and branch worktrees with unclassified ignored files are kept.
// Run: node plugin/scripts/test-build-v2-g2-leftover.mjs
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFixture } from "./fixtures/build-v2/make-fixture.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (v, m) => { if (!v) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); };

const { removeWorktree } = await import("../runtime/build/integrate/worktrees.mjs");
const { buildPaths } = await import("../runtime/build/paths.mjs");
const RUN = "run-g2l";
const scratch = await mkdtemp(path.join(os.tmpdir(), "pc-g2-leftover-"));
let n = 0;
const git = (cwd, args) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } }).trim();
const put = async (file, text) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); };

/** A project with an integration ref and a detached G2 snapshot of its tip, plus the generated ignored files of a real G2. */
async function world() {
  const dir = path.join(scratch, `w${n++}`); await mkdir(dir, { recursive: true });
  const fx = await createFixture("basic", { dir });
  const root = fx.root;
  await put(path.join(root, ".gitignore"), ".pandacorp/run/\n.pandacorp/inbox/\n.pandacorp/comms/\nnode_modules/\n.env.local\ndocs/design/prototype/assets/\n");
  git(root, ["add", "-A"]); git(root, ["commit", "-q", "-m", "ignore generated files"]);
  git(root, ["branch", `lane/${RUN}/integration`, "main"]);
  const sha = git(root, ["rev-parse", "main"]);
  const p = buildPaths(root);
  const snap = path.join(p.build, "g2", `frd-01-alpha-${sha}`);
  await mkdir(path.dirname(snap), { recursive: true });
  git(root, ["worktree", "add", "-q", "--detach", snap, sha]);
  for (const [rel, text] of [[".env.local", "DATABASE_URL=postgres://127.0.0.1:4002/x\n"], [".pandacorp/run/gate-report.json", "{}\n"], [".pandacorp/run/verify.lock", "1\n"],
    ["docs/design/prototype/assets/funko-ref/a.png", "png"], ["node_modules/pkg/index.js", "module.exports = 1;\n"]]) await put(path.join(snap, rel), text);
  return { dir, fx, root, p, sha, snap };
}
const remove = (w, worktree) => removeWorktree({ project: w.root, worktree, runId: RUN }, {});

await test("an engine-created G2 snapshot with bootstrap/verify ignored files is removed (was kept as unclassified-ignored-files/owner-state)", async () => {
  const w = await world();
  try {
    const res = await remove(w, w.snap);
    eq(res.removed, true, `removed (reason ${res.reason})`);
    ok(!existsSync(w.snap), "directory gone");
    ok(!git(w.root, ["worktree", "list", "--porcelain"]).includes(w.snap), "unregistered");
  } finally { await w.fx.cleanup(); }
});

await test("adversarial: an untracked non-ignored file in the snapshot keeps it", async () => {
  const w = await world();
  try {
    await put(path.join(w.snap, "src/alpha/hand-written.ts"), "export const x = 1;\n");
    const res = await remove(w, w.snap);
    eq(res.removed, false, "kept"); eq(res.reason, "uncommitted-work", "reason");
  } finally { await w.fx.cleanup(); }
});

await test("adversarial: a tracked modification in the snapshot keeps it", async () => {
  const w = await world();
  try {
    await writeFile(path.join(w.snap, "src/alpha/list.ts"), "// changed by hand\n");
    const res = await remove(w, w.snap);
    eq(res.removed, false, "kept"); ok(["uncommitted-work", "masked-tracked-change"].includes(res.reason), `reason ${res.reason}`);
  } finally { await w.fx.cleanup(); }
});

await test("adversarial: a detached checkout whose pin is not reachable from this run's integration ref is kept", async () => {
  const w = await world();
  try {
    git(w.snap, ["-c", "user.name=t", "-c", "user.email=t@x", "commit", "-q", "--allow-empty", "-m", "foreign"]);
    const foreign = git(w.snap, ["rev-parse", "HEAD"]);
    const other = path.join(w.p.build, "g2", `frd-01-alpha-${foreign}`);
    git(w.root, ["worktree", "add", "-q", "--detach", other, foreign]);
    await put(path.join(other, ".env.local"), "X=1\n");
    const res = await remove(w, other);
    eq(res.removed, false, "kept"); eq(res.reason, "detached-ownership-unproven", "reason");
  } finally { await w.fx.cleanup(); }
});

await test("adversarial: a BRANCH unit worktree with an unclassified ignored file stays protected (only detached G2 snapshots are disposable)", async () => {
  const w = await world();
  try {
    const wt = path.join(w.p.build, "wt", "u-x");
    git(w.root, ["worktree", "add", "-q", "-b", `lane/${RUN}/u-x`, wt, "main"]);
    await put(path.join(wt, ".env.local"), "SECRET=hand-made\n");
    const res = await remove(w, wt);
    eq(res.removed, false, "kept"); eq(res.reason, "unclassified-ignored-files", "reason");
  } finally { await w.fx.cleanup(); }
});

await rm(scratch, { recursive: true, force: true });
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
