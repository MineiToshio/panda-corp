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
          status: { type: 'string', enum: ['open', 'doing'] },
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
  `Read every file matching \`${FACTORY_ROOT}/factory/backlog/BL-*.md\` (skip \`_item-template.md\` and \`README.md\`). For each, parse its YAML frontmatter and return {id, path, title, status, tier} where \`path\` is the file's ABSOLUTE path (anchored at ${FACTORY_ROOT}, never a relative/cwd-derived path) and \`status\` is the frontmatter's own \`status\` field verbatim. Compute \`tier\` per this rubric — ${tierRubric} — by reading the item's own \`severity\` field and how much its \`## Fix plan\` section actually touches (read the file body, not just the frontmatter, to judge this). Return ALL items regardless of status (open, doing, AND done) — the caller filters; do not pre-filter yourself. Return { items: [] } if the directory has no BL-*.md files (an honest empty list, never an error for a genuinely empty backlog).`,
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

const RECIPE = (item) => `Implement and close factory backlog item ${item.id} (proposal 31 T1.1 — dispatched by the pandacorp-backlog engine, replacing a hand-run subagent).

1. Isolate FIRST: create a fresh worktree anchored at the factory root: \`git -C ${FACTORY_ROOT} worktree add ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id} -b bl/${item.id}\`. The \`-C ${FACTORY_ROOT}\` decides WHICH repo owns the worktree — NEVER run worktree add without it (your cwd may be a different repo). Then VERIFY ownership before any work: \`git -C ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id} rev-parse --git-common-dir\` must resolve inside ${FACTORY_ROOT} — if it does not, remove that worktree immediately and return status: "blocked" with reason "worktree anchored to wrong repo". Do ALL work inside that worktree directory from here on — never touch the main checkout's working tree.
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
    `From the MAIN checkout at ${FACTORY_ROOT} (never a worktree), land backlog item ${item.id}'s branch \`${item.branch}\`.

1. Same repo, local branch — no fetch needed, just proceed.
2. Rebase the branch onto current main first if it is behind: from the item's OWN worktree at ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id}, run \`git -C ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id} rebase main\` (or skip if already up to date).
3. From the MAIN checkout: \`git -C ${FACTORY_ROOT} merge --ff-only ${item.branch}\` when possible. If ff-only fails, do a normal merge and resolve conflicts by hand using these named hotspots:
   - plugin/.claude-plugin/plugin.json (and plugin/.codex-plugin/plugin.json) version field: keep the HIGHER of the two versions, never blindly pick one side.
   - plugin/docs/decision-log.md: keep BOTH entries, most-recent-on-top (never drop either side's entry).
   - factory/backlog/README.md's open-item count mentions: recount from the actual files after the merge, don't trust either side's stale number.
4. After the merge lands (ff-only or resolved), run \`bash ${FACTORY_ROOT}/plugin/scripts/validate-backlog.sh\` from ${FACTORY_ROOT}. If it reports errors: \`git -C ${FACTORY_ROOT} revert --no-edit HEAD\` (or reset to the pre-merge commit if the merge was a plain fast-forward with nothing to revert-cleanly — whichever leaves main exactly as it was before this merge attempt), and report validator: "red", merged: false, with the validator's error as reason. Do NOT proceed to remove the worktree in that case — leave it for inspection.
5. If the validator is green: remove the worktree and its branch BEFORE returning — \`git -C ${FACTORY_ROOT} worktree remove ${FACTORY_ROOT}/.claude/worktrees/bl-${item.id}\` then \`git -C ${FACTORY_ROOT} branch -d ${item.branch}\`.

Return { id: "${item.id}", merged: true or false, validator: "green" or "red", reason: <one-line if red or not merged> }.`,
    { label: `merge:${item.id}`, phase: 'Merge', model: 'sonnet', agentType: 'pandacorp:implementer', schema: MERGE_SCHEMA },
  )

  if (mergeResult && mergeResult.merged === true && mergeResult.validator === 'green') {
    merged.push({ id: item.id, summary: item.summary })
    log(`Merge: ${item.id} merged into main, validator green.`)
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
