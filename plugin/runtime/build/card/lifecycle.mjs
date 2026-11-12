// card/lifecycle.mjs: the state transitions of a card around a build (building, docs sha, reset, archive).
import path from "node:path";
import { fail, resolveDeps, SHA_RE, SLUG_RE } from "./common.mjs";
import { updateFrontmatter } from "./frontmatter.mjs";
import { cardPaths, parseCardText } from "./parse.mjs";
import { readCard, readRegular } from "./read.mjs";
import { atomicWrite, ensureRealDir, guardWrite, updateCard } from "./write.mjs";

/**
 * `start --run`: the run takes the card. Sets `status: building`, `run_id` and stamps `engine: v2`. Idempotent for the
 * same run; refuses a card that is done, discarded, closing or owned by another run.
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {{runId: string}} opts
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<object>} the updated card model
 */
export async function markCardBuilding(project, slug, { runId }, deps = {}) {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(runId ?? "")) throw fail("INVALID_INPUT", `invalid run id: ${runId}`);
  const card = await readCard(project, slug, {}, deps);
  if (!card) throw fail("INVALID_INPUT", `card not found: ${slug}`);
  const owned = card.status === "building" && card.run_id === runId;
  if (!owned && !["ready", "draft"].includes(card.status)) throw fail("INVALID_STATE", `card ${slug} is ${card.status || "unreadable"}, not buildable`);
  return updateCard(project, slug, { set: { status: "building", run_id: runId, engine: "v2" } }, deps);
}

/**
 * Record the docs-before commit of a card (D17).
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {string} sha the `Change-Docs:` commit
 * @param {object} [deps] see `resolveDeps`
 */
export async function setCardDocsSha(project, slug, sha, deps = {}) {
  if (!SHA_RE.test(sha ?? "")) throw fail("INVALID_INPUT", `invalid sha: ${sha}`);
  return updateCard(project, slug, { set: { docs_sha: sha } }, deps);
}

/**
 * A failed, stopped or abandoned build returns the card to `ready` with a note (BUILD-8).
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {string} note why it was reopened (English, one line)
 * @param {object} [deps] see `resolveDeps`
 */
export async function resetCardReady(project, slug, note, deps = {}) {
  return updateCard(project, slug, { set: { status: "ready", note }, remove: ["run_id"] }, deps);
}

/**
 * D18 decision for a `building` card at `start --run`/`--resume`.
 * @param {{v1: boolean, engine: string, run_id: string}} card a card model
 * @param {{runId: string, otherRunStatus?: string|null}} ctx `runId` = the run being started or resumed;
 *   `otherRunStatus` = `state.status` of the card's own run when it is a different run (`null` = no record of it)
 * @returns {{action: "resume"|"reset_ready"|"leave"|"reconcile_v1"|"unknown", reason: string}}
 */
export function buildingCardAction(card, { runId, otherRunStatus = null }) {
  if (card.engine === "v2") {
    if (card.run_id === runId) return { action: "resume", reason: "v2 card of this run" };
    if (otherRunStatus === null || otherRunStatus === "finished") return { action: "reset_ready", reason: "v2 card of another, terminal run" };
    return { action: "leave", reason: `v2 card of run ${card.run_id}, which is ${otherRunStatus}` };
  }
  if (card.v1) return { action: "reconcile_v1", reason: "default-engine card (integration_transaction): build-state.mjs reconcileBuildingChange" };
  return { action: "unknown", reason: "building card owned by neither engine" };
}

/**
 * Archive a completed card (PLAN 3.16 A3), idempotent and never an error:
 * a pending card gets `status: done` + `shipped_sha` and moves to `done/`; a card already in `done/` (the DR-147
 * reconciler moved it) only gets `shipped_sha` when it has none; a missing card yields a `note` for the journal.
 * @param {string} project absolute project root
 * @param {{slug: string, sha: string}} input the landed commit that completes the card
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<{action: "archived"|"stamped"|"already_archived"|"missing"|"conflict", path: string|null, note: string|null}>}
 */
export async function archiveCard(project, { slug, sha }, deps = {}) {
  const ctx = resolveDeps(deps);
  if (!SLUG_RE.test(slug ?? "")) throw fail("INVALID_INPUT", `invalid card slug: ${slug}`);
  if (!SHA_RE.test(sha ?? "")) throw fail("INVALID_INPUT", `invalid sha: ${sha}`);
  const dirs = cardPaths(project);
  const src = path.join(dirs.pending, `${slug}.md`);
  const dst = path.join(dirs.done, `${slug}.md`);
  const [pendingRaw, doneRaw] = [await readRegular(ctx.fs, src), await readRegular(ctx.fs, dst)];
  if (pendingRaw !== null && doneRaw !== null) {
    return { action: "conflict", path: null, note: `card ${slug} exists in changes/ and changes/done/; left untouched` };
  }
  if (pendingRaw !== null) {
    await guardWrite(ctx, src);
    await ensureRealDir(ctx.fs, dirs.done, { create: true });
    const mode = (await ctx.fs.lstat(src)).mode & 0o777;
    await atomicWrite(ctx.fs, src, updateFrontmatter(pendingRaw, { set: { status: "done", shipped_sha: sha } }), mode);
    await ctx.fs.rename(src, dst);
    return { action: "archived", path: dst, note: null };
  }
  if (doneRaw === null) return { action: "missing", path: null, note: `card ${slug} not found in changes/ or changes/done/` };
  if (parseCardText(doneRaw, { slug, source: "done" }).shipped_sha !== "") return { action: "already_archived", path: dst, note: null };
  await guardWrite(ctx, dst);
  await atomicWrite(ctx.fs, dst, updateFrontmatter(doneRaw, { set: { shipped_sha: sha } }), (await ctx.fs.lstat(dst)).mode & 0o777);
  return { action: "stamped", path: dst, note: null };
}
