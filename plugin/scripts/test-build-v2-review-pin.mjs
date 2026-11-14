#!/usr/bin/env node
// test-build-v2-review-pin.mjs: BL-0323. A re-dispatched review must judge exactly the end of the diff range its brief
// names: units/worktrees.mjs pinReviewWorktree moves a reused checkout there (or fails loud), and failure/unblock.mjs
// lifts an older owner `review_blocked` hand-back only when the wrong checkout is proven (HEAD != brief range end).
// Real git in a temp repo. Run: node plugin/scripts/test-build-v2-review-pin.mjs
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildPaths } from "../runtime/build/paths.mjs";
import { pinReviewWorktree } from "../runtime/build/units/worktrees.mjs";
import { planUnblock, reviewCheckoutProof } from "../runtime/build/failure/unblock.mjs";

let passed = 0; let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (e) { console.error(`FAIL  ${name}: ${e.message}`); failed++; } };
const ok = (v, m) => { if (!v) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); };
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: ENV, encoding: "utf8" }).trim();
const RUN = "br-2026-11-14-01";
const REVIEW = "u-review-frd-01-alpha";

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "pc-pin-")));
  git(root, "init", "-q", "-b", "main");
  await writeFile(path.join(root, "a.txt"), "a\n"); git(root, "add", "-A"); git(root, "commit", "-q", "-m", "A");
  const p = buildPaths(root);
  git(root, "branch", p.integrationBranch(RUN));
  const wt = p.unitWorktree(REVIEW, 1);
  await mkdir(path.dirname(wt), { recursive: true });
  git(root, "worktree", "add", "-q", "-b", `lane/${RUN}/${REVIEW}`, wt, p.integrationBranch(RUN));
  const A = git(wt, "rev-parse", "HEAD");
  // A later patch lands on the integration branch after the review checkout was made.
  const integ = path.join(root, "integ");
  git(root, "worktree", "add", "-q", integ, p.integrationBranch(RUN));
  await writeFile(path.join(integ, "b.txt"), "b\n"); git(integ, "add", "-A"); git(integ, "commit", "-q", "-m", "B patch");
  const B = git(integ, "rev-parse", "HEAD");
  return { root, p, wt, A, B, cleanup: () => rm(root, { recursive: true, force: true }) };
}

await test("pinReviewWorktree moves a reused review checkout to the range end and proves HEAD == pin", async () => {
  const f = await fixture();
  try {
    const out = await pinReviewWorktree({ project: f.root, runId: RUN, worktree: f.wt, sha: f.B }, { env: ENV });
    eq([out.moved, out.head], [true, f.B], "moved to B");
    eq(git(f.wt, "rev-parse", "HEAD"), f.B, "HEAD is the pin");
    eq((await pinReviewWorktree({ project: f.root, runId: RUN, worktree: f.wt, sha: f.B }, { env: ENV })).moved, false, "already pinned: no move");
  } finally { await f.cleanup(); }
});

await test("pinReviewWorktree keeps an untracked file and refuses a branch holding its own commit", async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.wt, "scratch.local"), "x\n");
    await pinReviewWorktree({ project: f.root, runId: RUN, worktree: f.wt, sha: f.B }, { env: ENV });
    eq(git(f.wt, "status", "--porcelain"), "?? scratch.local", "untracked file kept");
    await writeFile(path.join(f.wt, "own.txt"), "own\n"); git(f.wt, "add", "own.txt"); git(f.wt, "commit", "-q", "-m", "own");
    let threw = null;
    try { await pinReviewWorktree({ project: f.root, runId: RUN, worktree: f.wt, sha: f.A }, { env: ENV }); } catch (e) { threw = e; }
    ok(threw && threw.code === "INVALID_STATE", `a review branch with its own commit is never reset: ${threw?.message}`);
  } finally { await f.cleanup(); }
});

const legacy = (f, briefEnd) => {
  const state = { units: [
    { id: "u-build-wo-01-017", kind: "build", frd: "frd-01-alpha", state: "blocked", attempt: 2, wos: ["wo-01-017"], depends_on: [] },
    { id: REVIEW, kind: "review", frd: "frd-01-alpha", state: "verified", attempt: 1, wos: ["wo-01-017"], depends_on: ["u-build-wo-01-017"], worktree: f.wt, review: { verdict: "blocked" } },
  ] };
  const events = [
    { seq: 1, type: "unit_state", data: { unit: "u-build-wo-01-017", from: "reviewing", to: "blocked" } },
    { seq: 2, type: "handback", data: { unit: "u-build-wo-01-017", cause: "owner", reason_code: "review_blocked", reason: "wrong checkout", attempt: 2, blocked: ["u-build-wo-01-017", REVIEW] } },
  ];
  return { state, events, brief: `Diff range: ${f.A}..${briefEnd}\n` };
};

await test("legacy review_blocked: proven wrong checkout -> unblock restores reviewing and re-queues the review; unproven -> refused", async () => {
  const f = await fixture();
  try {
    const { state, events, brief } = legacy(f, f.B);
    await mkdir(path.dirname(f.p.briefFile(REVIEW)), { recursive: true });
    await writeFile(f.p.briefFile(REVIEW), brief);
    const proof = await reviewCheckoutProof({ paths: f.p, state, events, unitId: "u-build-wo-01-017" }, { env: ENV });
    eq(proof, true, "HEAD A is not the brief's range end B");
    const plan = planUnblock({ state, events, unitId: "u-build-wo-01-017", reason: "review re-run on its pin", checkoutProof: proof });
    eq([plan.restored["u-build-wo-01-017"], plan.restored[REVIEW], plan.reviewCheckout], ["reviewing", "queued", true], "restore + re-queue");
    ok(plan.state.units.find((u) => u.id === REVIEW).review === null, "the blocked review verdict is cleared");
    let threw = null;
    try { planUnblock({ state, events, unitId: "u-build-wo-01-017", reason: "x", checkoutProof: false }); } catch (e) { threw = e; }
    ok(threw && threw.code === "INVALID_INPUT", "without the proof an owner review_blocked stays the owner's");
    await writeFile(f.p.briefFile(REVIEW), `Diff range: ${f.A}..${f.A}\n`);
    eq(await reviewCheckoutProof({ paths: f.p, state, events, unitId: "u-build-wo-01-017" }, { env: ENV }), false, "HEAD == range end: no proof");
  } finally { await f.cleanup(); }
});

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
