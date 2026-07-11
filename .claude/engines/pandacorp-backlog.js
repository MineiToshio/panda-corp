export const meta = {
  name: 'pandacorp-backlog',
  description: 'Deterministic drain-all engine for factory/backlog/ (proposal 31 T1.1): scans open/doing BL-* items and sizes each to a model tier (CONV-12/DR-111), fans out one isolated-worktree implementer per item in parallel, then merges the successful ones back into main ONE AT A TIME with a validator gate between merges. Replaces the improvised prose fan-out in implement-backlog/SKILL.md\'s drain-all mode.',
  phases: [
    { title: 'Scan' },
    { title: 'Implement' },
    { title: 'Merge' },
    { title: 'Report' },
  ],
}

// scriptPath launches deliver `args` as a JSON STRING (name launches delivered an object) —
// normalize before ANY read, or every args.* below silently falls to its legacy default (BL-0022 class).
// Verified empirically 2026-07-06 (proposal 31 T0). Unparseable string = fail LOUD, never run misconfigured.
if (typeof args === 'string') {
  try { args = JSON.parse(args) } catch (e) { log('FATAL: args arrived as an unparseable string: ' + e.message); throw e }
}

// ── Input (all optional) ─────────────────────────────────────────────────────
//   args.items:       explicit BL ids to drain (default: every open|doing item)
//   args.maxItems:     cap on how many scanned items are actually dispatched (default: no cap)
//   args.factoryRoot:  absolute path to the factory root — EVERY path/git command in every
//     agent prompt below is anchored to this, NEVER to cwd (BL-0022 discipline). Defaults to
//     the real factory so a bare launch works; a harness run points this at a fixture repo.
const FACTORY_ROOT = (args && args.factoryRoot) || '/Users/Shared/Proyectos/panda-corp'
const ITEMS_FILTER = (args && args.items) || null
const MAX_ITEMS = (args && args.maxItems) || Infinity

// BL-0022 discipline, same as pandacorp-build's WORK_FROM: subagents inherit the SESSION's cwd,
// which may be a DIFFERENT repo than FACTORY_ROOT (harness runs point at a fixture). Without this
// preamble on EVERY prompt, weaker-tier agents drift to the repo their cwd suggests — observed
// live 2026-07-06: a haiku implementer reasoned against the real factory's backlog during a
// fixture run, twice, despite absolute paths in the prompt body.
const ANCHOR = `ANCHOR — target repo: ${FACTORY_ROOT}. cd ${FACTORY_ROOT} FIRST. Your session cwd may point at a DIFFERENT repo — ignore it completely. Never read, edit, or run git/scripts against any repo other than ${FACTORY_ROOT} (and its own worktrees under ${FACTORY_ROOT}/.claude/worktrees/).\n\n`

const SCAN_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'path', 'title', 'status', 'tier'],
        properties: {
          id: { type: 'string' },
          path: { type: 'string' },
          title: { type: 'string' },
          // Scan returns the complete store so resume can exclude already-closed
          // work from canonical frontmatter. Keeping `done` out of this schema
          // contradicted the prompt below and made an honest complete scan fail
          // schema validation as soon as the backlog contained a closed item.
          status: { type: 'string', enum: ['open', 'doing', 'done'] },
          tier: { type: 'string', enum: ['haiku', 'sonnet', 'opus'] },
        },
      },
    },
  },
}

const IMPLEMENT_SCHEMA = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: { type: 'string' },
    branch: { type: 'string' },
    status: { type: 'string', enum: ['done', 'blocked'] },
    reason: { type: 'string' },
    summary: { type: 'string' },
  },
}

const MERGE_SCHEMA = {
  type: 'object',
  required: ['id', 'merged', 'validator'],
  properties: {
    id: { type: 'string' },
    merged: { type: 'boolean' },
    validator: { type: 'string', enum: ['green', 'red'] },
    reason: { type: 'string' },
  },
}

// ── Scan ──────────────────────────────────────────────────────────────────
phase('Scan')

const tierRubric = 'CONV-12/DR-111 (factory/standards/conventions.md): a one-line doc/prose/copy tweak or a mechanical rename -> haiku; the common case (a skill/script/template change with real logic, a routine build-engine adjustment) -> sonnet (the default floor); a change to the build engine\'s own core orchestration, a cross-cutting standard, or anything genuinely architectural/high-judgment -> opus. Fable is never chosen automatically.'

const scan = await agent(
  `${ANCHOR}Read every file matching \`${FACTORY_ROOT}/factory/backlog/BL-*.md\` (skip \`_item-template.md\` and \`README.md\`). For each, parse its YAML frontmatter and return {id, path, title, status, tier} where \`path\` is the file's ABSOLUTE path (anchored at ${FACTORY_ROOT}, never a relative/cwd-derived path) and \`status\` is the frontmatter's own \`status\` field verbatim. Compute \`tier\` per this rubric — ${tierRubric} — by reading the item's own \`severity\` field and how much its \`## Fix plan\` section actually touches (read the file body, not just the frontmatter, to judge this). Return ALL items regardless of status (open, doing, AND done) — the caller filters; do not pre-filter yourself. Return { items: [] } if the directory has no BL-*.md files (an honest empty list, never an error for a genuinely empty backlog).`,
  { label: 'scan', phase: 'Scan', model: 'haiku', agentType: 'pandacorp:implementer', schema: SCAN_SCHEMA },
)

const scannedAll = (scan && scan.items) || []
if (!scan || !Array.isArray(scan.items)) {
  log('FATAL: scan agent returned no items array — cannot proceed without a scan result.')
  throw new Error('pandacorp-backlog: scan phase produced no usable result')
}

let candidates = scannedAll.filter((it) => it.status === 'open' || it.status === 'doing')

if (ITEMS_FILTER) {
  const wanted = new Set(ITEMS_FILTER)
  const before = candidates.length
  candidates = candidates.filter((it) => wanted.has(it.id))
  const missing = ITEMS_FILTER.filter((id) => !candidates.some((it) => it.id === id))
  if (missing.length) {
    log(`args.items requested ${missing.join(', ')} but they were not found among open|doing backlog items (already done, or don't exist) — skipping them.`)
  }
  log(`Filtered by args.items: ${before} open|doing candidates -> ${candidates.length} matched.`)
}

if (candidates.length > MAX_ITEMS) {
  const dropped = candidates.slice(MAX_ITEMS)
  candidates = candidates.slice(0, MAX_ITEMS)
  log(`args.maxItems=${MAX_ITEMS} caps this run — dropped ${dropped.length} item(s) NOT dispatched this run: ${dropped.map((it) => it.id).join(', ')}. Relaunch to pick them up (frontmatter-driven resume).`)
}

log(`Scan: ${scannedAll.length} total backlog file(s), ${candidates.length} dispatched this run (haiku=${candidates.filter((it) => it.tier === 'haiku').length}, sonnet=${candidates.filter((it) => it.tier === 'sonnet').length}, opus=${candidates.filter((it) => it.tier === 'opus').length}).`)

if (candidates.length === 0) {
  log('Nothing to drain — every requested item is already done or the backlog is empty.')
  return { done: [], blocked: [] }
}

// ── Implement (parallel, one isolated worktree per item) ───────────────────
phase('Implement')

const RECIPE = (item) => `${ANCHOR}Implement and close factory backlog item ${item.id} (proposal 31 T1.1 — dispatched by the pandacorp-backlog engine, replacing a hand-run subagent).

1. Isolate FIRST, with resume awareness. Let \`WT=${FACTORY_ROOT}/.claude/worktrees/bl-${item.id}\` and \`BRANCH=bl/${item.id}\`.
   - If Git already registers WT for BRANCH, REUSE it: this is a previous red-merge/blocked attempt preserved for inspection. Never recreate or delete it. Re-run the item's tests and validator from that worktree; a prior \`status: done\` inside the branch is not proof that the failed merge is now valid.
   - If BRANCH exists but has no registered worktree, attach it with \`git -C ${FACTORY_ROOT} worktree add $WT $BRANCH\`.
   - If neither exists, create it with \`git -C ${FACTORY_ROOT} worktree add $WT -b $BRANCH\`.
   - If WT exists on disk but Git does not register it to BRANCH, STOP as blocked; never delete an ambiguous directory.
   The \`-C ${FACTORY_ROOT}\` decides WHICH repo owns the worktree — NEVER run worktree add without it (your cwd may be a different repo). Then VERIFY ownership before any work: canonicalize both \`git -C $WT rev-parse --git-common-dir\` and \`git -C ${FACTORY_ROOT} rev-parse --git-common-dir\`; they must be the exact same directory. If they differ, return status: "blocked" with reason "worktree anchored to wrong repo". Do ALL work inside that worktree directory from here on — never touch the main checkout's working tree.
2. Read the item whole at ${item.path} (already known to you: title "${item.title}"): its Problem (+ Root cause if a bug), Fix plan, Tests, Done when, Out of scope.
3. Implement EXACTLY the Fix plan — nothing broader, nothing past Out of scope. No drive-by refactors.
4. Prove it with the item's own Tests section: a unit test, a verify.sh --canary gate canary, a script/CLI assertion, or a documented manual repro when automation is genuinely infeasible. Never skip proof.
5. When every Done when criterion is objectively true, in the worktree:
   - Rewrite ${item.path}'s OWN frontmatter: status: done, closed: <today, ISO date>, closes: "<the DR/standard/doc/version this produced>" (quote free-text values).
   - If the fix touched plugin/: bump plugin/.claude-plugin/plugin.json's version per semver (PATCH/fix, MINOR/capability, MAJOR/breaking), add the plugin/docs/decision-log.md entry (most-recent-on-top), and run \`claude plugin validate plugin/\` from inside the worktree.
   - If the fix touched factory/standards/ or factory/decisions/registry.yaml or the constitution: add the entry to factory/decision-log.md.
   - Re-run \`bash plugin/scripts/validate-backlog.sh\` (from inside the worktree) — the store must stay valid after your own edit.
6. Commit INSIDE THE WORKTREE (Conventional Commits, English): "fix(backlog): ${item.id} — <title>" for a bug, "feat(backlog): ${item.id} — <title>" for a change. NEVER merge into main, NEVER touch the main checkout — a separate serialized merge phase does that next.
7. If you get stuck (missing owner decision, external dependency, genuine technical fault): leave the item's frontmatter status: doing (never silently revert to open), commit whatever partial progress is safe, and report status: blocked with a one-line reason.

Return { id: "${item.id}", branch: "bl/${item.id}", status: "done" or "blocked", reason: <one-line if blocked>, summary: <one-line of what shipped or what's blocking> }.`

const implementResults = await parallel(
  candidates.map((item) => () => agent(
    RECIPE(item),
    { label: `implement:${item.id}`, phase: 'Implement', model: item.tier, agentType: 'pandacorp:implementer', schema: IMPLEMENT_SCHEMA },
  )),
)

const succeeded = []
const blockedFromImplement = []
for (let i = 0; i < candidates.length; i++) {
  const item = candidates[i]
  const result = implementResults[i]
  if (!result || result.status !== 'done') {
    blockedFromImplement.push({ id: item.id, reason: (result && result.reason) || 'implement agent returned no usable result' })
    log(`Implement: ${item.id} did NOT reach done (${(result && result.reason) || 'no result'}) — left as-is, not retried this run.`)
    continue
  }
  succeeded.push({ id: item.id, branch: result.branch || `bl/${item.id}`, summary: result.summary || '' })
  log(`Implement: ${item.id} done on branch ${result.branch || `bl/${item.id}`}.`)
}

// ── Merge (STRICTLY serialized — one at a time, in return order) ───────────
phase('Merge')

const merged = []
const blockedFromMerge = []

for (const item of succeeded) {
  const mergeResult = await agent(
    `${ANCHOR}From the MAIN checkout at ${FACTORY_ROOT} (never a worktree), land backlog item ${item.id}'s branch \`${item.branch}\`.

1. Same repo, local branch — no fetch needed. Fail closed BEFORE rebase/merge unless ${FACTORY_ROOT} is on branch \`main\` and \`git -C ${FACTORY_ROOT} status --porcelain\` is empty. Never merge over a dirty main checkout: rollback restoration would otherwise overwrite unrelated owner work.
2. Capture \`PRE_MERGE_SHA=$(git -C ${FACTORY_ROOT} rev-parse HEAD)\` before changing main. Rebase the branch onto current main first if it is behind: from the item's OWN worktree at ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id}, run \`git -C ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id} rebase main\` (or skip if already up to date).
3. From the MAIN checkout: \`git -C ${FACTORY_ROOT} merge --ff-only ${item.branch}\` when possible. If ff-only fails, do a normal merge and resolve conflicts by hand using these named hotspots:
   - plugin/.claude-plugin/plugin.json (and plugin/.codex-plugin/plugin.json) version field: keep the HIGHER of the two versions, never blindly pick one side. If this was a genuine CONFLICT on the version field (both sides independently bumped it from the same stale base, not just one side changing it) — a COLLAPSED BUMP: only one increment survives even though two items each thought they were the one bumping from a stable base. Do NOT try to compute a combined/correct bump yourself (that is BL-0025's still-open sequential-allocator work) — just keep the higher value AND set the returned \`reason\` field to a one-line flag even though the merge succeeds, e.g. \`"COLLAPSED-VERSION-BUMP: ${item.id} and another item both bumped plugin.json — verify the surviving version covers both changes' severity"\`, so the owner can reconcile manually.
   - plugin/docs/decision-log.md: keep BOTH entries, most-recent-on-top (never drop either side's entry).
   - factory/backlog/README.md's open-item count mentions: recount from the actual files after the merge, don't trust either side's stale number.
4. After the merge lands (ff-only or resolved), run \`bash ${FACTORY_ROOT}/plugin/scripts/validate-backlog.sh\` from ${FACTORY_ROOT}. If it reports errors, capture \`MERGED_SHA=$(git -C ${FACTORY_ROOT} rev-parse HEAD)\` and first re-check ALL ownership assumptions: the canonical common dir is still the exact repo from step 1, main is still the checked-out branch, and HEAD is exactly \`$MERGED_SHA\`. Then run ONE Git-owned rollback operation: \`git -C ${FACTORY_ROOT} reset --keep $PRE_MERGE_SHA\`. Never split rollback into \`update-ref\` followed by \`restore\`: an owner edit arriving between those commands would be overwritten. \`reset --keep\` must ABORT rather than overwrite a concurrent worktree/index edit; if it aborts, return merged:false/validator:red with reason \`ROLLBACK-BLOCKED-BY-CONCURRENT-OWNER-EDIT\`, preserve the owner's files byte-for-byte, leave HEAD/worktree/worktree-branch in place, STOP this item, and let every later item fail the clean-main preflight. If it succeeds, verify HEAD equals \`$PRE_MERGE_SHA\` and the checkout is clean. A revert commit is NOT acceptable here: Git would still consider the item branch merged and a later resume could not land it again. Do NOT proceed to remove the worktree in either red case — leave it for inspection and resume.
5. If the validator is green: remove the worktree and its branch BEFORE returning — \`git -C ${FACTORY_ROOT} worktree remove ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id}\` then \`git -C ${FACTORY_ROOT} branch -d ${item.branch}\`.

Return { id: "${item.id}", merged: true or false, validator: "green" or "red", reason: <one-line if red or not merged, OR the COLLAPSED-VERSION-BUMP flag above even when merged:true/validator:"green"> }.`,
    { label: `merge:${item.id}`, phase: 'Merge', model: 'sonnet', agentType: 'pandacorp:implementer', schema: MERGE_SCHEMA },
  )

  if (mergeResult && mergeResult.merged === true && mergeResult.validator === 'green') {
    // A `reason` on a SUCCESSFUL merge is never routine chatter — it's reserved for the
    // COLLAPSED-VERSION-BUMP flag (S4, interim honesty fix; BL-0025 tracks the real allocator).
    // Surface it loudly here AND carry it into the final Report, never swallow it silently.
    const flag = mergeResult.reason ? `[FLAG: ${mergeResult.reason}]` : ''
    merged.push({ id: item.id, summary: flag ? `${item.summary || 'merged'} ${flag}` : item.summary })
    log(`Merge: ${item.id} merged into main, validator green.${flag ? ' ' + flag : ''}`)
  } else {
    const reason = (mergeResult && mergeResult.reason) || 'merge agent returned no usable result'
    blockedFromMerge.push({ id: item.id, reason })
    log(`Merge: ${item.id} BLOCKED — ${reason}`)
  }
}

// ── Report ───────────────────────────────────────────────────────────────
phase('Report')

const done = merged.map((m) => ({ id: m.id, reason: m.summary || 'merged' }))
const blocked = [...blockedFromImplement, ...blockedFromMerge]

log(`Drain complete: ${done.length} done, ${blocked.length} blocked.`)

return { done, blocked }
