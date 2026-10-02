export const meta = {
 name: 'pandacorp-build',
 description: 'Pandacorp build engine v2 (DR-050 + BL-0021 + DR-118): builds in GLOBAL WAVES — every wave takes the ready work orders of ALL FRDs (dependsOn satisfied, artifacts disjoint per DR-060, capped at the mode\'s wave) so independent features build in parallel; the per-FRD review/test gate runs CONCURRENTLY with the next wave\'s build, against its own pinned detached worktree snapshot (DR-118) — gates never wait for a wave boundary, but still serialize WITH EACH OTHER (one gate worktree). State lives in the work-order frontmatter (implementation_status). Runs to COMPLETION by default; stops ONLY by health or budget — nothing left to build, a budget ceiling, too many blocks in a row, or work that needs the owner. It TRIES TO REPAIR before giving up; an unrecoverable stop BLOCKS with a reason (needs-owner | external | error) instead of dying. Resumable: it reads the frontmatter and NEVER rebuilds a VERIFIED work order.',
 phases: [
  { title: 'Baseline' },
  { title: 'Process Change' },
  { title: 'Plan' },
  { title: 'Build' },
  { title: 'Hardening' },
  { title: 'Review' },
 ],
}
// GENERATED from plugin/runtime/engine/pandacorp-build.src.js by plugin/scripts/generate-engine.mjs — do not edit (BL-0204)
if (typeof args === 'string') {
 try { args = JSON.parse(args) } catch (e) { log('FATAL: args arrived as an unparseable string: ' + e.message); throw e }
}
const STATE_CLI = args && typeof args.stateCli === 'string' ? args.stateCli : ''
if (!STATE_CLI.startsWith('/') || /[\0\r\n]/.test(STATE_CLI)) {
 const message = 'FATAL: args.stateCli must be an absolute validated build-state CLI path'
 log(message)
 throw new Error(message)
}
const shellQuote = (value) => `'${String(value).replaceAll("'", `'"'"'`)}'`
const STATE_CLI_COMMAND = `node ${shellQuote(STATE_CLI)}`
const DRIFT_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'drift-proof.mjs'))}`
const INVENTORY_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'gate-inventory.mjs'))}`
const WO_REVERT_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'wo-revert.mjs'))}`
const SEAL_REPORT_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'seal-report.mjs'))}`
const FINDER_SNIPPETS_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'finder-snippets.mjs'))}`
const MODE = (args && args.mode) || 'powerful'
const argBool = (a, key, expect) => Boolean(a && (a[key] === expect || a[key] === String(expect)))
const STRICT_BASELINE = argBool(args, 'strictBaseline', true)
const CHANGE = (args && args.change) ? String(args.change).split('/').pop().replace(/\.md$/, '') : null
const normalizeFolder = (s) => String(s).replace(/\/[^/]+\.md$/, '').replace(/\/$/, '').split('/').pop()
let ONLY = (args && !args.change && args.frds) ? args.frds.map(normalizeFolder) : null
const TARGETED = Boolean(CHANGE) || Boolean(args && args.frds)
const SAFE_POINT_WAVE_THROTTLE = 3
const SAFE_POINT_EVERY_WAVE = argBool(args, 'safePointEveryWave', true)
const DRAIN_ON_EMPTY_PLAN = !(args && args.drainOnEmptyPlan === false)
const MAX_FRDS = (args && args.maxFrds) || Infinity
const LOW_BUDGET = (args && args.lowBudget) || 80000
const MAX_SPEND = (args && args.maxSpend) || null
const MAX_AGENTS_AUTO = Boolean(args && args.maxAgents === 'auto')
let MAX_AGENTS = MAX_AGENTS_AUTO ? null : ((args && args.maxAgents) || null)
const MAX_CONSECUTIVE_BLOCKS = (args && args.maxConsecutiveBlocks) || 3
const FOUNDATION_REPAIR_CAP = (args && args.foundationRepairCap) || 2
const FOUNDATION_GATE_NULL_CAP = (args && args.foundationGateNullCap) || 2
const MAX_REOPENS = (args && args.maxReopens) || 3
const FORCE_UI_PASSES = argBool(args, 'forceUiPasses', true)
const GATE_EVIDENCE = (args && args.gateEvidence === 'digested') ? 'digested' : 'explore'
if (args && args.gateEvidence !== undefined && args.gateEvidence !== 'explore' && args.gateEvidence !== 'digested') {
 log(`⚠ args.gateEvidence='${args.gateEvidence}' no es 'explore' ni 'digested' — usando 'explore' (WP-06 fail-closed)`)
}
const DRIFT_FINDER = (() => {
 const raw = args ? args.driftFinder : undefined
 if (raw === undefined || raw === null) return GATE_EVIDENCE === 'digested'
 if (raw === true || raw === 'true') return true
 if (raw === false || raw === 'false') return false
 log(`⚠ args.driftFinder='${raw}' no es booleano — usando el default (${GATE_EVIDENCE === 'digested' ? 'on' : 'off'} con gateEvidence '${GATE_EVIDENCE}') (BL-0203)`)
 return GATE_EVIDENCE === 'digested'
})()
const VISUAL_QA_MODEL = (args && args.visualQaModel === 'opus') ? 'opus' : 'sonnet'
const GATE_CONTEXT_SCOPE = argBool(args, 'gateContextScope', true)
const GATE_INVENTORY_CACHE = argBool(args, 'gateInventoryCache', true)
if (args && args.visualQaModel !== undefined && args.visualQaModel !== 'sonnet' && args.visualQaModel !== 'opus') {
 log(`⚠ args.visualQaModel='${args.visualQaModel}' no es 'sonnet' ni 'opus' — usando 'sonnet' (E-3 fail-closed)`)
}
const DRIFT_POLICY = (args && args.driftPolicy === 'block') ? 'block' : 'record'
if (args && args.driftPolicy !== undefined && args.driftPolicy !== 'record' && args.driftPolicy !== 'block') {
 log(`⚠ args.driftPolicy='${args.driftPolicy}' no es 'record' ni 'block' — usando 'record' (BL-0178)`)
}
const PARALLEL_GATES = !argBool(args, 'parallelGates', false)
const GATE_SLOTS_MAX = 8
const GATE_SLOTS_DEFAULT = 2
const GATE_SLOTS = (() => {
 const raw = args && (args.gateSlots !== undefined && args.gateSlots !== null ? args.gateSlots : args.maxParallelGates)
 if (!PARALLEL_GATES) {
  if (raw !== undefined && raw !== null) log(`⚠ args.gateSlots/maxParallelGates='${raw}' ignored — args.parallelGates is off, so gates keep the single C2 worktree (D1)`)
  return 0
 }
 if (args && args.gateSlots !== undefined && args.gateSlots !== null && args.maxParallelGates !== undefined && args.maxParallelGates !== null && Number(args.gateSlots) !== Number(args.maxParallelGates)) {
  log(`⚠ both args.gateSlots=${args.gateSlots} and args.maxParallelGates=${args.maxParallelGates} were passed — gateSlots wins (D1)`)
 }
 if (raw === undefined || raw === null) return GATE_SLOTS_DEFAULT
 const n = Number(raw)
 if (Number.isInteger(n) && n >= 1 && n <= GATE_SLOTS_MAX) return n
 log(`⚠ args.gateSlots='${raw}' is not an integer 1..${GATE_SLOTS_MAX} — using ${GATE_SLOTS_DEFAULT} gate slots (D1 fail-closed)`)
 return GATE_SLOTS_DEFAULT
})()
const LEAN_CLOSE_OUT = !argBool(args, 'leanCloseOut', false)
const SCOPED_REPAIR = argBool(args, 'scopedRepair', true)
const REPAIR_BRAKE = !argBool(args, 'repairBrake', false)
const REPAIR_BUDGET_FACTOR = (args && args.repairBudgetFactor) || 3
const FINDING_SPREAD_THRESHOLD = (args && args.findingSpreadThreshold) || 3
const PATCH_ATTEMPT_CAP = (args && args.patchAttemptCap) || 2
const PROJECT = (args && args.project) || '$(basename "$PWD")'
const PROJECT_DIR = (args && args.projectDir) || '.'
const LEASE_TOKEN = (args && args.leaseToken) || ''
const LEASE_EPOCH = (args && args.leaseEpoch) || 0
const TRACK_PATH = PROJECT_DIR === '.' ? '.pandacorp/track.jsonl' : `${PROJECT_DIR}/.pandacorp/track.jsonl`
const WORK_FROM = PROJECT_DIR === '.' ? '' : `Work from the project root ${PROJECT_DIR} — cd there FIRST; every relative path below is relative to it.\n`
const SYNC_ROLLUPS = "Run the sole governed rollup writer exactly once: `{{STATE_CLI_COMMAND}} sync-rollups --project \"{{PROJECT_DIR}}\" --token \"{{LEASE_TOKEN}}\" --epoch \"{{LEASE_EPOCH}}\"`. Do not edit FRD/blueprint rollups or work-order counters yourself. The command re-derives them from work-order frontmatter, advances producer freshness, validates the lease fence inside the mutation mutex, and fails closed. Return its JSON `corrected` value.".replaceAll('{{STATE_CLI_COMMAND}}', STATE_CLI_COMMAND).replaceAll('{{PROJECT_DIR}}', PROJECT_DIR).replaceAll('{{LEASE_TOKEN}}', LEASE_TOKEN).replaceAll('{{LEASE_EPOCH}}', String(LEASE_EPOCH))
const SYNC_ROLLUPS_COMMIT = ' If that command changed any docs/frds/*/frd.md or blueprint.md on disk — or `git status --porcelain -- docs/frds` still lists one of those rollup documents as modified (an earlier step left it uncommitted) — stage ONLY those rollup documents and commit them right now, as their OWN commit (Conventional Commits, scope) — BEFORE anything else below.'
const WHOLE_FRD_ORACLE = "**Whole-FRD source oracle (mandatory, fail-closed):** before judging code or writing tests, inventory every normative contract in the entire `frd.md` — requirements, numbered acceptance criteria, invariants, edge cases, limits, errors and exclusions — including normative material outside numbered ACs. Record a traceability checklist in the verdict with each contract, its class, `pass | fail | not-applicable`, and the test path(s) that prove it. **The inventory needs at least one entry for EACH of the 7 contract classes** (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion): a numbered REQ-NN-MMM requirement is its OWN `requirement` entry, distinct from the acceptance-criterion entries that verify it — do not cover a requirement only through its ACs and skip the `requirement` entry. If a class genuinely does not apply to this FRD, add a `not-applicable` entry for it with `tests: []` instead of omitting the class — an omitted class is itself RED even when every other class is complete. Every applicable edge-case or limit class requires at least one adversarial boundary test. Missing inventory, missing applicable boundary coverage, or any contradiction is RED. Passing numbered ACs can never waive, override or dismiss another normative FRD clause; there are no reviewer waivers for approved spec text. A contradiction you believe pre-dates this cycle is still a `fail` entry — never dropped, never waived — at most PROPOSED as pre-existing drift for the engine to prove or reject."
const DRIFT_CLAIM_DIRECTIVE = "**Pre-existing drift (DR-122, BL-0178) — you PROPOSE, the engine DECIDES:** when a `fail` contract is contradicted by code you believe this cycle did NOT cause (legacy code, a contract no reviewed work order owns through its `source_requirements`), keep it a `status: \"fail\"` traceability entry and ADD `claim: \"preexisting\"`, `evidence_test` and `direction`. `evidence_test` is the repo-relative path of a probe you write at `.pandacorp/run/drift-probes/<frd>/<contract-id>.drift-probe.ts` (one file per claim, named after the contract id, e.g. `ac-02-010-4.drift-probe.ts`): a vitest file that FAILS on an assertion precisely because of the contradiction and would PASS once the contract holds, importing production code ONLY through the `@/` alias (never a relative import — the engine runs it from a copy placed elsewhere). The path is deliberately outside the collected test tree: never list it in `testFiles` and never copy it into `src/`. `direction` is `code` (the code is wrong), `spec` (the spec is stale) or `unknown`. The engine runs your probe at this pin AND at the pin's `last_green_sha`: only a probe that fails on an assertion at BOTH is recorded as pre-existing drift (a draft change card for the owner plus a `drift:` list in the FRD frontmatter) — it then never blocks and never reopens this cycle's work orders; a probe that passes at `last_green_sha` is a regression this cycle caused and is reopened patch-first; a probe that passes at this pin is discarded; an unloadable or flaky probe proves nothing and is treated as a cycle fault. So when your ONLY reds are pre-existing drift claims, return the verdict you would give without them — `green: true` with your `testFiles` — and never take the blocked/needs-owner exit for a drift claim. Never claim a contract a reviewed work order owns."
const DISMISSAL_CITATION_DIRECTIVE = "**Scope dismissals need a literal citation (BL-0211):** when you noticed something that looks like an unmet contract or a defect and you decline to record it as a `fail` or a finding because a work order, a change card or the FRD scopes it out (\"matches the WO scope\", \"out of scope\", \"by design\", \"deferred\"), list it in the verdict's `dismissals` array as `{ finding, ground, contract, source, quote }`. `source` is `<repo-relative path>:<line>` of the literal line that scopes it out: open the file and find the line with `grep -n`, never cite from memory and never paraphrase; `quote` is that line's own words, verbatim. No literal citation, no dismissal: if you cannot cite it, record it as a `fail` (or a finding). Set `contract` to the REQ/AC id (or the clause text) whenever the thing you noticed is a normative clause of `frd.md`. The FRD outranks the work order: a work order's or change card's \"out of scope\" can never dismiss a normative FRD clause, because a work order that defers something the FRD says SHALL exist is itself the contradiction. Record that clause as a `fail` (and propose it as pre-existing drift with `direction: spec` or `unknown` when it pre-dates this cycle). Only a line of `frd.md` itself (an out-of-scope or exclusions clause) or of the PRD can dismiss a `contract`; a work order or change-card line may dismiss only a finding that is not an FRD clause (for example a fence on which files to touch). The engine validates the citation's shape: a dismissal without a valid citation is treated as NOT dismissed and your verdict is sent back to you once."
const DRIFT_FINDER_DIRECTIVE = "**Whole-FRD drift finder method (BL-0203) — one pass over EVERY contract, located in the code, never assumed:** 0. **Pin discipline (BL-0205) — the shell forgets its directory between your Bash calls.** Your Bash tool starts EVERY call in the launching session's own directory, the factory's MAIN checkout where later commits have already landed, never in the pinned worktree; a `cd` in one call does NOT carry to the next, so a bare `grep`/`cat` silently audits the wrong code. The engine's prompt names the pinned worktree and the pinned commit. Your FIRST call prints the absolute project directory inside the pin and its HEAD (`cd \"<dir>\" && pwd -P && git rev-parse HEAD`): that HEAD must start with the pinned commit, and if it does not, STOP and return no contracts. From then on start EVERY Bash command with the literal absolute directory it printed (`cd \"<pinDir>\" && …`, or `git -C \"<pinDir>\" …`, or only absolute paths), the heredocs that write probes included, and give Read, Grep and Glob absolute paths under it, never a relative one. Your LAST call repeats the HEAD check. Report `pinDir` and `headSha` (first call) and `headShaEnd` (last call) exactly as printed: the engine discards your whole report if a reported HEAD is not the pin. 1. **Inventory.** Read `docs/frds/<frd>/frd.md` in full at this pin and list every normative contract with its id: each `REQ-NN-MMM` requirement, each `AC-NN-MMM.K` acceptance criterion, and the `CMP-NN-*`/`IF-NN-*` components and interfaces its `blueprint.md` declares. A clause without an id is still a contract — name it by its section. Do not stop at the contracts the work orders under review own: the drift this pass exists for lives in the OTHER contracts, the ones earlier cycles verified. 2. **Locate each one in the code, not in its name.** `grep` for the id, for the identifiers, routes, labels and literal strings the contract names, and OPEN the file that implements it. Never mark a contract implemented because a file or function has a plausible name, because a test with its id exists, or because a work order's Status Note says so — read the lines that do the work and quote them. 3. **Compare literally.** Check values, sets, enums, lists and mappings item by item against the text — a filter set the spec requires to exclude a category can still contain it under an old or renamed label. Check that content the spec requires is actually present in the rendered output, not just that the component that should carry it exists — a prior revert can silently drop the content while leaving the component standing. Check that a surface the spec requires is mounted on a reachable route, not only defined in an unused component. 4. **Check input validation beyond the type.** For every contract about parsing, dates, numbers or user input, find the validation and ask what it accepts that it should not: a lenient date parser can accept a string that only looks like a date, or resolve a calendar day in the wrong timezone; a lenient number parser can accept trailing non-numeric characters. A validation criterion met only for the inputs the implementer happened to test is drift. 5. **Classify each contract** — `implemented` (you read the implementing lines; give the project-relative file, the line and a short snippet copied verbatim from those lines, at least 6 characters — the engine checks every snippet against the committed tree at the pin, and a row whose snippet is not there is handed to the judge as `unknown`; two such rows discard your whole report), `drift` (the code contradicts the text; quote both sides in `why`), or `unknown` (you could not locate the implementation, or your tool budget ran out before you reached it). Never guess `implemented` to finish faster: an honest `unknown` makes the judge look; a false `implemented` hides the defect. Set `owner` to the work order whose `source_requirements` (frontmatter) lists the contract, or `none`, and `claim` to `cycle` when that owner is one of the work orders under review this cycle, else `preexisting`. 6. **Write one probe per drift.** A vitest file at `.pandacorp/run/drift-probes/<frd>/<contract-id-slug>.finder.drift-probe.ts` (e.g. `req-03-001.finder.drift-probe.ts`; the `.finder` infix keeps it apart from the reviewer's own probes) that FAILS on an assertion precisely because of the contradiction and would PASS once the contract holds. Import production code ONLY through the `@/` alias (the engine runs a copy of it from another directory) and `describe/it/expect` from `vitest`; keep it deterministic (fixed dates, no network, no real clock). Write it with a Bash heredoc. Do not run it — the engine runs it twice at two commits. It lives outside the collected test tree on purpose: never copy it into `src/`. 7. **Stay read-only everywhere else.** Before your first probe, delete only your own stale probes for this FRD (`rm -f .pandacorp/run/drift-probes/<frd>/*.finder.drift-probe.ts*`). Never edit production code, tests, docs or frontmatter; never run `verify.sh`, the test suite, a dev server or a browser; never run a git command that writes; never commit. Another agent is running the gate script in this same worktree right now. 8. **Budget.** Spend at most the tool-call budget the engine states. Work through the contracts the work orders under review do NOT own first (that is where the digested judge cannot look), then the cycle's own. When the budget runs out, mark every contract you have not reached `unknown` and set `budgetExhausted: true` — never drop a contract from the list."
const RENEW_LEASE = `FIRST renew this run's atomic lease (fail closed): \`${STATE_CLI_COMMAND} renew --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\`. If renewal fails, return stop:true and mutate nothing.`
const RENEW_LEASE_SCHEMA = { type: 'object', properties: { stop: { type: 'boolean', description: 'true iff the lease renewal itself failed — the engine stops rather than continue building on an unrenewed/lost lease' } } }
const RELEASE_LEASE = `Release this run with the fenced TWO-PHASE protocol, in this exact order: (1) \`${STATE_CLI_COMMAND} quiesce --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\` (projects running:false while the lease STILL fences every writer); (2) stage ONLY .pandacorp/status.yaml and commit it as \`chore: quiesce Claude build lease\` when it changed; (3) only after that commit succeeds run \`${STATE_CLI_COMMAND} finalize-release --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\`. Any failure is fatal. Never use the compatibility \`release\` command here, never clear status.yaml, and never delete the lease directory by hand.`
const GREENFIELD_PROBE_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'greenfield-probe.mjs'))} --project ${shellQuote(PROJECT_DIR)}`
const INSPECT_STOP = `${STATE_CLI_COMMAND} inspect-stop --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"`
let agentSpawned = 0
let foundationRepairs = 0
let foundationGateNulls = 0
const capHit = () => Boolean(MAX_AGENTS && agentSpawned >= MAX_AGENTS)
const PROFILES = {
 pro: { wave: 2, worker: 'sonnet', judge: 'opus', split: false, reviewSplit: false },
 balanced: { wave: 4, worker: 'sonnet', judge: 'opus', split: false, reviewSplit: false },
 powerful: { wave: 8, worker: 'sonnet', judge: 'opus', split: false, reviewSplit: true },
 deep: { wave: 6, worker: 'opus', judge: 'opus', split: true, reviewSplit: true },
}
const P = PROFILES[MODE] || PROFILES.balanced
const COST = (m) => (m === 'opus' ? 3 : 1)
if (args === undefined || args === null) {
 log(`⚠⚠ args arrived ${args === null ? 'null' : 'undefined'} — if you launched this run WITH args (mode/maxAgents/maxFrds/change), they were DROPPED (DR-072 R2 / BL-0024) and this run is UNBOUNDED in powerful mode. Supervisor: verify against what you passed; if args were intended, TaskStop and relaunch.`)
} else if (typeof args !== 'object') {
 log(`⚠⚠ args arrived as a ${typeof args}, NOT an object — mode/maxAgents/maxFrds were DROPPED. This run is UNBOUNDED. Stop and relaunch passing args as a JSON object (DR-072 R2).`)
}
if (!LEASE_TOKEN || !LEASE_EPOCH) throw new Error('FATAL: atomic lease token/epoch missing — launch only through launch-implement.sh')
log(`Mode ${MODE} · wave ≤${P.wave} · maxFrds ${MAX_FRDS === Infinity ? 'sin tope' : MAX_FRDS} · maxAgents ${MAX_AGENTS_AUTO ? 'auto (se dimensiona tras el plan)' : (MAX_AGENTS || 'OFF (sin freno de presupuesto!)')} · workers ${P.worker} · judge ${P.judge}${CHANGE ? ' · change ' + CHANGE : ONLY ? ' · frds ' + ONLY.join(',') : ''}`)
const EMIT = (role, wo, ctx = {}) =>
 `Before you start, record your activity for Party (one append, fire-and-forget):\n` +
 `  printf '{"event":"AgentWorking","at":"%s","project":"%s","data":{"role":"${role}","wo":"${wo}","frd":"${ctx.frd || ''}","phase":"${ctx.phase || 'build'}","activity":"${ctx.activity || ''}","mode":"${MODE}"}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson\n`
const TRACK = (kind, fields = '') =>
 ` Also append ONE line to ${TRACK_PATH} for the durable build timeline (fire-and-forget): printf '{"kind":"${kind}"${fields},"at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${TRACK_PATH}.`
const JOURNAL_PATH = PROJECT_DIR === '.' ? '.pandacorp/build-journal.jsonl' : `${PROJECT_DIR}/.pandacorp/build-journal.jsonl`
const JOURNAL = (body, args = '') =>
 ` Append ONE line to ${JOURNAL_PATH} (the committed build-journal — append-only like track.jsonl, fire-and-forget; a later commit stages it): printf '{"at":"%s",${body}}\\n' "$(date -u +%FT%TZ)"${args} >> ${JOURNAL_PATH}.`
const JOURNAL_GOLD = ` BUILD-JOURNAL GOLD (A5, DR-047): read ${JOURNAL_PATH} (if it exists) and distill its GOLD entries — any work order that reached \`reopen_count\` ≥ 2 before resolving, and any entry classified \`architectural\` or \`deadlocked-contract\` — into ONE-LINE lessons appended to .pandacorp/run/lessons.md (the raw DR-047 capture inbox; tag each \`(agent-inferred)\`). Skip silently if the journal is absent or has no gold.`
const GATE_EVENT = (frd, wos, attempt) =>
 ` Also append the Party gate-open event (fire-and-forget — the tribunal lights up, BL-0020): printf '{"event":"gate","at":"%s","project":"%s","frd":"${frd}","wos":${wos},"attempt":${attempt}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
const ACHIEVEMENT = (frd) =>
 ` For EACH work order you just set VERIFIED, ALSO append its Party achievement event (one line per WO, fire-and-forget — the Bóveda trophy shelf + unlock toast read exactly this event, BL-0020): printf '{"event":"achievement","at":"%s","project":"%s","workOrder":"%s","wo":"%s","frd":"${frd}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<the-wo-id>" "<the-wo-id>" >> ~/.claude/dashboard-events.ndjson.`
const BUILD_LAUNCH_EVENT =
 ` Also append the BuildLaunch event, ONCE, right away (fire-and-forget): printf '{"event":"BuildLaunch","at":"%s","project":"%s","mode":"${MODE}","maxAgents":${MAX_AGENTS || 0},"targeted":${TARGETED}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
const GATE_VERDICT = (frd, verdict, fields = '', args = '') =>
 ` Also append the GateVerdict event for this exit (fire-and-forget — COUNTS only, never id arrays): printf '{"event":"GateVerdict","at":"%s","project":"%s","frd":"${frd}","verdict":"${verdict}"${fields}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}"${args} >> ~/.claude/dashboard-events.ndjson.`
const emitGateOutcome = (frd, verdict, fields = '', args = '') =>
 `${TRACK('review_end', `,"frd":"${frd}","verdict":"${verdict}"`)}${TRACK('frd_end', `,"frd":"${frd}"`)}${GATE_VERDICT(frd, verdict, fields, args)}`
const WO_REOPEN_EVENT = (frd, reason = 'gate-reject') =>
 ` ALSO append the live Party wo_reopen event to the dashboard stream (fire-and-forget, ONE line for THIS reopened WO): printf '{"event":"wo_reopen","at":"%s","project":"%s","frd":"${frd}","wo":"%s","reason":"${reason}","reopen_count":%s}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<the-wo-id>" "<its NEW reopen_count after you increment it, an integer>" >> ~/.claude/dashboard-events.ndjson.`
const PATCH_RESULT = (frd, outcome) =>
 ` Also append the PatchResult event (fire-and-forget): printf '{"event":"PatchResult","at":"%s","project":"%s","frd":"${frd}","outcome":"${outcome}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
const PREVIEW_SMOKE = (frd) =>
 ` PREVIEW SMOKE EVENT (UI FRDs only): if ${frd} exposes a UI surface, right after the verify.sh browser/Playwright layer append the PreviewSmoke event with the REAL numbers from that Playwright output (fire-and-forget): printf '{"event":"PreviewSmoke","at":"%s","project":"%s","frd":"${frd}","pass":%s,"routes":%s,"failed":%s}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<true if every route rendered clean, else false>" "<number of routes exercised>" "<number of routes that failed>" >> ~/.claude/dashboard-events.ndjson. If ${frd} has NO UI surface, SKIP this event entirely (do not emit it).`
const HARDENING_EVENT_IF_NO_FINDINGS = (stage) =>
 ` If (and ONLY if) your \`findings\` array is EMPTY, ALSO append the Hardening event for the ${stage} stage now, because no fix spawn will follow to emit it (fire-and-forget): printf '{"event":"Hardening","at":"%s","project":"%s","stage":"${stage}","status":"ok"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson. If \`findings\` is non-empty, do NOT emit it.`
const HARDENING_EVENT = (stage) =>
 ` Also append the Hardening event for the ${stage} stage (fire-and-forget): printf '{"event":"Hardening","at":"%s","project":"%s","stage":"${stage}","status":"%s"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<ok if this stage passed, else fail>" >> ~/.claude/dashboard-events.ndjson.`
const BUILD_COMPLETE = (verdict, frdsDoneTotal) =>
 ` Also append the BuildComplete event (fire-and-forget): printf '{"event":"BuildComplete","at":"%s","project":"%s","wos":"%s","frds":"${frdsDoneTotal}","verdict":"${verdict}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<VERIFIED work orders/total work orders from .pandacorp/status.yaml, e.g. 12/15>" >> ~/.claude/dashboard-events.ndjson.`
const UI_PASS_SKIPPED_EVENT = (pass, frd, reason) =>
 ` Also append the UiPassSkipped event (fire-and-forget): printf '{"event":"UiPassSkipped","at":"%s","project":"%s","pass":"${pass}","frd":"${frd}","reason":"${reason}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
const GATE_EVIDENCE_FALLBACK_EVENT = (frd, reason) =>
 ` Also append the GateEvidenceFallback event (fire-and-forget — WP-06: the pre-collected evidence pack was unusable, so THIS gate ran in explore mode): printf '{"event":"GateEvidenceFallback","at":"%s","project":"%s","frd":"${frd}","reason":"${reason}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
const MECH_FALLBACK_EVENT = (requestedType, fallbackType) =>
 ` Also append the MechFallback event, ONCE (fire-and-forget — BL-0141/BL-0168: the runtime rejected agentType '${requestedType}', this run falls back to '${fallbackType}'): printf '{"event":"MechFallback","at":"%s","project":"%s","requestedType":"${requestedType}","fallbackType":"${fallbackType}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.\n`
const MECH = (args && args.mechModel) || 'haiku'
const MECH_LEAN = !(args && args.mechLean === false)
const MECH_AGENT = (fallback) => (MECH_LEAN ? 'pandacorp:mech' : fallback)
const optionalText = (v) => {
 if (typeof v !== 'string') return ''
 const t = v.trim()
 return /^(?:null|undefined|none|""|'')$/i.test(t) ? '' : t
}
const MECH_EFFORT = MECH_LEAN ? 'low' : undefined
const LANE = (args && args.lane === 'fast') ? 'fast' : 'classic'
if (args && args.lane !== undefined && args.lane !== 'fast' && args.lane !== 'classic') log(`⚠ args.lane ${JSON.stringify(args.lane)} is neither fast nor classic — running classic`)
const argFlag = (key, dflt) => (argBool(args, key, true) ? true : argBool(args, key, false) ? false : dflt)
const MECH_SCRIPT = argFlag('mechScript', LANE === 'fast')
const INFRA_GUARD = argFlag('infraGuard', LANE === 'fast')
const INFRA_PAUSE_SECONDS = 60
const FAST = LANE === 'fast' && MECH_SCRIPT
const FUSED_START = FAST && argFlag('fusedStart', true) && !CHANGE && !STRICT_BASELINE
const REVIEW_BUDGET = (args && args.reviewBudget === 'defer') ? 'defer' : 'now'
if (args && args.reviewBudget !== undefined && args.reviewBudget !== 'now' && args.reviewBudget !== 'defer') log(`⚠ args.reviewBudget ${JSON.stringify(args.reviewBudget)} is neither now nor defer — using now`)
const REVIEW_DEFERRED = FAST && REVIEW_BUDGET === 'defer'
if (LANE === 'fast' || MECH_SCRIPT || INFRA_GUARD) log(`lane ${LANE} · mechScript ${MECH_SCRIPT ? 'on' : 'off'} · infraGuard ${INFRA_GUARD ? 'on' : 'off'}${FAST ? ` · reviewBudget ${REVIEW_BUDGET}` : LANE === 'fast' ? ' · the fast build needs mechScript: classic waves' : ''} (proposal 39)`)
const fastFloor = new Set()
const fastClassified = new Set()
const fastUsable = []
const priorUsable = []
let earlySecurity = null
const MECH_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'pandacorp-build-mech.mjs'))}`
const mechOpCommand = (op, flags = '') => `${MECH_CLI_COMMAND} ${op} --project ${shellQuote(PROJECT_DIR)}${flags ? ` ${flags}` : ''}`
const MECH_LINE_SCHEMA = { type: 'object', required: ['line'], properties: { line: { type: 'string', description: 'the LAST line the command printed, verbatim' } } }
const MECH_LITERAL = (cmd) => `MECHANICAL COMMAND RUNNER (proposal 39 C1): run exactly \`${cmd}\` once, as ONE Bash call with no command before or after it, and return its last line VERBATIM as \`line\`. That line is ONE JSON object ending in an integrity checksum ("sum"): copy it character for character. A non-zero exit is data, not a problem for you to fix: do not inspect, edit, fix, stage, commit or revert anything yourself.`
const MECH_FUSED = (cmd, before, after) => `MECHANICAL STEPS (proposal 39 C1): do them IN THIS ORDER, each exactly once, skipping none.\n${[before, `MECHANICAL COMMAND RUNNER: run exactly \`${cmd}\` once, as ONE Bash call of its own (nothing chained into that call), and return its last line VERBATIM as \`line\`. That line is ONE JSON object ending in an integrity checksum ("sum"): copy it character for character. Its exit code is data, not a problem for you to fix: whatever it is, do not inspect, edit, fix, stage, commit or revert anything because of it.`, after].map((x) => String(x || '').trim()).filter(Boolean).map((x, i) => `STEP ${i + 1}. ${x}`).join('\n')}\nReturn as \`line\` the last line of the MECHANICAL COMMAND RUNNER step, untouched by any other step.`
const MAX_CONCURRENT_GATES = (args && args.maxConcurrentGates) || 2
const GATE_WORKTREE = PROJECT_DIR === '.' ? '.pandacorp/run/gate-worktree' : `${PROJECT_DIR}/.pandacorp/run/gate-worktree`
const gateProjectCd = (wt = GATE_WORKTREE) => `cd "${wt}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix)"`
const worktreeWorkFrom = (pinSha, wt = GATE_WORKTREE) => `Work from the GATE WORKTREE ${wt} — FIRST cd into the PROJECT directory inside it, exactly: \`${gateProjectCd(wt)}\` (the worktree holds the WHOLE repo; a nested project's root is not the worktree root). It is a DETACHED git worktree checked out at the pinned commit ${pinSha} (a frozen, quiet copy of the tree so the main build keeps going); DO NOT cd to the main project root and DO NOT run any \`git commit\`/branch op that writes the main tree. Every relative path below is relative to that project directory inside the worktree; any path written as an absolute ${PROJECT_DIR}/... is the MAIN tree (append-only files only). **Your shell does NOT remember that \`cd\` (BL-0205):** a subagent's Bash tool starts every call in the launching session's own directory — the MAIN checkout, which is NOT the pinned commit — so a bare \`grep\`/\`cat\`/\`ls\` reads the wrong tree. Start EVERY Bash command with that same \`cd\` (\`<that cd> && <command>\`), or use only absolute paths / \`git -C <worktree>\`, and give Read/Grep/Glob absolute paths under the worktree.\n`
const GATE_SLOT_PORT_BASE = 3800
const gateSlotPath = (k) => `${GATE_WORKTREE}-${k}`
const gateSlotPort = (k) => GATE_SLOT_PORT_BASE + 10 * k
const gateWorktreePathOf = (frd) => { const st = frdState.get(frd); return (st && st.gateSlotPath) || GATE_WORKTREE }
const PARALLEL_PERSIST_NO_SALVAGE = `    **No gate-worktree salvage here (D1, args.parallelGates):** this gate's slot was already salvaged and cleaned by its own release step, and another FRD's gate may be reviewing in that slot right now — do NOT touch any ${gateSlotPath('<k>')} directory. `
const GATE_EVIDENCE_ROOT = PROJECT_DIR === '.' ? '.pandacorp/run/gate-evidence' : `${PROJECT_DIR}/.pandacorp/run/gate-evidence`
const gateEvidenceDir = (frd) => `${GATE_EVIDENCE_ROOT}/${frd}`
const REPO_TOP_ASSIGN = `TOP="$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-toplevel)"`
const repoParentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.')
const repoRootPortCommand = (srcDir, paths) => [REPO_TOP_ASSIGN, ...paths.map((p) => `mkdir -p "$TOP"/${shellQuote(repoParentOf(p))} && cp ${shellQuote(`${srcDir}/${p}`)} "$TOP"/${shellQuote(p)}`)].join(' && ')
const repoRootHashCommand = (paths) => [REPO_TOP_ASSIGN, ...paths.map((p) => `{ shasum -a 256 "$TOP"/${shellQuote(p)} || echo "MISSING ${p}"; }`)].join(' && ')
const repoRootStageCommand = (paths) => `${REPO_TOP_ASSIGN} && git -C "$TOP" --literal-pathspecs add -- ${paths.map(shellQuote).join(' ')}`
const REPO_ROOT_PATHS_NOTE = 'These paths are REPO-ROOT-relative (git listed them from the repository root): NEVER copy, hash, stage or clean one relative to the project directory — for a nested project the path already starts with the project folder, so a project-relative copy DOUBLES it (`mission-control/mission-control/…`, canary E2).'
const PREFIX_ASSIGN = `P="$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix)"`
const PROJECT_STATUS_COMMAND = `${PREFIX_ASSIGN} && printf 'PREFIX=%s\\n' "$P" && git -C ${shellQuote(PROJECT_DIR)} status --porcelain -- . | cut -c4- | sed 's/^/IN /' && git -C ${shellQuote(PROJECT_DIR)} status --porcelain | cut -c4- | while IFS= read -r p; do case "$p" in "$P"*) ;; *) printf 'OUT %s\\n' "$p" ;; esac; done`
const SCOPE_GUARD = `${REPO_TOP_ASSIGN} && ${PREFIX_ASSIGN} && inproj() { [ "$#" -gt 0 ] || { echo 'BL-0202 REFUSED: no path given, nothing was touched' >&2; return 3; }; for p in "$@"; do case "$p" in ''|/*|..|../*|*/..|*/../*|:*) printf 'BL-0202 REFUSED: %s is not a plain repo-root-relative path, nothing was touched\\n' "$p" >&2; return 3 ;; esac; case "$p" in "$P"*) ;; *) printf 'BL-0202 REFUSED: %s is OUTSIDE this project (prefix %s), nothing was touched\\n' "$p" "$P" >&2; return 3 ;; esac; case "$p" in "$P".pandacorp/status.yaml) printf 'BL-0202 REFUSED: %s is controller-owned, nothing was touched\\n' "$p" >&2; return 3 ;; esac; done; }`
const SCOPED_PATHS = '<PATHS>'
const scopedRestoreCommand = (ref) => `${SCOPE_GUARD} && set -- ${SCOPED_PATHS} && inproj "$@" && git -C "$TOP" --literal-pathspecs checkout ${ref} -- "$@"`
const scopedCleanCommand = () => `${SCOPE_GUARD} && set -- ${SCOPED_PATHS} && inproj "$@" && git -C "$TOP" --literal-pathspecs clean -fd -- "$@"`
const SCOPED_PATHS_NOTE = `${SCOPED_PATHS} = the paths, each single-quoted, REPO-ROOT-relative EXACTLY as the IN lines list them (a nested project's paths start with its folder, e.g. 'mission-control/src/x.ts'). A BL-0202 REFUSED exit means your path list is wrong: fix the list, never work around the guard with another command.`
const NO_WHOLE_TREE_WRITES = 'NEVER a whole-tree form: no `git reset --hard`, no `git checkout -- .`/`git checkout .`/`git restore .`, no `git clean` without an explicit path, no `git stash` push/pop/drop, no `git add -A`/`git add .`/`git commit -a` (BL-0202: the repository may be shared with other sessions\' uncommitted work outside this project).'
const REVIEWER_TEST_PATH = /(^|\/)(__tests__|_tests|tests?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$/
const REVIEWER_TESTS_EXPLICIT = `\n  **RUN YOUR OWN ADVERSARIAL TESTS EXPLICITLY, BY PATH (BL-0183):** the focused gate's vitest step selects tests with \`--changed <sha>\`, which ALSO picks up any uncommitted file in the tree — it is NOT the contract for which tests certify this FRD. After that verify.sh run, run EVERY adversarial test file you wrote this gate by its path — \`pnpm vitest run <path> [<path> …]\` (a Playwright spec: \`pnpm playwright test <path>\`) — never relying on \`--changed\` to have collected them. On a PASS every one of them must pass; on a reopen the RED-proven ones must fail for the reason you state. (On the concurrent path the engine refuses to start a gate over a dirty worktree, so every uncommitted file you see there is yours.)`
const NOTIFY = (msg, sound) =>
 ` Notify the owner (run via Bash, fire-and-forget): ` +
 `osascript -e 'display notification "${msg}" with title "Pandacorp build" sound name "${sound || 'Basso'}"' 2>/dev/null || true.`
const __rawAgent = agent
let mechUnavailable = false
let mechFallbackLogged = false
const typeFallbackAnnounced = new Set()
const AGENT_TYPE_NOT_FOUND_RE = /agent type '([^']+)' not found/
const DEFAULT_AGENT_FALLBACK = 'pandacorp:implementer'
const ORACLE_TYPES = new Set(['pandacorp:reviewer', 'pandacorp:security-auditor', 'pandacorp:test-writer'])
let oracleNoFallbackLogged = false
let landingInFlight = null
const STRUCTURED_WRAPPER_KEYS = new Set(['parameter', 'input', 'result', 'output', 'json'])
const unwrapStructuredResult = (answer, schema) => {
 if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return answer
 const keys = Object.keys(answer)
 if (keys.length !== 1 || !STRUCTURED_WRAPPER_KEYS.has(keys[0])) return answer
 if (schema && schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, keys[0])) return answer
 const inner = answer[keys[0]]
 if (typeof inner !== 'string') return answer
 let parsed
 try { parsed = JSON.parse(inner) } catch { return answer }
 if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return answer
 if (typeof parsed.sum === 'string' && !(schema && schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, 'sum'))) return answer
 return parsed
}
const unwrapMech = (answer, opts) => {
 if (!opts || opts.model !== MECH || !opts.schema) return answer
 const out = unwrapStructuredResult(answer, opts.schema)
 if (out !== answer) log(`ℹ 9.118.2: ${opts.label || 'a MECH step'} returned its result JSON-encoded inside \`${Object.keys(answer)[0]}\` — unwrapped.`)
 return out
}
agent = async (prompt, opts = {}) => {
 const wf = (opts && opts.workFrom !== undefined) ? opts.workFrom : WORK_FROM
 let rest = opts
 if (opts && opts.workFrom !== undefined) { rest = { ...opts }; delete rest.workFrom }
 const finalPrompt = typeof prompt === 'string' && wf ? wf + prompt : prompt
 return INFRA_GUARD ? infraGuardedSpawn(finalPrompt, rest) : spawnWithTypeFallback(finalPrompt, rest)
}
class InfraError extends Error { constructor(message, extra = {}) { super(message); this.infra = true; Object.assign(this, extra) } }
const isInfraError = (e) => Boolean(e && e.infra === true)
let infraHalt = null
const parkedWos = []
const acceptedWos = []
const THROWN_LIMIT_RE = /\b(?:429|529)\b|overloaded|rate[ _-]?limit|usage limit|quota|too many requests/i
const PROVIDER_ENVELOPE_RE = /"type"\s*:\s*"(?:rate_limit_error|overloaded_error)"|\bAPI Error:?\s*(?:429|529)\b|Claude(?: AI)? usage limit reached\|\d{9,}/i
const LIMIT_REPLY_RE = /^\s*(?:Claude(?: AI)? usage limit reached\b|(?:you've|you have) (?:hit|reached) your (?:usage )?limit\b)/i
const INFRA_ALLOWED_AFTER_HALT = /^(?:commit:|park:|gate-release:|build-paused$)/
function infraSignal(answer, err, opts) {
 if (err) {
  const m = String((err && err.message) || err)
  return { kind: THROWN_LIMIT_RE.test(m) ? 'limit' : 'infra', detail: `threw: ${m.slice(0, 200)}` }
 }
 if (answer === null || answer === undefined) return { kind: 'infra', detail: 'returned no output' }
 if (typeof answer === 'string') {
  if (!answer.trim()) return { kind: 'infra', detail: 'returned empty text' }
  return PROVIDER_ENVELOPE_RE.test(answer) || LIMIT_REPLY_RE.test(answer) ? { kind: 'limit', detail: 'its text is a usage-limit reply' } : null
 }
 if (typeof answer === 'object') {
  if (opts && opts.schema && !Array.isArray(answer) && Object.keys(answer).length === 0) return { kind: 'infra', detail: 'returned an empty object' }
  const text = ['failure', 'reason', 'error'].map((k) => answer[k]).filter((v) => typeof v === 'string').join(' ')
  if (PROVIDER_ENVELOPE_RE.test(text)) return { kind: 'limit', detail: 'its text carries the provider\'s usage-limit envelope' }
 }
 return null
}
function haltForInfra(sig, label) {
 if (!infraHalt) {
  infraHalt = { kind: sig.kind, label: label || '', detail: sig.detail }
  log(`⏸ INFRA HALT (paused-infra, proposal 39 C7): ${sig.kind === 'limit' ? 'a usage-limit/429/overload signature' : 'a second infrastructure failure'} on ${label || 'an agent call'} (${sig.detail}) — no new dispatch from here; in-flight results land as they arrive, unlanded work orders are parked, nothing is blocked or reverted`)
 }
 return new InfraError(`infra halt: ${sig.detail}`, { kind: sig.kind, label })
}
async function infraPause(forLabel) {
 agentSpawned++
 try {
  const r = await spawnWithTypeFallback(`${WORK_FROM}INFRA PAUSE (proposal 39 C7): the previous agent call (${forLabel}) failed for an infrastructure reason. Run exactly \`sleep ${INFRA_PAUSE_SECONDS}\` as ONE Bash call (timeout ${(INFRA_PAUSE_SECONDS + 30) * 1000} ms), nothing before or after it, then return { done: true }.`,
   { label: `infra-pause:${forLabel}`, phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
  return Boolean(r && r.done === true)
 } catch (e) { return false }
}
async function infraGuardedSpawn(finalPrompt, rest) {
 const label = (rest && rest.label) || ''
 if (infraHalt && !INFRA_ALLOWED_AFTER_HALT.test(label)) throw new InfraError(`run paused (${infraHalt.kind}): ${label || 'an agent call'} was not dispatched`, { kind: infraHalt.kind, label, refused: true })
 for (let attempt = 1; ; attempt++) {
  let answer
  let err = null
  try { answer = await spawnWithTypeFallback(finalPrompt, rest) } catch (e) { err = e }
  if (err && (isInfraError(err) || (typeof err.message === 'string' && AGENT_TYPE_NOT_FOUND_RE.test(err.message)))) throw err
  const sig = infraSignal(answer, err, rest)
  if (!sig) return answer
  if (sig.kind === 'limit' || attempt >= 2 || infraHalt) throw haltForInfra(sig, label)
  log(`⚠ infra on ${label || 'an agent call'} (${sig.detail}) — not a work-order failure: pausing ${INFRA_PAUSE_SECONDS}s, then one retry (proposal 39 C7)`)
  if (!(await infraPause(label))) throw haltForInfra({ kind: 'infra', detail: `${sig.detail}; the pause itself failed` }, label)
 }
}
async function spawnWithTypeFallback(finalPrompt, rest) {
 if (mechUnavailable && rest && rest.agentType === 'pandacorp:mech') {
  rest = { ...rest, agentType: rest.fallbackAgentType || DEFAULT_AGENT_FALLBACK }
 }
 try {
  const answer = await __rawAgent(finalPrompt, rest)
  laneTopUp()
  return unwrapMech(answer, rest)
 } catch (e) {
  const requestedType = rest && rest.agentType
  const match = requestedType && typeof requestedType === 'string' && requestedType.startsWith('pandacorp:') && e && typeof e.message === 'string'
   ? e.message.match(AGENT_TYPE_NOT_FOUND_RE)
   : null
  if (!match || match[1] !== requestedType) throw e
  if (ORACLE_TYPES.has(requestedType) && !rest.fallbackAgentType) {
   if (!oracleNoFallbackLogged) {
    oracleNoFallbackLogged = true
    log(`agentType '${requestedType}' no disponible en este runtime — es un tipo oráculo sin fallback explícito, así que el gate falla en vez de degradar el juez (DR-015).`)
   }
   throw e
  }
  const fallback = rest.fallbackAgentType || DEFAULT_AGENT_FALLBACK
  if (fallback === requestedType) throw e
  if (requestedType === 'pandacorp:mech') {
   mechUnavailable = true
   if (!mechFallbackLogged) {
    mechFallbackLogged = true
    log(`pandacorp:mech no disponible en este runtime (plugin desactualizado en la sesión): usando ${fallback}; reinicia la sesión para 9.103.0`)
   }
  } else {
   log(`agentType '${requestedType}' no disponible en este runtime — usando ${fallback} como fallback${typeFallbackAnnounced.has(requestedType) ? '.' : ` (plugin desactualizado en la sesión: reinicia la sesión para cargar el plugin instalado — BL-0168; hasta entonces el agente dedicado no se usa).`}`)
  }
  const announceFallback = !typeFallbackAnnounced.has(requestedType)
  typeFallbackAnnounced.add(requestedType)
  const retryPrompt = announceFallback && typeof finalPrompt === 'string' ? MECH_FALLBACK_EVENT(requestedType, fallback) + finalPrompt : finalPrompt
  try {
   return unwrapMech(await __rawAgent(retryPrompt, { ...rest, agentType: fallback }), rest)
  } catch (e2) {
   log(`⚠ fallback ${fallback} also failed: ${e2 && e2.message ? e2.message : e2}`)
   throw e
  }
 }
}
const GATE_SKIP =
 ` GATE QUARANTINE (BL-0011, fail-closed) — you are about to run a WHOLE-PROJECT \`bash .pandacorp/verify.sh\` (no \`--since\`), whose e2e layer asserts EVERY route. FIRST derive the needs-owner quarantine set so a route the OWNER must unblock does not red-lock the whole gate: scan every docs/frds/*/work-orders/wo-*.md and collect ONLY those whose frontmatter is EXACTLY \`implementation_status: BLOCKED\` AND \`blocked_reason: needs-owner\` (NOT error, NOT external, NOT any other reason — those still RED). For each such WO, take the route it owns (its \`route:\`/\`path:\` frontmatter if present, else the live path of the surface it builds, matched against e2e/routes.ts SURFACES). If the set is NON-EMPTY, export it before running verify.sh: \`export PANDACORP_GATE_SKIP_ROUTES="/route-a,/route-b"\` (comma-separated, no spaces) and LOG it loudly to your output ("⚠ quarantining needs-owner-blocked route(s): …, held aside from the whole-project gate — tracked owner TODO(s), not regressions"). If the set is EMPTY, do NOT export the variable (the default is zero quarantine — the full gate ranges over every route). NEVER add a route that is not provably BLOCKED needs-owner.`
const LAST_GREEN_ORDERING = ` **last_green_sha ORDERING (BL-0066 — do this EXACTLY, TWO commits):** (A) COMMIT the complete independently verified snapshot first (code/tests, VERIFIED frontmatter, frd.md/blueprint.md rollups, timeline/journal, and status.yaml with every field EXCEPT the new last_green_sha/safe_to_test publication). (B) Run \`git rev-parse HEAD\` and prove it exists + is on the current chain with \`git cat-file -e <sha>^{commit} && git merge-base --is-ancestor <sha> HEAD\`; only then write THAT SHA as \`last_green_sha\` and \`safe_to_test: true\` in .pandacorp/status.yaml and make a SECOND metadata-only commit: \`git add .pandacorp/status.yaml && git commit -m "chore(build): publish last green snapshot"\`. NEVER amend commit A: the stable contract is last_green_sha = the verified ancestor snapshot, and pointer commit B descends from A.`
const VERIFY_SCHEMA = {
 type: 'object', required: ['green'],
 properties: { green: { type: 'boolean' }, sha: { type: 'string' }, failure: { type: 'string' } },
}
const PLAN_SCHEMA = {
 type: 'object', required: ['frds'],
 properties: {
  stack: { type: 'string', description: 'A (web) | B/C (API) | D (scraper/data)' },
  hasFrontend: { type: 'boolean' },
  unsatisfiedDeps: {
   type: 'array',
   description: 'Only when args.frds is set: deps of the requested FRDs that are NOT fully VERIFIED yet. Return [] if all deps are satisfied or args.frds is not set.',
   items: {
    type: 'object', required: ['frd', 'dep'],
    properties: {
     frd: { type: 'string', description: 'the requested FRD folder that has this unmet dep' },
     dep: { type: 'string', description: 'the dep FRD folder that is NOT fully VERIFIED yet (at least one of its WOs is not VERIFIED)' },
    },
   },
  },
  frds: {
   type: 'array',
   items: {
    type: 'object', required: ['frd', 'workOrders'],
    properties: {
     frd: { type: 'string', description: 'the FRD folder, e.g. frd-03-<slug>' },
     deps: { type: 'array', items: { type: 'string' }, description: 'FRD folders that must be VERIFIED first' },
     workOrders: {
      type: 'array',
      items: {
       type: 'object', required: ['id', 'status'],
       properties: {
        id: { type: 'string' },
        status: { type: 'string', description: 'implementation_status from the WO frontmatter' },
        docStatus: { type: 'string', description: "BL-0171 defense-in-depth: the LITERAL `status:` frontmatter field on the WO file (DRAFT|ACTIVE) — DR-100's gating field, DISTINCT from `status` above (which is really `implementation_status`). Omit/leave empty when the WO has no `status:` line at all (a legacy WO predating this field defaults to buildable, matching preflight-implement.sh's own grep). The engine refuses to schedule a WO whose docStatus is literally DRAFT — never built un-gated, even if some other path let it reach the plan." },
        path: { type: 'string', description: 'repo-relative path of this work-order markdown file, e.g. docs/frds/frd-03-x/work-orders/wo-03-001-y.md — injected into the builder prompt so the agent opens THE file instead of hunting for it (DR-108)' },
        acText: { type: 'string', description: "DR-108 context pack: the FRD's EARS acceptance-criteria lines that THIS work order must satisfy, copied VERBATIM from frd.md (only the ACs this WO owns per the Build Plan — bounded, not the whole FRD). Injected into the builder + test-writer prompts so the first attempt builds against the REAL AC scope instead of a one-line summary (first-attempt gate failures were the top rework cause)." },
        difficulty: { type: 'string', description: 'low|medium|high from the WO frontmatter (default medium). high → built on opus a-priori (DR-073 HYBRID)' },
        reopen_count: { type: 'number', description: 'from the WO frontmatter (default 0) — empirical escalation signal (a WO that already failed once is built on opus, DR-073)' },
        deps: { type: 'array', items: { type: 'string' }, description: 'intra-FRD WO ids that must be built first' },
        artifacts: { type: 'array', items: { type: 'string' }, description: 'globs of files/dirs this WO writes (from its `artifacts:` frontmatter) — the engine serializes wave-parallel WOs whose artifacts overlap, so they never collide (DR-060)' },
        foundation: { type: 'boolean', description: 'true if this WO builds the shared design-system primitives / component inventory the other WOs reuse — the engine builds it FIRST, alone, before the rest fan out (DR-057)' },
        priorAttempts: { type: 'array', description: 'A4 CROSS-PASS LEARNING: a BOUNDED digest (last 2) of what earlier attempts on THIS work order tried and why they did not hold — synthesized by reading .pandacorp/build-journal.jsonl (if present) for this wo id. Injected into the builder as HYPOTHESES to verify against the CURRENT code, never gospel. [] when the journal is absent or has no entries for this wo.', items: { type: 'object', properties: { attempt: { type: 'number' }, classification: { type: 'string' }, findingKey: { type: 'string' }, tried: { type: 'string' }, why: { type: 'string' } } } },
        summary: { type: 'string' },
       },
      },
     },
    },
   },
  },
 },
}
const BLOCK_REASON = { type: 'string', enum: ['needs-owner', 'external', 'error'] }
const REPORT_SCOPE = { type: 'string', enum: ['full', 'since', 'partial'], description: 'WP-08: the `scope` value of `.pandacorp/run/gate-report.json` as written by the LAST verify.sh run you performed for this verdict. Copy it VERBATIM, never guess it — the engine REFUSES to stamp VERIFIED or advance last_green_sha on "partial" (a --only/--files scoped run is not a certification).' }
const REPORT_SCOPE_DIRECTIVE = ' **GATE-REPORT SCOPE (WP-08, mandatory):** after the verify.sh run behind this verdict, read `.pandacorp/run/gate-report.json` and return its `scope` field VERBATIM as `report_scope`. Never guess or normalize it. A `partial` scope (a `--only`/`--files` scoped run) can certify NOTHING — the engine refuses the promotion — so reporting it honestly costs you nothing and reporting it wrongly is a false certification.'
const isPartialReport = (v) => Boolean(v && v.report_scope === 'partial')
const refusePartial = (frd, what) =>
 log(`⛔ ${frd}: ${what} claims GREEN but its gate-report says scope:"partial" (a --only/--files SCOPED run). A scoped gate is not a certification — REFUSING to stamp VERIFIED / advance last_green_sha (WP-08 cage).`)
const STOP_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' } } }
const APPLY_GATE_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, report_scope: REPORT_SCOPE, inventory_output: { type: 'string', description: 'BL-0189: the stdout of the inventory-cache write command, VERBATIM (only when the prompt asked for it)' } } }
const CLOSE_RECEIPT_SCHEMA = { type: 'object', required: ['done', 'allowed_paths', 'lease_released'], properties: { done: { type: 'boolean' }, reason: { type: 'string' }, allowed_paths: { type: 'array', items: { type: 'string' } }, before_dirty: { type: 'array', items: { type: 'string' } }, after_dirty: { type: 'array', items: { type: 'string' } }, commit: {}, lease_released: { type: 'boolean' } } }
const PRECHECK_SCHEMA = {
 type: 'object',
 properties: {
  stop: { type: 'boolean', description: 'true iff .pandacorp/run/stop exists — the owner asked to halt; the engine stops clean without building' },
  green: { type: 'boolean', description: 'true = clean tree AND HEAD is last_green_sha OR its direct metadata-only pointer child (known-green fast path); false ONLY paired with a BL-0022 failure' },
  escalate: { type: 'boolean', description: 'true = dirty tree or HEAD is beyond the certified snapshot/pointer pair → run the judge baseline' },
  dirty: { type: 'boolean', description: 'true iff `git status --porcelain` showed changes (informs the judge baseline whether reconciliation is needed)' },
  dirtyPaths: { type: 'array', items: { type: 'string' }, description: "BL-0124: every BARE path `git status --porcelain` reported dirty — EXACTLY as that command prints it (repo-root-relative: git prints paths from the REPOSITORY root even for a nested project, e.g. 'mission-control/.pandacorp/status.yaml'), WITHOUT the leading 2-character XY status code + separating space it prints before each path (' M mission-control/.pandacorp/status.yaml' → 'mission-control/.pandacorp/status.yaml'; never the raw porcelain line with its status code still attached); [] when clean. The engine — not this step — strips projectPrefix and decides whether the narrow leased-status.yaml exclusion applies, so a path still carrying its status code silently fails that comparison and forces an unnecessary judge-baseline (BL-0160) — report the bare path honestly even when escalating." },
  outsideDirtyPaths: { type: 'array', items: { type: 'string' }, description: "BL-0202: every `OUT <path>` line of the scoped status command — a dirty path OUTSIDE this project (a nested project shares its repository, e.g. the factory's parallel sessions). INFORMATIONAL ONLY: it never escalates the baseline and nothing ever touches it; [] when none." },
  projectPrefix: { type: 'string', description: "E2 finding 2: the VERBATIM output of `git -C <project> rev-parse --show-prefix` (trimmed) — '' for a project at its repository root, e.g. 'mission-control/' for a nested one. The engine strips it from dirtyPaths before comparing, because porcelain paths are repo-root-relative." },
  greenfieldProbe: { type: 'string', description: '9.118.2: the ONE stdout line of the greenfield probe command, VERBATIM (a sealed JSON line — never re-formatted, never summarized). Only when escalating.' },
  leaseValid: { type: 'boolean', description: "BL-0124: true iff THIS run already holds the current valid lease fence — already PROVEN by STEP 0's inspect-stop succeeding under this run's own token/epoch (the same fence BL-0079 relies on for the repair step), not a fresh check. Only meaningful together with dirtyPaths." },
  failure: { type: 'string' },
 },
}
const SAFE_POINT_SCHEMA = {
 type: 'object', required: ['stop', 'stop_receipt'],
 properties: {
  stop: { type: 'boolean', description: 'true iff rethink_pending: true — owner-file stop truth is carried separately by stop_receipt' },
  stop_receipt: { type: 'object', required: ['status_exists', 'stop', 'method'], properties: {
   status_exists: { type: 'boolean' }, stop: { type: 'boolean' }, method: { type: 'string' },
  }, description: 'verbatim fenced stateCli inspect-stop receipt; mandatory and validated fail-closed by the engine' },
  ready: { type: 'array', items: { type: 'string' }, description: 'queue slugs with status: ready — expedite first, then standard FIFO' },
  unblocked: { type: 'array', description: 'WOs flipped BLOCKED→PLANNED because the owner answered their decision — reported so the engine re-enrolls them THIS run', items: { type: 'object', required: ['frd', 'wo'], properties: { frd: { type: 'string', description: 'the FRD folder that owns this WO' }, wo: { type: 'string', description: 'the WO id flipped BLOCKED→PLANNED' } } } },
 },
}
const MISSING_FOUNDATION = { type: 'array', items: { type: 'string' }, description: 'names of shared design-system primitives the surface needed but that are NOT in the built foundation (e.g. Room, AgentSprite). Set this when the failure is "a needed primitive is missing from the foundation" — the engine auto-repairs the foundation (DR-065), it does NOT escalate.' }
const FINDINGS = { type: 'array', description: 'DR-073: the specific fixable fault(s) of the rejected WO(s) + the RED-proven failing test(s) the reviewer wrote — fed to attemptPatch for an in-place repair before any revert', items: {
 type: 'object', required: ['wo', 'finding'],
 properties: { wo: { type: 'string' }, finding: { type: 'string', description: 'the specific bounded fault, with file:line' }, failingTest: { type: 'string', description: 'the RED-proven test (path / describe-it / a snippet) that fails without the fix and passes with it' }, files: { type: 'array', items: { type: 'string' }, description: 'the file(s) the fix should touch' } },
} }
const DISMISSALS = { type: 'array', description: 'BL-0211: each thing you noticed and did NOT record as a fail/finding because a work order, change card or the FRD scopes it out. Each needs the LITERAL citation (source = <repo-relative path>:<line>, quote = that line verbatim); without it the engine treats the finding as NOT dismissed.', items: {
 type: 'object', required: ['finding'],
 properties: { finding: { type: 'string', description: 'what you noticed' }, ground: { type: 'string', description: 'wo-scope | change-card-scope | frd-scope | other' }, contract: { type: 'string', description: 'the REQ/AC id (or clause text) when this is a normative clause of frd.md' }, source: { type: 'string', description: 'repo-relative path and line of the literal line that scopes it out, e.g. docs/frds/frd-03/frd.md:31' }, quote: { type: 'string', description: 'that line\'s own words, verbatim' } },
} }
const FRD_GATE_SCHEMA = {
 type: 'object', required: ['green', 'traceability'],
 properties: { green: { type: 'boolean' }, reopen: { type: 'array', items: { type: 'string' } }, findings: FINDINGS, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' }, dismissals: DISMISSALS,
  traceability: { type: 'array', minItems: 7, description: 'Whole-FRD normative inventory: AT LEAST ONE entry per contractClass (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion) — an omitted class is RED. A REQ-NN-MMM requirement is its OWN requirement entry, never covered only via its acceptance-criterion entries. A class that genuinely does not apply gets a not-applicable entry with tests: [] instead of being omitted.', items: { type: 'object', required: ['contract', 'contractClass', 'status', 'tests'], properties: { contract: { type: 'string' }, contractClass: { type: 'string', enum: ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion'] }, status: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] }, tests: { type: 'array', items: { type: 'string' } },
   claim: { type: 'string', enum: ['preexisting'], description: 'BL-0178: set ONLY on a status:"fail" entry you believe this cycle did NOT cause. A proposal — the engine proves it with a differential run of evidence_test before it counts.' },
   evidence_test: { type: 'string', description: 'BL-0178: the probe you wrote to demonstrate the contradiction, at .pandacorp/run/drift-probes/<frd>/<contract-id>.drift-probe.ts (imports via @/ only; never in testFiles).' },
   direction: { type: 'string', enum: ['code', 'spec', 'unknown'], description: 'BL-0178: your read of which side is wrong — the owner decides on the resulting card.' } } } },
  testFiles: { type: 'array', items: { type: 'string' }, description: 'C2: repo-relative paths of the new/changed adversarial test files the gate wrote this cycle (in its worktree) — the apply step ports them to the main tree on green' },
  report_scope: REPORT_SCOPE,
  gateReport: { type: 'object', description: 'WP-08: the verbatim `.pandacorp/run/gate-report.json` written by the verify.sh run behind this verdict. Copy it as-is (you may omit `duration_ms` and truncate each sub-gate\'s `failures` to its first 20 entries). The engine reads the failing sub-gate NAMES and their failure FILE paths from it — nothing else — to route a purely mechanical failure to a cheap fixer.', properties: {
   scope: { type: 'string' }, green: { type: 'boolean' },
   subgates: { type: 'array', items: { type: 'object', properties: {
    name: { type: 'string', description: 'structure-guard | data-layer | api-error-contract | doc-lint | residual-ambiguity | biome | tsc | knip | madge | vitest | playwright' },
    exit: { type: 'number' },
    failures: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, code: { type: 'string' }, msg: { type: 'string' } } } },
   } } },
  } },
 },
}
const SUBGATE_CLASS = {
 biome: 'lint', tsc: 'types', madge: 'cycles', knip: 'deadcode',
 'structure-guard': 'structure', 'data-layer': 'structure', 'api-error-contract': 'structure',
 vitest: 'unit-test', playwright: 'e2e', 'doc-lint': 'doc', 'residual-ambiguity': 'doc',
}
const MECHANICAL_CLASSES = ['lint', 'types', 'structure', 'cycles']
function classifyGateFailure(gate) {
 const subgates = gate && gate.gateReport && Array.isArray(gate.gateReport.subgates) ? gate.gateReport.subgates : null
 if (!subgates) return null
 const failed = subgates.filter((s) => s && typeof s.name === 'string' && Number(s.exit) !== 0)
 if (!failed.length) return null
 const names = [...new Set(failed.map((s) => s.name))]
 const classes = [...new Set(names.map((n) => SUBGATE_CLASS[n]).filter(Boolean))]
 if (!classes.length) return null
 const files = [...new Set(failed.flatMap((s) => (s.failures || []).map((x) => x && x.file).filter(Boolean)))]
 return { subgates: names, classes, files, mechanical: classes.every((c) => MECHANICAL_CLASSES.includes(c)) }
}
const REQUIRED_TRACE_CLASSES = ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion']
const DRIFT_STATUSES = ['drift', 'discarded']
const isOpenFail = (entry) => Boolean(entry) && (entry.status === 'fail' || (DRIFT_STATUSES.includes(entry.status) && entry.__driftAdjudicated !== true))
const DISMISSAL_SOURCE_RE = /^(?:docs\/|\.pandacorp\/inbox\/changes\/)[^\s:]+\.md:[1-9]\d*(?:-[1-9]\d*)?$/
const DISMISSAL_FRD_SOURCE_RE = /^docs\/(?:frds\/[^/\s:]+\/frd\.md|product\/prd\.md|product\/prds\/[^\s:]+\.md):[1-9]\d*(?:-[1-9]\d*)?$/
const DISMISSAL_MIN_QUOTE_CHARS = 10
function classifyDismissals(result) {
 const list = result && Array.isArray(result.dismissals) ? result.dismissals : []
 const flawed = []
 const valid = []
 for (const d of list) {
  const obj = d && typeof d === 'object' ? d : {}
  const finding = String(obj.finding || obj.contract || '').replace(/\s+/g, ' ').trim().slice(0, 120) || '(unnamed dismissal)'
  const source = String(obj.source || '').trim()
  const quote = String(obj.quote || '').replace(/\s+/g, ' ').trim()
  const contract = obj.contract || contractIdOf(obj.finding) || contractIdOf(quote)
  let why = ''
  if (!DISMISSAL_SOURCE_RE.test(source)) why = 'no <path>:<line> citation of a docs/ or change-card line'
  else if (quote.length < DISMISSAL_MIN_QUOTE_CHARS) why = 'no literal quote of that line'
  else if (contract && !DISMISSAL_FRD_SOURCE_RE.test(source)) why = 'a work order or change card cannot dismiss a normative FRD contract (the FRD outranks the work order): only a line of frd.md or the PRD can, otherwise record it as a fail'
  if (why) flawed.push({ finding, why })
  else valid.push({ finding, source, quote })
 }
 return { flawed, valid }
}
const flawedDismissals = (result) => classifyDismissals(result).flawed
const dismissalReaskNote = (flawed) => flawed && flawed.length
 ? ` Your verdict's \`dismissals\` array carried ${flawed.length} scope dismissal(s) without a valid LITERAL citation, so the engine treats them as NOT dismissed: ${flawed.map((x) => `"${x.finding}" (${x.why})`).join('; ')}. For each one either (a) open the file, find the line that scopes it out with grep -n, and cite it as source \`<path>:<line>\` plus its verbatim quote (note: the FRD outranks the work order, so a work order or change card line can never dismiss a normative FRD clause; only a line of frd.md can), or (b) you cannot cite it, so record it as a \`fail\` traceability entry or a finding. Never dismiss from memory or paraphrase.`
 : ''
function traceabilityReaskDirective(gate, resubmitTail) {
 const missingClasses = (gate && gate.missingClasses) || []
 const dismissalNote = dismissalReaskNote(gate && gate.flawedDismissals)
 const dismissalOnly = dismissalNote && missingClasses.length === 0
 const head = dismissalOnly
  ? '**RE-ASK — your prior verdict\'s scope dismissals were not backed by a literal citation (this is not a re-review of the code, judge the same work again):**'
  : '**RE-ASK — your prior verdict\'s traceability inventory was INCOMPLETE (this is not a re-review of the code, judge the same work again):**'
 const classes = dismissalOnly ? '' : ` your last \`traceability\` array had no entry for: ${missingClasses.join(', ') || 'a required contractClass'}. Every one of the 7 \`contractClass\` values (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion) needs >= 1 entry. A REQ-NN-MMM requirement is its OWN \`requirement\` entry, distinct from the acceptance-criterion entries that test it. If a class genuinely does not apply to this FRD, add a \`not-applicable\` status entry for it with \`tests: []\` instead of omitting it.`
 return `${head}${classes}${dismissalNote} Re-submit your FULL verdict ${resubmitTail}`
}
function enforceWholeFrdTraceability(result) {
 const trace = result && result.traceability
 const missingClasses = Array.isArray(trace) ? REQUIRED_TRACE_CLASSES.filter((kind) => !trace.some((entry) => entry && entry.contractClass === kind)) : REQUIRED_TRACE_CLASSES.slice()
 const missing = missingClasses.length > 0
 const invalidBoundary = Array.isArray(trace) && trace.some((entry) => entry && ['edge-case', 'limit'].includes(entry.contractClass) && entry.status === 'pass' && (!Array.isArray(entry.tests) || entry.tests.length === 0))
 const waivedFailure = result && result.green === true && Array.isArray(trace) && trace.some(isOpenFail)
 const flawed = flawedDismissals(result)
 if (!(missing || invalidBoundary || waivedFailure || flawed.length)) return result
 const note = `whole-FRD traceability is missing, lacks boundary evidence, or contradicts a green verdict${missing ? ` — missing contractClass: ${missingClasses.join(', ')}` : ''}${invalidBoundary ? '; an edge-case/limit entry claims pass with no boundary test' : ''}${waivedFailure ? '; a traceability entry is status:fail under an overall green verdict' : ''}${flawed.length ? `; a scope dismissal lacks a valid literal citation: ${flawed.map((x) => `"${x.finding}" (${x.why})`).join('; ')}` : ''}`
 log(`⚠ ${(result && result.frd) || 'gate'}: ${note}`)
 const reaskable = (missing || flawed.length > 0) && !invalidBoundary && !waivedFailure && result && typeof result === 'object'
 if (!result || typeof result !== 'object') return { green: false, traceability: [], failure: note }
 const safeTrace = Array.isArray(trace) ? trace : []
 const deficientFields = reaskable ? { traceabilityDeficient: true, missingClasses, flawedDismissals: flawed } : {}
 if (result.green !== true) {
  return { ...result, traceability: safeTrace, ...deficientFields, failure: result.failure ? `${result.failure} · traceability: ${note}` : note }
 }
 return { green: false, traceability: safeTrace, ...deficientFields, failure: note }
}
const DRIFT_PROBE_RE = /^\.pandacorp\/run\/drift-probes\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*\.drift-probe\.tsx?$/
const DRIFT_WO_PATH_RE = /^docs\/frds\/[A-Za-z0-9][A-Za-z0-9._-]*\/work-orders\/wo-[A-Za-z0-9._-]+\.md$/
const DRIFT_OUTPUT_SCHEMA = { type: 'object', required: ['output'], properties: { output: { type: 'string', description: 'the command stdout, VERBATIM — a single JSON line; never summarized, never re-formatted' } } }
const contractIdOf = (contract) => { const m = String(contract || '').match(/\b(?:REQ|AC)-\d+-\d+(?:\.\d+)?\b/); return m ? m[0] : null }
const INHERITED_KEY = (i) => `INH-${i + 1}`
const INHERITED_CLASS_TAG_RE = new RegExp(`^(?:\\[\\s*(?:${REQUIRED_TRACE_CLASSES.join('|')})\\s*\\]|(?:${REQUIRED_TRACE_CLASSES.join('|')})\\s*:)\\s*`, 'i')
function stripInheritedContract(x) {
 let s = String(x || '').replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim()
 s = s.replace(/^[•*]\s*/, '')
 s = s.replace(/\s*(?:[·|]\s*)?\bkey:?\s*INH-\d+\s*$/i, '')
 s = s.replace(/\s+-{1,2}\s+the gate's tests:[\s\S]*$/i, '')
 for (let k = 0; k < 3; k++) {
  const t = s.replace(/^INH-\d+\s*[:.)·-]?\s*/i, '').replace(INHERITED_CLASS_TAG_RE, '')
  if (t === s) break
  s = t
 }
 return s.trim()
}
function unresolvedInherited(inherited, resolved) {
 const proofs = (Array.isArray(resolved) ? resolved : []).filter((r) => r && r.pass === true && Array.isArray(r.tests) && r.tests.length > 0)
 const norm = (x) => stripInheritedContract(x).toLowerCase()
 return (inherited || []).filter((e, i) => {
  const key = INHERITED_KEY(i).toLowerCase()
  const id = contractIdOf(stripInheritedContract(e.contract))
  const text = norm(e.contract)
  return !proofs.some((r) => String(r.key || '').trim().toLowerCase() === key
   || (id && contractIdOf(stripInheritedContract(r.contract)) === id)
   || (text && norm(r.contract) === text))
 })
}
const contractCore = (id) => String(id).replace(/^(?:REQ|AC)-/, '').replace(/\.\d+$/, '')
function probeRunState(runs) {
 if (!Array.isArray(runs) || runs.length === 0) return 'load-error'
 const one = (r) => ((!r || r.parsed !== true || Number(r.suiteErrors) > 0 || !(Number(r.total) > 0)) ? 'load-error' : (Number(r.failed) > 0 ? 'assertion-failed' : 'passed'))
 const states = [...new Set(runs.map(one))]
 return states.length === 1 ? states[0] : 'flaky'
}
const cyrb53 = (str) => {
 let h1 = 0xdeadbeef
 let h2 = 0x41c6ce57
 for (let i = 0; i < str.length; i++) {
  const ch = str.charCodeAt(i)
  h1 = Math.imul(h1 ^ ch, 2654435761)
  h2 = Math.imul(h2 ^ ch, 1597334677)
 }
 h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
 h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
 return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
const DRIFT_SEAL_RE = /,"sum":"([0-9a-f]{14})"\}$/
const driftSealHolds = (text) => {
 const m = DRIFT_SEAL_RE.exec(text)
 return Boolean(m) && cyrb53(`${text.slice(0, m.index)}}`).toString(16).padStart(14, '0') === m[1]
}
function parseDriftProof(answer) {
 const raw = unwrapAnswer(answer, 'output')
 const text = raw && typeof raw.output === 'string' ? raw.output.trim().split('\n').pop() : ''
 if (!text) return { proof: null, error: 'the drift-proof runner returned no output', transport: true }
 let j
 try { j = JSON.parse(text) } catch { return { proof: null, error: 'the drift-proof output is not valid JSON', transport: true } }
 if (j && typeof j === 'object' && j.ok === false && typeof j.error === 'string') return { proof: null, error: `the drift-proof script refused: ${j.error}` }
 const sealed = Boolean(j) && typeof j === 'object' && (j.sum !== undefined || Number(j.version) >= 2)
 if (sealed && !driftSealHolds(text)) return { proof: null, error: 'the drift-proof output failed its integrity seal (the relay altered it)', transport: true }
 if (!sealed && !(j && typeof j === 'object' && j.version === 1)) return { proof: null, error: 'the drift-proof output carries neither a seal nor a legacy version marker (garbled)', transport: true }
 if (!j || j.ok !== true) return { proof: null, error: `the drift-proof script refused: ${(j && j.error) || 'no ok:true'}` }
 if (!Array.isArray(j.probes) || !j.owned || typeof j.owned !== 'object') return { proof: null, error: 'the drift-proof output lacks probes/owned' }
 return { proof: j, error: '', legacy: !sealed }
}
function ownedDriftCores(proof, woPaths) {
 if (!proof || !woPaths.length) return null
 const cores = new Set()
 for (const p of woPaths) {
  const o = proof.owned[p]
  if (!o || o.error || !Array.isArray(o.ids)) return null
  const ids = Array.isArray(o.sourceRequirements) && o.sourceRequirements.length ? o.sourceRequirements : o.ids
  for (const id of ids) cores.add(contractCore(id))
 }
 return cores
}
function classifyDriftClaim(entry, proof, owned, proofError, unreadable = false) {
 const id = contractIdOf(entry.contract)
 if (!id) return { verdict: 'cycle-fault', why: 'the contract carries no REQ/AC id, so non-ownership cannot be proven' }
 if (!DRIFT_PROBE_RE.test(String(entry.evidence_test || ''))) return { verdict: 'cycle-fault', why: 'no valid evidence_test probe (.pandacorp/run/drift-probes/<frd>/<id>.drift-probe.ts)' }
 if (!proof) return { verdict: unreadable ? 'unproven' : 'cycle-fault', why: proofError || 'the differential proof did not run' }
 if (!owned) return { verdict: 'cycle-fault', why: 'reviewed work-order ownership could not be read at the pin' }
 if (owned.has(contractCore(id))) return { verdict: 'cycle-fault', why: `${id} is owned by a reviewed work order (source_requirements) — never pre-existing` }
 const probe = proof.probes.find((p) => p && p.path === entry.evidence_test)
 if (!probe || probe.missing) return { verdict: 'cycle-fault', why: 'the probe file was not found where the reviewer said it wrote it' }
 const stored = probe.stored
 const head = probeRunState(probe.head)
 if (head === 'passed') return { verdict: 'refuted', why: 'the probe PASSES at the gate pin — the claimed contradiction is not demonstrated', stored }
 if (head !== 'assertion-failed') return { verdict: 'cycle-fault', why: `the probe is ${head} at the gate pin — it proves nothing`, stored }
 if (proof.baseValid !== true) return { verdict: 'cycle-fault', why: `no valid pre-cycle base (${proof.baseReason || 'unknown'})`, stored }
 const base = probeRunState(probe.base)
 if (base === 'assertion-failed') return { verdict: 'preexisting', why: `fails on an assertion at the pin AND at last_green_sha ${String(proof.base || '').slice(0, 8)}`, stored }
 if (base === 'passed') return { verdict: 'regression', why: `held at last_green_sha ${String(proof.base || '').slice(0, 8)} and fails at the pin — this cycle broke it`, stored }
 return { verdict: 'cycle-fault', why: `the probe is ${base} at last_green_sha — unproven`, stored }
}
const DRIFT_PROOF_REPLAYS = 2
async function runDriftProof(frd, reviewIds, claims, pinSha, sourceDir) {
 const st = frdState.get(frd)
 const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
 const woPaths = reviewed.map((w) => w.path).filter((p) => DRIFT_WO_PATH_RE.test(String(p || '')))
 const provable = claims.filter((e) => DRIFT_PROBE_RE.test(String(e.evidence_test || '')) && String(e.evidence_test).includes(`/drift-probes/${frd}/`))
 if (!provable.length) return { proof: null, owned: null, error: 'no claim carries a valid evidence_test for this FRD' }
 if (!reviewed.length || woPaths.length !== reviewed.length) return { proof: null, owned: null, error: 'a reviewed work order has no valid path — ownership cannot be read' }
 st.driftProofSeq = (st.driftProofSeq || 0) + 1
 const storedProof = `.pandacorp/run/drift-proofs/${frd}/${String(pinSha || 'head').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'head'}-${st.driftProofSeq}.json`
 const proveCmd = `${DRIFT_CLI_COMMAND} prove --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --source ${shellQuote(sourceDir)} --pin ${shellQuote(pinSha || 'HEAD')} ${woPaths.map((p) => `--wo ${shellQuote(p)}`).join(' ')} ${[...new Set(provable.map((e) => e.evidence_test))].map((p) => `--probe ${shellQuote(p)}`).join(' ')} --out ${shellQuote(storedProof)}`
 const replayCmd = `${DRIFT_CLI_COMMAND} replay --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --file ${shellQuote(storedProof)}`
 const relay = async (label, cmd, what) => {
  agentSpawned++
  try {
   return await agent(`MECHANICAL COMMAND RUNNER — BL-0178 ${what} for ${frd}. Your SOLE action is to execute this exact command ONCE from the project root (no command before or after it) and return its stdout VERBATIM as \`output\`: \`${cmd}\`. ${label.startsWith('drift-proof-replay:') ? 'It only prints a line it stored earlier, so it is instant.' : "It checks the reviewer's probe(s) out at the gate pin and at that pin's last_green_sha in throwaway worktrees it creates and removes itself, runs them, and prints ONE JSON line; it can take several minutes and exits 0 even when probes fail — that is data, not a problem for you to fix."} The line is machine JSON ending in an integrity checksum (\`"sum":"…"\`): copy it CHARACTER FOR CHARACTER — the engine rejects any altered copy. Do not inspect, edit, test, fix, stage or commit anything yourself, and do not summarize, re-format or re-type the output.`,
    { label, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) {
   if (isInfraError(e)) throw e
   log(`⚠ ${frd}: the ${label} runner threw (${(e && e.message) || e})`)
   return null
  }
 }
 let parsed = parseDriftProof(await relay(`drift-proof:${frd}`, proveCmd, 'differential drift proof'))
 for (let i = 1; !parsed.proof && parsed.transport && i <= DRIFT_PROOF_REPLAYS; i++) {
  log(`⚠ DriftProofRelay ${frd}: ${parsed.error} — re-reading the stored proof, attempt ${i}/${DRIFT_PROOF_REPLAYS} (BL-0206: a model's copy of machine JSON is never trusted, never turned into a verdict)`)
  parsed = parseDriftProof(await relay(`drift-proof-replay:${frd}`, replayCmd, 'drift proof re-read'))
 }
 const { proof, error } = parsed
 if (!proof && parsed.transport) {
  log(`⚠⚠ DriftProofUnreadable ${frd}: ${error} after ${DRIFT_PROOF_REPLAYS} re-read(s) — the differential proof could not be READ, so every drift claim of this gate stays UNPROVEN: no reopen, no card, no drift: entry — and an open fail, so nothing is certified on it (DR-122: what is not proven never reopens and never waives; BL-0206). Re-running the gate proves it`)
  return { proof: null, owned: null, error, unreadable: true }
 }
 if (!proof) { log(`⚠ ${frd}: ${error} — every drift claim stays a cycle fault (BL-0178 fail-closed)`); return { proof: null, owned: null, error } }
 if (parsed.legacy) log(`⚠ ${frd}: the drift-proof script predates the sealed output (version 1) — its relay integrity could not be verified (BL-0206; update the installed plugin)`)
 if (proof.cleanup && proof.cleanup.ok === false) log(`⚠ ${frd}: drift-proof left temporary worktree(s) behind: ${(proof.cleanup.leftover || []).join(', ')}`)
 return { proof, owned: ownedDriftCores(proof, woPaths), error: '' }
}
async function recordDrift(frd, confirmed) {
 const st = frdState.get(frd)
 if (st && !st.recordedDrift) st.recordedDrift = new Set()
 const fresh = confirmed.filter((d) => !(st && st.recordedDrift.has(d.id)))
 if (!fresh.length) { log(`◦ ${frd}: drift ${confirmed.map((d) => d.id).join(', ')} already recorded this run — not filing it again (BL-0178 idempotent)`); return }
 const items = fresh.map((d) => ({ id: d.id, contract: d.contract, contractClass: d.contractClass, direction: d.direction, probe: d.stored, pin: d.pin, base: d.base }))
 const cmd = `${DRIFT_CLI_COMMAND} record --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --project-name "${PROJECT}" --items ${shellQuote(JSON.stringify(items))}`
 let res = null
 for (let attempt = 1; attempt <= 2 && !res; attempt++) {
  agentSpawned++
  let raw = null
  try {
   raw = await agent(`MECHANICAL COMMAND RUNNER — BL-0178 drift record for ${frd}. Your SOLE action is to execute this exact command ONCE from the project root and return its stdout VERBATIM as \`output\`: \`${cmd}\`. It writes draft change card(s) into .pandacorp/inbox/changes/ (gitignored owner channel, idempotent) and appends one GateDriftRecorded event. Do not edit, stage or commit anything yourself.`,
    { label: `drift-record:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) { raw = null; log(`⚠ ${frd}: the drift-record runner threw (${(e && e.message) || e})`) }
  raw = unwrapAnswer(raw, 'output')
  try { res = raw && typeof raw.output === 'string' ? JSON.parse(raw.output.trim().split('\n').pop()) : null } catch { res = null }
  if (!res && attempt === 1) log(`⚠ ${frd}: the drift-record result was unreadable — running the idempotent command once more (BL-0206)`)
 }
 if (!res || res.ok !== true) {
  log(`⚠⚠ ${frd}: drift ${fresh.map((d) => d.id).join(', ')} is PROVEN but its draft card could NOT be written (${(res && res.error) || 'no ok:true output'}) — it still lands in the FRD's committed \`drift:\` frontmatter; file the card by hand (BL-0178)`)
  return
 }
 if (st) for (const d of fresh) st.recordedDrift.add(d.id)
 log(`✎ ${frd}: pre-existing drift recorded as draft card(s) — written ${(res.written || []).join(', ') || 'none'}; already present ${(res.skipped || []).join(', ') || 'none'} (BL-0178)`)
}
async function adjudicateDrift(frd, reviewIds, gate, pinSha, sourceDir) {
 if (!gate || typeof gate !== 'object' || !Array.isArray(gate.traceability)) return gate
 const claimIdx = gate.traceability.map((e, i) => (e && e.status === 'fail' && e.claim === 'preexisting' ? i : -1)).filter((i) => i >= 0)
 if (!claimIdx.length) return gate
 if (DRIFT_POLICY === 'block') {
  log(`◦ ${frd}: ${claimIdx.length} pre-existing-drift claim(s) IGNORED — args.driftPolicy:'block' treats every fail as a cycle fault (BL-0178 rollback)`)
  return { ...gate, traceability: gate.traceability.map((e, i) => { if (!claimIdx.includes(i)) return e; const { claim, ...rest } = e; return rest }) }
 }
 const claims = claimIdx.map((i) => gate.traceability[i])
 const { proof, owned, error, unreadable } = await runDriftProof(frd, reviewIds, claims, pinSha, sourceDir)
 const confirmed = []
 const faults = []
 const unreadableIds = []
 const trace = gate.traceability.map((e, i) => {
  if (!claimIdx.includes(i)) return e
  const fromFinder = e.origin === 'drift-finder'
  const c = fromFinder ? classifyFinderClaim(e, proof, owned, error) : classifyDriftClaim(e, proof, owned, error, unreadable === true)
  const id = contractIdOf(e.contract)
  const { __judgeEntry, ...claimEntry } = e
  const dropFinderClaim = (why) => (__judgeEntry ? __judgeEntry : { ...claimEntry, status: 'discarded', __driftAdjudicated: true, driftWhy: why })
  if (c.verdict === 'preexisting') {
   confirmed.push({ id, contract: e.contract, contractClass: e.contractClass, direction: e.direction || 'unknown', stored: c.stored, pin: proof.pin, base: proof.base })
   log(`⚖ ${frd}: ${id} is PROVEN pre-existing drift (${c.why}) — recorded, it never blocks nor reopens this cycle (BL-0178${fromFinder ? '; claimed by the drift finder, BL-0203' : ''})`)
   return { ...claimEntry, status: 'drift', __driftAdjudicated: true, driftWhy: c.why }
  }
  if (c.verdict === 'refuted') {
   log(`⚖ ${frd}: drift claim on ${id} DISCARDED — ${c.why} (${fromFinder ? 'BL-0203: the drift finder was wrong' : 'BL-0178: the reviewer was wrong'})`)
   return fromFinder ? dropFinderClaim(c.why) : { ...e, status: 'discarded', __driftAdjudicated: true, driftWhy: c.why }
  }
  if (c.verdict === 'unproven') {
   if (unreadable === true) unreadableIds.push(id || e.contract)
   if (!fromFinder) {
    log(`⚖ ${frd}: drift claim on ${id || e.contract} is UNPROVEN (${c.why}) — the proof could not be read, so the claim is neither drift nor a cycle fault: it stays an OPEN fail, no reopen, no card (DR-122, BL-0206)`)
    const { claim, ...open } = claimEntry
    return { ...open, driftVerdict: 'unproven', driftWhy: c.why }
   }
   log(`⚖ ${frd}: drift finder claim on ${id || e.contract} is unproven (${c.why}) — discarded, never a cycle fault on a finder's word (BL-0203)`)
   return dropFinderClaim(c.why)
  }
  log(`⚖ ${frd}: drift claim on ${id || e.contract} is a CYCLE FAULT (${c.verdict}: ${c.why}) — routed patch-first like any other fail (BL-0178${fromFinder ? '; claimed by the drift finder, BL-0203' : ''})`)
  const { claim, ...rest } = claimEntry
  faults.push({ entry: rest, c })
  return { ...rest, driftVerdict: c.verdict, driftWhy: c.why }
 })
 let next = { ...gate, traceability: trace, __drift: confirmed }
 if (confirmed.length) await recordDrift(frd, confirmed)
 const st = frdState.get(frd)
 const atCap = Boolean(st) && st.f.workOrders.some((w) => reviewIds.includes(w.id) && (w.reopen_count || 0) >= MAX_REOPENS)
 const otherOpen = trace.some((e, i) => !claimIdx.includes(i) && isOpenFail(e))
 const reportRed = Boolean(gate.gateReport && gate.gateReport.green === false)
 const onlyDriftRed = !otherOpen && !reportRed && !(gate.missingFoundation && gate.missingFoundation.length) && !(gate.findings && gate.findings.length) && !atCap
 if (faults.length) {
  const findingsAdd = faults.map(({ entry, c }) => ({
   wo: reviewIds[0],
   finding: `${entry.contract} — contradicted, and the BL-0178 differential proof makes it a CYCLE FAULT (${c.verdict}: ${c.why})${c.verdict === 'regression' ? '. It held at last_green_sha: find the change in `git diff <last_green_sha>..HEAD` that broke it — a shared helper outside this FRD may be the culprit' : ''}`,
   failingTest: c.stored ? `${c.stored} — the reviewer's probe; install it VERBATIM as a collected test (renamed *.test.ts under src/**/_tests/, it imports via @/ only) to reproduce` : String(entry.evidence_test || ''),
   files: [],
  }))
  if (next.green === true && !atCap) next = { ...next, green: false, reopen: [...reviewIds], findings: findingsAdd, failure: `BL-0178: ${faults.length} pre-existing-drift claim(s) were NOT proven pre-existing — reopened patch-first` }
  else if (next.green !== true && next.reopen && next.reopen.length) next = { ...next, findings: [...(next.findings || []), ...findingsAdd] }
  else if (next.green !== true && onlyDriftRed && next.blocked_reason !== 'external') next = { ...next, blocked_reason: undefined, reopen: [...reviewIds], findings: findingsAdd, failure: `BL-0178: the block rested only on drift claims, and ${faults.length} of them are cycle faults — reopened patch-first` }
 } else if (next.green !== true && onlyDriftRed && !(next.reopen && next.reopen.length) && next.blocked_reason === 'needs-owner' && unreadableIds.length) {
  log(`◦ ${frd}: the needs-owner block is KEPT — it rested on drift claim(s) ${unreadableIds.join(', ')} whose proof could not be read, so they are not proven drift (BL-0206)`)
 } else if (next.green !== true && onlyDriftRed && !(next.reopen && next.reopen.length) && next.blocked_reason === 'needs-owner') {
  log(`✓ ${frd}: the gate blocked needs-owner ONLY over drift the engine proved pre-existing — policy (a): the block is lifted, the cycle's work orders are certified (BL-0178)`)
  next = { ...next, green: true, blocked_reason: undefined, failure: undefined, __driftBlockLifted: true }
 }
 const unproven = trace.filter((e) => e && e.driftVerdict === 'unproven')
 if (unproven.length && next.green === true && !faults.length) {
  log(`⛔ DriftProofUnproven ${frd}: ${unproven.map((e) => contractIdOf(e.contract) || e.contract).join(', ')} stay OPEN fails — the FRD is NOT certified this run and NOT reopened; it re-gates next pass (DR-122, BL-0206)`)
  next = { ...next, green: false, __driftUnproven: true, failure: `BL-0206: ${unproven.length} pre-existing-drift claim(s) could not be proven (the differential proof was unreadable) — not certified, re-gated next pass` }
 } else if (unproven.length && next.reopen && next.reopen.length) {
  next = { ...next, findings: [...(next.findings || []), ...unproven.map((e) => ({ wo: reviewIds[0], finding: `${e.contract} — contradicted, and its pre-existing-drift claim could NOT be proven (BL-0206: the differential proof was unreadable) — an open fail like any other`, failingTest: String(e.evidence_test || ''), files: [] }))] }
 }
 return next
}
const deferredGateOutcome = (raw) => Boolean(raw) && typeof raw === 'object' && raw.green !== true && raw.blocked_reason === 'needs-owner'
 && Array.isArray(raw.traceability) && raw.traceability.some((e) => e && e.status === 'fail' && e.claim === 'preexisting')
async function finalizeGate(frd, reviewIds, raw, pinSha = null, sourceDir = PROJECT_DIR) {
 const adjudicated = await adjudicateDrift(frd, reviewIds, mergeDriftFinderClaims(frd, raw), pinSha, sourceDir)
 let result = enforceWholeFrdTraceability(adjudicated)
 for (const d of classifyDismissals(adjudicated).valid) log(`⊙ ${frd}: gate dismissed "${d.finding}" by ${d.source} — "${d.quote.slice(0, 160)}"`)
 if (deferredGateOutcome(raw) && result && result.green !== true && !(result.reopen && result.reopen.length)) result = { ...result, __outcomeDeferred: true }
 const st = frdState.get(frd)
 if (st) {
  st.landingDrift = (adjudicated && Array.isArray(adjudicated.__drift)) ? adjudicated.__drift : []
  st.inheritedFails = (result && Array.isArray(result.traceability)) ? result.traceability.filter(isOpenFail) : []
  st.inventoryCandidate = inventoryCandidateOf(result, pinSha)
 }
 return result
}
const driftFrontmatter = (frd) => {
 const st = frdState.get(frd)
 const ids = ((st && st.landingDrift) || []).map((d) => d.id)
 return ids.length
  ? ` **BL-0178 DRIFT (engine-proven pre-existing drift — it does NOT block):** in docs/frds/${frd}/frd.md frontmatter set exactly \`drift: [${ids.join(', ')}]\` (add the key if absent, replace it if present — a replica of the draft change card(s) already filed, written only by this certifying step) and include frd.md in the snapshot commit.`
  : ` **BL-0178 DRIFT:** if docs/frds/${frd}/frd.md frontmatter has a \`drift:\` line, delete that line (this gate proved no pre-existing drift; the replica is re-derived at every certifying landing) and include frd.md in the snapshot commit; otherwise change nothing.`
}
const EVIDENCE_SCHEMA = {
 type: 'object', required: ['report'],
 properties: {
  report: { type: ['string', 'null'], description: 'BL-0214: the SEALED LINE the last command of step 1 printed (`seal-report.mjs seal` over .pandacorp/run/gate-report.json after `bash .pandacorp/verify.sh --since <last_green_sha> --report-all`) — that one line, byte-for-byte, never re-formatted, never a summary. The engine recomputes its checksum. `null` iff the sanity gate (step 0) refused to run verify.sh at all — see `reason`.' },
  reason: { type: 'string', description: 'BL-0149: set ONLY when `report` is null — why the collector refused to run verify.sh (e.g. "gate-worktree-not-bootstrapped"). The engine surfaces this VERBATIM in the GateEvidenceFallback log/event instead of a generic message.' },
  report_suspect: { type: 'boolean', description: 'BL-0149: true iff 3+ cheap sub-gates (biome/tsc/knip/madge…) are red with environment-only noise (command not found, Cannot find module) rather than a real finding — the pack is discarded and the gate degrades to explore, same as a null report.' },
  diffStat: { type: 'string', description: 'the output of `git diff <pin_base>..<pin> --stat` (the full stat, every file)' },
  diff: { type: 'string', description: "the UNIFIED diff `git diff <pin_base>..<pin> -- <the reviewed work orders' artifact paths>`, capped at EVIDENCE_DIFF_MAX_LINES lines" },
  truncated: { type: 'boolean', description: 'true iff the unified diff exceeded the line cap and was clipped — the gate is told so explicitly, so a clipped diff is never read as the complete change set' },
  tests: { type: 'array', items: { type: 'string' }, description: 'BL-0187: the project-relative test files this cycle added or changed (`git diff --relative --name-only --diff-filter=AMR <pin_base>..<pin>` filtered to test paths), verbatim — [] when none' },
  ac: { type: 'string', description: "the FRD's EARS acceptance criteria, VERBATIM from frd.md" },
 },
}
const FINDER_SCHEMA = {
 type: 'object', required: ['findings'],
 properties: {
  findings: {
   type: 'array',
   items: {
    type: 'object', required: ['file', 'claim', 'severity', 'evidence'],
    properties: {
     file: { type: 'string', description: 'the file (path, ideally with a line) the finding is anchored to' },
     claim: { type: 'string', description: 'the specific defect claimed, one sentence' },
     severity: { type: 'string', enum: ['correction', 'nit'], description: "'correction' = a blocking defect (correctness/security/SSOT/render) that must be verified and, if confirmed, fixed; 'nit' = advisory polish that never blocks" },
     evidence: { type: 'string', description: 'the concrete evidence for the claim (the code/behavior observed) — grounds it so the skeptic can try to refute it' },
    },
   },
  },
 },
}
const VERIFY_FINDING_SCHEMA = {
 type: 'object', required: ['refuted'],
 properties: {
  refuted: { type: 'boolean', description: 'true iff the skeptic could NOT anchor/reproduce the finding against the actual code (the finding dies); false iff it stands (a real defect the closer must act on)' },
  reason: { type: 'string', description: 'why refuted or upheld, with the evidence checked' },
 },
}
const REPAIR_SCHEMA = {
 type: 'object', required: ['green'],
 properties: {
  green: { type: 'boolean' }, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' },
  cause: { type: 'string', enum: ['code', 'gate-test-defective'], description: "why the patch could not green: 'code' = the build genuinely fails → revert+retry; 'gate-test-defective' = a reviewer test is internally inconsistent/unsatisfiable by ANY correct implementation → the engine routes to gate-test repair (BL-0001), never a rebuild" },
  inheritedResolved: { type: 'array', description: 'BL-0178 (verify-patch only): one entry per inherited open contract you were given — the test file(s) you ran that prove it now holds, and whether they passed', items: { type: 'object', required: ['contract', 'pass', 'tests'], properties: { key: { type: 'string', description: 'BL-0191: the INH-<n> key the prompt gave this contract' }, contract: { type: 'string', description: 'the inherited contract text as given (without its [class] tag and tests suffix)' }, pass: { type: 'boolean' }, tests: { type: 'array', items: { type: 'string' } } } } },
  resolved: { type: 'string', description: 'BL-0191 (verify-patch only, on green): one line — what the patch resolved; the certify step journals it' },
  defectiveTests: { type: 'array', description: 'BL-0001: the reviewer test(s) judged defective, with evidence — only when cause is gate-test-defective', items: { type: 'object', required: ['path', 'why'], properties: { path: { type: 'string' }, why: { type: 'string', description: 'the internal inconsistency, e.g. "asserts desktop-only nav visibility but the Playwright config runs desktop+mobile and no viewport is forced"' } } } },
  report_scope: REPORT_SCOPE,
 },
}
const DIAGNOSE_SCHEMA = {
 type: 'object', required: ['classification', 'recommendation', 'confidence'],
 properties: {
  classification: { type: 'string', enum: ['point', 'architectural', 'gate-test-defective', 'deadlocked-contract'], description: "point = a bounded, cleanly-fixable fault; architectural = findings spread over > FINDING_SPREAD_THRESHOLD files OR the same findingKey recurring across >=2 attempts OR an AC unsatisfiable vs the blueprint; gate-test-defective = a reviewer adversarial test is internally inconsistent/unsatisfiable (route to gate-test repair); deadlocked-contract = a blessed test asserts a contract a dependsOn sibling WO intentionally derogates (LESSON-0104)" },
  seam: { type: 'object', description: 'where the fault localizes', properties: { files: { type: 'array', items: { type: 'string' } }, symbol: { type: 'string' }, why: { type: 'string' }, cleanlySeparable: { type: 'boolean', description: 'true iff reverting ONLY seam.files cleanly isolates the fault without unwinding good work — gates the PARTIAL revert' } } },
  repeatsPrior: { type: 'boolean', description: 'true iff this SAME fault (findingKey) already appears in the journal for this WO on a prior attempt, AFTER purging priors you cannot reproduce now (supersededPriors)' },
  supersededPriors: { type: 'array', description: 'prior journal diagnoses this diagnosis REFUTES against the current code (poison self-purge) — not counted as recurrences', items: { type: 'object', properties: { attempt: { type: 'number' }, whyCannotReproduce: { type: 'string' } } } },
  recommendation: { type: 'string', enum: ['patch', 'partial-revert', 'full-revert', 'block-needs-owner'], description: 'block-needs-owner ONLY for architectural/deadlocked-contract at confidence medium|high' },
  decisionRecord: { type: 'string', description: 'Spanish, owner-facing — what keeps failing, the diagnosis, what the owner must decide (meaningful when recommending block-needs-owner; a one-liner otherwise)' },
  confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
 },
}
const PROCESS_CHANGE_SCHEMA = {
 type: 'object', required: ['done', 'affectedFrds'],
 properties: {
  done: { type: 'boolean' },
  affectedFrds: { type: 'array', items: { type: 'string' }, description: 'FRD folder names (docs/frds/<folder>) created or updated by this change' },
  changeFile: { type: 'string', description: 'the matched change filename in .pandacorp/inbox/changes/' },
  failure: { type: 'string' },
 },
}
const CHANGE_GATE_SCHEMA = {
 type: 'object', required: ['results'],
 properties: {
  results: {
   type: 'array',
   items: {
    type: 'object', required: ['frd', 'gated'],
    properties: {
     frd: { type: 'string', description: 'the FRD folder graded (one of the affected FRDs passed in)' },
     gated: { type: 'boolean', description: 'true iff every DRAFT work order this change added/touched in this FRD passed readiness+grounding+consistency AND was stamped/flipped to ACTIVE in this same call' },
     failure: { type: 'string', description: 'what failed and what the owner/architect must fix, when gated is false — nothing was changed on disk for this FRD' },
    },
   },
  },
 },
}
const FOUNDATION_SCHEMA = {
 type: 'object', required: ['complete'],
 properties: {
  complete: { type: 'boolean' },
  missing: { type: 'array', items: {
   type: 'object', required: ['name'],
   properties: { name: { type: 'string' }, referencedBy: { type: 'array', items: { type: 'string' } }, suggestedPath: { type: 'string' }, note: { type: 'string' } },
  } },
 },
}
function unwrapAnswer(raw, key) {
 const fromText = (text) => {
  let j = null
  try { j = JSON.parse(text) } catch { return null }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null
  if (key in j) return j
  return typeof j.sum === 'string' ? { [key]: text.trim() } : null
 }
 if (typeof raw === 'string') return fromText(raw) || raw
 if (!raw || typeof raw !== 'object' || Array.isArray(raw) || key in raw) return raw
 const keys = Object.keys(raw)
 return keys.length === 1 && typeof raw[keys[0]] === 'string' ? (fromText(raw[keys[0]]) || raw) : raw
}
function parseMechLine(answer, op) {
 const raw = unwrapAnswer(answer, 'line')
 const text = raw && typeof raw.line === 'string' ? raw.line.trim().split('\n').pop().trim() : ''
 if (!text) return { body: null, error: `the ${op} runner returned no line` }
 let j
 try { j = JSON.parse(text) } catch { return { body: null, error: `the ${op} line is not valid JSON` } }
 if (!driftSealHolds(text)) return { body: null, error: `the ${op} line failed its integrity seal (the relay altered it)` }
 if (!j || j.op !== op) return { body: null, error: `the line is not a ${op} receipt` }
 return { body: j, error: '' }
}
async function runMechOp(op, flags, { label, phase = 'Build', prefix = '', suffix = '' }) {
 const cmd = mechOpCommand(op, flags)
 const raw = await agent(prefix.trim() || suffix.trim() ? MECH_FUSED(cmd, prefix, suffix) : MECH_LITERAL(cmd), { label, phase, model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: MECH_LINE_SCHEMA })
 return parseMechLine(raw, op)
}
const parkWoFlags = (w) => `--wo ${shellQuote(w.id)}${(w.artifacts || []).map((a) => ` --file ${shellQuote(a)}`).join('')}${FAST ? ' --all-undeclared' : ''}`
async function parkWorkOrders(wos) {
 for (const w of wos) {
  agentSpawned++
  let r = null
  try { r = await runMechOp('park-wo', parkWoFlags(w), { label: `park:${w.id}` }) } catch (e) { r = { body: null, error: (e && e.message) || String(e) } }
  if (r.body && r.body.ok === true) { parkedWos.push(w.id); log(`⇣ ${w.id} parked (${r.body.status}${r.body.dir ? ` → ${r.body.dir}` : ''}) — rebuilt on resume`) }
  else log(`⚠ ${w.id} could not be parked (${r.error || (r.body && (r.body.reason || r.body.error)) || 'no receipt'}) — ${FAST ? 'its dirty paths stay; the next fast run stops before dispatch and lists them (needs-owner)' : 'the resume precheck salvages it'}`)
 }
}
const PAUSED = Object.freeze({ paused: true })
const INFRA_RESUME_HINT = 'Paused on an infrastructure failure (usage limit, 429, overload or a dead agent). Committed work orders are kept; nothing was blocked, repaired or reverted. Relaunch /pandacorp:implement once the usage window resets: the resume precheck demotes any IN_REVIEW without its commit and only that work is rebuilt.'
const jsonSafe = (s) => String(s || '').replace(/[^\w:.+@/-]/g, '_').slice(0, 120)
async function pausedExit(st = {}) {
 if (st.inFlight && st.inFlight.size) { log(`⏸ waiting for ${st.inFlight.size} in-flight gate(s) to settle — their verdicts are not landed this run`); await Promise.allSettled([...st.inFlight.values()]) }
 const h = infraHalt || { kind: 'infra', label: '', detail: 'unknown' }
 agentSpawned++
 let closed = null
 try {
  closed = await agent(`BUILD PAUSED (paused-infra, proposal 39 C7): the run halted on an infrastructure failure (${jsonSafe(h.kind)} at ${jsonSafe(h.label)}). Record it and release the run, nothing else (no verify, no fix, no commit beyond the lease release). Append the dashboard event (fire-and-forget): printf '{"event":"build_paused","at":"%s","project":"%s","reason":"${jsonSafe(h.kind)}","label":"${jsonSafe(h.label)}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.${TRACK('build_paused', `,"reason":"${jsonSafe(h.kind)}","label":"${jsonSafe(h.label)}"`)} Then: ${RELEASE_LEASE} Return done:true once the lease release succeeded.`,
   { label: 'build-paused', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
 } catch (e) { log(`⚠ the build-paused close could not run (${(e && e.message) || e}) — build_paused is not recorded and the lease expires by its TTL`) }
 log(`⏸ Run ended: paused-infra (${h.kind} at ${h.label || '?'}). ${INFRA_RESUME_HINT}`)
 return { mode: MODE, builtFrds: st.builtFrds || [], blockedFrds: st.blockedFrds || [], reopenedFrds: st.reopenedFrds || [], blockedReasons: st.blockedReasons || {}, blockedFailures: st.blockedFailures || {}, stopReason: 'paused-infra',
  paused: { kind: h.kind, label: h.label, detail: h.detail, parked: [...parkedWos], accepted: [...acceptedWos], closed: Boolean(closed && closed.done === true) }, resumeHint: INFRA_RESUME_HINT, ...(FAST ? { usable: fastUsable.map((u) => ({ ...u })) } : {}) }
}
async function ensureStopped(reason) {
 agentSpawned++
 const receipt = await agent(`MECHANICAL COMMAND RUNNER — your SOLE action is to execute this exact command once, with no command before or after it, and return its JSON stdout verbatim: \`${STATE_CLI_COMMAND} close-preloop --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}" --reason "${reason}"\`. Do not inspect, edit, test, build, stage or commit anything yourself. The CLI owns the fenced two-phase close and rejects every diff outside .pandacorp/status.yaml.`,
  { label: 'ensure-stopped', phase: 'Baseline', model: MECH, agentType: MECH_AGENT('pandacorp:devops'), effort: MECH_EFFORT, schema: CLOSE_RECEIPT_SCHEMA })
 if (!receipt || receipt.done !== true || receipt.lease_released !== true || JSON.stringify(receipt.allowed_paths) !== JSON.stringify(['.pandacorp/status.yaml'])) throw new Error('FATAL: bounded pre-loop close returned an invalid receipt')
}
async function infraPausable(fn) {
 try { return await fn() } catch (e) { if (isInfraError(e)) return PAUSED; throw e }
}
async function preLoopGuarded(fn) {
 try {
  return await fn()
 } catch (e) {
  if (isInfraError(e)) return PAUSED
  log('☠ pre-loop failure: ' + e.message)
  await ensureStopped('pre-loop failure: ' + e.message)
  throw e
 }
}
phase('Baseline')
let mechGreenfield = null
const FAST_SHARED_PATHS = new Set(['.pandacorp/status.yaml', '.pandacorp/track.jsonl', '.pandacorp/build-journal.jsonl'])
let fused = null
if (FUSED_START) {
 agentSpawned++
 const flags = [`--token ${shellQuote(LEASE_TOKEN)} --epoch ${shellQuote(String(LEASE_EPOCH))}`, ...(TARGETED ? ['--targeted'] : []), ...(ONLY || []).map((f) => `--frd ${shellQuote(f)}`),
  `--launch-event --mode ${shellQuote(MODE)} --max-agents ${shellQuote(String(MAX_AGENTS || 0))}`, ...(args && args.project ? [`--project-name ${shellQuote(PROJECT)}`] : [])]
 const r = await preLoopGuarded(() => runMechOp('fast-start', flags.join(' '), { label: 'fast-start', phase: 'Baseline' }))
 if (r === PAUSED) return await pausedExit()
 const b = r.body
 if (b && b.ok === true && b.precheck && b.precheck.ok === true) { fused = b; log(`▶ fast-start (one scripted op): ${b.status}${b.stage ? ` at ${b.stage}` : ''}${b.baseline ? ` · baseline ${b.baseline}` : ''}`) }
 else log(`⚠ fast-start unverifiable (${r.error || (b && (b.reason || b.error || b.status)) || 'no receipt'}) — the separate start steps run (fail-safe)`)
}
let fusedProbe = fused && ['planned', 'dispatched'].includes(fused.status) && fused.probe ? fused.probe : null
let fusedDispatch = fused && fused.status === 'dispatched' && fused.dispatch && fused.dispatch.ok === true ? fused.dispatch : null
if (MECH_SCRIPT) {
 if (!fused) agentSpawned++
 const pre = fused ? { body: fused.precheck } : await preLoopGuarded(() => runMechOp('precheck', '', { label: 'mech-precheck', phase: 'Baseline' }))
 if (pre === PAUSED) return await pausedExit()
 const p = pre.body
 if (!p || p.ok !== true) {
  const why = pre.error || (p && (p.reason || p.error || p.status)) || 'no receipt'
  log(`⊘ resume precheck unverifiable or refused (${why}) — stopping before planning (fail-closed, proposal 39 C7)`)
  await ensureStopped('precheck failed')
  return { mode: MODE, builtFrds: [], blockedFrds: ['precheck'], blockedReasons: { precheck: 'error' }, note: `precheck failed: ${why}` }
 }
 const demoted = Array.isArray(p.demoted) ? p.demoted : []
 for (const d of demoted) log(`↓ resume: ${d.wo} demoted ${d.from}→${d.to} (${d.why}${d.applied === false ? ', reported only: not on main' : ''}) — rebuilt this run (proposal 39 C7)`)
 const ownerDirt = FAST && Array.isArray(p.ownerDirt) ? p.ownerDirt.filter((x) => typeof x === 'string' && x && !FAST_SHARED_PATHS.has(x)) : []
 if (ownerDirt.length) {
  log(`⊘ fast lane: el árbol del proyecto tiene ${ownerDirt.length} cambio(s) del owner sin commitear — el motor NO construye encima (un builder desharía un cambio que no es suyo). Commitea, guarda o descarta estas rutas y relanza: ${ownerDirt.join(', ')}`)
  await ensureStopped('owner dirt')
  return { mode: MODE, builtFrds: [], blockedFrds: ['owner-dirt'], blockedReasons: { 'owner-dirt': 'needs-owner' }, ownerDirt, note: `owner dirt (needs-owner): the fast lane never builds over uncommitted owner edits — commit, stash or discard, then relaunch: ${ownerDirt.join(', ')}` }
 }
 if (FAST && p.greenfield && p.greenfield.greenfield === true) mechGreenfield = { reason: String(p.greenfield.reason || 'greenfield') }
 if (Array.isArray(p.keptInReview) && p.keptInReview.length) log(`✓ resume: ${p.keptInReview.length} IN_REVIEW work order(s) hold their flip commit after the last stamp — kept, never rebuilt`)
 if (Array.isArray(p.salvaged) && p.salvaged.length) log(`⇣ resume: ${p.salvaged.length} engine-owned dirty path(s) salvaged to ${p.salvageDir} and reset`)
 if (p.status === 'attention') log(`⚠ resume: interrupted discard(s) refused for ${(p.refused || []).join(', ')} — the engine's own recovery below handles them`)
 for (const u of Array.isArray(p.usable) ? p.usable : []) if (u && typeof u.frd === 'string' && typeof u.sha === 'string') priorUsable.push({ frd: u.frd, sha: u.sha })
 if (priorUsable.length) log(`✓ resume: ${priorUsable.map((u) => `${u.frd} @ ${u.sha}`).join(', ')} USABLE since an earlier run (committed build_usable, proposal 39 C6) — fix-forward only, never auto-discarded`)
}
if (fused && fused.status === 'stop') {
 log('⏸ owner stop signal (.pandacorp/run/stop, fast-start) — el motor para limpio antes de planificar')
 await ensureStopped('owner stop signal')
 return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'owner stop signal' }
}
const FUSED_BASELINE = fused && ['green', 'leased-status-only', 'greenfield'].includes(fused.baseline) ? fused.baseline : null
if (!FUSED_BASELINE) agentSpawned++
const precheck = FUSED_BASELINE ? null : await preLoopGuarded(() => agent(
 `You are the Pandacorp baseline PRE-CHECK (mechanical — cheap; do NOT run verify.sh, do NOT fix code, just return a verdict). Do these steps IN ORDER:
  ${FUSED_START ? '' : `**STEP L — record the launch (B1):** as your very FIRST action, emit the build-launch event so the dashboard knows this run started.${BUILD_LAUNCH_EVENT}`}
  **STEP 0 — deterministic root + owner-stop receipt (BL-0068):** execute exactly \`${INSPECT_STOP}\` with Node (NEVER shell \`test\`, \`[\` or an alias-sensitive builtin). If it fails, STOP and return { green: false, failure: "BL-0022: deterministic project/lease inspection failed" }. Preserve its JSON receipt. If receipt.stop is true, return { stop: true } immediately; if false, continue. Never infer stop from a command exit code.
  **STEP W — preserve gate-worktree crash evidence (BL-0067):** NEVER delete, recreate, prune, reset, clean, or force-remove ${GATE_WORKTREE}. Its contents may be the only evidence left by a crashed gate. Leave it untouched here; the lazy gate-worktree probe below will reuse it only when Git records that exact path as a worktree and its tree is clean. Any dirty, orphaned, unregistered, locked, or ambiguous state falls back to the synchronous gate without mutation.${PARALLEL_GATES ? ` The SAME protection covers every parallel gate slot ${gateSlotPath('<k>')} (D1, args.parallelGates): never delete, recreate, prune, reset, clean or force-remove any of them — a dirty slot is dropped from the pool by its own probe, never cleaned.` : ''}
  **STEP 1 — consume the rethink stop:** if ${PROJECT_DIR}/.pandacorp/status.yaml has \`rethink_pending: true\`, set it to \`false\` and commit that one-line change (this run STARTS from the re-planned docs, so the stop signal is consumed — DR-069).
  **STEP 2 — owner stop signal:** already decided exclusively by STEP 0's Node receipt. Do not probe it again. Do NOT delete the signal (the owner removes it).
  **STEP 3 — clean-tree fast path (BL-0066), scoped to THIS project (BL-0202):** list the tree with the BL-0202 STATUS COMMAND: \`${PROJECT_STATUS_COMMAND}\` (run it VERBATIM, as ONE Bash call). Its first line is \`PREFIX=<p>\` — this project's repository prefix, the output of \`git -C ${PROJECT_DIR} rev-parse --show-prefix\` ('' for a project at its repository root, e.g. \`mission-control/\` for a nested one) — then one \`IN <path>\` line per dirty path INSIDE this project and one \`OUT <path>\` line per dirty path ELSEWHERE in the repository (a nested project shares its repository with other work, e.g. the factory's parallel sessions). **OUT paths are INFORMATIONAL ONLY: they never make this project dirty, never escalate, and you never touch them** — just report every one as outsideDirtyPaths. This project's tree is CLEAN iff there is NO \`IN\` line. Read \`last_green_sha\` from status.yaml. Prove it exists and is an ancestor: \`git -C ${PROJECT_DIR} cat-file -e <last_green>^{commit} && git -C ${PROJECT_DIR} merge-base --is-ancestor <last_green> HEAD\`. A CLEAN tree is known-green only when EITHER (a) HEAD == last_green_sha (legacy projects), OR (b) HEAD is its DIRECT child (\`git rev-parse HEAD^\` == last_green_sha) AND \`git -C ${PROJECT_DIR} diff --name-only --relative <last_green>..HEAD\` is EXACTLY \`.pandacorp/status.yaml\` (the BL-0066 metadata-only pointer commit; \`--relative\` lists this project's own paths, project-relative). Then return { green: true, outsideDirtyPaths: <every OUT path> }. Any other descendant may contain unverified work: return { escalate: true, dirty: false, dirtyPaths: [], outsideDirtyPaths: <every OUT path> }. **A dirty tree (at least one IN line) always escalates from here — do NOT decide any exclusion yourself, even if the only IN path looks like the controller's own status.yaml** — but ALWAYS also report the raw signal the engine needs to apply the narrow BL-0124 exclusion on its own: return { escalate: true, dirty: true, dirtyPaths: <every IN path>, outsideDirtyPaths: <every OUT path>, leaseValid: true, projectPrefix: <the PREFIX= value> }. **dirtyPaths entries are BARE paths, EXACTLY as the IN lines print them — repo-root-relative (git prints paths from the REPOSITORY root even for a nested project) — with the 2-character XY status code AND its separating space STRIPPED** (the command already cuts it: \`git status --porcelain\` prints \` M mission-control/.pandacorp/status.yaml\` for a nested project — status code, space, path — and the IN line reads \`IN mission-control/.pandacorp/status.yaml\`; report \`mission-control/.pandacorp/status.yaml\`, never a raw porcelain line, and never rewrite the path yourself). **projectPrefix** is the PREFIX= value VERBATIM. This is not cosmetic: the engine strips projectPrefix from dirtyPaths[0] and matches the rest against the literal string \`.pandacorp/status.yaml\` with strict equality to decide the exclusion (BL-0160 — a path still carrying its status code silently fails that match and forces an avoidable judge-baseline every time; E2 finding 2 — without the prefix a nested project could never match). (leaseValid is true, not a fresh check — reaching this step already proves it, since STEP 0's inspect-stop just succeeded under THIS run's own token/epoch, the SAME fence BL-0079 relies on for the repair step).${STRICT_BASELINE ? ' NOTE: this run launched with args.strictBaseline — the engine will NOT apply the BL-0124 exclusion regardless of what dirtyPaths/leaseValid say, so it makes no difference to your answer; report the same honest signal.' : ''}
  **STEP G — greenfield facts (9.118.2):** whenever you return escalate:true, FIRST run exactly \`${GREENFIELD_PROBE_COMMAND}\` (VERBATIM, ONE Bash call) and add its single stdout line to your verdict as \`greenfieldProbe\` — a STRING, copied character for character (it ends in a \`"sum"\` seal the engine checks; never re-format, shorten or interpret it). It is a fact for the ENGINE; it never changes any other field of your answer. Return your verdict as the structured object itself — never JSON-encoded inside a single string field.`,
 { label: 'baseline-precheck', phase: 'Baseline', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: PRECHECK_SCHEMA },
))
if (precheck === PAUSED) return await pausedExit()
if (precheck && precheck.stop === true) {
 log('⏸ owner stop signal (.pandacorp/run/stop) — el motor para limpio antes de construir (no lo borro, lo hace el owner)')
 await ensureStopped('owner stop signal')
 return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'owner stop signal' }
}
let baseline
const PRECHECK_PREFIX = (precheck && /^(?:[^/.][^/]*\/)*$/.test(optionalText(precheck.projectPrefix)) && !optionalText(precheck.projectPrefix).split('/').includes('..')) ? optionalText(precheck.projectPrefix) : ''
const projectRelativeDirtyPath = (p) => (typeof p === 'string' && PRECHECK_PREFIX && p.startsWith(PRECHECK_PREFIX)) ? p.slice(PRECHECK_PREFIX.length) : p
const isInProject = (p) => !PRECHECK_PREFIX || (typeof p === 'string' && p.startsWith(PRECHECK_PREFIX))
const precheckDirty = Array.isArray(precheck && precheck.dirtyPaths) ? precheck.dirtyPaths : null
const projectDirtyPaths = precheckDirty ? precheckDirty.filter(isInProject) : null
const outsideDirtyPaths = [...new Set([...((precheck && Array.isArray(precheck.outsideDirtyPaths)) ? precheck.outsideDirtyPaths : []), ...(precheckDirty || []).filter((p) => !isInProject(p))].filter((p) => typeof p === 'string' && p))]
if (outsideDirtyPaths.length) log(`ℹ BL-0202: ${outsideDirtyPaths.length} ruta(s) sucia(s) FUERA del proyecto${PRECHECK_PREFIX ? ` (${PRECHECK_PREFIX})` : ''}, de otra sesión — informativo: no escalan el baseline y el motor no las toca: ${outsideDirtyPaths.slice(0, 10).join(', ')}${outsideDirtyPaths.length > 10 ? ', …' : ''}`)
const leasedStatusOnly = Array.isArray(projectDirtyPaths) && projectDirtyPaths.length === 1 && projectRelativeDirtyPath(projectDirtyPaths[0]) === '.pandacorp/status.yaml'
const readGreenfieldFacts = (line) => {
 if (typeof line !== 'string') return null
 const text = line.trim()
 if (!driftSealHolds(text)) return null
 let facts
 try { facts = JSON.parse(text) } catch { return null }
 return facts && facts.ok === true && facts.probe === 'greenfield' ? facts : null
}
const isGreenfield = (facts) => Boolean(facts) && facts.greenfield === true
const greenfieldFacts = readGreenfieldFacts(precheck && precheck.greenfieldProbe)
let baselineGreenfield = null
if (FUSED_BASELINE) {
 baseline = { green: true }
 log(`Baseline ${FUSED_BASELINE} (fast-start, scripted: ${FUSED_BASELINE === 'greenfield' ? `${(mechGreenfield && mechGreenfield.reason) || 'greenfield'} — red by construction, each FRD's verify certifies it` : FUSED_BASELINE === 'green' ? 'clean tree at last_green_sha or its BL-0066 pointer commit' : 'the only dirty path is the leased status.yaml, BL-0124'}) — no verify.sh, no judge.`)
} else if (precheck && precheck.green === true) {
 baseline = { green: true }
 log('Baseline verde (fast path: árbol limpio en el snapshot verde o su pointer commit BL-0066) — no se corrió verify.sh.')
} else if (precheck && precheck.green === false && optionalText(precheck.failure)) {
 baseline = precheck
} else if (!STRICT_BASELINE && precheck && precheck.leaseValid === true && leasedStatusOnly) {
 baseline = { green: true }
 log('Baseline verde (fast path BL-0124: el único diff sucio es el status.yaml propio bajo un lease ya probado válido) — no se corrió verify.sh.')
} else if (mechGreenfield) {
 baseline = { green: true }
 log(`Baseline: greenfield (${mechGreenfield.reason}) — sin juez de baseline: verify.sh es rojo por construcción hasta que se construyan; cada FRD lo certifica en su propio verify (proposal 39, fast lane).${precheck && precheck.dirty ? ` Rutas sucias del proyecto que el motor NO toca: ${(projectDirtyPaths || []).slice(0, 10).join(', ') || '(sin lista)'}.` : ''}`)
} else if (!STRICT_BASELINE && isGreenfield(greenfieldFacts)) {
 baseline = { green: true }
 baselineGreenfield = greenfieldFacts
 log(`Baseline no aplicable (greenfield 9.118.2): last_green_sha vacío y los ${greenfieldFacts.workOrders} work orders siguen PLANNED/DRAFT — el árbol rojo por construcción es trabajo de los WOs (self-tests + gate de FRD); no se corrió el judge baseline.`)
} else {
 agentSpawned += COST(P.judge)
 baseline = await preLoopGuarded(() => agent(
  `You are the Pandacorp baseline-repair engineer (DR-067 reconciliation + verify). The cheap pre-check found the tree DIRTY or HEAD beyond the certified last_green snapshot/pointer pair${precheck && precheck.dirty ? ' (tree is dirty)' : ''}.
    **STEP 0 — FAIL-LOUD project-root guard (BL-0022/BL-0068):** execute exactly \`${INSPECT_STOP}\`; if it fails, return { green: false, failure: "BL-0022: deterministic project/lease inspection failed" } and do nothing else. NEVER use shell \`test\` or \`[\` for this guard.
    **STEP 1 — DR-067 RECONCILIATION, scoped to THIS project (BL-0202) (only if the tree is dirty/conflicted):** list the tree with the BL-0202 STATUS COMMAND: \`${PROJECT_STATUS_COMMAND}\` (VERBATIM, ONE Bash call). \`IN <path>\` lines are THIS project's dirty paths; \`OUT <path>\` lines are OTHER work sharing the repository (a nested project: the factory's parallel sessions) — NEVER restore, clean, stage, stash or commit an OUT path, it is not yours.${outsideDirtyPaths.length ? ` The pre-check already saw these OUT paths — leave every one exactly as it is: ${outsideDirtyPaths.slice(0, 20).map((p) => `\`${p}\``).join(', ')}.` : ''} The valid active fence makes \`.pandacorp/status.yaml\` controller-owned: NEVER checkout or restore \`.pandacorp/status.yaml\`; renew/sync-rollups deterministically re-derive its active projection from the fenced lease. If the IN lines show other uncommitted/conflicted changes (unmerged paths or \`<<<<<<<\` markers — a kill or app-restart left a run mid-write), DISCARD only the uncommitted edits of those other tracked MODIFIED IN paths (every IN path except .pandacorp/status.yaml) by restoring them to HEAD — NEVER to last_green_sha — with the BL-0202 RESTORE COMMAND: \`${scopedRestoreCommand('HEAD')}\` — run it VERBATIM except ${SCOPED_PATHS_NOTE} (Why HEAD: whenever IN_REVIEW work was committed after the pin — every carry-over work order, BL-0212 — a checkout of the pin rewrites the INDEX too, staging the reversal of those later commits, and the next commit anywhere would silently erase them.) It refuses (exit 3, touching nothing) any path outside this project, the controller-owned status.yaml, or an empty list. Surgical — ${NO_WHOLE_TREE_WRITES} Stashes: leave EVERY stash as it is — never drop or pop one (DR-067: never stash-pop across a moved tree; the stash list is repository-wide, so in a nested project it holds other sessions' stashes, and a drop is unrecoverable). Remove leftover temp preview pages — any \`preview-wo*\` scratch page/route the build created (untracked IN paths) — with the BL-0202 CLEAN COMMAND: \`${scopedCleanCommand()}\` (VERBATIM except <PATHS>, same path rules). Leave legitimate untracked owner state (\`.pandacorp/\`, etc.) untouched.
    **STEP 2 —${GATE_SKIP} THEN run \`bash ${PROJECT_DIR}/.pandacorp/verify.sh\`:**
    - GREEN → return { green: true }, change nothing further.
    - RED → fix the PRODUCTION code (never weaken/skip tests) until it passes end-to-end, commit (Conventional Commits with scope) staging ONLY this project's files by explicit path (never \`git add -A\`/\`git add .\`/\`git commit -a\` — BL-0202: in a nested project they sweep other sessions' work into your commit), return { green: true }. (A route quarantined above is NOT yours to fix — it waits on the owner; do not touch it.)
    If you genuinely can't, return { green: false, failure } describing what remains.${NOTIFY('Baseline roto y no se pudo reparar — necesita tu intervencion')}`,
  { label: 'baseline', phase: 'Baseline', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA },
 ))
 if (baseline === PAUSED) return await pausedExit()
}
if (!baseline || baseline.green !== true) {
 log(`Baseline red and auto-repair failed${baseline?.failure ? ': ' + baseline.failure : ''} — stopping for the owner.`)
 await ensureStopped('baseline red')
 return { mode: MODE, builtFrds: [], blockedFrds: ['baseline'], blockedReasons: { baseline: 'error' }, note: 'baseline red (needs manual fix)' }
}
log('Baseline green — planning by FRD.')
const integratedChanges = []
const drainedThisRun = new Set()
async function gateChangeWorkOrders(affectedFrds, phaseTitle) {
 agentSpawned += COST(P.judge)
 const gate = await agent(
  `You are a FRESH, INDEPENDENT reviewer running the Pandacorp DR-100 readiness gate — the SAME evidence contract /pandacorp:architecture's step 9/9b/9b2 requires before a blueprint/work-order may leave \`status: DRAFT\` (see plugin/skills/architecture/SKILL.md). You did NOT write these documents; grade them as an outside reviewer would, fail-closed.

For EACH of these FRD folders: ${affectedFrds.join(', ')}
1. Read its frd.md, blueprint.md and every work-orders/wo-*.md whose frontmatter is \`status: DRAFT\` (a WO already \`status: ACTIVE\` from a prior gate is NOT yours to re-grade — leave it untouched).
2. READINESS (mirrors architecture step 9): every REQ/AC this change touches maps to a component; the new/updated DRAFT work order(s) are each covered unambiguously; the data model has no \`TBD\`; \`dependsOn\`/intra-FRD deps are acyclic and complete; each DRAFT WO's \`artifacts:\` globs don't overlap a SIBLING work order's; no \`[NEEDS CLARIFICATION]\` survives anywhere this change touched; if a DRAFT WO is backend and materializes an API contract, its \`docs/api/<wo-id>.md\` ownership is clear.
3. GROUNDING (mirrors architecture step 9b): every file path, import and API each DRAFT WO's spec references actually exists (or is genuinely new and declared as such) — no invented symbol/path.
4. CONSISTENCY (mirrors architecture step 9b-consistency): the new/updated content does not contradict an EXISTING ACTIVE/VERIFIED FRD, blueprint or ADR elsewhere in the project.
5. If ALL THREE pass for this FRD's DRAFT work order(s): stamp evidence and flip status, in ONE commit per FRD (Conventional Commits, scope = the FRD slug):
   - Every DRAFT work-orders/wo-*.md you gated → frontmatter \`status: DRAFT\` → \`status: ACTIVE\`.
   - Its blueprint.md: if its frontmatter is STILL \`status: DRAFT\` (a brand-new FRD this change created), flip \`status: DRAFT\` → \`status: ACTIVE\` and ADD \`readiness_gate: passed <today YYYY-MM-DD>\`, \`grounding_gate: passed <today YYYY-MM-DD>\`, \`consistency_gate: passed <today YYYY-MM-DD>\`. If the blueprint is ALREADY \`status: ACTIVE\` (a change that only added a WO to an existing gated FRD), leave its status/stamps exactly as they are — only the new WO's own \`status:\` flips.
   Return { frd, gated: true } for this FRD.
6. If ANY of the three checks fails: change NOTHING for this FRD (every DRAFT WO and the blueprint stay exactly as they are — DRAFT stays DRAFT, never built), and return { frd, gated: false, failure: '<what failed and what the owner/architect must fix>' }.
Return { results: [{ frd, gated, failure? }, ...] } — one entry per FRD folder listed above, in the same order.${NOTIFY('Verificando el readiness gate (DR-100) de la change')}`,
  { label: `gate-change-wos:${affectedFrds.join('+')}`, phase: phaseTitle, model: P.judge, agentType: 'pandacorp:architect', schema: CHANGE_GATE_SCHEMA },
 )
 if (!gate || !Array.isArray(gate.results)) {
  return { gatedFrds: [], failures: affectedFrds.map((frd) => ({ frd, failure: 'gate-change-wos returned no verdict (dead/garbled agent) — treating as NOT gated' })) }
 }
 const gatedFrds = gate.results.filter((r) => r && r.gated === true).map((r) => r.frd)
 const failures = affectedFrds.filter((frd) => !gatedFrds.includes(frd)).map((frd) => {
  const r = gate.results.find((x) => x && x.frd === frd)
  return { frd, failure: (r && r.failure) || 'gate-change-wos did not report this FRD as gated' }
 })
 return { gatedFrds, failures }
}
async function processChange(slug, phaseTitle) {
 agentSpawned += COST(P.judge)
 const proc = await agent(
  `You are integrating a specific pending change into the build (DR-069).

1. Find the change file .pandacorp/inbox/changes/${slug}.md — the exact filename, the extension is always .md. If the file does not exist, list .pandacorp/inbox/changes/*.md and return { done: false, affectedFrds: [], failure: "no existe .pandacorp/inbox/changes/${slug}.md — archivos disponibles: <list>" }.
2. Read its frontmatter. If status is "draft", return { done: false, affectedFrds: [], failure: "la change está en borrador — márcala ready primero" }. If status is "needs-owner" or "structural", return { done: false, affectedFrds: [], failure: "esta change requiere decisión del owner antes de construirla" }. Only proceed if status is "ready".
3. Read its type and full description.
4. Route by type:
   - type "bug" or "regression" → TDD fix: write a RED regression test (fails without the fix, passes with it); implement the minimum production-code fix; never weaken or skip tests. Create a WO in the affected FRD (or create a minimal FRD if none exists) and set it IN_REVIEW.
   - type "feature" | "change" | "improvement" | "chore" → minimum FRD scope: does this fit an existing FRD? Add a WO to it with implementation_status: PLANNED. Is it genuinely new? Create a minimal new FRD folder (docs/frds/frd-NN-<slug>/) with frd.md + blueprint.md + at least one work-orders/wo-NN-001-*.md with implementation_status: PLANNED. Follow the same FRD/WO structure as existing ones in docs/frds/.
5. Mark the change IN-FLIGHT so it is (a) not re-drained by a later safe point and (b) archivable ACROSS runs: set its frontmatter \`status: building\` and \`affected_frds: [the FRD folders you created/updated above]\`. Do NOT archive it and do NOT set it done — the ENGINE moves it to done/ once ALL its \`affected_frds\` are VERIFIED, reading that from the FRD rollups on disk at close-out (DR-069 §7). This durable stamp is what lets a change whose FRDs finish verifying on a LATER run still get archived (WS-A/D1 — the old in-session ledger silently lost those). Commit this frontmatter edit.
6. Return { done: true, affectedFrds: ['frd-XX-slug', ...], changeFile: '<the matched filename>' }.${NOTIFY('Procesando change ' + slug)}`,
  { label: `process-change:${slug}`, phase: phaseTitle, model: P.judge, agentType: 'pandacorp:implementer', schema: PROCESS_CHANGE_SCHEMA },
 )
 if (proc && proc.done === true && proc.affectedFrds && proc.affectedFrds.length) {
  const { gatedFrds, failures } = await gateChangeWorkOrders(proc.affectedFrds, phaseTitle)
  for (const f of failures) log(`⊘ ${f.frd}: work order(s) from change '${proc.changeFile || slug}' did NOT pass the DR-100 readiness/grounding/consistency gate — left DRAFT, NOT built this run (needs-owner)${f.failure ? ': ' + f.failure : ''}.`)
  proc.affectedFrds = gatedFrds
  if (gatedFrds.length) integratedChanges.push({ file: proc.changeFile || `${slug}.md`, frds: gatedFrds })
 }
 return proc
}
if (CHANGE) {
 phase('Process Change')
 const proc = await preLoopGuarded(() => processChange(CHANGE, 'Process Change'))
 if (proc === PAUSED) return await pausedExit()
 if (!proc || !proc.done || !proc.affectedFrds || !proc.affectedFrds.length) {
  log(`⊘ No se pudo procesar la change '${CHANGE}': ${proc?.failure || 'no se encontró o no tiene FRDs afectados'}.`)
  await ensureStopped('change not processed')
  return { mode: MODE, builtFrds: [], blockedFrds: [], note: `change '${CHANGE}' no procesada: ${proc?.failure || 'sin FRDs'}` }
 }
 ONLY = proc.affectedFrds
 log(`Change '${proc.changeFile || CHANGE}' procesada — FRDs afectados: ${ONLY.join(', ')}`)
}
const greenfieldEvent = (facts) =>
 ` FIRST, record the engine's greenfield baseline decision — your ONLY write, fire-and-forget, ONE Bash call: printf '{"event":"baseline_greenfield","at":"%s","project":"%s","workOrders":${facts.workOrders}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson; printf '{"kind":"baseline_greenfield","workOrders":${facts.workOrders},"at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${TRACK_PATH}.\n`
async function runPlanner(label) {
 agentSpawned += COST(P.judge)
 return await agent(
  `${label === 'plan' && baselineGreenfield ? greenfieldEvent(baselineGreenfield) : ''}You are the Pandacorp build planner. Read state WITHOUT modifying anything:
  - WALK every FRD module docs/frds/*/. For each, read frd.md and blueprint.md's **Build Plan** (WO order, intra-FRD deps, parallelism, cross-FRD deps) in full, and the **frontmatter ONLY** of every work-orders/wo-*.md (the \`implementation_status\`, \`id\`, deps, title, **\`difficulty\`** (low|medium|high, default medium), **\`reopen_count\`** (number, default 0) and **the LITERAL \`status:\` field** (DRAFT|ACTIVE — DR-100's gating field, distinct from \`implementation_status\`; absent when the WO predates this field) — NOT the full WO body; the implementer reads the body when it builds its own WO, so planning stays fast and cheap).
  - For each work order, the **frontmatter \`implementation_status\` is the source of truth**: PLANNED/IN_PROGRESS = pending; IN_REVIEW = built, awaiting its FRD gate; VERIFIED = done (NEVER rebuild); BLOCKED = skip.
  - **DR-100 gating (BL-0171 defense-in-depth):** a WO whose LITERAL \`status:\` frontmatter reads \`DRAFT\` never passed the readiness/grounding/consistency gate (/pandacorp:architecture step 9b2) — report it via \`docStatus\` below EXACTLY as it reads on disk; the engine itself refuses to schedule it. Do not silently promote or omit it.
  - docs/product/architecture.md → the platform stack.
  - **FOUNDATION (DR-057, web only): read docs/design/components.md** (the shared-component inventory) and skim every FRD's \`mocks/\`/\`fdd.md\` to grasp the COMPLETE set of shared primitives the surfaces reference. The foundation work orders must build the UNION of those primitives — not a hand-picked subset (the gap that shipped flat Party surfaces: Room/AgentSprite/etc. were never in the foundation). Mark \`foundation: true\` on EVERY WO that builds a shared primitive the inventory lists, so the engine builds them all before surfaces fan out.
  Return the FRDs that still have non-VERIFIED work orders, **in cross-FRD dependency order** (from the Build Plans). For each FRD: its \`frd\` folder, its \`deps\` (FRD folders that must be VERIFIED first), and its \`workOrders\` (each with id, frontmatter \`status\`, **\`docStatus\` (the LITERAL \`status:\` frontmatter field, DRAFT|ACTIVE — DR-100/BL-0171; omit when the WO has no \`status:\` line at all)**, **\`path\` (the WO file's repo-relative path — DR-108, the builder opens THE file instead of hunting)**, **\`acText\` (DR-108 CONTEXT PACK — copy VERBATIM from frd.md the EARS acceptance-criteria lines THIS work order owns per the Build Plan; bounded to its own ACs, never the whole FRD. You are the ONLY agent that reads frd.md in full — this hand-off is what lets each builder construct against the real AC scope on the FIRST attempt instead of a one-line summary)**, intra-FRD \`deps\`, one-line \`summary\`, **\`difficulty\` (low|medium|high — COPY it from the WO's \`difficulty:\` frontmatter; default \`medium\` when absent — DR-073: \`high\` builds on opus a-priori)**, **\`reopen_count\` (number — COPY it from the WO's \`reopen_count:\` frontmatter; default \`0\` when absent — DR-073: \`>=1\` builds on opus empirically)**, **its \`artifacts\` = the file/dir globs it writes, COPIED FROM the WO's \`artifacts:\` frontmatter — REQUIRED so the engine keeps parallel WOs disjoint (DR-060); if a WO has none in frontmatter, infer the files it will write from its title/summary**, and **\`foundation: true\` if this WO builds a shared design-system primitive / the inventory the other WOs reuse — DR-057, it must build before they fan out**, and **\`priorAttempts\` (A4 CROSS-PASS LEARNING) — if \`${JOURNAL_PATH}\` EXISTS, read it and, for EACH WO, synthesize a BOUNDED digest (the last 2 relevant entries) of what earlier attempts tried and why they did not hold: \`[{ attempt, classification, findingKey, tried, why }]\` drawn from that WO's attempt/verdict/diagnosis lines. Return \`[]\` (or omit) when the journal is absent or has no entries for the WO — it is fed to the builder as HYPOTHESES to verify against the CURRENT code, never as gospel**) **in the Build Plan's order**.${ONLY ? ' Limit to these FRD folders: ' + ONLY.join(', ') + '.' : ''}
  hasFrontend=true only if the stack is web (A).${ONLY ? ` TARGETED BUILD — also check cross-FRD deps of the requested FRDs: for each dep folder listed in their Build Plans, read the frontmatter \`implementation_status\` of every work-orders/wo-*.md in that dep. If ALL are VERIFIED the dep is satisfied; if ANY is not VERIFIED, include it in unsatisfiedDeps as { frd: '<requested-frd>', dep: '<the-dep-folder>' }. Return unsatisfiedDeps:[] when all deps are satisfied.` : ''}`,
  { label, phase: 'Plan', schema: PLAN_SCHEMA, model: P.judge, agentType: 'pandacorp:architect' },
 )
}
async function fastPlan() {
 const fp = fused && fused.plan
 if (!fp) agentSpawned++
 const r = fp ? { body: fp } : await runMechOp('plan', `--classify --compact${ONLY ? ONLY.map((f) => ` --frd ${shellQuote(f)}`).join('') : ''}`, { label: 'mech-plan', phase: 'Plan' })
 const b = r.body
 if (b && b.ok === true && b.status === 'planned' && Array.isArray(b.frds)) {
  for (const f of b.frds) { fastClassified.add(f.frd); if (f.floor !== false) fastFloor.add(f.frd) }
  log(`▶ fast lane: no plan agent — ${b.frds.length} FRD(s) in Build Plan order${fastFloor.size ? ` · floor (USABLE only when VERIFIED): ${[...fastFloor].join(', ')}` : ''} (proposal 39 C3/C4)`)
  return b
 }
 log(`↩ fast lane: the scripted Build Plan reader declined (${r.error || (b && (b.reason || b.error || b.status)) || 'no receipt'}) — running the plan agent`)
 return await runPlanner('plan')
}
phase('Plan')
let plan = await preLoopGuarded(() => (FAST ? fastPlan() : runPlanner('plan')))
if (plan === PAUSED) return await pausedExit()
if (!plan || !plan.frds) {
 log('planner returned no verdict — fail-loud (NOT treating a dead/garbled plan as "all verified")')
 await ensureStopped('planner failed')
 return { mode: MODE, builtFrds: [], blockedFrds: ['plan'], blockedReasons: { plan: 'error' }, note: 'planner failed' }
}
if (plan.frds.length === 0) {
 if (!TARGETED && DRAIN_ON_EMPTY_PLAN) {
  let drain
  try { drain = await drainReadyQueuePreLoop() } catch (e) { if (isInfraError(e)) return await pausedExit(); log('☠ pre-loop drain failed: ' + e.message); await ensureStopped('pre-loop drain failed'); throw e }
  if (drain.stop) {
   await ensureStopped('owner stop signal')
   return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'owner stop signal' }
  }
  if (drain.drained) {
   log('Cola de changes drenada antes del plan vacío (BL-0129) — replanificando con el trabajo recién creado.')
   plan = await preLoopGuarded(() => runPlanner('plan-post-drain'))
   if (plan === PAUSED) return await pausedExit()
   if (!plan || !plan.frds) {
    log('planner returned no verdict after the pre-loop drain — fail-loud (NOT treating a dead/garbled plan as "all verified")')
    await ensureStopped('planner failed')
    return { mode: MODE, builtFrds: [], blockedFrds: ['plan'], blockedReasons: { plan: 'error' }, note: 'planner failed' }
   }
  }
 }
 if (plan.frds.length === 0) {
  log('Nothing to build: every FRD is VERIFIED and the change queue is empty — cola vacía (BL-0129: checked, not skipped).')
  await ensureStopped('nothing to build')
  return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'all verified' }
 }
}
if (ONLY && plan.unsatisfiedDeps && plan.unsatisfiedDeps.length > 0) {
 const byFrd = {}
 for (const { frd, dep } of plan.unsatisfiedDeps) {
  if (!byFrd[frd]) byFrd[frd] = []
  byFrd[frd].push(dep)
 }
 const detail = Object.entries(byFrd).map(([f, deps]) => `${f} requiere: ${deps.join(', ')}`).join('; ')
 log(`⊘ Build parcial bloqueado — hay dependencias sin VERIFIED: ${detail}. Implementa primero esos FRDs (o corre /pandacorp:implement sin filtro para el orden automático).`)
 await ensureStopped('unsatisfied deps')
 return { mode: MODE, builtFrds: [], blockedFrds: ONLY, blockedReasons: Object.fromEntries(ONLY.map((f) => [f, 'needs-owner'])), note: `deps sin verificar — ${detail}` }
}
log(`${plan.frds.length} FRDs with pending work · stack ${plan.stack}${plan.hasFrontend ? ' (web)' : ''}`)
const designRef = (frd) => plan.hasFrontend
 ? ` VISUAL FIDELITY (DR-054/056, web — do NOT skip): OPEN this work order's \`## Visual reference\`, then read \`docs/frds/${frd}/fdd.md\` + its \`mocks/\` (the BINDING screen mock — view the screenshot AND the mock's source) and \`docs/design/design-tokens.json\` + root \`DESIGN.md\`. Your job is to TRANSLATE that one screen's mock into the project's components on the frozen tokens — reproduce its layout, structure, spacing, components and density; do NOT approximate, invent, or restyle. THEN run a SINGLE LIGHT in-loop fidelity check BEFORE marking IN_REVIEW (DR-072 — keep it cheap; the thorough pass is at the end): render the route ONCE (preview/Playwright), screenshot it next to the mock, and fix ONLY a GROSS structural divergence (wrong layout, a missing section) — do NOT iterate on nits (exact sizes/spacing/shades): the dedicated end-of-build Visual QA pass owns fine fidelity, so don't pay that loop twice. Aim for a RECOGNIZABLE, faithful match (right layout, structure, components, density), NOT pixel-perfection. The FRD gate blocks only a GROSS structural mismatch (a flat list where the mock is a rich layout, a missing section); small nits (exact sizes/spacing/shades) are swept later by the end-of-build Visual QA pass + the owner (DR-072) — so get it recognizably right and move on, don't burn cycles chasing the last pixel.`
 : ''
const reuseRef = (frd) => plan.hasFrontend
 ? ` REUSE & COHERENCE (DR-057): before creating ANY UI component, READ the component inventory \`docs/design/components.md\` (if it doesn't exist yet you're early in the build — create it and list your component as the first row) and scan \`src/components/core\` + \`src/components/modules\`. REUSE an existing component if one fits; ADAPT/extend it (add a prop/variant) if it is close — do NOT fork a near-duplicate for a small difference; CREATE a new shared component only if none fits, and when you do, APPEND it to \`docs/design/components.md\` so the next agent reuses it. A component that re-implements an existing pattern (a second banner/card/modal) is a defect the gate rejects.`
 : ''
let pendingSyncRollups = null
if (fused && fused.synced && fused.synced.ok === true) log(`✓ rollups synced by fast-start${fused.synced.commit ? ` (${fused.synced.commit})` : ''}`)
else if (MECH_LEAN) {
 pendingSyncRollups = SYNC_ROLLUPS + ' Stage only the rollup documents and .pandacorp/status.yaml changed by the command, then commit them together (Conventional Commits, scope).' + (MECH_SCRIPT ? '' : ' THEN, as a SEPARATE step (do not commit this part — see below):\n  ')
} else {
 agentSpawned++
 if ((await infraPausable(() => agent(SYNC_ROLLUPS + ' Stage only the rollup documents and .pandacorp/status.yaml changed by the command, then commit them together (Conventional Commits, scope).',
  { label: 'sync-rollups', phase: 'Plan', model: MECH, agentType: 'pandacorp:implementer' }))) === PAUSED) return await pausedExit()
}
function pickWorkerModel(wo) {
 if (P.worker === 'opus') return 'opus'
 if (wo.difficulty === 'high') return 'opus'
 if ((wo.reopen_count || 0) >= 1) return 'opus'
 return P.worker
}
let commitChain = Promise.resolve()
let lastCommitSha = null
const TRACK_AND_WO_COMMIT = (frd, woId) =>
 ` Also, in a SINGLE bash call (one heredoc covering both printfs, not two separate commands), append BOTH fire-and-forget lines: (1) to ${TRACK_PATH} — the durable timeline wo_end line: \`printf '{"kind":"wo_end","frd":"${frd}","wo":"${woId}","state":"in_review","at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${TRACK_PATH}\`; (2) to ~/.claude/dashboard-events.ndjson — the Party wo_commit event: \`printf '{"event":"wo_commit","at":"%s","project":"%s","frd":"${frd}","wo":"${woId}","state":"IN_REVIEW"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson\`.`
const commitWoFlags = (wo) => [`--wo ${shellQuote(wo.id)}`, ...(wo.artifacts || []).map((a) => `--file ${shellQuote(a)}`),
 ...(plan && plan.hasFrontend ? [`--extra ${shellQuote('docs/design/components.md')} --reason ${shellQuote('DR-057 shared component inventory')}`] : []),
 ...(P.split && plan && plan.hasFrontend ? [`--extra ${shellQuote(`docs/api/${wo.id}.md`)} --reason ${shellQuote('DR-060 per-WO API contract')}`] : [])].join(' ')
async function scriptedCommitWO(wo) {
 const r = await runMechOp('commit-wo', commitWoFlags(wo), { label: `commit:${wo.id}` })
 const b = r.body
 if (b && b.ok === true && (b.status === 'committed' || b.status === 'nothing')) return { committed: b.status === 'committed' ? 1 : 0, sha: b.sha }
 throw new Error(`commit-wo did not commit ${wo.id}: ${r.error || (b && `${b.status}: ${b.reason || b.error || ''}`) || 'no receipt'}`)
}
async function commitWOGreen(wo, frd, solo = false) {
 agentSpawned++
 const scripted = MECH_SCRIPT && solo && Array.isArray(wo.artifacts) && wo.artifacts.length > 0
 const link = commitChain.then(() => scripted ? scriptedCommitWO(wo) :
  agent(
   `You are the SOLE git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race), committing work order ${wo.id} now that its self-test is green and its frontmatter is IN_REVIEW.${TRACK_AND_WO_COMMIT(frd, wo.id)} Then make exactly ONE commit (Conventional Commits, with scope, the subject naming ${wo.id}) staging ONLY this work order's own files: its declared artifacts ${wo.artifacts && wo.artifacts.length ? '(' + wo.artifacts.join(' ') + ')' : "(use `git status -- .` (THIS project only, BL-0202) to identify THIS wo's files)"} AND its own work-order markdown under \`docs/frds/${frd}/work-orders/\` (the IN_REVIEW frontmatter + ## Status Note) AND \`.pandacorp/track.jsonl\` (the durable timeline lines for THIS wo — the wo_start the builder appended + the wo_end you just appended) AND \`.pandacorp/build-journal.jsonl\` if it changed (append-only, shared — like track.jsonl; sweeps any pending build-journal lines a retry builder appended). Sibling work orders of the same wave may be MID-BUILD — do NOT stage or touch their files; if \`git status -- .\` shows changes outside this WO's files (other than track.jsonl / build-journal.jsonl, which are append-only and shared), leave them untouched. Do NOT advance last_green_sha (that is the FRD gate's job — this WO is self-test-green, not yet review-verified). THEN return the sha of the commit you just made (\`git rev-parse --short HEAD\`). Return { committed: 1, sha: "<that short sha>" }.`,
   { label: `commit:${wo.id}`, phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: { type: 'object', required: ['committed'], properties: { committed: { type: 'number' }, sha: { type: 'string' } } } },
  ),
 )
 commitChain = link.catch(() => {})
 return link.then((r) => { if (r && r.sha && Number(r.committed) > 0) lastCommitSha = r.sha; if (infraHalt) acceptedWos.push(wo.id); return true }, (e) => { log(`commit failed for ${wo.id}: ${(e && e.message) || e}`); return false })
}
const priorAttemptsCtx = (wo) => (wo.priorAttempts && wo.priorAttempts.length)
 ? ` PRIOR ATTEMPTS ON THIS WORK ORDER (from the build-journal — they MAY be wrong; treat each as a HYPOTHESIS to verify, and re-diagnose against the CURRENT code, do NOT blindly repeat or trust them): ${wo.priorAttempts.map((a) => `[attempt ${a.attempt ?? '?'}: ${a.classification || 'point'}${a.findingKey ? ' · ' + a.findingKey : ''} · tried: ${a.tried || '?'} · why it didn't hold: ${a.why || '?'}]`).join(' ')}`
 : ''
const priorDiagnosisCtx = (wo) => wo._priorDiagnosis
 ? ` DIAGNOSIS FROM THE LAST FAILED PATCH (A3 — a hypothesis to VERIFY against the CURRENT code, not gospel): classification=${wo._priorDiagnosis.classification || 'point'}; seam=${wo._priorDiagnosis.seam ? ((wo._priorDiagnosis.seam.files || []).join(', ') + (wo._priorDiagnosis.seam.symbol ? ' @ ' + wo._priorDiagnosis.seam.symbol : '')) : 'n/a'}${wo._priorDiagnosis.seam && wo._priorDiagnosis.seam.why ? ' — ' + wo._priorDiagnosis.seam.why : ''}. Rebuild focusing on that seam; if the diagnosis does not match what you see, follow the code.` : ''
const woCtx = (wo, frd) =>
 `${wo.path ? ` Your work-order file: \`${wo.path}\` — open it and follow it in full.` : ''}${wo.acText ? ` The EARS acceptance criteria THIS work order must satisfy (verbatim from FRD ${frd} — the gate will assert exactly these):\n  ${wo.acText}\n ` : wo.acFile ? ` The EARS acceptance criteria THIS work order must satisfy are in \`${wo.acFile}\` (verbatim from FRD ${frd} — the gate will assert exactly these): read it first.` : ''}${priorAttemptsCtx(wo)}${priorDiagnosisCtx(wo)}`
const SELFTEST = (woId) => ` THEN run your fast SELECTIVE self-test (NOT the whole suite): \`pnpm biome check .\`, \`pnpm tsc --noEmit\`, and \`pnpm vitest run\` limited to THIS work order's own test files. If green: set the WO's frontmatter **\`implementation_status: IN_REVIEW\`** and fill its **\`## Status Note\`** hand-off (what it built; the interfaces/contracts exposed with signatures; the integration seams; **the implicit DECISIONS & ASSUMPTIONS you made — naming, data shapes, formats, units, error/empty conventions — so the consumer inherits them instead of re-deciding incompatibly**; which test files cover it). **Do NOT call git — the engine commits THIS work order the INSTANT your self-test passes, via a serialized single writer (Option B, DR-060), so there is no index.lock race.** Return green=true. If red after honest attempts, return green=false with the reason.`
const retryAttemptJournal = (wo, frd) => wo._isRetry
 ? JOURNAL(`"wo":"${wo.id}","frd":"${frd}","attempt":${(wo.reopen_count || 0) + 1},"reopen_count":${wo.reopen_count || 0},"rung":"retry","role":"builder","kind":"attempt","classification":"","seam":null,"findingKey":"","tried":"%s","verdict":"","why":"%s","confidence":"%s"`,
   ` "<one line: what you rebuilt/changed this retry>" "<one line: your approach vs the prior attempt>" "<low|medium|high: your confidence it now meets the AC>"`)
 : ''
async function buildWO(wo, frd, solo = false) {
 try { return await buildWOUnguarded(wo, frd, solo) } catch (e) {
  if (!isInfraError(e)) throw e
  log(`⏸ ${wo.id}: infrastructure failure, not a work-order failure (${e.message}) — parked, never repaired`)
  return { green: false, committed: false, infra: true }
 }
}
async function buildWOUnguarded(wo, frd, solo) {
 const woModel = pickWorkerModel(wo)
 if (woModel !== P.worker) log(`⤴ opus: ${wo.id} (${wo.difficulty === 'high' ? 'difficulty=high' : 'reopen=' + (wo.reopen_count || 0)})`)
 if (!wo._isRetry) buildCostByFrd.set(frd, (buildCostByFrd.get(frd) || 0) + woWaveCost(wo))
 let v
 if (P.split && plan.hasFrontend) {
  agentSpawned += 3 * COST(woModel) + 1
  await agent(`${EMIT('test-writer', wo.id, { frd, activity: 'test' })}${TRACK('wo_start', `,"frd":"${frd}","wo":"${wo.id}"`)} Write the acceptance tests (RED) for work order ${wo.id} from the EARS criteria of FRD ${frd}: ${wo.summary || ''}.${woCtx(wo, frd)} No production code.`,
   { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
  await agent(`${EMIT('backend-dev', wo.id, { frd, activity: 'backend' })}First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces). Then implement the backend of ${wo.id} (TDD until green): ${wo.summary || ''}.${woCtx(wo, frd)} Publish YOUR API contract at docs/api/${wo.id}.md (your own per-WO file — DR-060: never a shared docs/api.md, which races across parallel WOs). Do NOT call git — you never commit; the engine commits this work order (serialized single writer) when it greens (Option B).`,
   { label: `be:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:backend-dev' })
  await agent(`${EMIT('frontend-dev', wo.id, { frd, activity: 'frontend' })}Implement the UI of ${wo.id} using ONLY design tokens and the provider WO's contract at docs/api/<the-backend-WO-in-your-Dependencies>.md (DR-060: read that specific per-WO file, never a shared docs/api.md): ${wo.summary || ''}.${woCtx(wo, frd)}${designRef(frd)}${reuseRef(frd)} Do NOT call git — you never commit; the engine commits this work order when it greens (Option B).`,
   { label: `fe:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:frontend-dev' })
  v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'selftest' })}Close work order ${wo.id} (built by the split team this wave).${SELFTEST(wo.id)} These are file edits to THIS WO's own files only.${retryAttemptJournal(wo, frd)}`,
   { label: `selftest:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
 } else {
  agentSpawned += COST(woModel)
  v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'implement' })}${TRACK('wo_start', `,"frd":"${frd}","wo":"${wo.id}"`)} Fully implement work order ${wo.id} with TDD (RED→GREEN→refactor), anchored in the EARS criteria of FRD ${frd} and in bugs from .pandacorp/comms/progress.md: ${wo.summary || ''}.${woCtx(wo, frd)} This is a COARSE slice (a whole view/capability) — build it end-to-end. First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces) and integrate against those, not a guess. If \`.pandacorp/run/preserved-tests/${wo.id}/\` exists, RESTORE those test files into the tree first — they are proven coverage a previous revert preserved (DR-107): they are your RED baseline, make them pass.${designRef(frd)}${reuseRef(frd)}${SELFTEST(wo.id)}${retryAttemptJournal(wo, frd)}`,
   { label: `build:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
 }
 const green = Boolean(v && v.green === true)
 const committed = green ? await commitWOGreen(wo, frd, solo) : false
 return { green, committed }
}
const gateVerdictJournal = (frd, reviewIds, attemptNo) => JOURNAL(
 `"wo":"%s","frd":"${frd}","attempt":${attemptNo},"reopen_count":0,"rung":"gate","role":"reviewer","kind":"verdict","classification":"%s","seam":null,"findingKey":"%s","tried":"","verdict":"%s","why":"%s","confidence":"%s"`,
 ` "<the primary work order this verdict is about, else ${(reviewIds && reviewIds[0]) || frd}>" "<point|architectural|gate-test-defective|deadlocked-contract, or empty for a green/unclassified verdict>" "<\`<file>::<one-line claim>\` for a reopen/fail, else empty>" "<green if you set VERIFIED, else red>" "<one line why>" "<low|medium|high>"`)
async function frdGate(frd, reviewIds, workFrom, evidencePack) {
 const st = frdState.get(frd)
 const concurrent = typeof workFrom === 'string' && workFrom.length > 0
 const drift = concurrent ? { pin: (st && st.pinSha) || null, source: gateWorktreePathOf(frd) } : { pin: null, source: PROJECT_DIR }
 if (!concurrent && st && st.driftFinderPromise) { log(`◦ ${frd}: the drift-finder report was gathered in the gate worktree, but this gate runs on the main tree — running without it (BL-0203)`); st.driftFinderPromise = null; st.driftFinding = null }
 const priorAttempts = (st && st.gateAttempts) || 0
 const attemptNo = priorAttempts + 1
 if (st) st.gateAttempts = attemptNo
 const reviewedWos = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
 const anyReopened = reviewedWos.some((w) => (w.reopen_count || 0) >= 1)
 const useSplit = P.reviewSplit && (priorAttempts >= 1 || anyReopened)
 if (st && GATE_INVENTORY_CACHE) st.inventoryCache = await resolveInventoryCache(frd, drift.pin)
 try {
  if (useSplit) {
   const remaining = MAX_AGENTS ? MAX_AGENTS - agentSpawned : Infinity
   if (remaining >= splitGateEstimatedCost()) {
    const split = await frdGateSplit(frd, reviewIds, attemptNo, workFrom, evidencePack)
    if (!split || !split.__splitFailed) return enforceInventoryCoverage(frd, await finalizeGate(frd, reviewIds, split, drift.pin, drift.source))
   } else {
    log(`↩ ${frd}: reviewSplit on but the split's estimated cost (${splitGateEstimatedCost()}) exceeds the remaining agent budget (${remaining}) — using the serial gate instead (contract 5)`)
   }
  } else if (P.reviewSplit) {
   log(`▹ ${frd}: first gate attempt this run — running SERIAL (split kicks in on a re-gate or a prior-reopened WO, C1a)`)
  }
  return enforceInventoryCoverage(frd, await finalizeGate(frd, reviewIds, await frdGateSerial(frd, reviewIds, attemptNo, workFrom, evidencePack), drift.pin, drift.source))
 } finally {
  if (st) st.inventoryCache = null
  if (st) { st.driftFinderPromise = null; st.driftFinding = null }
 }
}
const GATE_PASS_RETURN = ` **If CORRECTION passes (visual nits, if any, APPEND to the punch-list at the MAIN tree \`${PROJECT_DIR}/.pandacorp/comms/visual-punch-list.md\` — absolute path, they do NOT block):** you are a REVIEW-ONLY gate — do NOT set any work order VERIFIED, do NOT reset reopen_count, do NOT recompute the FRD rollup, do NOT edit .pandacorp/status.yaml, do NOT advance last_green_sha, and do NOT \`git commit\` (you may be running in a FROZEN worktree; a separate serialized apply step on the MAIN tree performs every one of those writes). Just make sure the adversarial test files you wrote this cycle are SAVED in your working tree, and return { green: true, testFiles: [the repo-relative path of EACH new or changed test file you wrote this gate] } so the apply step can port them to the main tree.`
const EVIDENCE_MARKER = 'YOUR EVIDENCE IS ALREADY COLLECTED'
const EVIDENCE_READ_BUDGET = 8
const EVIDENCE_DIFF_MAX_LINES = 1500
function validateEvidence(pack) {
 if (!pack || typeof pack !== 'object') return { evidence: null, fallbackReason: 'collector returned no verdict' }
 if (typeof pack.report !== 'string' || !pack.report.trim()) return { evidence: null, fallbackReason: pack.reason ? String(pack.reason) : 'gate-report.json missing from the pack' }
 let parsed
 try { parsed = JSON.parse(pack.report) } catch { return { evidence: null, fallbackReason: 'gate-report.json is not valid JSON' } }
 if (!parsed || typeof parsed !== 'object' || typeof parsed.green !== 'boolean') return { evidence: null, fallbackReason: 'gate-report.json has no boolean green' }
 if (pack.report_suspect === true) return { evidence: null, fallbackReason: 'collector flagged report_suspect (3+ cheap sub-gates red on environment noise, e.g. an unbootstrapped worktree) — discarding the pack rather than risk it being read as authoritative' }
 const tests = Array.isArray(pack.tests) ? pack.tests.filter((t) => typeof t === 'string' && t.trim()) : []
 return { evidence: { ...pack, tests, reportCompact: JSON.stringify(parsed) }, fallbackReason: '' }
}
function reviewedArtifacts(frd, reviewIds) {
 const st = frdState.get(frd)
 const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
 return [...new Set(reviewed.flatMap((w) => w.artifacts || []).filter(Boolean))]
}
function reviewedAcText(frd, reviewIds) {
 const st = frdState.get(frd)
 const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
 return reviewed.filter((w) => w.acText).map((w) => `[${w.id}] ${w.acText}`).join('\n  ')
}
const gateSealedReportPath = (frd) => `${gateWorktreePathOf(frd)}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix).pandacorp/run/gate-report.${frd}.sealed.json`
async function collectGateEvidence(frd, reviewIds, pinSha) {
 const artifacts = reviewedArtifacts(frd, reviewIds)
 const acText = reviewedAcText(frd, reviewIds)
 const scope = artifacts.length ? ` -- ${artifacts.map(shellQuote).join(' ')}` : ''
 const scopeNote = artifacts.length
  ? "the pathspecs are the reviewed work orders' declared artifacts, relative to THIS project directory"
  : 'the reviewed work orders declare no artifacts — do NOT scope by path; take the whole project diff and let the line cap clip it'
 const wt = gateWorktreePathOf(frd)
 const slotRun = `${wt}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix).pandacorp/run`
 agentSpawned++
 return await agent(`WP-06 GATE EVIDENCE COLLECTOR for ${frd}. You are NOT the reviewer: you judge NOTHING, you fix NOTHING, you decide NOTHING. Your entire job is to run the commands below in this frozen worktree and return their output VERBATIM, so the reviewer that runs after you does not have to re-derive it. **Write no file, edit no frontmatter, run no mutating git command, never \`git commit\`, never touch the main tree.**
  0) **SANITY GATE (BL-0149) — confirm this worktree is actually bootstrapped BEFORE you touch verify.sh.** From the project directory (the cd above), run exactly \`node -e "process.stdout.write(require('node:fs').existsSync('node_modules/.bin/vitest') ? 'BOOTSTRAPPED' : 'NOT-BOOTSTRAPPED')"\` — NEVER shell \`test\`/\`[\`, which an owner alias can hijack (BL-0187). If it prints NOT-BOOTSTRAPPED, \`.pandacorp/worktree-bootstrap.sh\` never ran here (or it failed): do NOT run verify.sh, do NOT attempt steps 1-4 below, and return IMMEDIATELY \`{ report: null, reason: "gate-worktree-not-bootstrapped" }\`. A gate report produced without node_modules is command-not-found noise dressed up as evidence — worse than no report at all, because a reviewer would read it as authoritative.
  1) Read \`last_green_sha\` from .pandacorp/status.yaml (call it PIN_BASE) and run the gate script exactly once (that argument ORDER is required — \`--since\` is positional). **Run it as ONE Bash call, in the FOREGROUND, with the Bash tool's \`timeout: 600000\` (the run takes minutes; the 120 s default would push it to the background) — NEVER \`run_in_background\`, never \`&\`, NEVER a polling/\`until\`/\`sleep\` loop. The command, verbatim except PIN_BASE:** \`${gateProjectCd(wt)} && { mkdir -p "${slotRun}"; REPORT="${slotRun}/gate-report.json"; LOG="${slotRun}/evidence-verify.log"; rm -f "$REPORT"; perl -e 'alarm shift; exec @ARGV' 540 bash .pandacorp/verify.sh --since <PIN_BASE> --report-all > "$LOG" 2>&1; echo "verify exit=$?"; ${SEAL_REPORT_CLI_COMMAND} seal --file "$REPORT" --frd ${frd} --pin ${pinSha} --out "${gateSealedReportPath(frd)}"; }\` — REPORT is THIS gate worktree's own report, an absolute path inside it (for a nested project such as Mission Control it resolves to \`<this worktree>/mission-control/.pandacorp/run/gate-report.json\`); NEVER read the main project tree's copy of that file, it belongs to a different run. The perl alarm is the hard bound (540 s): exit 142 means it timed out, and the report is then missing. A non-zero exit is FINE and expected otherwise — it is data, not a problem for you to fix. The LAST line that command printed is the report, SEALED by a script (\`{"ok":true,"version":2,"kind":"gate-report",…,"sum":"<14 hex>"}\`, ASCII, one line): return that line **byte-for-byte** in \`report\` — never pretty-print it, never re-indent it, never shorten it, never drop or reorder a key or a \`failures[]\` row however many there are. The engine recomputes the checksum over exactly what you return, and a copy that differs by ONE character is discarded (BL-0214). If that last line is \`{"ok":false,…}\` (the file was missing or unreadable), return it as \`report\` anyway — the engine detects it and falls back.
  1b) **SANITY CHECK (BL-0149) on what step 1 just produced.** Look at the sub-gates in that report. If **3 or more** of the cheap sub-gates (biome/tsc/knip/madge and similar) are RED with an ENVIRONMENT-only message (\`command not found\`, \`Cannot find module\`, \`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL\`, or equivalent "the tool itself could not run" text — never an actual lint/type finding), set \`report_suspect: true\`: this is a broken worktree, not a real verdict, and a reviewer must never mistake environment noise for a finding. Otherwise set \`report_suspect: false\`.
  2) \`git diff --relative <PIN_BASE>..${pinSha} --stat\` → return it verbatim in \`diffStat\`. \`--relative\` is REQUIRED (BL-0187): it keeps the stat to THIS project — without it a nested project's stat lists every file the enclosing repo changed.
  3) \`git diff --relative <PIN_BASE>..${pinSha}${scope}\` → return it in \`diff\` (${scopeNote}). **Hard cap ${EVIDENCE_DIFF_MAX_LINES} lines.** If the full patch is longer, do NOT silently cut it: include the largest files first, clip each at a hunk boundary, add a \`… <N> lines clipped from <path>\` marker where you clipped, and set \`truncated: true\`. Under the cap → the complete patch and \`truncated: false\`.
  3b) \`tests\`: the test files this cycle ADDED or CHANGED — the output lines of \`git diff --relative --name-only --diff-filter=AMR <PIN_BASE>..${pinSha} | grep -E '(^|/)(__tests__|_tests|tests?|e2e)/|\\.(test|spec)\\.[cm]?[jt]sx?$' || true\`, one path per array item, verbatim ([] when it prints nothing).
  4) \`ac\`: this FRD's EARS acceptance criteria, VERBATIM. The build plan already extracted the criteria these work orders own — each line is prefixed with the \`[WO id]\` that owns it; start from exactly this text and return it unchanged${acText ? `:\n  ${acText}\n  ` : ` (the plan threaded none, so read docs/frds/${frd}/frd.md and copy its acceptance criteria verbatim). `}Only ADD to it: if docs/frds/${frd}/frd.md carries numbered acceptance criteria this list is missing, append those verbatim too, each prefixed \`[not owned by a reviewed work order]\`. Never paraphrase, never renumber, never drop one.
  Return { report, diffStat, diff, truncated, tests, ac, report_suspect } — or, if step 0 refused, just { report: null, reason }.`,
  { label: `evidence:${frd}`, phase: 'Review', model: MECH, effort: MECH_EFFORT, agentType: MECH_AGENT('pandacorp:implementer'), schema: EVIDENCE_SCHEMA, workFrom: worktreeWorkFrom(pinSha, gateWorktreePathOf(frd)) })
}
function launchEvidence(frd) {
 if (GATE_EVIDENCE !== 'digested') return
 if (PARALLEL_GATES) return
 const st = frdState.get(frd)
 if (!st || st.evidencePromise) return
 const pinSha = st.pinSha
 if (!pinSha) return
 const work = gateWorktreeChain.then(async () => {
  const ok = await ensureGateWorktree(pinSha)
  if (!ok) return null
  const finder = startDriftFinder(frd, st.reviewIds, pinSha, worktreeWorkFrom(pinSha))
  try { return await collectGateEvidence(frd, st.reviewIds, pinSha) }
  finally { if (finder) await finder }
 }).then((r) => r, () => null)
 gateWorktreeChain = work.then(() => {}, () => {})
 st.evidencePromise = work
}
async function resolveGateEvidence(frd, reviewIds, pinSha) {
 if (GATE_EVIDENCE !== 'digested') return null
 const st = frdState.get(frd)
 let raw = null
 try { raw = (st && st.evidencePromise) ? await st.evidencePromise : await collectGateEvidence(frd, reviewIds, pinSha) }
 catch (e) { log(`⚠ GateEvidenceFallback ${frd}: the evidence collector threw (${(e && e.message) || e}) — this gate runs in EXPLORE mode`); return { evidence: null, fallbackReason: 'collector threw' } }
 const verdict = validateEvidence(await verifyEvidenceSeal(frd, raw, pinSha))
 if (!verdict.evidence) log(`⚠ GateEvidenceFallback ${frd}: ${verdict.fallbackReason} — this gate runs in EXPLORE mode (the gate is never skipped and never runs blind)`)
 return verdict
}
const EVIDENCE_REREADS = 2
function readSealedReport(text, frd, pinSha) {
 const line = String(text || '').trim().split('\n').pop()
 let j = null
 try { j = JSON.parse(line) } catch { return { error: 'the collector report is not valid JSON', transport: true } }
 if (j && typeof j === 'object' && j.ok === false && typeof j.error === 'string') return { error: `the collector could not seal gate-report.json: ${j.error.replace(/[^\w .,:;/()-]/g, ' ').slice(0, 120)}` }
 if (!j || typeof j !== 'object' || j.kind !== 'gate-report' || !driftSealHolds(line)) return { error: 'the collector report failed its integrity seal (the relay altered it, or it was never sealed)', transport: true }
 if (j.frd !== frd || String(j.pin) !== String(pinSha)) return { error: `the sealed report belongs to ${String(j.frd).slice(0, 40)} at ${String(j.pin).slice(0, 12)}, not to ${frd} at ${String(pinSha).slice(0, 12)}` }
 if (!j.report || typeof j.report !== 'object') return { error: 'the sealed report carries no report object' }
 return { report: JSON.stringify(j.report) }
}
async function verifyEvidenceSeal(frd, raw, pinSha) {
 if (!raw || typeof raw !== 'object' || typeof raw.report !== 'string' || !raw.report.trim()) return raw
 let read = readSealedReport(raw.report, frd, pinSha)
 for (let i = 1; !read.report && read.transport && i <= EVIDENCE_REREADS; i++) {
  log(`⚠ EvidenceRelay ${frd}: ${read.error} — re-reading the stored sealed report, attempt ${i}/${EVIDENCE_REREADS} (BL-0214: a model's copy of machine JSON is never trusted)`)
  agentSpawned++
  let again = null
  try {
   again = await agent(`MECHANICAL COMMAND RUNNER — BL-0214 evidence re-read for ${frd}. Your SOLE action is to execute this exact command ONCE (no command before or after it) and return its stdout VERBATIM as \`output\`: \`${SEAL_REPORT_CLI_COMMAND} reread --file "${gateSealedReportPath(frd)}"\`. It only prints a line the collector stored earlier, so it is instant. Do not inspect, edit, fix, summarize, re-format or re-indent its output: it is ONE sealed JSON line and the engine verifies its checksum character by character.`,
    { label: `evidence-reread:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) { log(`⚠ ${frd}: the evidence re-read runner threw (${(e && e.message) || e})`) }
  again = unwrapAnswer(again, 'output')
  read = readSealedReport(again && typeof again.output === 'string' ? again.output : '', frd, pinSha)
 }
 if (!read.report) return { report: null, reason: `${read.error}${read.transport ? ` after ${EVIDENCE_REREADS} re-read(s)` : ''}` }
 return { ...raw, report: read.report }
}
const DRIFT_FINDER_TOOL_BUDGET = 60
const FINDER_PROBE_RE = /\.finder\.drift-probe\.tsx?$/
const DRIFT_FINDER_STATUSES = ['implemented', 'drift', 'unknown']
const DRIFT_FINDER_SCHEMA = {
 type: 'object', required: ['contracts', 'pinDir', 'headSha'],
 properties: {
  pinDir: { type: 'string', description: 'BL-0205: the absolute project directory inside the pinned worktree, as `pwd -P` printed it on your FIRST call' },
  headSha: { type: 'string', description: 'BL-0205: `git rev-parse HEAD` as printed on your FIRST call, run inside pinDir — it must be the pinned commit' },
  headShaEnd: { type: 'string', description: 'BL-0205: the same HEAD check on your LAST call, run inside pinDir' },
  contracts: { type: 'array', description: 'ONE entry per normative contract of the FRD — none dropped, none merged into a range', items: {
   type: 'object', required: ['contract', 'status'],
   properties: {
    contract: { type: 'string', description: 'the contract id first, then its text, e.g. "REQ-03-001 — architecture projects SHALL NOT appear"' },
    contractClass: { type: 'string', enum: REQUIRED_TRACE_CLASSES },
    owner: { type: 'string', description: 'the work-order id whose source_requirements lists this contract, or "none"' },
    status: { type: 'string', enum: DRIFT_FINDER_STATUSES },
    evidence: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, snippet: { type: 'string' } } },
    claim: { type: 'string', enum: ['preexisting', 'cycle'] },
    probe_test: { type: 'string', description: 'drift only: .pandacorp/run/drift-probes/<frd>/<contract-id-slug>.finder.drift-probe.ts' },
    direction: { type: 'string', enum: ['code', 'spec', 'unknown'] },
    why: { type: 'string' },
   },
  } },
  toolCalls: { type: 'number', description: 'your own count of your tool calls — telemetry only, never used to decide anything (it undercounts the billed calls)' },
  budgetExhausted: { type: 'boolean', description: 'true iff you stopped because the tool budget ran out — telemetry only, never used to decide anything' },
 },
}
const frdRoster = (frd) => {
 const st = frdState.get(frd)
 const wos = st ? st.f.workOrders : []
 return wos.map((w) => `${w.id} · ${w.status || 'unknown'} · ${w.path || `docs/frds/${frd}/work-orders/${w.id}.md`}`).join('\n  ')
}
function startDriftFinder(frd, reviewIds, pinSha, workFrom, wt = GATE_WORKTREE) {
 if (!DRIFT_FINDER) return null
 const st = frdState.get(frd)
 if (!st) return null
 if (st.driftFinderPromise) return st.driftFinderPromise
 const acText = reviewedAcText(frd, reviewIds)
 st.driftFinderPin = { sha: String(pinSha || ''), wt }
 agentSpawned += COST('sonnet')
 st.driftFinderPromise = agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'find-drift' })}FRD gate — the WHOLE-FRD DRIFT FINDER for ${frd} (BL-0203, canary F2). You run BESIDE this FRD's gate, in its pinned worktree, while another agent runs the gate script here; the opus reviewer that judges this FRD reads your report. You are NOT the judge (DR-015): everything you return is a proposal the judge weighs and the engine proves (DR-122).
  ${DRIFT_FINDER_DIRECTIVE}
  **THIS FRD:** \`docs/frds/${frd}/frd.md\` and \`docs/frds/${frd}/blueprint.md\` at this pin — inventory EVERY contract in them. Its work orders (id · status · path) — read each one's frontmatter \`source_requirements\` (ownership) and its \`## Status Note\` (the tests it declares as evidence):
  ${frdRoster(frd) || '(the plan carried no work-order list — find them under docs/frds/' + frd + '/work-orders/)'}
  **THE WORK ORDERS UNDER REVIEW THIS CYCLE:** ${reviewIds.join(', ')} — a contract one of them owns is a \`cycle\` contract; every other contract is \`preexisting\`, and those are where the judge cannot look: do them FIRST.${acText ? `\n  The planner's verbatim criteria of those work orders (a head start, not the inventory): \n  ${acText}` : ''}
  **DECLARED EVIDENCE, if cached:** \`${PROJECT_DIR}/.pandacorp/run/gate-evidence/${frd}/inventory.json\` (MAIN tree, read-only, may be absent or stale — frd.md at this pin is the authority) lists the evidence tests of the last green gate per contract.
  **THE PIN (BL-0205 — read this twice).** Pinned worktree: \`${wt}\`. Pinned commit: \`${pinSha}\`. Your Bash tool starts EVERY call in the launching session's directory (the MAIN checkout, NOT this commit): a \`cd\` does not carry to your next call. Your FIRST call, exactly: \`PIN_DIR="${wt}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix)"; cd "$PIN_DIR" && pwd -P && git rev-parse HEAD\`. It prints the absolute project directory inside the pin (from here on \`<pinDir>\`) and its HEAD, which MUST start with \`${pinSha}\` — if it does not, STOP and return \`contracts: []\` with what you saw. Then begin EVERY Bash command with the literal printed directory (\`cd "<pinDir>" && …\`, or \`git -C "<pinDir>" …\`), each probe-writing heredoc included, and give Read/Grep/Glob absolute paths under \`<pinDir>\`. Your LAST call: \`cd "<pinDir>" && git rev-parse HEAD\`. Return \`pinDir\`, \`headSha\` (first call), \`headShaEnd\` (last call); the engine DISCARDS your whole report when a reported HEAD is not the pin.
  **PROBES:** write each drift probe at \`.pandacorp/run/drift-probes/${frd}/<contract-id-slug>.finder.drift-probe.ts\`, relative to this project directory inside the worktree (i.e. \`<pinDir>/.pandacorp/run/drift-probes/…\`).
  **TOOL BUDGET: at most ${DRIFT_FINDER_TOOL_BUDGET} tool calls** — count them (the two HEAD checks included); report your count in \`toolCalls\` (telemetry only: the engine decides nothing from it).
  Return { pinDir, headSha, headShaEnd, contracts: [{ contract, contractClass, owner, status: implemented|drift|unknown, evidence: { file, line, snippet }, claim: preexisting|cycle, probe_test (drift only), direction (drift only: code|spec|unknown), why }], toolCalls, budgetExhausted }.`,
  { label: `find:drift:${frd}`, phase: 'Review', model: 'sonnet', effort: 'medium', agentType: 'pandacorp:drift-finder', fallbackAgentType: 'pandacorp:reviewer', schema: DRIFT_FINDER_SCHEMA, workFrom })
  .then((r) => r, (e) => ({ __threw: (e && e.message) || String(e) }))
 return st.driftFinderPromise
}
function finderWrongTree(raw, pin) {
 const want = String(pin.sha || '').trim().toLowerCase()
 if (!want) return ''
 const same = (x) => { const v = String(x || '').trim().toLowerCase(); return v.length >= 7 && (want.startsWith(v) || v.startsWith(want)) }
 if (typeof raw.headSha !== 'string' || !raw.headSha.trim()) return `the finder reported no HEAD sha, so the tree it audited cannot be shown to be the gate pin ${want.slice(0, 8)} (BL-0205)`
 if (!same(raw.headSha)) return `WRONG TREE: the finder's first HEAD check reported ${raw.headSha.trim().slice(0, 12)}, not the gate pin ${want.slice(0, 8)} — it audited another checkout (BL-0205)`
 if (raw.headShaEnd !== undefined && raw.headShaEnd !== null && !same(raw.headShaEnd)) return `WRONG TREE: the finder's last HEAD check reported ${String(raw.headShaEnd).trim().slice(0, 12)}, not the gate pin ${want.slice(0, 8)} — it drifted to another checkout mid-run (BL-0205)`
 const dir = typeof raw.pinDir === 'string' ? raw.pinDir.trim().replace(/\/+$/, '') : ''
 const slot = String(pin.wt || '').replace(/\/+$/, '').split('/').pop()
 if (!dir.startsWith('/') || (slot && !dir.includes(`/${slot}`)) || dir === String(PROJECT_DIR).replace(/\/+$/, '')) return `WRONG TREE: the finder reported working in '${dir || '(none)'}', not inside the pinned worktree ${pin.wt || '(unknown)'} (BL-0205)`
 return ''
}
function validateDriftFinding(raw, frd, pin = null) {
 if (!raw || typeof raw !== 'object') return { finding: null, reason: 'the finder returned no verdict' }
 if (raw.__threw) return { finding: null, reason: `the finder threw (${raw.__threw})` }
 const wrongTree = pin ? finderWrongTree(raw, pin) : ''
 if (wrongTree) return { finding: null, reason: wrongTree }
 if (!Array.isArray(raw.contracts)) return { finding: null, reason: 'the finder output has no contracts array' }
 if (!raw.contracts.length) return { finding: null, reason: 'the finder returned no contracts (an FRD always has some — it did not do the pass)' }
 const rows = []
 const malformed = []
 for (const [i, r] of raw.contracts.entries()) {
  if (!r || typeof r.contract !== 'string' || !r.contract.trim() || !DRIFT_FINDER_STATUSES.includes(r.status)) { malformed.push(i); continue }
  const probeOk = r.status === 'drift' && typeof r.probe_test === 'string' && DRIFT_PROBE_RE.test(r.probe_test) && FINDER_PROBE_RE.test(r.probe_test) && r.probe_test.includes(`/drift-probes/${frd}/`)
  rows.push({ ...r, provable: probeOk && Boolean(contractIdOf(r.contract)) })
 }
 if (!rows.length) return { finding: null, reason: `every one of the finder's ${raw.contracts.length} rows is malformed` }
 return { finding: { rows, malformed, pinDir: typeof raw.pinDir === 'string' ? raw.pinDir.trim() : '', selfReported: { toolCalls: Number(raw.toolCalls) || null, budgetExhausted: raw.budgetExhausted === true } }, reason: '' }
}
const FINDER_SNIPPET_MISS_LIMIT = 2
const FINDER_SNIPPET_RETRIES = 2
const finderCitedFile = (file, pinDir) => {
 const f = String(file || '').trim()
 for (const base of [pinDir, PROJECT_DIR]) {
  const b = String(base || '').replace(/\/+$/, '')
  if (b && f.startsWith(`${b}/`)) return f.slice(b.length + 1)
 }
 return f
}
function parseSnippetCheck(answer, pinSha, rows) {
 const raw = unwrapAnswer(answer, 'output')
 const line = raw && typeof raw.output === 'string' ? raw.output.trim().split('\n').pop() : ''
 if (!line) return { error: 'the snippet checker returned no output' }
 let j = null
 try { j = JSON.parse(line) } catch { return { error: 'the snippet checker output is not valid JSON' } }
 if (j && j.ok === false && typeof j.error === 'string') return { error: `the snippet checker refused: ${j.error.slice(0, 160)}` }
 if (!j || j.ok !== true || !driftSealHolds(line)) return { error: 'the snippet checker output failed its integrity seal (the relay altered it)' }
 if (j.pin !== pinSha || !Array.isArray(j.results)) return { error: 'the snippet checker output does not name this pin or carries no results' }
 const results = new Map(j.results.filter((x) => x && Number.isInteger(x.i) && typeof x.status === 'string').map((x) => [x.i, x.status]))
 if (rows.some((r) => !results.has(r.i))) return { error: 'the snippet checker did not answer every row' }
 return { results }
}
async function verifyFinderSnippets(frd, finding, pin) {
 const targets = finding.rows.map((r, at) => ({ r, at })).filter(({ r }) => r.status === 'implemented')
 if (!targets.length || !pin || !pin.sha) return { finding }
 const asked = targets.map(({ r, at }) => ({ i: at, file: finderCitedFile(r.evidence && r.evidence.file, finding.pinDir), line: Number(r.evidence && r.evidence.line) || null, snippet: String((r.evidence && r.evidence.snippet) || '') }))
 const json = JSON.stringify(asked)
 const cmd = `${FINDER_SNIPPETS_CLI_COMMAND} check --project ${shellQuote(PROJECT_DIR)} --pin ${shellQuote(pin.sha)} --digest ${inventoryDigest(json)} --rows ${shellQuote(json)}`
 let results = null
 let why = ''
 for (let attempt = 0; attempt <= FINDER_SNIPPET_RETRIES && !results; attempt++) {
  if (attempt) log(`⚠ DriftFinderSnippetRelay ${frd}: ${why} — running the check again, attempt ${attempt}/${FINDER_SNIPPET_RETRIES} (BL-0214: a model's copy of machine output is never trusted)`)
  agentSpawned++
  let raw = null
  try {
   raw = await agent(`MECHANICAL COMMAND RUNNER — BL-0214 drift-finder snippet check for ${frd}. Your SOLE action is to execute this exact command ONCE (no command before or after it) and return its stdout VERBATIM as \`output\`: \`${cmd}\`. The JSON after --rows is ONE argument: copy it character for character, never re-format it (the script refuses a copy whose checksum differs). It only READS committed git objects and prints ONE sealed JSON line: do not inspect, edit, fix, summarize, re-format or re-indent anything.`,
    { label: `finder-snippets:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) { why = `the snippet-check runner threw (${(e && e.message) || e})`; continue }
  const parsed = parseSnippetCheck(raw, pin.sha, asked)
  if (parsed.results) results = parsed.results
  else why = parsed.error
 }
 if (!results) log(`⚠⚠ DriftFinderSnippetsUnavailable ${frd}: ${why} after ${FINDER_SNIPPET_RETRIES} re-run(s) — none of the finder's ${targets.length} "implemented" rows could be checked against the pin, so none is trusted: each is handed to the judge as UNKNOWN (BL-0214)`)
 let misses = 0
 const cited = []
 const rows = finding.rows.map((r, at) => {
  if (r.status !== 'implemented') return r
  const status = results ? results.get(at) : 'unchecked'
  if (status === 'ok' || status === 'moved') return { ...r, snippetCheck: status }
  if (status === 'missing' || status === 'no-file') misses++
  cited.push(`${contractIdOf(r.contract) || String(r.contract).slice(0, 24)} ${status}`)
  return { ...r, status: 'unknown', snippetCheck: status }
 })
 if (misses >= FINDER_SNIPPET_MISS_LIMIT) return { finding: null, reason: `WRONG TREE (snippets): ${misses} of the finder's ${targets.length} implemented citations are not in the tree at the gate pin ${String(pin.sha).slice(0, 8)} — it read something other than the pinned commit (BL-0214)` }
 if (results && cited.length) log(`⚠ DriftFinderSnippets ${frd}: ${cited.length} of ${targets.length} "implemented" row(s) cite a snippet that cannot be verified at the pin (${cited.join(', ')}) — downgraded to UNKNOWN: the judge must open that code itself (BL-0214)`)
 return { finding: { ...finding, rows } }
}
function driftSelfReportDiscrepancy(selfReported) {
 if (!selfReported || !selfReported.budgetExhausted) return ''
 const { toolCalls } = selfReported
 if (toolCalls === null) return `it claims its ${DRIFT_FINDER_TOOL_BUDGET}-call tool budget ran out but reports no call count`
 if (toolCalls < DRIFT_FINDER_TOOL_BUDGET * 0.8) return `it claims its ${DRIFT_FINDER_TOOL_BUDGET}-call tool budget ran out but self-reports only ${toolCalls} calls`
 return ''
}
async function awaitDriftFinding(frd) {
 const st = frdState.get(frd)
 if (!st || !st.driftFinderPromise) return null
 if (st.driftFinding !== undefined && st.driftFinding !== null) return st.driftFinding
 const validated = validateDriftFinding(await st.driftFinderPromise, frd, st.driftFinderPin)
 const { finding, reason } = validated.finding ? await verifyFinderSnippets(frd, validated.finding, st.driftFinderPin) : validated
 if (!finding) { log(`⚠ DriftFinderFallback ${frd}: ${reason} — this gate runs without a drift-finder report (the gate itself is never skipped)`); st.driftFinding = false; return null }
 const n = (s) => finding.rows.filter((r) => r.status === s).length
 log(`⌕ ${frd}: drift finder → ${finding.rows.length} contract(s): ${n('implemented')} implemented, ${n('drift')} drift (${finding.rows.filter((r) => r.provable).length} with a probe), ${n('unknown')} unknown${finding.malformed.length ? `; ${finding.malformed.length} MALFORMED row(s) ignored (#${finding.malformed.join(', #')})` : ''}; self-reported (UNVERIFIED, telemetry only): ${finding.selfReported.toolCalls === null ? 'no tool-call count' : `${finding.selfReported.toolCalls} tool calls`}${finding.selfReported.budgetExhausted ? ', budget exhausted' : ''}`)
 const discrepancy = driftSelfReportDiscrepancy(finding.selfReported)
 if (discrepancy) log(`⚠ DriftFinderSelfReportDiscrepancy ${frd}: ${discrepancy} — its self-report is not trusted (BL-0208); the billed count is in the run's usage-rollup (tool_calls)`)
 st.driftFinding = finding
 return finding
}
const currentDriftFinding = (frd) => { const st = frdState.get(frd); return (st && st.driftFinding) || null }
function isCycleRow(frd, reviewIds, row) {
 if (row.owner && reviewIds.includes(row.owner)) return true
 const id = contractIdOf(row.contract)
 return Boolean(id) && reviewedAcText(frd, reviewIds).includes(id)
}
const finderRowLine = (r) => `• ${r.contract}${r.evidence && r.evidence.file ? ` — ${r.evidence.file}${r.evidence.line ? `:${r.evidence.line}` : ''}` : ''}${r.evidence && r.evidence.snippet ? ` \`${String(r.evidence.snippet).slice(0, 160)}\`` : ''}${r.owner ? ` · owner ${r.owner}` : ''}${r.why ? ` · ${String(r.why).slice(0, 240)}` : ''}${r.snippetCheck && r.snippetCheck !== 'ok' && r.snippetCheck !== 'moved' ? ` · [ENGINE] the finder called it implemented, but its cited snippet could not be verified at the pin (${r.snippetCheck}) — UNREVIEWED, open the code yourself` : ''}${r.status === 'drift' ? (r.provable ? ` · probe ${r.probe_test}${r.direction ? ` · direction ${r.direction}` : ''}` : ' · NO valid probe (unproven pointer)') : ''}`
function driftFinderBlock(frd, reviewIds) {
 const f = currentDriftFinding(frd)
 if (!f) return ''
 const drift = f.rows.filter((r) => r.status === 'drift')
 const unknown = f.rows.filter((r) => r.status === 'unknown')
 const unknownCycle = unknown.filter((r) => isCycleRow(frd, reviewIds, r))
 const unknownOther = unknown.filter((r) => !isCycleRow(frd, reviewIds, r))
 const implemented = f.rows.filter((r) => r.status === 'implemented')
 const list = (rows) => (rows.length ? rows.map(finderRowLine).join('\n  ') : '(none)')
 return `
  **WHOLE-FRD DRIFT FINDER REPORT (BL-0203).** A separate sonnet agent walked EVERY contract of \`docs/frds/${frd}/frd.md\` (and the blueprint's CMP/IF) against the code at this pin, OUTSIDE the diff you were handed. Every UNKNOWN row below is UNREVIEWED, whatever reason the finder gives (it may have stopped early or run out of tool budget, and its own account of how many calls it made is not reliable). It is not a verdict and it proved nothing by itself: you are the judge (DR-015).
  (1) DRIFT CLAIMS — open each evidence file:line and each probe. If the code contradicts the contract, record it as a \`fail\` traceability entry: with \`claim: "preexisting"\`, \`evidence_test\` = that probe path and a \`direction\` when no reviewed work order owns it (the engine proves it, DR-122), or as a finding/reopen of the reviewed work order that owns it. If you disagree, refute it ONLY with a test of your own that asserts the contract HOLDS: status \`pass\`, that test in the entry's \`tests\` AND in \`testFiles\`. **The engine submits every drift claim you neither record as a \`fail\` nor refute with a test of your own to the same differential proof:** proven pre-existing → a draft card, never a block; a regression, or a contract a reviewed work order owns failing on an assertion at this pin → reopened patch-first; anything unproven → discarded with a log.
  ${list(drift)}
  (2) UNKNOWN ON THIS CYCLE'S CONTRACTS (${reviewIds.join(', ')}) — the finder could NOT locate their implementation. You MUST deep-review each one yourself: open the implementing code, exercise it with at least one test, and return it in \`traceability\` with non-empty \`tests\` (or as a \`fail\`). These reads do NOT count against your read budget.
  ${list(unknownCycle)}
  (3) UNKNOWN ON OTHER CONTRACTS — review what you can; a contract you cannot confirm stays out of a \`pass\` without a test.
  ${list(unknownOther)}
  (4) IMPLEMENTED — a pointer map (file:line) to jump straight to the code instead of searching; do not re-verify every row.
  ${list(implemented)}
`
}
function mergeDriftFinderClaims(frd, raw) {
 const f = currentDriftFinding(frd)
 if (!f || !raw || typeof raw !== 'object' || !Array.isArray(raw.traceability)) return raw
 const claims = f.rows.filter((r) => r.status === 'drift' && r.provable)
 if (!claims.length) return raw
 if (DRIFT_POLICY === 'block') { log(`◦ ${frd}: ${claims.length} drift-finder claim(s) NOT merged — args.driftPolicy:'block' (the judge saw them in its prompt; BL-0203)`); return raw }
 const own = new Set(Array.isArray(raw.testFiles) ? raw.testFiles : [])
 const trace = [...raw.traceability]
 for (const r of claims) {
  const id = contractIdOf(r.contract)
  const at = trace.findIndex((e) => e && contractIdOf(e.contract) === id)
  const judge = at >= 0 ? trace[at] : null
  if (judge && judge.origin === 'drift-finder') { log(`◦ ${frd}: drift finder listed ${id} twice — the first claim stands (BL-0203)`); continue }
  if (judge && judge.status === 'fail') { log(`◦ ${frd}: drift finder claim on ${id} — the judge already recorded it as a fail; its entry governs (BL-0203)`); continue }
  if (judge && judge.status === 'pass' && Array.isArray(judge.tests) && judge.tests.some((x) => own.has(x))) { log(`⚖ ${frd}: drift finder claim on ${id} refuted by the reviewer with its own passing test (${judge.tests.filter((x) => own.has(x)).join(', ')}) — dropped before any proof (DR-015; BL-0203)`); continue }
  const entry = { contract: r.contract, contractClass: REQUIRED_TRACE_CLASSES.includes(r.contractClass) ? r.contractClass : (/^REQ-/.test(id) ? 'requirement' : 'acceptance-criterion'), status: 'fail', claim: 'preexisting', evidence_test: r.probe_test, direction: r.direction || 'unknown', tests: [], origin: 'drift-finder', ...(judge ? { __judgeEntry: judge } : {}) }
  if (at >= 0) trace[at] = entry
  else trace.push(entry)
  log(`⌕ ${frd}: drift finder claim on ${id} ${judge ? `(the judge marked it ${judge.status} without a test of its own)` : '(absent from the judge\'s traceability)'} submitted to the DR-122 differential proof (BL-0203)`)
 }
 return { ...raw, traceability: trace }
}
function classifyFinderClaim(entry, proof, owned, proofError) {
 const id = contractIdOf(entry.contract)
 if (!proof) return { verdict: 'unproven', why: proofError || 'the differential proof did not run' }
 const probe = proof.probes.find((p) => p && p.path === entry.evidence_test)
 if (!probe || probe.missing) return { verdict: 'unproven', why: 'the finder probe was not found where it said it wrote it' }
 const head = probeRunState(probe.head)
 if (head === 'passed') return { verdict: 'refuted', why: 'the probe PASSES at the gate pin — the claimed contradiction is not demonstrated', stored: probe.stored }
 if (head !== 'assertion-failed') return { verdict: 'unproven', why: `the probe is ${head} at the gate pin`, stored: probe.stored }
 if (!owned) return { verdict: 'unproven', why: 'reviewed work-order ownership could not be read at the pin', stored: probe.stored }
 if (id && owned.has(contractCore(id))) return { verdict: 'cycle-fault', why: `${id} is owned by a reviewed work order and the finder probe fails on an assertion at the pin — a defect of this cycle the gate did not record`, stored: probe.stored }
 const c = classifyDriftClaim(entry, proof, owned, proofError)
 return c.verdict === 'cycle-fault' ? { ...c, verdict: 'unproven' } : c
}
const evidenceOf = (pack) => (pack && pack.evidence) || null
const evidenceFallbackOf = (frd, pack) => ((pack && pack.fallbackReason) ? GATE_EVIDENCE_FALLBACK_EVENT(frd, pack.fallbackReason) : '')
const evidenceBlock = (frd, ev) => ev ? `
  **${EVIDENCE_MARKER} (WP-06).** A dedicated collector already ran the gate script and gathered the diff and the acceptance criteria at this exact pinned commit, in this exact worktree. **The three attachments below ARE your primary material** — read them first and judge from them. Do NOT re-walk the tree to rebuild what is already here.
  **EXPLORATION BUDGET FOR THIS GATE: at most ${EVIDENCE_READ_BUDGET} additional file reads, plus EXACTLY ONE mandatory execution of the gate script AFTER you write your adversarial tests (step 2 below — not optional: ATTACHMENT 1 predates those tests and cannot certify them).** Writing your adversarial tests, running them, and building the traceability inventory are NOT exploration — they are the job, and they are not capped. **If ${EVIDENCE_READ_BUDGET} reads are not enough to reach a verdict you can defend, do NOT keep exploring: return the verdict you can defend and state in \`failure\` exactly what you still needed and why.** An honest bounded verdict beats an unbounded hunt.

  ── ATTACHMENT 1/3 · GATE REPORT — \`.pandacorp/run/gate-report.json\` from \`bash .pandacorp/verify.sh --since <last_green_sha> --report-all\` run at THIS pin (whitespace-compacted by the engine; every sub-gate, exit and failures[] row is intact) ──
  ${ev.reportCompact || ev.report}

  ── ATTACHMENT 2/3 · THE CHANGE UNDER REVIEW — \`git diff <pin_base>..<pin>\`, the patch scoped to the reviewed work orders' declared artifacts ──${ev.truncated ? `
  ⚠ **TRUNCATED**: the unified patch exceeded the ${EVIDENCE_DIFF_MAX_LINES}-line cap, so it carries the largest files clipped at hunk boundaries. This is NOT the complete change set — the \`--stat\` below IS complete, so reconcile against it and spend budgeted reads on any file you need in full.` : ''}
  STAT:
  ${ev.diffStat || '(the collector reported none)'}
  PATCH:
  ${ev.diff || '(the collector reported none)'}
  TEST FILES THIS CYCLE ADDED OR CHANGED (\`git diff --relative --name-only\`, test paths only — the implementers' evidence; run the ones covering the reviewed work orders BY PATH, never trusting \`--changed\` to have picked them up):
  ${ev.tests && ev.tests.length ? ev.tests.join('\n  ') : '(none — the cycle added or changed no test file)'}

  ── ATTACHMENT 3/3 · EARS ACCEPTANCE CRITERIA of ${frd}, verbatim ──
  ${ev.ac || `(the collector reported none — recover them from docs/frds/${frd}/frd.md within your read budget)`}
` : ''
const gateFocusedStep = (frd, ev) => (ev
 ? `  2) **Do NOT re-run the focused gate merely to discover its result — ATTACHMENT 1 above IS that result** (\`verify.sh --since <last_green_sha> --report-all\`, executed for you at this pin). Read every sub-gate's \`exit\` and every \`failures[]\` row in it; a red sub-gate there is first-class blocking evidence, and a \`green: false\` report can never be waived into a pass. **You MUST run verify.sh exactly once — \`bash .pandacorp/verify.sh --since <last_green_sha>\` — after writing your adversarial tests: ATTACHMENT 1 predates them and therefore cannot certify them.** Do NOT pass \`--only\`/\`--files\` on that re-run: this gate is the FRD's certification oracle, and a scoped run stamps the report \`scope:"partial"\`, which the engine refuses to certify on. It must pass clean.${REPORT_SCOPE_DIRECTIVE} Return THAT run's \`.pandacorp/run/gate-report.json\` VERBATIM as \`gateReport\` — never ATTACHMENT 1's — when it is RED, so the engine can route the failing sub-gate without paying a model to re-read your prose.${PREVIEW_SMOKE(frd)}`
 : `  2) Run the FOCUSED gate \`bash .pandacorp/verify.sh --since <last_green_sha>\` (read last_green_sha from .pandacorp/status.yaml) — biome + tsc run globally, but only the TESTS affected since the last green (fast and scales; the full suite runs once at close-out). It must pass clean. Do NOT pass \`--only\`/\`--files\` here: this run is the FRD's certification oracle, and a scoped run stamps the report \`scope:"partial"\`, which the engine refuses to certify on.${REPORT_SCOPE_DIRECTIVE} Also return that run's \`.pandacorp/run/gate-report.json\` VERBATIM as \`gateReport\` when it is RED, so the engine can route the failing sub-gate without paying a model to re-read your prose.${PREVIEW_SMOKE(frd)}`) + REVIEWER_TESTS_EXPLICIT
const gateContextScope = (frd, reviewIds) => {
 if (!GATE_CONTEXT_SCOPE) return ''
 const st = frdState.get(frd)
 const cycle = (st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)).map((w) => w.path || w.id) : []).join(', ') || reviewIds.join(', ')
 const cached = Boolean(st && st.inventoryCache && st.inventoryCache.hit)
 return `
  **CONTEXT SCOPE (gate cost, BL-0188) — your obligations above are unchanged; this governs only HOW MUCH you read.** Everything you read or print stays in your context for every later turn, so read what the verdict needs, not the whole tree:
  • ${cached ? `FRD: the engine-verified CACHED INVENTORY above stands in for a whole-file re-read — read the sections of \`docs/frds/${frd}/frd.md\` holding the contracts you deep-review.` : `READ IN FULL: \`docs/frds/${frd}/frd.md\` (the whole-FRD oracle needs every contract).`} Also in full: this cycle's work orders (${cycle}).
  • HEADER ONLY: the FRD's OTHER work orders (VERIFIED in earlier cycles, a stable foundation) — their frontmatter (\`source_requirements\`, \`artifacts\`) and \`## Status Note\` (which tests cover them), never the whole body.
  • SECTIONS ONLY: \`docs/frds/${frd}/blueprint.md\` — \`grep -n\` the REQ/CMP/IF ids this cycle's work orders cite and read those sections.
  • POINTERS ONLY: \`docs/rules/*\`, \`AGENTS.md\`, the factory standards and memory — open one only when a specific finding hinges on it (memory: grep \`INDEX.md\` for a matching trigger).
  • NEVER: the factory, plugin or build-engine source (\`plugin/\`, \`.claude/engines/\`, an enclosing repo's \`factory/\` when this project is nested) — it is not the product under review.
  • HEAVY OUTPUT → FILE + TAIL: run verify.sh / vitest / playwright / \`git log\` with stdout+stderr redirected to \`.pandacorp/run/gate-logs/<name>.log\` (gitignored) and read \`tail -n 80\` plus a \`grep\` of the failures — never print a whole log into the conversation.`
}
const INVENTORY_STATUSES = ['pass', 'not-applicable', 'drift']
const INVENTORY_SAMPLE_MIN = 3
const inventoryDigest = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
function inventoryError(inv, frd) {
 if (!inv || typeof inv !== 'object' || Array.isArray(inv)) return 'not a JSON object'
 if (inv.version !== 1) return `unknown version ${JSON.stringify(inv.version)}`
 if (inv.frd !== frd) return `it belongs to ${JSON.stringify(inv.frd)}`
 if (typeof inv.gatedAt !== 'string' || !/^[0-9a-f]{7,40}$/.test(inv.gatedAt)) return 'gatedAt is not a commit sha'
 if (!inv.sources || typeof inv.sources.frd !== 'string' || !(inv.sources.blueprint === null || typeof inv.sources.blueprint === 'string')) return 'sources (the frd.md/blueprint.md fingerprints) are missing'
 if (!Array.isArray(inv.contracts) || !inv.contracts.length) return 'it lists no contracts'
 for (const [i, e] of inv.contracts.entries()) {
  if (!e || typeof e.contract !== 'string' || !e.contract.trim()) return `contract ${i} has no text`
  if (!REQUIRED_TRACE_CLASSES.includes(e.contractClass)) return `contract ${i} has an unknown class`
  if (!INVENTORY_STATUSES.includes(e.status)) return `contract ${i} has status ${JSON.stringify(e.status)}`
  if (!Array.isArray(e.tests) || e.tests.some((x) => typeof x !== 'string')) return `contract ${i} has no tests array`
 }
 const missing = REQUIRED_TRACE_CLASSES.filter((k) => !inv.contracts.some((e) => e.contractClass === k))
 return missing.length ? `missing contractClass: ${missing.join(', ')}` : ''
}
async function resolveInventoryCache(frd, pinSha) {
 if (!GATE_INVENTORY_CACHE) return null
 const cmd = `${INVENTORY_CLI_COMMAND} check --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --pin ${shellQuote(pinSha || 'HEAD')}`
 agentSpawned++
 let raw = null
 try {
  raw = await agent(`MECHANICAL COMMAND RUNNER — BL-0189 inventory-cache check for ${frd}. Your SOLE action is to execute this exact command ONCE (no command before or after it) and return its stdout VERBATIM as \`output\`: \`${cmd}\`. It only READS (git objects and one gitignored file) and prints ONE JSON line. Do not inspect, edit, fix, summarize or reformat anything.`,
   { label: `gate-inventory:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
 } catch (e) { log(`⚠ ${frd}: the inventory-cache check threw (${(e && e.message) || e}) — full whole-FRD inventory this gate`); return { hit: false, reason: 'check threw' } }
 raw = unwrapAnswer(raw, 'output')
 const line = (raw && typeof raw.output === 'string') ? raw.output.trim().split('\n').pop() : ''
 let j = null
 try { j = JSON.parse(line) } catch { j = null }
 if (j && j.ok === true && (j.sum !== undefined || Number(j.version) >= 2) && !driftSealHolds(line)) {
  log(`⚠ ${frd}: the inventory-cache check line failed its integrity seal (the relay altered it) — full whole-FRD inventory this gate`)
  return { hit: false, reason: 'check altered' }
 }
 if (j && j.ok === true && j.sum === undefined && !(Number(j.version) >= 2)) log(`⚠ ${frd}: the inventory-cache check predates the sealed output — its relay integrity could not be verified (update the installed plugin)`)
 if (!j || j.ok !== true || !j.sources || typeof j.sources.frd !== 'string') {
  log(`⚠ ${frd}: the inventory-cache check returned no usable facts (${(j && j.error) || 'unparseable output'}) — full whole-FRD inventory this gate`)
  return { hit: false, reason: 'check failed' }
 }
 if (j.inventory === null || j.inventory === undefined) { log(`◦ ${frd}: no cached contract inventory yet — full whole-FRD inventory this gate (a green gate seeds it)`); return { hit: false, reason: 'absent' } }
 let inv = null
 let defect = ''
 try { inv = JSON.parse(j.inventory) } catch { defect = 'not valid JSON' }
 if (!defect) defect = inventoryError(inv, frd)
 if (defect) {
  log(`⊘ ${frd}: MALFORMED cached contract inventory (${j.inventoryPath || 'inventory.json'}: ${defect}) — IGNORED, never read as an empty or partial inventory (DR-078); this gate re-derives the whole-FRD inventory and its green landing rewrites the cache`)
  return { hit: false, reason: 'malformed', malformed: true }
 }
 const changed = [inv.sources.frd !== j.sources.frd ? 'frd.md' : '', (inv.sources.blueprint || null) !== (j.sources.blueprint || null) ? 'blueprint.md' : ''].filter(Boolean)
 if (changed.length) { log(`↻ ${frd}: cached contract inventory is STALE — ${changed.join(' + ')} changed normatively since ${inv.gatedAt} — full whole-FRD inventory this gate`); return { hit: false, reason: 'stale' } }
 log(`⚡ ${frd}: cached contract inventory HIT (gated at ${inv.gatedAt}, ${inv.contracts.length} contracts, frd.md/blueprint.md unchanged) — the reviewer deep-reviews this cycle's contracts and re-runs the rest's evidence`)
 return { hit: true, inventory: inv }
}
const inventoryBlock = (frd, reviewIds) => {
 const st = frdState.get(frd)
 const c = st && st.inventoryCache
 if (!c || !c.hit) return ''
 const inv = c.inventory
 const rows = inv.contracts.map((e) => `${e.contractClass} | ${e.status} | ${e.contract} | ${e.tests.length ? e.tests.join(', ') : '—'}`).join('\n  ')
 return `
  **CACHED WHOLE-FRD INVENTORY — FRD baseline gated at ${inv.gatedAt} (BL-0189).** The engine verified that the normative body of \`docs/frds/${frd}/frd.md\`${inv.sources.blueprint ? ' and of its blueprint.md' : ''} (sha256, frontmatter excluded) is UNCHANGED since the last GREEN gate of this FRD inventoried it at ${inv.gatedAt}. The oracle above is NOT relaxed — your verdict still returns the COMPLETE traceability (every contract below, all 7 classes) and any contradiction is still RED — but do NOT re-derive the inventory from scratch:
  (1) DEEP-REVIEW every contract this cycle's work orders (${reviewIds.join(', ')}) own or cite, exactly as without a cache;
  (2) for EVERY other contract below, re-run its recorded evidence tests BY PATH in ONE batched run (\`pnpm vitest run <paths…>\`; Playwright specs \`pnpm playwright test <paths…>\`) — a contract whose evidence is missing or fails, or whose code this cycle's diff touched, gets the full deep review;
  (3) deep-review a further SAMPLE of at least ${INVENTORY_SAMPLE_MIN} of the remaining contracts (or 20% of them, whichever is larger), spread across classes;
  (4) return EVERY contract below in \`traceability\` (its status re-confirmed now) plus any the cache missed — the engine REFUSES a green verdict that drops a cached REQ/AC contract.
  CACHED INVENTORY (class | status at ${inv.gatedAt} | contract | evidence tests):
  ${rows}
`
}
function enforceInventoryCoverage(frd, result) {
 const st = frdState.get(frd)
 const c = st && st.inventoryCache
 if (!c || !c.hit || !result || result.green !== true) return result
 const seen = new Set((Array.isArray(result.traceability) ? result.traceability : []).map((e) => contractIdOf(e && e.contract)).filter(Boolean))
 const dropped = [...new Set(c.inventory.contracts.map((e) => contractIdOf(e.contract)).filter((id) => id && !seen.has(id)))]
 if (!dropped.length) return result
 log(`⚠ ${frd}: the green verdict DROPPED ${dropped.length} cached contract(s) from its traceability (${dropped.join(', ')}) — refused (BL-0189: a cache never shrinks the oracle); re-asking with the full whole-FRD inventory`)
 if (st) st.inventoryCandidate = null
 return { ...result, green: false, traceabilityDeficient: true, missingClasses: dropped.map((id) => `cached contract ${id}`), failure: `whole-FRD traceability dropped cached contract(s): ${dropped.join(', ')}` }
}
function inventoryCandidateOf(result, pinSha) {
 if (!GATE_INVENTORY_CACHE || !result || result.green !== true || !Array.isArray(result.traceability)) return null
 const contracts = result.traceability.map((e) => ({ contract: String((e && e.contract) || ''), contractClass: e && e.contractClass, status: e && e.status === 'discarded' ? 'pass' : e && e.status, tests: Array.isArray(e && e.tests) ? e.tests.filter((x) => typeof x === 'string') : [] }))
 if (!contracts.length || contracts.some((e) => !e.contract.trim() || !INVENTORY_STATUSES.includes(e.status) || !REQUIRED_TRACE_CLASSES.includes(e.contractClass))) return null
 return { pin: pinSha || null, contracts }
}
function inventoryPersistStep(frd) {
 const st = frdState.get(frd)
 const cand = st && st.inventoryCandidate
 if (!GATE_INVENTORY_CACHE || !cand) return ''
 const json = JSON.stringify(cand.contracts)
 const cmd = `${INVENTORY_CLI_COMMAND} write --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --pin ${shellQuote(cand.pin || 'HEAD')} --digest ${inventoryDigest(json)} --contracts ${shellQuote(json)}`
 return `
    **LAST STEP (BL-0189 — only after the commit above succeeded):** refresh this FRD's contract-inventory cache from the gate you just applied. Run the command in the fenced block below EXACTLY ONCE, byte-for-byte (it writes the gitignored run-state file .pandacorp/run/gate-evidence/${frd}/inventory.json — NEVER stage or commit it), and return its stdout VERBATIM as \`inventory_output\` together with \`done\`. It refuses (ok:false) rather than write a damaged cache, and its outcome never changes \`done\`.
    \`\`\`sh
    ${cmd}
    \`\`\``
}
function recordInventoryWrite(frd, r) {
 const st = frdState.get(frd)
 if (!GATE_INVENTORY_CACHE || !st || !st.inventoryCandidate) return
 if (!r || r.done !== true) return
 st.inventoryCandidate = null
 let j = null
 try { j = JSON.parse(String((r && r.inventory_output) || '').trim().split('\n').pop()) } catch { j = null }
 if (j && j.ok === true) log(`▣ ${frd}: contract inventory cached (${j.entries} contracts, gated at ${j.gatedAt}) — the next gate of this FRD reuses it while frd.md/blueprint.md stay unchanged`)
 else log(`⚠ ${frd}: the contract-inventory cache was NOT written (${(j && j.error) || 'no receipt'}) — the next gate runs the full whole-FRD inventory`)
}
async function frdGateSerial(frd, reviewIds, attemptNo = 1, workFrom, evidencePack, directive = '') {
 const ev = evidenceOf(evidencePack)
 if (DRIFT_FINDER) await awaitDriftFinding(frd)
 agentSpawned += COST(P.judge)
 return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd, reviewIds.length, attemptNo)}${evidenceFallbackOf(frd, evidencePack)} FRD review + integration gate for ${frd}. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.
 BUILD-JOURNAL (A1) — at WHICHEVER exit you take below (pass / reopen / blocked / fail), record this gate's verdict:${gateVerdictJournal(frd, reviewIds, attemptNo)}
${directive ? `\n  ${directive}\n` : ''}
  **THE GATE IS SPLIT (DR-072) — this is what makes the build converge instead of churning. Two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd} — the required behavior/sections/elements EXIST and work), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch** (the surface is not RECOGNIZABLY the designed thing — e.g. a flat text list where the mock shows a multi-panel/pixel-art layout; a section missing entirely). These BLOCK.
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing (15px vs 16px), spacing, exact color/shade, minor density/polish, "doesn't match the mock 100%". A pixel-judge is noisy; rejecting on nits is the #1 cause of the build never finishing. **NEVER reopen a WO for a nit.** Instead APPEND each nit to the punch-list \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap, e.g. "heading is 15px, design tokens say 16px"> · <file:approx-line if known>\`). The dedicated end-of-build Visual QA pass + the owner sweep these directly — they do not gate VERIFIED. Scope yourself to CORRECTION + GROSS only; **flag, don't fix, don't reject** the rest (an over-broad reviewer reporting every gap HARMS convergence — research-backed).

  ${WHOLE_FRD_ORACLE}
  ${DRIFT_CLAIM_DIRECTIVE}
  ${DISMISSAL_CITATION_DIRECTIVE}${inventoryBlock(frd, reviewIds)}${gateContextScope(frd, reviewIds)}
${evidenceBlock(frd, ev)}${driftFinderBlock(frd, reviewIds)}
  1) Review the changed work orders for CORRECTION (the blocking lenses above) and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising them TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again** (the same fault is not resolving autonomously): you are REVIEW-ONLY — do NOT stamp BLOCKED, do NOT write decisions.md, do NOT commit; just${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)}${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)} return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' } — the engine persists the BLOCKED state + the decision record on the MAIN tree. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH on the existing build BEFORE any revert. **FIX-FORWARD MANDATE (DR-073, calibrated 2026-07-01): a BOUNDED fault you can name at file:line with an estimated fix of ≤ ~30 lines (a hardcoded string, a missing null-guard, a clipped breakpoint, a missing escape) MUST take this findings exit — never a bare failure, never blocked_reason 'error' (80% of real first-gate fails had ≤6-min fixes; routing them to revert cost ~1.5h of a run's 2.2h rework).** Your job here is to REPORT the fixable fault(s) precisely: for EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (a test you wrote that fails WITHOUT the fix and will pass WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)}${GATE_VERDICT(frd, 'reopen', `,"reopened":%s`, ` "<the count of work orders you are reopening — an integer>"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }. The engine patches those findings in place; only if the patch can't green it whole-project does it then revert + reopen for a clean rebuild (DR-070, the fallback).
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built (it isn't in src/components nor docs/design/components.md — e.g. the mock shows a Room/AgentSprite/StoneBridge the foundation never built), do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  If it's broken and you can't pinpoint specific WOs, first classify \`blocked_reason\` ('needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error'), then — **unless** that reason is 'needs-owner' AND a \`fail\` entry of your traceability carries \`claim: "preexisting"\` (BL-0178/BL-0185: then emit NOTHING here — the engine adjudicates the claim first and emits this gate's ONE terminal outcome itself, so a block it lifts is never reported as both blocked and passed) —${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the SAME blocked_reason value you are about to return>"`)} return { green: false, failure, blocked_reason }. **\`failure\` MUST open with ONE sentence naming what is RED and what the owner must do — any context or praise for what passed comes AFTER that sentence, never before it** (F1/BL-0174: the engine keeps only the first ~400 chars of \`failure\`; leading with praise for passing work silently drops the real blocking cause).${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`,
  { label: `gate:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA, workFrom })
}
const VERIFY_CAP = 8
const FINDER_LENSES = [
 { key: 'correctness', lens: 'CORRECTNESS vs the FRD\'s acceptance criteria — read the EARS AC of this FRD and assert the required behavior/sections/elements EXIST and work; every AC this feature owns is met. Report each unmet/incorrect AC.' },
 { key: 'security', lens: 'SECURITY — OWASP-class defects for this stack: missing authz on a mutating route/action, injection, unsafe input at a boundary, secrets in code, missing/incorrect validation. Report each concrete exposure.' },
 { key: 'quality', lens: 'QUALITY — a near-DUPLICATE of an existing shared component/primitive (DR-057; cross-check docs/design/components.md + src/components), a SINGLE-SOURCE-OF-TRUTH violation (DR-115: a fact with two writers, an increment-maintained counter, a second independent derivation of the same value), and a DEAD/STALE reader mapping (a field read that nothing writes, a stale replica rendered as truth). Report each.' },
 { key: 'runtime', lens: 'RUNTIME/VISUAL — does the feature actually RENDER/RUN? You MAY run the existing browser gates READ-ONLY (render the routes, screenshot) but write no tests and change nothing. Report a route that errors, a blank/error render, an uncaught console error, or a GROSS structural mismatch vs the binding mock (a flat list where the mock is a rich layout, a missing section). Advisory nits (exact px/shade/spacing) → severity nit.' },
]
const splitGateEstimatedCost = () => 4 * COST('sonnet') + Math.min(VERIFY_CAP, VERIFY_CAP) * COST('sonnet') + COST(P.judge)
const findingKey = (find) => `${String(find.file || '').trim().toLowerCase()}::${String(find.claim || '').trim().toLowerCase().replace(/\s+/g, ' ')}`
async function frdGateSplit(frd, reviewIds, attemptNo = 1, workFrom, evidencePack) {
 const ev = evidenceOf(evidencePack)
 agentSpawned += 4 * COST('sonnet')
 const lensSweep = () => parallel(FINDER_LENSES.map((L) => () =>
  agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'find' })}FRD split-gate FIND stage — the ${L.key} lens for ${frd} (proposal 31 T1.2). You are ONE of four parallel read-only finders. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW), exercising them together with the rest of the feature. This FRD MAY have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation; do NOT re-review or change them.
    Your lens: ${L.lens}${evidenceBlock(frd, ev)}${gateContextScope(frd, reviewIds)}
    **READ-ONLY — findings ONLY:** do NOT write or modify tests, do NOT fix anything, do NOT run \`verify.sh\`, do NOT change any file or frontmatter. Just report. For each defect return { file (with a line if you can), claim (one sentence), severity ('correction' for a blocking defect in your lens; 'nit' for advisory polish), evidence (the concrete code/behavior you observed, so a skeptic can try to refute it) }. If your lens finds nothing, return { findings: [] }.`,
   { label: `find:${L.key}:${frd}`, phase: 'Review', model: 'sonnet', agentType: 'pandacorp:reviewer', schema: FINDER_SCHEMA, workFrom }),
 ))
 const finderResults = DRIFT_FINDER ? (await Promise.all([lensSweep(), awaitDriftFinding(frd)]))[0] : await lensSweep()
 const liveFinders = finderResults.filter((r) => r && Array.isArray(r.findings))
 const deadFinders = FINDER_LENSES.filter((_, i) => !finderResults[i] || !Array.isArray(finderResults[i].findings))
 if (deadFinders.length) log(`⚠ ${frd}: ${deadFinders.length}/4 finder lens(es) returned no verdict — proceeding with the other lenses (fail-safe)`)
 if (liveFinders.length === 0) { log(`⚠ ${frd}: all four finder lenses died — falling back to the serial frdGate() (the gate is never skipped)`); return { __splitFailed: true } }
 const byKey = new Map()
 for (const r of liveFinders) for (const f of r.findings) {
  if (!f || !f.claim) continue
  const k = findingKey(f)
  if (!byKey.has(k)) byKey.set(k, f)
 }
 const deduped = [...byKey.values()]
 const corrections = deduped.filter((f) => f.severity === 'correction')
 const nits = deduped.filter((f) => f.severity !== 'correction')
 log(`⚑ ${frd}: finders → ${deduped.length} deduped finding(s) (${corrections.length} correction(s), ${nits.length} nit(s))`)
 const toVerify = corrections.slice(0, VERIFY_CAP)
 const overflow = corrections.slice(VERIFY_CAP)
 if (overflow.length) log(`⚠ ${frd}: ${overflow.length} correction(s) exceed the verify cap of ${VERIFY_CAP} — passing them through UNVERIFIED (labeled) to the closer`)
 let survivingCorrections = [...overflow.map((f) => ({ ...f, verification: 'unverified-overflow' }))]
 if (toVerify.length) {
  agentSpawned += toVerify.length * COST('sonnet')
  const verdicts = await parallel(toVerify.map((f) => () =>
   agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'verify-finding' })}FRD split-gate VERIFY stage — adversarial skeptic for ONE finding on ${frd} (proposal 31 T1.2). A finder lens claimed this defect:
      • file: ${f.file}
      • claim: ${f.claim}
      • evidence given: ${f.evidence || '(none)'}
      Your job is to try to REFUTE it against the ACTUAL code — read the file, reproduce the claim, check the evidence holds. Be a skeptic: **default to refuted if you cannot reproduce or anchor the finding** in the real code (an unreproducible claim is noise, not a defect). Return { refuted: true, reason } if it does not hold; { refuted: false, reason } only if the defect genuinely stands. READ-ONLY: change nothing.`,
    { label: `verify-finding:${frd}`, phase: 'Review', model: 'sonnet', agentType: 'pandacorp:reviewer', schema: VERIFY_FINDING_SCHEMA, workFrom }),
  ))
  for (let i = 0; i < toVerify.length; i++) {
   const v = verdicts[i]
   if (!v) { survivingCorrections.push({ ...toVerify[i], verification: 'unverified-dead-skeptic' }); log(`⚠ ${frd}: a verifier returned no verdict — keeping its finding ALIVE (unverified, never drop a correction on a dead skeptic)`); continue }
   if (v.refuted === true) continue
   survivingCorrections.push({ ...toVerify[i], verification: 'confirmed', verifyReason: v.reason })
  }
  log(`⚖ ${frd}: verify → ${survivingCorrections.length} correction(s) survive (of ${corrections.length}; ${corrections.length - survivingCorrections.length} refuted or died)`)
 }
 const survList = survivingCorrections.length
  ? survivingCorrections.map((f) => `• [${f.verification}] ${f.file} — ${f.claim}${f.evidence ? ` (evidence: ${f.evidence})` : ''}`).join('\n  ')
  : '(none — the finder sweep + adversarial verify surfaced no surviving blocking correction)'
 const nitList = nits.length ? nits.map((f) => `• ${f.file} — ${f.claim}`).join('\n  ') : '(none)'
 agentSpawned += COST(P.judge)
 return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd, reviewIds.length, attemptNo)}${evidenceFallbackOf(frd, evidencePack)} FRD review + integration gate for ${frd} — the CLOSE stage of the split gate (proposal 31 T1.2). A parallel finder sweep (4 diverse lenses) + per-finding adversarial verification ALREADY RAN — so you do NOT re-hunt findings from scratch; you act on the survivors below. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.
 BUILD-JOURNAL (A1) — at WHICHEVER exit you take below (pass / reopen / blocked / fail), record this gate's verdict:${gateVerdictJournal(frd, reviewIds, attemptNo)}

  **SURVIVING BLOCKING CORRECTIONS (the finder sweep confirmed these — you must independently CONFIRM each one you act on; generator ≠ verifier, do not take the sweep's word):**
  ${survList}

  **ADVISORY NITS (from the finders — punch-list only, NEVER block or reopen on these):**
  ${nitList}

  **THE GATE IS SPLIT (DR-072) — two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd}), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch**. These BLOCK. The survivors above are your starting set — CONFIRM each independently against the code before you act; you may also add a blocking correction the sweep missed if you find one exercising the feature (the sweep is a head-start, not a ceiling).
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing, spacing, exact color/shade, minor polish. **NEVER reopen a WO for a nit.** APPEND each nit (the ones above + any you find) to \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap> · <file:approx-line if known>\`). The end-of-build Visual QA pass + the owner sweep these; they never gate VERIFIED.

  ${WHOLE_FRD_ORACLE}
  ${DRIFT_CLAIM_DIRECTIVE}
  ${DISMISSAL_CITATION_DIRECTIVE}${inventoryBlock(frd, reviewIds)}${gateContextScope(frd, reviewIds)}
${evidenceBlock(frd, ev)}${driftFinderBlock(frd, reviewIds)}
  1) Independently CONFIRM the surviving corrections and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising the work orders TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a confirmed real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again:** you are REVIEW-ONLY — do NOT stamp BLOCKED, do NOT write decisions.md, do NOT commit; just${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)}${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)} return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' } — the engine persists the BLOCKED state + the decision record on the MAIN tree. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH BEFORE any revert. **FIX-FORWARD MANDATE (DR-073): a BOUNDED fault you can name at file:line with a fix of ≤ ~30 lines MUST take this findings exit.** For EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (fails WITHOUT the fix, passes WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)}${GATE_VERDICT(frd, 'reopen', `,"reopened":%s`, ` "<the count of work orders you are reopening — an integer>"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }.
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built, do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  If it's broken and you can't pinpoint specific WOs, first classify \`blocked_reason\` ('needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error'), then — **unless** that reason is 'needs-owner' AND a \`fail\` entry of your traceability carries \`claim: "preexisting"\` (BL-0178/BL-0185: then emit NOTHING here — the engine adjudicates the claim first and emits this gate's ONE terminal outcome itself, so a block it lifts is never reported as both blocked and passed) —${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the SAME blocked_reason value you are about to return>"`)} return { green: false, failure, blocked_reason }. **\`failure\` MUST open with ONE sentence naming what is RED and what the owner must do — any context or praise for what passed comes AFTER that sentence, never before it** (F1/BL-0174: the engine keeps only the first ~400 chars of \`failure\`; leading with praise for passing work silently drops the real blocking cause).${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`,
  { label: `gate:${frd}`, phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA, workFrom })
}
const gateWorktreePrompt = (wt, sha, bootstrap, onFailure) =>
 `C2 gate worktree — prepare a FROZEN detached checkout at ${wt} pinned to commit ${sha} (MAIN-tree git op; this is the only main-tree git command you run here). Do EXACTLY:
      1) If the directory ${wt} does NOT exist: first confirm \`git -C ${PROJECT_DIR} worktree list --porcelain\` has NO worktree entry for that exact path. Then run \`git -C ${PROJECT_DIR} worktree add --detach ${wt} ${sha}\` and, from the project root you started in, run exactly \`(${gateProjectCd(wt)} && ${bootstrap})\` — the cd enters the PROJECT directory inside the worktree (the worktree holds the WHOLE repo: a nested project's \`.pandacorp/\` is under its prefix, not at the worktree root) (BL-0149 — it reconstitutes node_modules and everything else a fresh worktree needs; it is idempotent, safe to re-run, and skips reinstalling when the lockfile hasn't changed). Return { ok: true, created: true }.
      2) If the directory ALREADY exists: reuse it ONLY if \`git -C ${PROJECT_DIR} worktree list --porcelain\` records that exact canonical path AND \`git -C ${wt} status --porcelain=v1 --untracked-files=all\` prints nothing. If either check fails, DO NOT mutate anything; return { ok: false, failure: "gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved", dirty: [every line that status command printed, verbatim — the engine names them in its log (BL-0183); [] when the failure was not dirt] }.
      3) For a registered CLEAN reuse, \`git -C ${wt} checkout --detach ${sha}\`, then re-run exactly \`(${gateProjectCd(wt)} && ${bootstrap})\` from the project root (BL-0149 — same idempotent script; it is cheap when pnpm-lock.yaml is unchanged, so you do NOT need to diff the lockfile yourself first). Return { ok: true, created: false }.
      If ANY step fails (stuck lock, unreachable sha, linked path conflict, dirty/orphan evidence, worktree-bootstrap.sh exits non-zero), do NOT retry and DO NOT delete, reset, clean, prune, recreate, or force-remove the path: return { ok: false, failure: "<what failed>" }. ${onFailure} NEVER modify preserved crash evidence.`
const GATE_WORKTREE_SCHEMA = { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, created: { type: 'boolean' }, failure: { type: 'string' }, dirty: { type: 'array', items: { type: 'string' } } } }
async function ensureGateWorktree(sha, slot = LEGACY_SLOT) {
 if (slot.state === 'failed') return false
 if (slot.state === 'ready' && slot.lastSha === sha && slot.clean) return true
 if (slot.inFlight && slot.inFlightSha === sha) return slot.inFlight
 const pooled = slot !== LEGACY_SLOT
 const attempt = (async () => {
  agentSpawned++
  let r
  try {
  r = MECH_SCRIPT
   ? (await runMechOp('gate-prepare', `--path ${shellQuote(pooled ? slot.path : GATE_WORKTREE)} --sha ${shellQuote(sha)}${pooled ? ` --port ${slot.port}` : ''}`, { label: pooled ? `gate-worktree:${slot.id}` : 'gate-worktree', phase: 'Review' })).body
   : await agent(
   pooled
    ? gateWorktreePrompt(slot.path, sha, `PANDACORP_E2E_PORT=${slot.port} bash .pandacorp/worktree-bootstrap.sh`, `The engine drops THIS gate slot (${slot.id}) from the parallel pool for the rest of the run (D1); the other slots keep gating.`)
    : gateWorktreePrompt(GATE_WORKTREE, sha, 'bash .pandacorp/worktree-bootstrap.sh', 'The engine falls back to synchronous gates on the quiet main tree for the rest of the run.'),
   { label: pooled ? `gate-worktree:${slot.id}` : 'gate-worktree', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: GATE_WORKTREE_SCHEMA })
  } catch (e) {
   if (pooled) { slot.clean = false; slot.lastSha = null }
   throw e
  }
  if (r && r.ok === true) { slot.state = 'ready'; slot.lastSha = sha; slot.clean = true; return true }
  slot.state = 'failed'; slot.lastSha = null; slot.clean = false
  const dirty = (r && Array.isArray(r.dirty)) ? r.dirty.filter(Boolean) : []
  if (pooled) slot.failedOnDirt = dirty.length > 0
  if (pooled) {
   if (dirty.length) log(`⊘ D1 (BL-0183): REFUSING to gate over a DIRTY gate slot ${slot.id} (${slot.path}) — uncommitted path(s) a gate would silently execute (vitest --changed runs untracked files): ${dirty.join(' | ')} — evidence preserved, inspect/salvage by hand`)
   log(`⚠ D1: gate slot ${slot.id} (${slot.path}) could not be prepared (${(r && r.failure) || 'no verdict'}) — dropped from the parallel pool (${gatePool.filter((x) => x.state !== 'failed').length}/${gatePool.length} slot(s) left)`)
   return false
  }
  if (dirty.length) log(`⊘ C2 (BL-0183): REFUSING to gate over a DIRTY gate worktree ${GATE_WORKTREE} — uncommitted path(s) a gate would silently execute (vitest --changed runs untracked files): ${dirty.join(' | ')} — evidence preserved, inspect/salvage by hand`)
  log(`⚠ C2: gate worktree could not be prepared (${(r && r.failure) || 'no verdict'}) — falling back to the LEGACY synchronous gate path for the whole run`)
  return false
 })()
 slot.inFlight = attempt
 slot.inFlightSha = sha
 try { return await attempt }
 finally { if (slot.inFlight === attempt) { slot.inFlight = null; slot.inFlightSha = null } }
}
const GATE_RELEASE_SCHEMA = {
 type: 'object', required: ['salvaged', 'remaining'],
 properties: {
  salvaged: { type: 'array', items: { type: 'object', required: ['path', 'status'], properties: { path: { type: 'string' }, status: { type: 'string', enum: ['untracked', 'modified', 'deleted'] }, sha256: { type: ['string', 'null'] } } } },
  remaining: { type: 'array', items: { type: 'string' }, description: 'every line the post-clean `git status --porcelain=v1 --untracked-files=all` printed — [] iff the worktree is clean' },
  failure: { type: 'string' },
 },
}
async function releaseGateWorktree(frd, gate, slot = LEGACY_SLOT) {
 const wt = slot.path
 const declared = (gate && Array.isArray(gate.testFiles)) ? gate.testFiles.filter(Boolean) : []
 const dir = gateEvidenceDir(frd)
 agentSpawned++
 let r = null
 try {
  r = MECH_SCRIPT
   ? (await runMechOp('gate-release', `--path ${shellQuote(wt)} --dir ${shellQuote(dir)}`, { label: `gate-release:${frd}`, phase: 'Review' })).body
   : await agent(
   `C2 gate-worktree RELEASE for ${frd} (BL-0182). The FRD gate for ${frd} just finished in the gate worktree ${wt}; whatever it left there must be SALVAGED to the durable evidence dir ${dir} and then CLEANED, so the next gate starts on a clean tree. You run commands only — judge nothing, edit no source, run no git command that writes the MAIN tree. Do EXACTLY, in order:
      1) LIST: \`git -C ${wt} status --porcelain=v1 --untracked-files=all\`. \`--untracked-files=all\` is REQUIRED — plain \`--porcelain\` collapses a new directory to one \`?? dir/\` line and its files would never be salvaged. Each line is \`XY <path>\`; the path is relative to the worktree ROOT (git prints repo-root paths even for a nested project) — keep it EXACTLY as printed (unquote it if git double-quoted it).
      2) SALVAGE each listed path: \`??\` → untracked; a \`D\` in either status column → deleted; anything else → modified. Untracked/modified: \`mkdir -p\` the parent and \`cp ${wt}/<path> ${dir}/<path>\` (overwrite), then \`shasum -a 256 ${dir}/<path>\` and record { path, status, sha256 }. Deleted: record { path, status: "deleted", sha256: null } (nothing to copy).
      3) REPORT: the gate's report is gitignored, so step 1 does not list it. Let P = \`git -C ${PROJECT_DIR} rev-parse --show-prefix\` (empty for a flat project, e.g. \`mission-control/\` for a nested one). If ${wt}/<P>.pandacorp/run/gate-report.json exists, copy it to ${dir}/gate-report.json (overwrite).
      4) CLEAN exactly the listed paths, one at a time, and ONLY a path whose step-2 copy SUCCEEDED (or a deleted one): untracked → \`git -C ${wt} --literal-pathspecs clean -f -- <path>\`; modified or deleted → \`git -C ${wt} --literal-pathspecs checkout -- <path>\` (\`--literal-pathspecs\`: a \`[slug]\` segment is a glob class otherwise and would clean sibling files). NEVER a blanket \`clean -fd\`/\`reset --hard\`/\`checkout .\`, and never remove, prune or recreate the worktree (BL-0067).
      5) POSTCONDITION: re-run the step-1 command and return every line it prints as \`remaining\` ([] when clean).
      The gate declared these test files (JSON): ${JSON.stringify(declared)} — informational only; salvage what git lists, not this list.
      Return { salvaged: [...], remaining: [...] }. If a command fails, stop there and return what you have plus \`failure: "<what failed>"\` — never clean a path you could not copy.`,
   { label: `gate-release:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: GATE_RELEASE_SCHEMA })
 } catch (e) { log(`⚠ C2 (BL-0182): the gate-worktree release for ${frd} threw (${(e && e.message) || e})`) }
 const salvaged = (r && Array.isArray(r.salvaged)) ? r.salvaged.filter((x) => x && typeof x.path === 'string' && x.path) : []
 const remaining = (r && Array.isArray(r.remaining)) ? r.remaining.filter(Boolean) : null
 if (remaining && remaining.length === 0 && !optionalText(r && r.failure)) slot.clean = true
 else {
  slot.clean = false
  log(`⚠ C2 (BL-0182): the gate worktree is NOT proven clean after ${frd}'s gate (${(r && r.failure) || (remaining ? 'paths remain' : 'no release verdict')})${remaining && remaining.length ? `: ${remaining.join(' | ')}` : ''} — the next gate re-probes it and falls back to the legacy path rather than gate over it`)
 }
 const tests = salvaged
  .filter((x) => x.status !== 'deleted' && typeof x.sha256 === 'string' && x.sha256 && REVIEWER_TEST_PATH.test(x.path))
  .map((x) => ({ path: x.path, sha256: x.sha256 }))
 const other = salvaged.filter((x) => !tests.some((t) => t.path === x.path))
 if (other.length) log(`◦ ${frd}: the gate also left non-test path(s) in the worktree — kept as evidence in ${dir} only, never ported: ${other.map((x) => `${x.path} (${x.status})`).join(', ')}`)
 const undeclared = declared.filter((d) => !tests.some((t) => t.path === d || t.path.endsWith(`/${d}`)))
 if (undeclared.length) log(`⚠ ${frd}: the gate declared test file(s) the worktree did not contain — nothing to port for them: ${undeclared.join(', ')}`)
 return { dir, tests }
}
const reviewerTestsByFrd = new Map()
const REVIEWER_TEST_HASH_SCHEMA = { type: 'object', properties: { hashes: { type: 'array', items: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, sha256: { type: ['string', 'null'] } } } }, failure: { type: 'string' } } }
function compareReviewerHashes(expected, observed) {
 const seen = new Map((Array.isArray(observed) ? observed : []).filter((o) => o && typeof o.path === 'string').map((o) => [o.path, o.sha256]))
 const problems = []
 for (const e of expected || []) {
  const got = seen.get(e.path)
  if (!got) problems.push(`${e.path}: missing`)
  else if (got !== e.sha256) problems.push(`${e.path}: sha256 ${got} ≠ reviewer's ${e.sha256}`)
 }
 return problems
}
const reviewerTestPaths = (rt) => rt.tests.map((t) => t.path).join(', ')
async function portReviewerTests(frd, gate) {
 const ev = gate && gate.reviewerEvidence
 if (!gate || !Array.isArray(gate.reopen) || !gate.reopen.length || !ev || !ev.tests.length) return null
 agentSpawned++
 const r = await agent(
  `BL-0184 — PORT the reviewer's adversarial test files for ${frd} onto the MAIN tree BEFORE the patch (DR-080: the patch is judged by the reviewer's OWN files, never a re-typed copy). The review-only gate rejected in the gate worktree; the engine salvaged its test files into ${ev.dir}. ${REPO_ROOT_PATHS_NOTE} (1) run this port command VERBATIM, as ONE Bash call: \`${repoRootPortCommand(ev.dir, ev.tests.map((t) => t.path))}\`. (2) run this hash command VERBATIM, as ONE Bash call: \`${repoRootHashCommand(ev.tests.map((t) => t.path))}\` — and record { path, sha256 } for EACH entry of EXPECTED from its output (sha256 null for a MISSING line, or when step 1 failed). Stage nothing, commit nothing, touch nothing else. EXPECTED (JSON): ${JSON.stringify(ev.tests)}. Return { hashes: [{ path, sha256 }] }.`,
  { label: `port-reviewer-tests:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REVIEWER_TEST_HASH_SCHEMA })
 const problems = compareReviewerHashes(ev.tests, r && r.hashes)
 if (problems.length) {
  log(`⊘ ${frd} (BL-0184): could not port the reviewer's test files onto main (${problems.join('; ')}) — a patch would run without the tests that judge it (DR-080); re-gating ${frd} on the MAIN tree instead`)
  return false
 }
 reviewerTestsByFrd.set(frd, { dir: ev.dir, tests: ev.tests.map((t) => ({ path: t.path, sha256: t.sha256 })), rebless: false })
 log(`▹ ${frd}: the reviewer's ${ev.tests.length} RED test file(s) ported onto main for the patch ladder, sha256-pinned (BL-0184): ${ev.tests.map((t) => t.path).join(', ')}`)
 return true
}
function markReviewerTestsReblessed(frd) { const rt = reviewerTestsByFrd.get(frd); if (rt) rt.rebless = true }
async function checkReviewerTestIntegrity(frd) {
 const rt = reviewerTestsByFrd.get(frd)
 if (!rt || !rt.tests.length) return null
 agentSpawned++
 const r = await agent(
  `BL-0184 — DR-080 integrity check of the reviewer's test files for ${frd}, BEFORE the independent verifier runs. ${REPO_ROOT_PATHS_NOTE} Run this hash command VERBATIM, as ONE Bash call: \`${repoRootHashCommand(rt.tests.map((t) => t.path))}\` — and record { path, sha256 } for EACH entry of EXPECTED from its output (sha256 null for a MISSING line).${rt.rebless ? ' Record only — change nothing.' : ` THEN, for every file whose hash differs from EXPECTED or that is missing, RESTORE the reviewer's original by running ITS OWN restore command VERBATIM (and no other): ${rt.tests.map((t) => `${t.path} → \`${repoRootPortCommand(rt.dir, [t.path])}\``).join('; ')} — record the hash you OBSERVED before restoring, never the restored one.`} Edit nothing else, stage nothing, commit nothing. EXPECTED (JSON): ${JSON.stringify(rt.tests)}. Return { hashes: [{ path, sha256 }] }.`,
  { label: `reviewer-test-hash:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REVIEWER_TEST_HASH_SCHEMA })
 if (rt.rebless) {
  const observed = (r && Array.isArray(r.hashes)) ? r.hashes : []
  const missing = rt.tests.filter((t) => !observed.some((o) => o && o.path === t.path && typeof o.sha256 === 'string' && o.sha256))
  if (missing.length) {
   log(`⊘ ${frd} (BL-0184): the gate-test repair left reviewer test file(s) missing (${missing.map((t) => t.path).join(', ')}) — coverage is never deleted; verification refused`)
   return { green: false, failure: `DR-080: reviewer test file(s) missing after the gate-test repair: ${missing.map((t) => t.path).join(', ')}` }
  }
  rt.tests = rt.tests.map((t) => ({ path: t.path, sha256: observed.find((o) => o.path === t.path).sha256 }))
  rt.rebless = false
  return null
 }
 const problems = compareReviewerHashes(rt.tests, r && r.hashes)
 if (!problems.length) return null
 log(`⊘ ${frd} (BL-0184): DR-080 BREACH — the reviewer's test file(s) changed or vanished after the gate (${problems.join('; ')}); originals restored, the patch is NOT certified`)
 return { green: false, failure: `DR-080: the reviewer's test file(s) were modified or removed after the gate (${problems.join('; ')}) — a patch may not edit the tests that judge it` }
}
const reviewerTestsPatchDirective = (frd) => {
 const rt = reviewerTestsByFrd.get(frd)
 if (!rt || !rt.tests.length) return ''
 return `\n  **THE GATE'S OWN RED TESTS ARE ON THIS TREE (BL-0184, DR-080):** ${reviewerTestPaths(rt)} (REPO-ROOT-relative — run them by absolute path, \`pnpm vitest run "$(git rev-parse --show-toplevel)/<path>"\`). They are the REVIEWER's: you may NOT edit, move, rename, skip, delete or re-type them — make them PASS with production code. The engine pinned their sha256; the independent verification FAILS the patch on any difference. If you believe one is defective, take the gate-test-defective exit below and leave the file untouched.`
}
const reviewerTestsVerifyDirective = (frd) => {
 const rt = reviewerTestsByFrd.get(frd)
 if (!rt || !rt.tests.length) return ''
 return `\n  **THE GATE'S OWN ADVERSARIAL TESTS (BL-0184, DR-080) — run them EXPLICITLY, by path:** the review-only gate rejected on these reviewer-authored files, ported onto this tree and sha256-checked by the engine just before you: ${reviewerTestPaths(rt)}. They are REPO-ROOT-relative: run \`pnpm vitest run "$(git rev-parse --show-toplevel)/<path>" …\` for each (a Playwright spec: \`pnpm playwright test\` with the same absolute path), IN ADDITION to the FRD test files above — never trust \`--changed\`/affected selection to have picked them up. Every one must PASS; a missing one is RED. Do NOT edit them, and do NOT stage them — you write nothing (BL-0191); the certify step commits them.`
}
const reviewerTestsStageDirective = (frd) => {
 const rt = reviewerTestsByFrd.get(frd)
 if (!rt || !rt.tests.length) return ''
 return ` **THE GATE'S OWN ADVERSARIAL TESTS (BL-0184, DR-080):** the verifier ran these reviewer-authored files (ported onto this tree and sha256-checked by the engine): ${reviewerTestPaths(rt)}. They go into the snapshot commit (A) through the commit protocol's staging command below. Do NOT edit them.`
}
const landingCommitProtocol = (testPaths) => ` **COMMIT PROTOCOL — do this LAST, after every edit and append above, and make NO commit after it:** stage snapshot (A) with exactly this command: \`git -C ${shellQuote(PROJECT_DIR)} add -u -- docs/frds .pandacorp\`${testPaths.length ? `, then stage the reviewer's test files with exactly this command: \`${repoRootStageCommand(testPaths)}\`` : ''} (if \`.pandacorp/track.jsonl\` or \`.pandacorp/build-journal.jsonl\` exists but git does not track it yet, \`git -C ${shellQuote(PROJECT_DIR)} add -f -- <that file>\`). Commit (A), then run \`git -C ${shellQuote(PROJECT_DIR)} status --porcelain -- docs/frds\`: it must print NOTHING — a line there is a VERIFIED flip, a rollup or a drift replica left out of the snapshot; stage and commit it before (B). Then make the pointer commit (B) exactly as the ordering below says. Every timeline/journal line belongs in (A): a bookkeeping commit after (B) leaves HEAD past last_green_sha.${testPaths.length ? ` ${REPO_ROOT_PATHS_NOTE}` : ''}`
async function capturePin(frds, preSha = null) {
 if (MECH_LEAN && preSha) {
  for (const frd of frds) { const st = frdState.get(frd); if (st) st.pinSha = preSha }
  return preSha
 }
 agentSpawned++
 const r = await agent(
  `Return the current MAIN-tree HEAD short sha (\`git -C ${PROJECT_DIR} rev-parse --short HEAD\`) — the pin the FRD gate(s) for ${frds.join(', ')} will freeze at. Change nothing, commit nothing. Return { sha: "<the short sha>" }.`,
  { label: `pin:${frds.join('+')}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: { type: 'object', required: ['sha'], properties: { sha: { type: 'string' } } } })
 const sha = (r && r.sha) || null
 for (const frd of frds) { const st = frdState.get(frd); if (st) st.pinSha = sha }
 return sha
}
async function applyGate(frd, reviewIds, testFiles, sourceDir) {
 agentSpawned++
 const files = (testFiles || []).filter(Boolean)
 const fromEvidence = Boolean(sourceDir && sourceDir.startsWith(GATE_EVIDENCE_ROOT))
 const port = fromEvidence && files.length
  ? ` FIRST port the reviewer's adversarial test files — salvaged out of the gate worktree ${gateWorktreePathOf(frd)} into ${sourceDir} by the release step — onto the main tree: each \`${sourceDir}/<path>\` goes to \`<repo root>/<path>\` (the repo root is \`git -C ${PROJECT_DIR} rev-parse --show-toplevel\`) for ${files.join(', ')} — run this port command VERBATIM, as ONE Bash call: \`${repoRootPortCommand(sourceDir, files)}\`. ${REPO_ROOT_PATHS_NOTE}`
  : sourceDir && files.length
   ? ` FIRST port the reviewer's adversarial test files from the gate worktree onto the main tree — for EACH of these repo-relative paths copy \`${sourceDir}/<path>\` → \`<path>\` (mkdir -p the parent; overwrite): ${files.join(', ')}.`
   : (files.length ? ` The reviewer's adversarial test files are already on the main tree (${files.join(', ')}) — just make sure they are staged in the commit below.` : '')
 const gateReportPath = fromEvidence ? `${sourceDir}/gate-report.json` : sourceDir ? `${sourceDir}/.pandacorp/run/gate-report.json` : '.pandacorp/run/gate-report.json'
 const applyJournal = JOURNAL(
  `"wo":"%s","frd":"${frd}","attempt":0,"reopen_count":0,"rung":"gate","role":"verifier","kind":"resolution","classification":"","seam":null,"findingKey":"","tried":"gate passed in the pinned worktree; applied on main","verdict":"green","why":"%s","confidence":"high"`,
  ` "<the primary work order this gate verified, else ${(reviewIds || [])[0] || frd}>" "<one line: what the gate confirmed>"`)
 const link = commitChain.then(() => agent(
  `You are the SOLE main-tree git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race). Apply the PASSED FRD gate for ${frd} onto the MAIN tree (the review already happened; you only PERSIST it — do NOT re-review, do NOT re-run the suite).${port}
    **BEFORE you stamp anything (WP-08 cage):** read \`${gateReportPath}\` — the report the gate you are applying left behind (in the gate worktree, NOT your own main-tree copy of that filename, when this apply followed a concurrent gate) — and return its \`scope\` field VERBATIM as \`report_scope\`. If it reads \`partial\`, that gate ran \`--only\`/\`--files\` and certified NOTHING: stamp nothing, advance nothing, commit nothing, and return { done: false, report_scope: 'partial' }.
    Set the reviewed work orders (${(reviewIds || []).join(', ')}) frontmatter \`implementation_status: VERIFIED\` and **reset their \`reopen_count: 0\`** (DR-072 C2), then ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} Set safe_to_test:true through its owning transition until that field migrates.${driftFrontmatter(frd)}${emitGateOutcome(frd, 'pass', `,"passed":${(reviewIds || []).length}`)}${ACHIEVEMENT(frd)} BUILD-JOURNAL (A1): record the gate's green resolution (the trust boundary was the gate; you are its main-tree applier):${applyJournal}${landingCommitProtocol(fromEvidence ? files : [])}${fromEvidence || !files.length ? '' : ` Also stage the reviewer's test files (${files.join(', ')}) into (A).`}${LAST_GREEN_ORDERING} Return { done: true }.${inventoryPersistStep(frd)}`,
  { label: `apply-gate:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: APPLY_GATE_SCHEMA }))
 commitChain = link.then(() => {}, () => {})
 return link.then((r) => {
  if (isPartialReport(r)) { refusePartial(frd, 'apply-gate'); return false }
  recordInventoryWrite(frd, r)
  return Boolean(r && r.done === true)
 }, (e) => { log(`apply-gate failed for ${frd}: ${(e && e.message) || e}`); return false })
}
async function persistGateBlock(frd, reviewIds, reason, failure, alreadyTracked = false) {
 agentSpawned++
 const blockDrift = ((frdState.get(frd) || {}).landingDrift || []).map((d) => d.id)
 const driftNote = blockDrift.length ? ` BL-0178: the pre-existing drift the engine proved for this gate (${blockDrift.join(', ')}) is ALREADY filed as draft change card(s) and is NOT a reason for this block — do not list it as a blocker in decisions.md.` : ''
 const link = commitChain.then(() => agent(
  `You are the SOLE main-tree git writer at this instant (serialized). The FRD gate for ${frd} classified a BLOCK (${reason})${failure ? ` — ${failure}` : ''} but is review-only, so persist it on the MAIN tree now. For EACH reviewed work order (${(reviewIds || []).join(', ')}) whose frontmatter fault warrants it (a DR-072 non-progress WO has \`reopen_count\` ≥ ${MAX_REOPENS}; for a generic gate block, all of them): set \`implementation_status: BLOCKED\` + \`blocked_reason: ${reason}\`. Append an owner-facing record (SPANISH) to .pandacorp/inbox/decisions.md — what the gate keeps rejecting, the diagnosis, what the owner must decide. ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.${driftNote} Commit (Conventional Commits, scope).${alreadyTracked ? '' : emitGateOutcome(frd, 'blocked', `,"blocked_reason":"${reason}"`)}
${PARALLEL_GATES ? PARALLEL_PERSIST_NO_SALVAGE : `    **Gate-worktree salvage (F2/BL-0175) — run this BEFORE you finish, it is a SEPARATE tree from the one you just committed to:** if ${GATE_WORKTREE} exists and \`git -C ${PROJECT_DIR} worktree list --porcelain\` registers it, run \`git -C ${GATE_WORKTREE} status --porcelain=v1 --untracked-files=all\` (BL-0182: without \`--untracked-files=all\` a new directory collapses to one \`?? dir/\` line and its files are never salvaged; paths are worktree-ROOT-relative). For EACH path it reports, copy that file to \`.pandacorp/run/gate-evidence/${frd}/<the same relative path>\` (mkdir -p the parent; this is a gitignored MAIN-tree append, not a git write), then run \`git -C ${GATE_WORKTREE} clean -f -- <that exact path>\` for an untracked file or \`git -C ${GATE_WORKTREE} checkout -- <that exact path>\` for a modified tracked one — copy-then-clean EXACTLY the reported paths, one at a time, NEVER a blanket \`clean -fd\`/\`reset --hard\`/\`checkout .\` (BL-0067: this worktree may hold other crash evidence you must not touch). If \`git status --porcelain\` is already empty, or the worktree does not exist, skip this step entirely — do not create or touch anything. This keeps the gate worktree clean for C2 reuse by the NEXT FRD gate this run, instead of silently degrading the rest of the run (and every future one) to the legacy synchronous gate path. `}Return { done: true }.`,
  { label: `persist-block:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA }))
 commitChain = link.then(() => {}, () => {})
 return link.then(() => true, () => false)
}
const buildCostByFrd = new Map()
const repairCostByFrd = new Map()
const REPAIR_BUDGET_FLOOR = 9
const repairBudget = (frd) => Math.max(REPAIR_BUDGET_FACTOR * (buildCostByFrd.get(frd) || 0), REPAIR_BUDGET_FLOOR)
const buildTokensByFrd = new Map()
const buildTokensReliable = new Map()
const repairTokensByFrd = new Map()
const loggedTokenFallback = new Set()
const tokenFallbackReason = new Map()
function markTokensUnreliable(frd, why) {
 buildTokensReliable.set(frd, false)
 if (!tokenFallbackReason.has(frd)) {
  tokenFallbackReason.set(frd, why)
  log(`… ${frd}: repair brake on agent-weight, usage unreliable — ${why} (budget.spent() is one un-partitioned counter; D1/BL-0138)`)
  loggedTokenFallback.add(frd)
 }
}
function recordWaveBuildTokens(waveFrds, tokensSpent) {
 if (waveFrds.length === 1) {
  const [frd] = waveFrds
  if (tokensSpent > 0 && buildTokensReliable.get(frd) !== false) {
   buildTokensByFrd.set(frd, (buildTokensByFrd.get(frd) || 0) + tokensSpent)
   buildTokensReliable.set(frd, true)
  }
 } else {
  for (const frd of waveFrds) buildTokensReliable.set(frd, false)
 }
}
const tokenRepairBudget = (frd) => (buildTokensReliable.get(frd) === true ? REPAIR_BUDGET_FACTOR * (buildTokensByFrd.get(frd) || 0) : null)
function chargeRepair(frd, model, tokensSpent = 0) {
 if (!REPAIR_BRAKE) return
 repairCostByFrd.set(frd, (repairCostByFrd.get(frd) || 0) + COST(model))
 if (tokensSpent > 0) repairTokensByFrd.set(frd, (repairTokensByFrd.get(frd) || 0) + tokensSpent)
}
async function chargedRepair(frd, model, callFn) {
 const before = budget.spent()
 const gatesAlongside = PARALLEL_GATES ? gatesInFlight.size : 0
 if (gatesAlongside) markTokensUnreliable(frd, `${gatesAlongside} parallel gate(s) were reviewing while its repair rung ran`)
 try {
  return await callFn()
 } finally {
  chargeRepair(frd, model, gatesAlongside ? 0 : budget.spent() - before)
 }
}
function canAffordRepair(frd, model, units = 1) {
 if (!REPAIR_BRAKE) return true
 const ceiling = repairBudget(frd)
 const spent = repairCostByFrd.get(frd) || 0
 if (spent === 0) return true
 if (spent + COST(model) * units <= ceiling) return true
 const tokenCeiling = tokenRepairBudget(frd)
 if (tokenCeiling === null) {
  if (!loggedTokenFallback.has(frd)) {
   loggedTokenFallback.add(frd)
   log(`… ${frd}: repair brake on agent-weight, usage unavailable (this FRD's build spend was mixed into a multi-FRD wave — no trustworthy per-FRD token total, BL-0138)`)
  }
  return false
 }
 return (repairTokensByFrd.get(frd) || 0) <= tokenCeiling
}
async function blockRepairBudgetExhausted(frd, reopenIds, gate) {
 agentSpawned += COST(P.judge)
 const spent = repairCostByFrd.get(frd) || 0
 const ceiling = repairBudget(frd)
 const report = gate && gate.gateReport ? JSON.stringify(gate.gateReport).slice(0, 4000) : '(the gate returned no machine-readable report; quote its `failure` text instead)'
 const record = `El motor gastó ${spent} unidades de coste reparando ${frd}, por encima del techo de ${ceiling} (${REPAIR_BUDGET_FACTOR}× lo que costó construir esa feature en esta corrida). Seguir intentándolo sale más caro que construirla entera, así que paro y te lo paso: el trabajo está INTACTO en la rama y el informe objetivo del gate va adjunto.`
 return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}REPAIR BUDGET EXHAUSTED (WP-08) for ${frd}. Repair has cost ${spent} weighted cost-units against a ceiling of ${ceiling} (${REPAIR_BUDGET_FACTOR}× this FRD's own build spend this run). Do NOT patch, do NOT diagnose, do NOT retry — the point of stopping is to stop.
  1) **PRESERVE the work exactly as it is.** Do NOT revert, do NOT \`git checkout\` anything, do NOT \`git rm\` anything, and never a hard reset — the partially-repaired build stays on the branch so the owner (or a later run) can pick it up. Commit nothing but the state changes in step 2/3.
  2) Set EACH reopened work order (${(reopenIds || []).join(', ')}) \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  3) Append the owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH) and ATTACH the objective gate-report under it as a fenced \`\`\`json block so the owner reads the machine verdict, not a summary of it: ${record}
  GATE-REPORT (verbatim, from the failing gate): ${report}
  4) COMMIT (Conventional Commits, scope) staging the frontmatter flips, decisions.md, status.yaml and \`.pandacorp/build-journal.jsonl\`.${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"needs-owner","repair_units":${spent},"repair_budget":${ceiling}`)}${NOTIFY('FRD ' + frd + ' parado: la reparacion ya cuesta mas de ' + REPAIR_BUDGET_FACTOR + 'x construirlo — trabajo intacto, necesita tu decision')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
  { label: `block-repair-budget:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}
async function attemptRepair(frd, context, gateBlocked = false) {
 if (infraHalt) throw new InfraError(`run paused (${infraHalt.kind}): no repair of ${frd}`, { refused: true })
 agentSpawned += COST(P.judge)
 return await chargedRepair(frd, P.judge, () => agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}The build of FRD ${frd} hit a problem: ${context}. You are the repair engineer — TRY TO FIX it before we give up.
  1) Diagnose the root cause: read the failing output, the work orders, and .pandacorp/comms/progress.md.
  2) If it is within your reach (code / test / local config): fix the PRODUCTION code (never weaken or skip tests) until \`bash .pandacorp/verify.sh\` is green for this feature; set the affected work orders' frontmatter back to \`implementation_status: IN_REVIEW\`; commit (Conventional Commits with scope, the subject naming ${frd} and the work orders you fixed); return { green: true }.
  3) If you CANNOT fix it, classify WHY, set the affected work orders' frontmatter to \`implementation_status: BLOCKED\` + \`blocked_reason: <reason>\`, then ${SYNC_ROLLUPS} Discard ONLY the UNCOMMITTED edits of the blocked work orders' files (yours and a failed build's): restore tracked ones to HEAD with the BL-0202 RESTORE COMMAND \`${scopedRestoreCommand('HEAD')}\` and remove new untracked ones with the BL-0202 CLEAN COMMAND \`${scopedCleanCommand()}\` (each VERBATIM except ${SCOPED_PATHS_NOTE} List the paths with \`${PROJECT_STATUS_COMMAND}\`). **Never touch COMMITTED code and never restore anything "to last_green_sha"** (the pin may already contain the blocked work orders' rejected build, BL-0212): right after you return, the engine discards the blocked work orders' committed code by reverting their OWN commits (DR-070). Commit only the status change (the subject naming ${frd} and the work orders)${gateBlocked ? `, then append ONE more printf naming the blocked_reason you are actually returning below (needs-owner, external or error) — literally: ${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the blocked_reason you return: needs-owner|external|error>"`)}` : ''}, and return { green: false, blocked_reason, failure }:
     - 'needs-owner' → it needs a HUMAN action/decision the agent can't take: a missing env var or secret, an external account/service to set up, a product decision. ALSO append it to .pandacorp/inbox/decisions.md (what's blocked, the options, your recommendation).
     - 'external' → a transient OUTSIDE failure (no internet, an upstream 5xx) — worth a retry on a later run, not our bug.
     - 'error' → a technical failure you could not resolve.`,
  { label: `repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA }))
}
async function attemptPatch(frd, findings, reviewIds, priorDiagnosis = null, mech = null) {
 const scoped = Boolean(SCOPED_REPAIR && mech && mech.mechanical && !priorDiagnosis)
 const patchModel = scoped ? 'sonnet' : 'opus'
 const patchEffort = scoped ? 'medium' : 'xhigh'
 agentSpawned += COST(patchModel)
 if (scoped) log(`◦ ${frd}: gate-report classes ${mech.classes.join('+')} are MECHANICAL (${mech.subgates.join(', ')}) — patch-1 on sonnet/medium with a scoped inner loop instead of opus/xhigh (WP-08)`)
 const scopeFlags = scoped
  ? `--only=${mech.subgates.join(',')}${mech.files.length ? ` --files=${mech.files.join(',')}` : ''}`
  : ''
 const list = (findings || []).map((x) => `• ${x.wo}: ${x.finding}${x.failingTest ? ` — failing test: ${x.failingTest}` : ''}${x.files && x.files.length ? ` — file(s): ${x.files.join(', ')}` : ''}`).join('\n  ') || '(see the gate output)'
 const diagText = priorDiagnosis
  ? `\n  DIAGNOSIS OF WHY PATCH-1 FAILED (A3 — a HYPOTHESIS to verify against the CURRENT code, re-diagnose; it may be wrong): classification=${priorDiagnosis.classification || 'point'}; seam=${priorDiagnosis.seam ? ((priorDiagnosis.seam.files || []).join(', ') + (priorDiagnosis.seam.symbol ? ' @ ' + priorDiagnosis.seam.symbol : '')) : 'n/a'}${priorDiagnosis.seam && priorDiagnosis.seam.why ? ' — ' + priorDiagnosis.seam.why : ''}. Address that seam this time; if it does not match what you observe, follow the code.`
  : ''
 const patchAttemptJournal = JOURNAL(
  `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"patch","role":"builder","kind":"attempt","classification":"","seam":null,"findingKey":"%s","tried":"%s","verdict":"","why":"%s","confidence":"%s"`,
  ` "<the primary reopened work order you patched, else ${(reviewIds || [])[0] || frd}>" "<its attempt number, an integer>" "<its current reopen_count, an integer>" "<\`<file>::<one-line claim>\` of the primary finding>" "<one line: what you changed>" "<one line: why>" "<low|medium|high>"`)
 return await chargedRepair(frd, patchModel, () => agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'patch' })}Patch-in-place repair (DR-073)${priorDiagnosis ? ' — SECOND diagnosis-guided attempt (A3 patch-2)' : ''}. The build of ${frd} is ~CORRECT EXCEPT these specific findings:
  ${list}${diagText}${reviewerTestsPatchDirective(frd)}
  Patch ONLY these on the EXISTING build — do NOT revert, do NOT rebuild from scratch, do NOT touch unrelated files. For each finding, make the RED-proven failing test PASS (production code, never weaken/skip a test). Reviewed work orders this cycle: ${(reviewIds || []).join(', ')}.
  BUILD-JOURNAL (A1): record ONE kind:"attempt" line for this patch (descriptive — verdict stays empty, a patcher never certifies itself):${patchAttemptJournal}
  THEN RE-GATE (this is the safety invariant — a focused gate is NOT enough, red-team-A): run the FULL FRD adversarial + integration tests for ${frd} AND a WHOLE-PROJECT \`pnpm knip\` + \`pnpm biome check .\` + \`pnpm tsc --noEmit\` (NOT \`verify.sh --since\` — a dead export left by the patch must not slip to a sibling FRD's global gate). Everything must be whole-project-clean.
  **SELF-REPAIR BUDGET (DR-107) — a red introduced by YOUR OWN edits does not end the patch:** if the re-gate fails on something YOUR patch just added or touched (a type/lint error in a file you created or edited — e.g. a TS2345 in your own new test file), FIX that and re-gate. You may spend up to 2 such internal fix-and-re-gate cycles. (The real incident this exists for: a 1-line i18n patch was discarded — and its whole work order rebuilt from scratch — because its own new a11y spec had a trivial type error the old contract forbade fixing.)${scoped ? `
  **SCOPED INNER LOOP (WP-08) — for those ≤2 internal cycles ONLY, do NOT re-run the whole project.** The gate report says this failure is confined to ${mech.subgates.join(' + ')}, so re-check with \`bash .pandacorp/verify.sh ${scopeFlags}\` (it runs only those sub-gates, narrows biome to those paths and vitest to their related tests; tsc/knip/madge stay whole-program inside it). Add any file YOU touch to that \`--files\` list as you go. Such a run stamps the gate report \`scope:"partial"\` and CERTIFIES NOTHING — it is a fast inner check, which is exactly why the whole-project RE-GATE above remains mandatory and unscoped before you commit. If a scoped check surfaces a failure OUTSIDE the named sub-gates, stop scoping and go back to the full re-gate.` : ''}
  **If whole-project-clean:** COMMIT the patch (Conventional Commits, scope, the subject naming ${frd} and the work orders you patched — a later revert attributes the patch by them, BL-0212), staging \`.pandacorp/build-journal.jsonl\` too (append-only — your attempt line) — but do NOT set any WO \`VERIFIED\`, do NOT touch \`reopen_count\`, do NOT advance \`last_green_sha\`/status.yaml: you patched it, so you may not certify it (constitution rule 4, generator ≠ verifier — audit-20). An INDEPENDENT verifier re-runs the gate and stamps. Return { green: true }.
  **If the blocker is a DEFECTIVE reviewer test (BL-0001):** you conclude a blocking adversarial test is INTERNALLY INCONSISTENT or unsatisfiable by ANY correct implementation (e.g. it asserts desktop-only nav visibility without forcing a viewport while the Playwright config runs desktop+mobile) — **or (BL-0051) it is a BLESSED test asserting a contract that a work order of THIS FRD intentionally DEROGATES**, which no correct implementation of the new contract can satisfy either — do NOT edit that test (the patcher never rewrites the reviewer's tests) and do NOT keep bending production code to satisfy it: UNDO all your own edits (restore files you modified, delete files you created — \`git status\` must read as you found it, EXCEPT the append-only \`.pandacorp/build-journal.jsonl\` line, which is a durable record of this attempt and is swept by the engine's next commit — do NOT undo it),${PATCH_RESULT(frd, 'gate-test-defective')} and return { green: false, cause: 'gate-test-defective', defectiveTests: [{ path, why }], failure }. The engine routes it to an independent gate-test repair — not to a revert of the build.
  **If you CANNOT green it in place** (the ORIGINAL build genuinely fails beyond the findings, or your self-repair budget is spent): UNDO all your own edits the same way — leave the tree exactly as you found it (do NOT commit, do NOT revert the WO; the engine reverts cleanly), EXCEPT the append-only \`.pandacorp/build-journal.jsonl\` line (a durable record of this attempt — leave it; the engine's next commit sweeps it),${PATCH_RESULT(frd, 'code-fail')} and return { green: false, cause: 'code', failure: <why> }.`,
  { label: `patch:${frd}`, phase: 'Review', model: patchModel, effort: patchEffort, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA }))
}
async function repairGateTest(frd, defectiveTests, reviewIds, deadlock) {
 agentSpawned += COST(P.judge)
 markReviewerTestsReblessed(frd)
 const list = (defectiveTests || []).map((t) => `• ${t.path}: ${t.why}`).join('\n  ') || '(see the patch output)'
 const head = deadlock
  ? `GATE-TEST RE-BLESS — DEADLOCK BREAK (BL-0051) for ${frd}. The diagnoser classified this failure **deadlocked-contract** (confidence ${(deadlock && deadlock.confidence) || 'medium'}): a BLESSED reviewer test still asserts a contract that a work order of THIS SAME FRD intentionally DEROGATES, while the work order that would re-bless it \`dependsOn\` the derogating one — neither can ever go green (LESSON-0104). Diagnosis: ${(deadlock && deadlock.seam && deadlock.seam.why) || (deadlock && deadlock.decisionRecord) || '(see the build journal)'}. The blessed test(s) at issue:`
  : `GATE-TEST REPAIR (BL-0001) for ${frd}. The patch agent flagged these reviewer adversarial test(s) as DEFECTIVE — internally inconsistent, unsatisfiable by ANY correct implementation, or asserting a contract this FRD's own work orders intentionally derogate (BL-0051):`
 return await chargedRepair(frd, P.judge, () => agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate-test-repair' })}${head}
  ${list}
  You are an INDEPENDENT reviewer (you own the gate's tests; the patcher may not touch them). For EACH flagged test, judge the claim on the evidence — do not take the patcher's word:
  - **Genuinely defective** (the assertion contradicts its own setup/config, or no correct implementation of the FRD's acceptance criteria could satisfy it): REPAIR the test so it correctly asserts the FRD's REAL acceptance criterion (fix the assertion/setup — e.g. force the viewport it assumed; NEVER delete the coverage or weaken what the AC requires).
  - **DEROGATED CONTRACT (BL-0051 deadlock break)** (the test is internally consistent, but the contract it encodes was intentionally SUPERSEDED by a work order of THIS FRD): before you accept this, PROVE the derogation is DECLARED — read ${frd}'s \`frd.md\`, its blueprint and the sibling work orders **including their \`dependsOn\` graph**, and confirm a work order states the new contract. Only then RE-BLESS the test: rewrite the assertion(s) to the NEW contract the FRD now specifies (never delete the coverage, never weaken what the acceptance criteria require — the re-blessed test must still FAIL against an implementation that gets the NEW contract wrong). **DR-080 stays intact:** you are the INDEPENDENT reviewer who OWNS this test, which is exactly why this edit is yours and never the implementer's/patcher's. If NO work order declares the derogation, it is not a derogation — fall through to "Actually right".
  - **Actually right** (the build really violates it, or the claimed derogation is undeclared): change NOTHING and return { green: false, cause: 'code', failure: 'test upheld: <why the build is wrong>' } — the engine falls back to the normal revert (or, for a deadlock claim, to the needs-owner block).
  After repairing: re-run the repaired test file(s) + the FULL FRD test files for ${frd} AND whole-project \`pnpm biome check .\` + \`pnpm tsc --noEmit\` against the EXISTING build (work orders this cycle: ${(reviewIds || []).join(', ')}). If everything is clean, COMMIT only the test repair(s) (Conventional Commits, scope; note WHY each test was defective in the commit body) and return { green: true } — an independent verifier still re-runs the objective gate and stamps. If red remains, change nothing further and return { green: false, cause: 'code', failure }.`,
  { label: `gate-test-repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA }))
}
async function verifyPatched(frd, reviewIds) {
 const breach = await checkReviewerTestIntegrity(frd)
 if (breach) return breach
 agentSpawned++
 const inherited = ((frdState.get(frd) || {}).inheritedFails) || []
 const inheritedBlock = inherited.length
  ? `\n  **INHERITED OPEN CONTRACTS (BL-0178 — the gate recorded these as \`fail\`; you may NOT return green while any one stays open):**\n  ${inherited.map((e, i) => `• [${e.contractClass}] ${e.contract}${Array.isArray(e.tests) && e.tests.length ? ` — the gate's tests: ${e.tests.join(', ')}` : ''} · key ${INHERITED_KEY(i)}`).join('\n  ')}\n  For EACH one, run the test file(s) that prove it now holds on the patched build (the gate's tests above when they exist in this tree, else the patch's RED-proven test for it) and report it in \`inheritedResolved\` as { key: <its key, e.g. ${INHERITED_KEY(0)}>, contract: <its contract text as listed, without the [class] tag and the tests suffix>, pass, tests }. "Everything is clean" REQUIRES every inherited contract pass:true with at least one test — otherwise take the red exit.`
  : ''
 const verdict = await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'verify-patch' })}INDEPENDENT post-patch verification for ${frd} (constitution rule 4: the patch agent may not certify its own fix). Re-run the objective gate yourself — trust nothing the patcher reported: the FULL FRD test files for ${frd} — the affected tests — (\`pnpm vitest run\` on them) AND whole-project \`pnpm tsc --noEmit\` + \`pnpm biome check .\`. ${reviewerTestsVerifyDirective(frd)}
  **Do NOT re-run \`pnpm knip\` here (C1b): attemptPatch already ran the whole-project knip immediately before this step (its dead-export gate, red-team-A) and nothing changed since it committed — re-running knip is a duplicate multi-second whole-project scan for no new signal (the close-out full suite covers it once more at the end).**
  **YOU VERIFY — YOU DO NOT STAMP (BL-0191): write NOTHING, whatever the outcome** — no frontmatter or status.yaml edit, no journal/track/dashboard line, no \`git add\`, no commit. The engine checks your verdict (the WP-08 scope cage and every inherited contract below) BEFORE anything is certified; only an accepted verdict is then persisted by a separate serialized step.
${inheritedBlock}
  **If everything is clean:** return { green: true, inheritedResolved, report_scope, resolved: <one line: what the patch resolved> }.
  **If anything is red:** return { green: false, failure: <what failed> } — the engine reverts + reopens.
  **WHOLE-PROJECT ONLY (WP-08 cage):** run the checks above unscoped — never \`verify.sh --only\`/\`--files\`. Yours is THE certification verdict: a scoped run stamps \`scope:"partial"\` and the engine will refuse your verdict outright.${REPORT_SCOPE_DIRECTIVE}`,
  { label: `verify-patch:${frd}`, phase: 'Review', model: P.worker, agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA })
 if (!verdict || verdict.green !== true) return verdict
 if (isPartialReport(verdict)) {
  refusePartial(frd, 'the independent post-patch verification')
  return { ...verdict, green: false, failure: 'verification ran a SCOPED gate (gate-report scope:"partial") — it certifies nothing (WP-08 cage)' }
 }
 const open = unresolvedInherited(inherited, verdict.inheritedResolved)
 if (open.length) {
  const names = open.map((e) => contractIdOf(e.contract) || e.contract).join(', ')
  log(`⛔ ${frd}: the post-patch verifier claims GREEN but ${open.length} inherited fail contract(s) are not proven closed (${names}) — REFUSING to certify (BL-0178)`)
  return { ...verdict, green: false, failure: `BL-0178: inherited fail contract(s) not proven closed by a passing test: ${names}` }
 }
 const stamped = await certifyPatched(frd, reviewIds, verdict)
 if (!stamped) {
  log(`⊘ ${frd}: the independent verification ACCEPTED the patch but the certify step did not confirm its stamp — NOT marking it verified and NOT reverting the verified code; it re-gates next pass (BL-0191)`)
  return { ...verdict, green: false, unstamped: true, failure: 'BL-0191: the certify step did not confirm the stamp of an accepted post-patch verification' }
 }
 return verdict
}
async function certifyPatched(frd, reviewIds, verdict) {
 agentSpawned++
 const resolved = String((verdict && verdict.resolved) || '').replace(/[`\n\r]/g, ' ').slice(0, 300)
 const resolutionJournal = JOURNAL(
  `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"verify","role":"verifier","kind":"resolution","classification":"","seam":null,"findingKey":"","tried":"patched in place, independently verified","verdict":"green","why":"%s","confidence":"high"`,
  ` "<the primary patched work order, else ${(reviewIds || [])[0] || frd}>" "<its attempt number, an integer>" "<its reopen_count BEFORE you reset it, an integer>" "<one line: what the patch resolved>"`)
 const link = commitChain.then(() => agent(`You are the SOLE main-tree git writer at this instant (serialized — no other commit runs concurrently). An INDEPENDENT verifier just re-ran the objective gate over the in-place patch of ${frd} and the ENGINE accepted its verdict (WP-08 scope cage + every inherited open contract proven closed — BL-0178/BL-0191). You only PERSIST that certification: do NOT re-review, do NOT re-run the suite, do NOT edit code or tests.${resolved ? ` The verifier's summary of what the patch resolved: ${resolved}.` : ''}
  Set the patched work orders (${(reviewIds || []).join(', ')}) \`implementation_status: VERIFIED\` and **reset their \`reopen_count: 0\`**; ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} Set last_green_sha and safe_to_test through their current owning transition.${driftFrontmatter(frd)}${reviewerTestsStageDirective(frd)} BUILD-JOURNAL (A1) — record the independent verifier's kind:"resolution" (green) line (you persist ITS verdict; the patcher never certifies itself):${resolutionJournal}${emitGateOutcome(frd, 'pass', `,"passed":${(reviewIds || []).length},"via":"patch"`)}${PATCH_RESULT(frd, 'green')}${ACHIEVEMENT(frd)}${landingCommitProtocol(((reviewerTestsByFrd.get(frd) || {}).tests || []).map((t) => t.path))}${LAST_GREEN_ORDERING} Commits use Conventional Commits with a scope. Return { done: true }. If you cannot complete the stamp, return { done: false, failure: <why> }.`,
  { label: `certify-patch:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: APPLY_GATE_SCHEMA }))
 commitChain = link.then(() => {}, () => {})
 return link.then((r) => Boolean(r && r.done === true), (e) => { log(`certify-patch failed for ${frd}: ${(e && e.message) || e}`); return false })
}
const WO_REVERT_OK = new Set(['reverted', 'nothing'])
function parseWoRevert(answer, frd, mode) {
 const raw = unwrapAnswer(answer, 'output')
 const text = raw && typeof raw.output === 'string' ? raw.output.trim().split('\n').pop() : ''
 if (!text) return { receipt: null, error: 'the revert runner returned no output', transport: true }
 let j
 try { j = JSON.parse(text) } catch { return { receipt: null, error: 'the revert output is not valid JSON', transport: true } }
 if (!driftSealHolds(text)) return { receipt: null, error: 'the revert output failed its integrity seal (the relay altered it)', transport: true }
 if (j && j.ok === true && (j.frd !== frd || j.mode !== mode)) return { receipt: null, error: `the revert receipt is not this request's (it names ${String(j.frd).slice(0, 40)} ${String(j.mode).slice(0, 8)}, expected ${frd} ${mode})`, transport: true }
 if (!j || j.ok !== true) return { receipt: null, error: `the revert script refused its input: ${(j && j.error) || 'no ok:true'}` }
 if (!WO_REVERT_OK.has(j.status)) return { receipt: j, error: `${j.status}: ${j.reason || 'refused'}` }
 if (typeof j.changed !== 'boolean') return { receipt: j, error: 'the revert receipt carries no `changed` flag' }
 return { receipt: j, error: '' }
}
let woRevertSeq = 0
async function woRevert(frd, ids, mode, opts = {}) {
 if (infraHalt) throw new InfraError(`run paused (${infraHalt.kind}): no ${mode} of ${frd}'s code`, { refused: true })
 const stored = `.pandacorp/run/wo-revert/${frd}-e${LEASE_EPOCH}-${++woRevertSeq}-${mode}.json`
 const flags = [...ids.map((id) => `--wo ${shellQuote(id)}`), ...(opts.seam || []).map((p) => `--seam ${shellQuote(p)}`),
  opts.requireStatus ? `--require-status ${opts.requireStatus}` : '', opts.onlyStatus ? `--only-status ${opts.onlyStatus}` : '', opts.expectChange ? '--expect-change' : '',
  opts.recordIntent ? `--record-intent ${opts.recordIntent}` : ''].filter(Boolean).join(' ')
 const cmd = `${WO_REVERT_CLI_COMMAND} ${mode} --project ${shellQuote(PROJECT_DIR)} --project-name "${PROJECT}" --frd ${shellQuote(frd)} ${flags} --out ${shellQuote(stored)}`
 const relay = async (label, command) => {
  agentSpawned++
  try {
   return await agent(`MECHANICAL COMMAND RUNNER — BL-0212 ${mode === 'plan' ? 'revert plan (changes no tracked file)' : mode === 'recover' ? 'interrupted-revert recovery' : 'revert'} for ${frd}. Your SOLE action is to execute this exact command ONCE from the project root (no command before or after it) and return its stdout VERBATIM as \`output\`: \`${command}\`. It prints ONE JSON line ending in an integrity checksum (\`"sum":"…"\`): copy it CHARACTER FOR CHARACTER — the engine rejects any altered copy. A non-zero exit is data, not a problem for you to fix: do not inspect, edit, restore, stage, commit or revert anything yourself.`,
    { label, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) {
   if (isInfraError(e)) throw e
   log(`⚠ ${frd}: the ${label} runner threw (${(e && e.message) || e})`)
   return null
  }
 }
 let parsed = parseWoRevert(await relay(`wo-revert-${mode}:${frd}`, cmd), frd, mode)
 if (!parsed.receipt && parsed.transport) {
  log(`⚠ ${frd}: ${parsed.error} — re-reading the stored revert receipt once (BL-0212)`)
  parsed = parseWoRevert(await relay(`wo-revert-replay:${frd}`, `${WO_REVERT_CLI_COMMAND} replay --project ${shellQuote(PROJECT_DIR)} --file ${shellQuote(stored)}`), frd, mode)
 }
 return { ok: !parsed.error, receipt: parsed.receipt, error: parsed.error }
}
function noteRevert(frd, ids, receipt, expectChange) {
 const files = (receipt.files || []).filter((x) => x.action !== 'keep')
 if (!receipt.changed) {
  if (expectChange) log(`⚠ RevertNoop ${frd}: discarding ${ids.join(', ')} changed NOTHING (${receipt.reason || 'no committed attempt found'}) — the rebuild starts from the current tree (BL-0212)`)
  return
 }
 log(`↩ ${frd}: discarded the rejected work of ${ids.join(', ')} — ${files.length} file(s) (${files.filter((x) => x.via === 'pin').length} restored to last_green_sha, ${files.filter((x) => x.via === 'revert').length} by reverting its own commits), commit ${receipt.committed || '?'} (BL-0212)`)
}
async function refuseRevert(frd, ids, rv, { flip = false, blocked = false, emit = true } = {}) {
 const why = rv.error || 'unknown'
 const conflicts = rv.receipt && Array.isArray(rv.receipt.conflicts) && rv.receipt.conflicts.length ? ` Conflicting file(s): ${rv.receipt.conflicts.join(', ')}.` : ''
 const usableSha = rv.receipt && rv.receipt.status === 'usable' ? String(rv.receipt.usableSha || '?') : null
 log(usableSha
  ? `⛔ ${frd}: USABLE since ${usableSha} (a committed build_usable line) — the discard of ${ids.join(', ')} is refused; fix-forward only: BLOCKED needs-owner, nothing reverted (proposal 39 C6)`
  : `⛔ RevertRefused ${frd}: the rejected code of ${ids.join(', ')} could NOT be discarded without touching other work (${why}) — nothing was reverted; BLOCKED needs-owner (BL-0212)`)
 agentSpawned++
 const record = usableSha
  ? usableHoldRecord(frd, usableSha, ids, 'el revert de wo-revert.mjs')
  : `No pude descartar el código rechazado de ${ids.join(', ')} (${frd}) sin tocar trabajo de otras features: ${why}.${conflicts} Ese código sigue en main y puede romper el gate de otras FRDs. Decide cómo resolverlo (revertir a mano los commits de esas órdenes resolviendo el conflicto, o conservar el código y corregirlo).`
 await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}BL-0212 REVERT REFUSED for ${frd}. The engine's deterministic revert of the rejected work orders (${ids.join(', ')}) refused: ${why}.${conflicts} NOTHING was reverted and nothing may be: do NOT \`git checkout\`/\`restore\`/\`rm\`/\`revert\` any code file, never hand-resolve anything.
  1) ${blocked ? 'For EACH of these work orders that is BLOCKED' : `For EACH of these work orders${flip ? ' (just set PLANNED — their rejected code is still on main)' : ''}`}: set \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  2) Append this owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH): ${record}
  3) COMMIT (Conventional Commits, scope, the subject naming ${frd}) staging ONLY those frontmatter/rollup files, decisions.md and status.yaml.${emit ? emitGateOutcome(frd, 'blocked', `,"blocked_reason":"needs-owner"`) : ''}${NOTIFY(usableSha ? 'FRD ' + frd + ' USABLE rechazado por su gate: descartarlo necesita tu decision' : 'FRD ' + frd + ': no pude descartar el codigo rechazado sin tocar otras features — necesita tu decision')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
  { label: `block-revert-refused:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}
async function recordRepairDiscardIntent(frd, ids) {
 if (isUsable(frd)) return
 if (ids.length) await woRevert(frd, ids, 'plan', { recordIntent: 'BLOCKED' })
}
async function recoverPendingReverts() {
 for (const f of plan.frds || []) {
  if (ONLY && !ONLY.includes(f.frd)) continue
  const wos = f.workOrders || []
  const atRisk = wos.filter((w) => w.status === 'PLANNED' && (w.reopen_count || 0) >= 1).map((w) => w.id)
  if (!atRisk.length && !wos.some((w) => w.status === 'BLOCKED')) continue
  const rv = await woRevert(f.frd, [], 'recover')
  if (!rv.ok) {
   const named = rv.receipt && Array.isArray(rv.receipt.wos) && rv.receipt.wos.length ? rv.receipt.wos.map((w) => w.id) : atRisk
   await refuseRevert(f.frd, named, rv, { flip: atRisk.length > 0, blocked: atRisk.length === 0, emit: false })
   blockFrdInSchedule(f.frd, 'needs-owner')
   continue
  }
  const r = rv.receipt
  if (r.recovery === 'recovered') log(`↩ RevertRecovered ${f.frd}: a previous run was cut between the state flip and the discard — discarded the rejected work of ${(r.wos || []).map((w) => w.id).join(', ')} (${(r.files || []).filter((x) => x.action !== 'keep').length} file(s)), commit ${r.committed || '?'} (BL-0215)`)
  else if (r.recovery === 'stale' || r.recovery === 'dropped') log(`ℹ ${f.frd}: a pending revert intent was not acted on — ${r.reason} (BL-0215)`)
 }
}
async function discardBlockedCode(frd, ids) {
 if (!ids.length) return true
 if (isUsable(frd)) { await holdUsableDiscard(frd, ids, 'a discard of the work orders the repair blocked'); return false }
 const done = await woRevert(frd, ids, 'apply', { onlyStatus: 'BLOCKED' })
 if (done.ok) { noteRevert(frd, ids, done.receipt, false); return true }
 await refuseRevert(frd, ids, done, { blocked: true, emit: false })
 return false
}
async function revertAndReopen(frd, reopenIds, opts = {}) {
 const ids = reopenIds || []
 reviewerTestsByFrd.delete(frd)
 const seamFiles = (opts.seamFiles && opts.seamFiles.length) ? opts.seamFiles : null
 if (isUsable(frd)) { await holdUsableDiscard(frd, ids, seamFiles ? 'a partial revert of the seam + rebuild' : 'a revert + rebuild'); blockFrd(frd, 'needs-owner', 'USABLE code kept: the discard needs the owner (proposal 39 C6)'); return { refused: true } }
 const refused = async (rv, flip) => { await refuseRevert(frd, ids, rv, { flip }); blockFrd(frd, 'needs-owner', `revert refused (BL-0212): ${rv.error}`); return { refused: true } }
 const plan = await woRevert(frd, ids, 'plan', { seam: seamFiles, recordIntent: 'PLANNED' })
 if (!plan.ok) return await refused(plan, false)
 agentSpawned += COST(P.judge)
 const reopenReason = seamFiles ? 'seam' : 'gate-reject'
 const revertJournal = JOURNAL(
  `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"revert","role":"builder","kind":"attempt","classification":"","seam":${seamFiles ? `"${seamFiles.join(', ').replace(/"/g, '')}"` : 'null'},"findingKey":"","tried":"${seamFiles ? 'partial revert (seam only)' : 'full revert'}","verdict":"","why":"%s","confidence":""`,
  ` "<the reopened work order, else ${ids[0] || frd}>" "<its NEW attempt number after the increment, an integer>" "<its NEW reopen_count after you increment it, an integer>" "<one line: why it was reverted>"`)
 await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'revert' })}DR-073 fallback — the in-place patch could NOT green ${frd}, so revert + reopen for a clean rebuild${seamFiles ? ' (A3 PARTIAL revert — restricted to the diagnosed seam)' : ''}. Reopened work orders: ${ids.join(', ')}${seamFiles ? `\n  **SEAM (A3) — the diagnosis isolated the fault to these files ONLY; the engine discards NOTHING else the WO touched, so good work is preserved: ${seamFiles.join(', ')}** (the diagnosis proved the fault is confined to the seam).` : ''}
  **WS-D/D12 — you make ONE commit, the frontmatter flip; the engine discards the code AFTER it (crash-safe: never a committed IN_REVIEW pointing at code that has been reverted away).** For EACH reopened work order:
     a) Set its frontmatter \`implementation_status: PLANNED\` and **INCREMENT its \`reopen_count\`** (the non-progress cap, DR-072 — so a WO that keeps failing eventually BLOCKS needs-owner instead of grinding).
     b) **EXCEPTION — preserve test evidence (DR-107):** a newly-created TEST file that the reviewer authored or that a \`## Status Note\` references (an adversarial spec, an e2e spec like \`a11y.spec.ts\`) is COVERAGE, not rejected code — do not destroy it. MOVE it to \`.pandacorp/run/preserved-tests/<wo-id>/\` (mkdir -p; gitignored runtime state) instead of deleting it, so the rebuild restores it as its RED baseline (the personal-page-v2 incident: a green 6/6 a11y spec was deleted by a revert and had to be re-authored blind a pass later).
     c) Append one durable reopen line PER reopened work order to ${TRACK_PATH} (fire-and-forget — reopen_count resets to 0 when the WO finally passes, so WITHOUT this line the durable timeline under-reports rework): printf '{"kind":"wo_reopen","frd":"${frd}","wo":"%s","reason":"${reopenReason}","at":"%s"}\\n' "<the-wo-id>" "$(date -u +%FT%TZ)" >> ${TRACK_PATH}.${WO_REOPEN_EVENT(frd, reopenReason)} BUILD-JOURNAL (A1) — record ONE revert line (descriptive attempt; verdict stays empty):${revertJournal}
     ${SYNC_ROLLUPS} **COMMIT this frontmatter flip ALONE** (Conventional Commits, scope, the subject naming ${frd} and the reopened work orders; stage \`.pandacorp/build-journal.jsonl\` too, append-only).
  **Do NOT discard any other code yourself** — no \`git checkout\`/\`restore\`/\`rm\` of the work orders' files, never a restore "to last_green_sha" (the pin may already contain their rejected build, BL-0212) and never a hard reset. Right after your commit the engine discards the rejected code deterministically, by reverting the work orders' OWN commits (DR-070), leaving every other WO (IN_REVIEW or VERIFIED) untouched.
  Return { green: false } (the engine retries the reopened WOs — in-run first (DR-107), else next pass — from a clean base).`,
  { label: `revert:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
 const done = await woRevert(frd, ids, 'apply', { seam: seamFiles, requireStatus: 'PLANNED', expectChange: true })
 if (!done.ok) return await refused(done, true)
 noteRevert(frd, ids, done.receipt, true)
 return { refused: false }
}
async function foundationCompletenessGate() {
 agentSpawned += COST(P.judge)
 return await agent(
  `You are the FOUNDATION-COMPLETENESS auditor (DR-057). The foundation = the UNION of EVERY shared design-system primitive that ANY UI surface's mock/fdd references — not a hand-picked subset. READ-ONLY, build nothing.
    1) Enumerate the COMPLETE set: read docs/design/components.md (the living inventory) AND scan every docs/frds/*/mocks/ + fdd.md to list every shared primitive the surfaces depend on (layout shells, Banner/Card/Chip/Modal/Button, and any app-specific shared primitive the mocks show — e.g. Room/AgentSprite/StoneBridge/FlowStrip).
    2) For each, check it EXISTS as a BUILT shared component (scan src/components/core + src/components/modules) AND its foundation work order is VERIFIED/IN_REVIEW (read the WO frontmatter).
    Return { complete: true } if every referenced shared primitive is built; otherwise { complete: false, missing: [{ name, referencedBy: [frd folders], suggestedPath, note }] }. Be precise: only list primitives that surfaces genuinely reference and that are NOT yet built.`,
  { label: 'foundation-gate', phase: 'Plan', model: P.judge, agentType: 'pandacorp:reviewer', schema: FOUNDATION_SCHEMA })
}
async function repairFoundation(missing, context) {
 foundationRepairs++
 agentSpawned += COST(P.judge)
 const list = (missing || []).map((m) => `${m.name}${m.referencedBy && m.referencedBy.length ? ' (needed by ' + m.referencedBy.join(', ') + ')' : ''}${m.suggestedPath ? ' → ' + m.suggestedPath : ''}`).join('; ')
 return await agent(
  `${EMIT('implementer', 'foundation', { phase: 'build', activity: 'repair' })}FOUNDATION AUTO-REPAIR (DR-065), attempt ${foundationRepairs}/${FOUNDATION_REPAIR_CAP}. ${context}. The foundation is INCOMPLETE — these shared primitives that surfaces need are NOT built: ${list || '(see the gate output)'}.
    1) Reset to the last green — SAFELY (DR-072 R3, this prevents wiping verified work): read last_green_sha from .pandacorp/status.yaml, then FIRST verify it is an ANCESTOR of HEAD: \`git merge-base --is-ancestor <last_green_sha> HEAD && echo ANCESTOR || echo ORPHAN\`. ALSO run \`${PREFIX_ASSIGN} && printf 'PREFIX=%s\\n' "$P"\` (BL-0202). **If ANCESTOR AND PREFIX is empty** (a project at its repository root): \`git reset --hard <last_green_sha>\` to discard the flat half-built surfaces (NOT the verified foundation). **If PREFIX is NOT empty** (a project NESTED in a larger repository, e.g. Mission Control in the factory): NEVER \`git reset --hard\` — it rewinds the WHOLE repository, other sessions' commits and uncommitted work outside this project included — take the surgical path below even when ANCESTOR. **If ORPHAN** (the SHA drifted off-branch via reverts / factory commits / an overlay upgrade — a real footgun seen 2026-06-20): do NOT hard-reset (it would discard verified work). Instead surgically discard ONLY the failed surfaces' files — restore the tracked ones with the BL-0202 RESTORE COMMAND: \`${scopedRestoreCommand('HEAD')}\` and remove their new untracked dirs with the BL-0202 CLEAN COMMAND: \`${scopedCleanCommand()}\` (each VERBATIM except ${SCOPED_PATHS_NOTE} List the paths with \`${PROJECT_STATUS_COMMAND}\`: only IN paths are yours, OUT paths belong to other work) — keeping HEAD and every verified commit. ${NO_WHOLE_TREE_WRITES.replace('no `git reset --hard`, ', '')} If you cannot safely identify exactly which files to discard, STOP: return { green: false, blocked_reason: 'needs-owner', failure: 'last_green_sha orphaned — a hard reset would wipe verified work; the owner must confirm the recovery point' }.
    2) For EACH missing primitive: build it as a SHARED foundation component on the frozen design tokens, faithful to its mock/fdd spec (read docs/frds/*/mocks + docs/design/design-tokens.json + DESIGN.md); place it under src/components/core or src/components/modules; APPEND a row to docs/design/components.md so surfaces reuse it. TDD; never weaken tests.
    3) Run \`bash .pandacorp/verify.sh\` until green and commit (Conventional Commits, scope), staging ONLY this project's files by explicit path (never \`git add -A\`/\`git add .\`/\`git commit -a\`, BL-0202). The surfaces that depended on these primitives stay PLANNED so the normal loop rebuilds them next — now against REAL primitives.
    Return { green: true } if the foundation is now complete + green. If you genuinely cannot (low confidence, the gap is really a design/product decision, or it's beyond a primitive add), return { green: false, blocked_reason: 'needs-owner', failure } describing what a human must decide.${NOTIFY('Auto-reparé la fundación (faltaban primitivos) y reconstruyo las superficies')}`,
  { label: `foundation-repair:${foundationRepairs}`, phase: 'Build', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}
let foundationVerified = false
let foundationEscalated = false
async function ensureFoundationComplete() {
 if (foundationVerified || !plan.hasFrontend) return true
 if (foundationEscalated) return false
 while (true) {
  const fc = await foundationCompletenessGate()
  if (fc && fc.complete === true) { foundationVerified = true; return true }
  if (!fc) {
   foundationGateNulls++
   if (foundationGateNulls > FOUNDATION_GATE_NULL_CAP) {
    log(`⊘ Foundation-completeness gate produced no verdict (agent died/invalid) ${foundationGateNulls}x — escalating to the owner (fail-closed)`)
    foundationEscalated = true; return false
   }
   log('⚠ Foundation-completeness gate returned no verdict — NOT treating as complete; re-running (fail-closed)')
   continue
  }
  log(`⚠ Foundation INCOMPLETE: ${(fc.missing || []).map((m) => m.name).join(', ') || 'unknown primitives'}`)
  if (foundationRepairs >= FOUNDATION_REPAIR_CAP) {
   log(`⊘ Foundation still incomplete after ${foundationRepairs} auto-repair(s) — escalating to the owner`)
   foundationEscalated = true; return false
  }
  const fix = await repairFoundation(fc.missing, 'foundation-completeness gate before fanning out surfaces')
  if (!fix || fix.green !== true) {
   log(`⊘ Foundation auto-repair could not complete (${(fix && fix.blocked_reason) || 'error'}) — escalating to the owner`)
   foundationEscalated = true; return false
  }
  log(`✓ Foundation auto-repair ${foundationRepairs} done — re-checking completeness`)
 }
}
const builtFrds = []
const blockedFrds = []
const reopenedFrds = []
const blockedReasons = {}
const blockedFailures = {}
let consecutiveBlocks = 0
let stopReason = null
let deferredWork = false
function blockFrd(frd, reason, failure = '', trace = null) {
 if (infraHalt) { log(`⏸ ${frd}: not BLOCKED (${reason || 'error'}) — the run is paused on infra, the FRD resumes next run (proposal 39 C7)`); return }
 reason = reason || 'error'
 blockedFrds.push(frd)
 blockedReasons[frd] = reason
 const failing = Array.isArray(trace)
  ? trace.filter((e) => e && e.status === 'fail').map((e) => String(e.contract || '').split(' — ')[0]).filter(Boolean).slice(0, 4)
  : []
 const text = `${failing.length ? `FAIL ${failing.join(', ')} · ` : ''}${failure || ''}`
 if (text) blockedFailures[frd] = text.slice(0, 400)
 if (reason !== 'external') consecutiveBlocks++
}
const globToRe = (g) => new RegExp('^' + String(g)
 .replace(/[.+^${}()|[\]\\]/g, '\\$&')
 .replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$')
const globLiteral = (g) => String(g).replace(/\*\*\/?/g, '').replace(/\*/g, '') || '/'
const globsOverlap = (x, y) => {
 if (x === y) return true
 return globToRe(x).test(globLiteral(y)) || globToRe(y).test(globLiteral(x))
}
const artifactsOverlap = (a, b) => {
 const A = a.artifacts || [], B = b.artifacts || []
 if (!A.length || !B.length) return true
 return A.some((x) => B.some((y) => globsOverlap(x, y)))
}
const UI_ARTIFACT_RE = /(^|\/)(src\/app\/|src\/components\/|src\/styles\/|public\/)|\.(tsx|jsx|css|scss|svg|html|mdx)$|design-tokens\.json$|tailwind\.config\.|(^|\/)DESIGN\.md$/
const artifactsTouchUi = (wos) => wos.some((w) => !(w.artifacts && w.artifacts.length) || w.artifacts.some((a) => UI_ARTIFACT_RE.test(a)))
const FOUNDATION_SHARED_RE = /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json)$|(^|\/)messages\//
const joinsFoundationWave = (w) => (w.deps || []).length === 0 && Boolean(w.artifacts && w.artifacts.length) && !artifactsTouchUi([w]) && !w.artifacts.some((a) => FOUNDATION_SHARED_RE.test(a))
const uiPassesRequired = (builtWos) => FORCE_UI_PASSES || !builtWos.length || artifactsTouchUi(builtWos)
const pickDisjointWave = (ready, max, costBudget = Infinity, costOf = () => 1) => {
 const picked = []
 let cost = 1
 let cutBy = null
 for (const w of ready) {
  if (picked.length >= max) { cutBy = cutBy || 'count-cap'; break }
  if (picked.some((p) => artifactsOverlap(p, w))) continue
  if (picked.length > 0 && cost + costOf(w) > costBudget) { cutBy = cutBy || 'agent-budget'; break }
  picked.push(w)
  cost += costOf(w)
 }
 return { picked, cutBy }
}
const woWaveCost = (w) => {
 const m = pickWorkerModel(w)
 return (P.split && plan.hasFrontend) ? 3 * COST(m) + 2 : COST(m) + 1
}
const AUTO_FIXED_COST = 8
const AUTO_WO_MECH_COST = 3
const AUTO_FRD_COST = 20
const AUTO_HEADROOM = 1.25
const AUTO_USD_PER_UNIT = 0.5
const projectedFrdsCost = (frds) => {
 let units = 0
 for (const f of frds || []) {
  units += AUTO_FRD_COST
  for (const w of f.workOrders || []) {
   if (w.status === 'VERIFIED' || w.status === 'BLOCKED' || w.status === 'IN_REVIEW' || w.docStatus === 'DRAFT') continue
   units += AUTO_WO_MECH_COST + COST(pickWorkerModel(w))
  }
 }
 return units
}
const projectedRunCost = (pl) => AUTO_FIXED_COST + projectedFrdsCost(pl.frds)
function sizeAgentBudget(addedFrds) {
 if (!MAX_AGENTS_AUTO && !MAX_AGENTS) return
 const first = addedFrds === undefined
 const units = first ? projectedRunCost(plan) : projectedFrdsCost(addedFrds)
 const usd = (n) => `≈ ${(n * AUTO_USD_PER_UNIT).toFixed(0)} USD aprox.`
 if (!MAX_AGENTS_AUTO) {
  if (first && MAX_AGENTS < units) log(`⚠ AgentBudgetAdvisory: explicit maxAgents ${MAX_AGENTS} is below the projected run cost of ~${units} units (${usd(units)}; fixed ~${AUTO_FIXED_COST} + per WO ${AUTO_WO_MECH_COST}+builder weight + ~${AUTO_FRD_COST} per FRD) — the run may stop at the agent ceiling before every gate. Not overridden (an explicit value is never changed, partial resumable runs are legitimate); pass maxAgents:'auto' to size it from the plan.`)
  return
 }
 const cap = first ? Math.ceil(AUTO_HEADROOM * units) : (MAX_AGENTS || 0) + Math.ceil(AUTO_HEADROOM * units)
 MAX_AGENTS = Math.max(MAX_AGENTS || 0, cap)
 log(`⚖ maxAgents auto: projected ~${units} cost units${first ? '' : ' for the FRDs just added'} (${usd(units)}) → cap ${MAX_AGENTS} (x${AUTO_HEADROOM} headroom, plan of ${plan.frds.length} FRD(s))`)
}
async function safePointProbe() {
 const reuse = fusedProbe
 fusedProbe = null
 if (!reuse) agentSpawned++
 const r = reuse ? { body: reuse } : await runMechOp('safe-point', `--token ${shellQuote(LEASE_TOKEN)} --epoch ${shellQuote(String(LEASE_EPOCH))}${TARGETED ? ' --targeted' : ''}`, { label: 'safe-point-probe' })
 const b = r.body
 if (!b || b.ok !== true) { log(`⚠ safe-point probe unverifiable (${r.error || (b && (b.reason || b.error || b.status)) || 'no receipt'}) — running the full safe point (fail-safe, proposal 39 C1)`); return 'work' }
 if (b.stop === true || (b.stop_receipt && b.stop_receipt.stop === true)) { log(`⏸ safe-point probe: stop (${b.reason || (b.rethink_pending ? 'rethink_pending' : 'owner stop file')}) — el motor para en este safe point (proposal 39 C1)`); return 'stop' }
 const rc = b.stop_receipt
 if (!rc || rc.status_exists !== true || rc.stop !== false || rc.method !== 'node-lstat') { log('⚠ safe-point probe returned no valid stop receipt — running the full safe point (fail-safe, proposal 39 C1)'); return 'work' }
 if (b.work === true) { log(`◦ safe-point probe found work (ready: ${(b.ready || []).join(', ') || 'none'}; unreadable: ${(b.unreadable || []).length}; answered decisions: ${b.answeredDecisions || 0}) — the full safe point drains it`); return 'work' }
 return 'quiet'
}
async function safePoint() {
 if (MECH_SCRIPT) {
  const probe = await safePointProbe()
  if (probe === 'stop') return 'stop'
  if (probe === 'quiet') return null
 }
 agentSpawned++
 const sp = await agent(
  `${RENEW_LEASE} Safe-point check (DR-069/BL-0073) — read the owner's signals; change ONLY what is specified:
    0) Execute exactly \`${INSPECT_STOP}\`. This is the EXCLUSIVE source of truth for the owner stop file. Preserve its JSON output verbatim as \`stop_receipt\`. NEVER use shell \`test\`, \`[\`, \`stat\`, \`ls\`, filesystem aliases, or infer stop from path presence/absence or an exit code. If the command fails or its JSON cannot be returned exactly, throw/fail this safe point and mutate nothing — NEVER guess \`stop:false\`.
    1) Read .pandacorp/status.yaml → set \`stop: true\` iff \`rethink_pending: true\`. Do not derive this field from the stop file; the engine evaluates the fenced \`stop_receipt.stop\` itself.
    2) ${TARGETED ? 'TARGETED BUILD (the owner launched with a specific `change`/`frds` — build ONLY that): do NOT scan the queue for ready changes. Return `ready: []`. Other queued changes are intentionally left for a later bare `/implement`.' : 'List .pandacorp/inbox/changes/*.md (IGNORE the done/ subfolder): collect the slugs whose frontmatter `status` is "ready" — `class: expedite` FIRST, then standard FIFO by date. Skip draft/done/building (a `building` change is already integrated and in flight — never re-drain it, WS-A/D1).'}
    3) Read .pandacorp/inbox/decisions.md: for each decision the owner ANSWERED (via /pandacorp:decide) that resolves blocked work, find the work orders with \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\` that the answer unblocks, set each back to \`implementation_status: PLANNED\` (the DR-050 frontmatter signal), and update \`pending_decisions\` in status.yaml to the count still unanswered. Commit those frontmatter edits if you made any.
    Return { stop: <rethink_pending boolean>, stop_receipt: <the exact inspect-stop JSON object>, ready: [...slugs, expedite first], unblocked: [{ frd, wo } for EACH work order you flipped BLOCKED→PLANNED — WS-D/D14, report its OWNING FRD folder so the engine re-enrolls it THIS run] } (empty arrays when there is nothing).`,
  { label: 'safe-point', phase: 'Build', model: MECH, agentType: 'pandacorp:implementer', schema: SAFE_POINT_SCHEMA },
 )
 const receipt = sp && sp.stop_receipt
 if (!receipt || receipt.status_exists !== true || typeof receipt.stop !== 'boolean' || receipt.method !== 'node-lstat') {
  throw new Error('FATAL: recurring safe-point returned an invalid fenced stop receipt; refusing to guess owner stop state')
 }
 if (receipt.stop === true || sp.stop === true) { log('⏸ señal fenced de stop/rethink — el owner re-planificó o detuvo; el motor para en este safe point (la próxima corrida retoma con el plan nuevo)'); return 'stop' }
 if (sp && sp.unblocked && sp.unblocked.length) {
  for (const u of sp.unblocked) {
   if (!u || !u.wo) continue
   blockedIds.delete(u.wo)
   let st = u.frd ? frdState.get(u.frd) : null
   if (!st) { for (const [, s] of frdState) if (s.f.workOrders.some((w) => w.id === u.wo)) { st = s; break } }
   const woObj = st ? st.f.workOrders.find((w) => w.id === u.wo) : null
   if (st && woObj) {
    woObj.status = 'PLANNED'
    globalQueue.set(u.wo, { wo: woObj, frd: st.f.frd })
    st.toBuildIds.add(u.wo)
    st.failed = false
    st.enqueued = false
    if (!st.reviewIds.includes(u.wo)) st.reviewIds.push(u.wo)
    log(`↺ WO desbloqueado re-enrolado ESTA corrida: ${u.wo} (${st.f.frd}) — se construye en la próxima ola, no en la próxima corrida (WS-D/D14)`)
   } else {
    log(`⚠ WO desbloqueado ${u.wo} no está en el schedule de esta corrida — se construye en la próxima corrida`)
   }
  }
 }
 if (TARGETED && sp && sp.ready && sp.ready.length) {
  log(`⊘ Build dirigido — ${sp.ready.length} change(s) ready en cola NO se drenan (solo el objetivo); esperan a un /implement sin objetivo: ${sp.ready.join(', ')}`)
 } else if (!TARGETED && sp && sp.ready && sp.ready.length) {
  log(`⇩ Drenando ${sp.ready.length} change(s) ready de la cola (DR-069): ${sp.ready.join(', ')}`)
  for (const slug of sp.ready) {
   if (capHit()) { log('⛔ Techo de agentes — el resto de la cola espera a la próxima corrida'); break }
   if (drainedThisRun.has(slug)) { log(`⚠ Change '${slug}' ya drenada ESTA corrida pero reaparece 'ready' — el sello 'building' no cuajó; la salto para no re-drenar (WS-D/D9)`); continue }
   const proc = await processChange(slug, 'Build')
   if (!proc || proc.done !== true || !proc.affectedFrds || !proc.affectedFrds.length) { log(`⊘ Change '${slug}' no drenada: ${proc?.failure || 'sin FRDs afectados'}`); continue }
   drainedThisRun.add(slug)
   const newFolders = proc.affectedFrds.filter((x) => !plan.frds.some((pf) => pf.frd === x))
   const existing = proc.affectedFrds.filter((x) => plan.frds.some((pf) => pf.frd === x))
   if (existing.length) { deferredWork = true; log(`↷ Change '${slug}' tocó FRDs ya planificados (${existing.join(', ')}) — sus WOs nuevos se construyen en la PRÓXIMA corrida/pasada (WS-D/D4a: no se declara release esta corrida)`) }
   if (newFolders.length) {
    agentSpawned += COST(P.judge)
    const extra = await agent(
     `Re-plan ONLY these FRD folders (they were just created/updated by a drained change): ${newFolders.join(', ')}. Same contract as the main build planner: read each folder's frd.md + blueprint.md Build Plan + the frontmatter ONLY of every work-orders/wo-*.md, and return { frds: [{ frd, deps, workOrders: [{ id, status, docStatus (the LITERAL \`status:\` frontmatter field, DRAFT|ACTIVE — DR-100/BL-0171; omit when the WO has none), path, acText (the EARS AC lines this WO owns, verbatim from frd.md — DR-108), difficulty, reopen_count, deps, artifacts, foundation, priorAttempts (A4 — if \`${JOURNAL_PATH}\` exists, a bounded digest [{attempt, classification, findingKey, tried, why}] of the last 2 attempts on this WO; [] otherwise), summary }] }] } in Build Plan order. Read-only.`,
     { label: `plan-drained:${slug}`, phase: 'Build', model: P.judge, agentType: 'pandacorp:architect', schema: PLAN_SCHEMA },
    )
    if (extra && extra.frds && extra.frds.length) { for (const nf of extra.frds) { plan.frds.push(nf); enrollFrd(nf) } sizeAgentBudget(extra.frds); detectCycles(); log(`＋ FRDs de la change añadidos a esta corrida: ${extra.frds.map((x) => x.frd).join(', ')}`) }
   }
  }
 }
 return null
}
async function drainReadyQueuePreLoop() {
 agentSpawned++
 const sp = await agent(
  `${RENEW_LEASE} Pre-build safe-point check (DR-069/BL-0129) — read the owner's signals; change ONLY what is specified:
    0) Execute exactly \`${INSPECT_STOP}\`. This is the EXCLUSIVE source of truth for the owner stop file. Preserve its JSON output verbatim as \`stop_receipt\`. NEVER use shell \`test\`, \`[\`, \`stat\`, \`ls\`, filesystem aliases, or infer stop from path presence/absence or an exit code. If the command fails or its JSON cannot be returned exactly, throw/fail this safe point and mutate nothing — NEVER guess \`stop:false\`.
    1) Read .pandacorp/status.yaml → set \`stop: true\` iff \`rethink_pending: true\`. Do not derive this field from the stop file; the engine evaluates the fenced \`stop_receipt.stop\` itself.
    2) List .pandacorp/inbox/changes/*.md (IGNORE the done/ subfolder): collect the slugs whose frontmatter \`status\` is "ready" — \`class: expedite\` FIRST, then standard FIFO by date. Skip draft/done/building (a \`building\` change is already integrated and in flight — never re-drain it, WS-A/D1).
    Return { stop: <rethink_pending boolean>, stop_receipt: <the exact inspect-stop JSON object>, ready: [...slugs, expedite first], unblocked: [] } (empty arrays when there is nothing).`,
  { label: 'safe-point-pre-loop', phase: 'Plan', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: SAFE_POINT_SCHEMA },
 )
 const receipt = sp && sp.stop_receipt
 if (!receipt || receipt.status_exists !== true || typeof receipt.stop !== 'boolean' || receipt.method !== 'node-lstat') {
  throw new Error('FATAL: pre-loop safe-point returned an invalid fenced stop receipt; refusing to guess owner stop state')
 }
 if (receipt.stop === true || sp.stop === true) {
  log('⏸ señal fenced de stop/rethink en el drenado previo al plan — el owner re-planificó o detuvo; el motor para antes de construir.')
  return { stop: true, drained: false }
 }
 if (!sp.ready || !sp.ready.length) return { stop: false, drained: false }
 log(`⇩ Drenando ${sp.ready.length} change(s) ready de la cola antes de declarar "nothing to build" (BL-0129/DR-069): ${sp.ready.join(', ')}`)
 let drained = false
 for (const slug of sp.ready) {
  if (capHit()) { log('⛔ Techo de agentes — el resto de la cola espera a la próxima corrida'); break }
  if (drainedThisRun.has(slug)) { log(`⚠ Change '${slug}' ya drenada ESTA corrida pero reaparece 'ready' — el sello 'building' no cuajó; la salto (WS-D/D9)`); continue }
  const proc = await processChange(slug, 'Plan')
  if (!proc || proc.done !== true || !proc.affectedFrds || !proc.affectedFrds.length) { log(`⊘ Change '${slug}' no drenada: ${proc?.failure || 'sin FRDs afectados'}`); continue }
  drainedThisRun.add(slug)
  drained = true
 }
 return { stop: false, drained }
}
async function diagnoseFailure(frd, gate, reviewIds) {
 agentSpawned += COST(P.judge)
 const findingsList = (gate.findings || []).map((x) => `• ${x.wo}: ${x.finding}${x.files && x.files.length ? ` [${x.files.join(', ')}]` : ''}`).join('\n  ') || '(see the gate output)'
 const diagJournal = JOURNAL(
  `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"diagnose","role":"diagnoser","kind":"diagnosis","classification":"%s","seam":%s,"findingKey":"%s","tried":"","verdict":"","why":"%s","confidence":"%s"`,
  ` "<the primary reopened work order, else ${(gate.reopen || [])[0] || frd}>" "<its attempt number, an integer>" "<its current reopen_count, an integer>" "<point|architectural|gate-test-defective|deadlocked-contract>" "<a compact JSON object {\\"files\\":[...],\\"symbol\\":\\"...\\",\\"why\\":\\"...\\"} or the bare token null>" "<\`<file>::<one-line claim>\` of the fault>" "<one line: your diagnosis>" "<low|medium|high>"`)
 return await chargedRepair(frd, P.judge, () => agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'diagnose' })}DIAGNOSE (A2, progressive-learning recovery) for ${frd}. An in-place patch just FAILED to green the build (cause: code). You are a READ-ONLY diagnoser — change NOTHING, write no tests, fix nothing, run no revert. Read the CURRENT code, the failing gate findings, the reopened work orders (${(gate.reopen || []).join(', ')}), and the prior attempts recorded in ${JOURNAL_PATH} (if it exists). Findings:
  ${findingsList}
  Classify the failure and recommend the CHEAPEST SAFE recovery. RULES:
  - A diagnosis with NO file:line anchor is confidence:low and CANNOT justify a block or an 'architectural' classification. **Default to 'point' unless the evidence forces otherwise.**
  - Adversarially RE-CHECK every prior diagnosis in the journal against the CURRENT code — any you cannot reproduce NOW goes in \`supersededPriors\` (poison self-purge), and is NOT counted as a recurrence.
  - classification signals: **architectural** = findings spread over MORE than ${FINDING_SPREAD_THRESHOLD} files, OR the same \`findingKey\` recurring across >= 2 attempts (read the journal), OR an acceptance criterion that is unsatisfiable against the blueprint. **deadlocked-contract** = a blessed/preserved test asserts a contract that a SIBLING work order (a \`dependsOn\` relation) intentionally derogates (LESSON-0104). When you classify this, \`seam.files\` MUST list the BLESSED TEST file(s) that encode the superseded contract (not the production files) — the engine hands exactly those to an INDEPENDENT gate-test reviewer to RE-BLESS them to the derogated contract (BL-0051), so a wrong seam sends the wrong file for repair; in the decisionRecord, still recommend folding the derogation + the re-bless into ONE work order so the next plan cannot re-create the deadlock. **gate-test-defective** = a reviewer adversarial test is internally inconsistent / unsatisfiable by any correct implementation (route to the existing gate-test repair). **Otherwise → point** (a bounded fault).
  - \`seam\`: the file(s)/symbol the fault localizes to, \`why\`, and \`cleanlySeparable\` (true iff reverting ONLY those files cleanly isolates the fault WITHOUT unwinding good work — this gates the PARTIAL revert).
  - \`repeatsPrior\`: true iff this SAME fault (\`findingKey\`) already appears in the journal for this WO on a prior attempt, AFTER your \`supersededPriors\` purge.
  - \`recommendation\` ∈ patch | partial-revert | full-revert | block-needs-owner. Recommend **block-needs-owner ONLY** for architectural/deadlocked-contract at confidence medium|high (never on a weak diagnosis) — note that for deadlocked-contract the engine first attempts the independent gate-test RE-BLESS (BL-0051) and only blocks if that claim does not hold.
  - \`decisionRecord\`: a SPANISH, owner-facing paragraph (what keeps failing, your diagnosis, what the owner must decide) — meaningful when you recommend block-needs-owner; a one-liner otherwise.
  BUILD-JOURNAL (A1) — record YOUR kind:"diagnosis" line (you are the diagnoser; this is the trust-split's diagnosis half):${diagJournal}
  Return { classification, seam, repeatsPrior, supersededPriors, recommendation, decisionRecord, confidence }.`,
  { label: `diagnose:${frd}`, phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:reviewer', schema: DIAGNOSE_SCHEMA }))
}
async function blockEarlyNeedsOwner(frd, reopenIds, diag) {
 const ids = reopenIds || []
 const plan = isUsable(frd) ? { ok: false, error: 'the FRD is USABLE (proposal 39 C6): its landed code is never discarded automatically' } : await woRevert(frd, ids, 'plan', { recordIntent: 'BLOCKED' })
 if (!plan.ok) log(`⛔ RevertRefused ${frd}: the rejected code of ${ids.join(', ')} cannot be discarded without touching other work (${plan.error}) — it stays on main and the decision record says so (BL-0212)`)
 agentSpawned += COST(P.judge)
 const cls = (diag && diag.classification) || 'architectural'
 const conf = (diag && diag.confidence) || 'high'
 const record = (diag && diag.decisionRecord) || `El gate rechaza repetidamente ${frd} y el diagnóstico lo clasifica como ${cls} (confianza ${conf}) — no es un fallo puntual que el motor pueda arreglar solo; requiere una decisión del owner.`
 const refusedNote = plan.ok ? '' : ` AÑADE al registro: el motor NO pudo descartar el código rechazado sin tocar trabajo de otras features (${plan.error}); ese código sigue en main.`
 const res = await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}EARLY BLOCK needs-owner (A3 progressive-learning recovery) for ${frd}. The diagnoser classified this failure as **${cls}** (confidence ${conf}) — a doomed spec; burning the remaining reopens on it cannot help. Do NOT retry, do NOT patch. Steps:
  1) PRESERVE reviewer-authored / Status-Note-referenced TEST files of the reopened work orders (${ids.join(', ')}) — MOVE them to \`.pandacorp/run/preserved-tests/<wo-id>/\` (DR-107), do not delete. Discard NO other code yourself — no \`git checkout\`/\`restore\`/\`rm\`, never a restore "to last_green_sha" (the pin may already contain their rejected build), never a hard reset: ${plan.ok ? 'right after your commit the engine discards the rejected code by reverting the work orders\' OWN commits (BL-0212, DR-070).' : 'the engine\'s revert refused, so the rejected code stays on main for the owner to resolve (BL-0212).'}
  2) Set EACH reopened work order's frontmatter \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  3) Append the owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH) — what the gate keeps rejecting, the diagnosis, and exactly what the owner must decide — and INLINE the build-journal digest for this WO: read the last few ${JOURNAL_PATH} lines for ${ids[0] || frd} and summarize the attempt/diagnosis history so the owner sees how it got here. The record: ${record}${refusedNote}
  4) COMMIT (Conventional Commits, scope, the subject naming ${frd} and the work orders) staging the frontmatter flip, the moved tests, decisions.md, status.yaml AND \`.pandacorp/build-journal.jsonl\` (append-only — sweeps the diagnosis line).${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"needs-owner"`)}${NOTIFY('FRD ' + frd + ' bloqueado (diagnóstico ' + cls + ') — necesita tu decisión')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
  { label: `block-needs-owner:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
 if (plan.ok) {
  const done = await woRevert(frd, ids, 'apply', { requireStatus: 'BLOCKED', expectChange: true })
  if (done.ok) noteRevert(frd, ids, done.receipt, true)
  else await refuseRevert(frd, ids, done, { blocked: true, emit: false })
 }
 return res
}
async function revertThenRetry(f, reopenIds, reviewIds, priorDiagnosis = null, opts = {}) {
 if ((await revertAndReopen(f.frd, reopenIds, opts)).refused) return 'blocked'
 return await inRunRetry(f, reopenIds, reviewIds, priorDiagnosis)
}
async function inRunRetry(f, reopenIds, reviewIds, priorDiagnosis = null) {
 const retryWos = f.workOrders.filter((w) => reopenIds.includes(w.id)).map((w) => ({ ...w, reopen_count: (w.reopen_count || 0) + 1, _isRetry: true, _priorDiagnosis: priorDiagnosis }))
 const canRetry = !capHit() && retryWos.length > 0 && retryWos.every((w) => w.reopen_count < MAX_REOPENS)
 if (!canRetry) { reopenedFrds.push(f.frd); return 'reopened' }
 if (!capHit() && !canAffordRepair(f.frd, 'opus', retryWos.length)) {
  log(`⊘ ${f.frd}: presupuesto de reparación agotado antes del in-run retry (${repairCostByFrd.get(f.frd) || 0} + ${COST('opus') * retryWos.length} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted (WP-08/D4)`)
  await blockRepairBudgetExhausted(f.frd, reopenIds, null)
  blockFrd(f.frd, 'needs-owner', 'repair budget exhausted before the in-run retry rebuild')
  return 'blocked'
 }
 let budgetedRetry = retryWos
 if (MAX_AGENTS) {
  const remaining = MAX_AGENTS - agentSpawned
  const affordable = []
  let spent = 0
  for (const w of retryWos) { const c = woWaveCost(w); if (spent + c > remaining) break; affordable.push(w); spent += c }
  budgetedRetry = affordable
 }
 if (budgetedRetry.length === 0) {
  log(`↩ ${f.frd}: in-run retry deferred — the reopened WO(s) don't fit the remaining agent budget (${MAX_AGENTS ? MAX_AGENTS - agentSpawned : '∞'}); they rebuild next pass (WS-D/D6)`)
  reopenedFrds.push(f.frd); return 'reopened'
 }
 if (budgetedRetry.length < retryWos.length) log(`↻ ${f.frd}: in-run retry trimmed to fit the agent budget — ${budgetedRetry.map((w) => w.id).join(', ')} now; the rest rebuild next pass (WS-D/D6)`)
 log(`↻ ${f.frd}: in-run retry (DR-107) — rebuilding ${budgetedRetry.map((w) => w.id).join(', ')} from the clean base now (opus)${priorDiagnosis ? ' with the diagnosis threaded (A3)' : ''} instead of paying a whole extra pass`)
 for (const w of budgetedRetry) await chargedRepair(f.frd, 'opus', () => buildWO(w, f.frd))
 const regate = await frdGate(f.frd, reviewIds)
 if (regate && regate.green === true && isPartialReport(regate)) { refusePartial(f.frd, "the in-run retry's re-gate"); reopenedFrds.push(f.frd); return 'reopened' }
 if (regate && regate.green === true) { await applyGate(f.frd, reviewIds, regate.testFiles, null); log(`✓ ${f.frd} VERIFIED (in-run retry)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
 if (regate && regate.reopen && regate.reopen.length) { if ((await revertAndReopen(f.frd, regate.reopen)).refused) return 'blocked' }
 else if (regate && regate.traceabilityDeficient) {
  const missingClasses = regate.missingClasses || []
  log(`⚠ ${f.frd}: in-run retry's re-gate has an incomplete traceability contract (missing: ${missingClasses.join(', ') || 'see failure'}) — re-asking once before deferring (B2, BL-0157)`)
  const st = frdState.get(f.frd)
  const attemptNo = ((st && st.gateAttempts) || 0) + 1
  if (st) st.gateAttempts = attemptNo
  const directive = traceabilityReaskDirective(regate, 'with a COMPLETE traceability inventory this time.')
  const reregate = await finalizeGate(f.frd, reviewIds, await frdGateSerial(f.frd, reviewIds, attemptNo, undefined, undefined, directive))
  if (reregate && reregate.green === true && isPartialReport(reregate)) { refusePartial(f.frd, "the in-run retry's traceability re-ask"); reopenedFrds.push(f.frd); return 'reopened' }
  if (reregate && reregate.green === true) { await applyGate(f.frd, reviewIds, reregate.testFiles, null); log(`✓ ${f.frd} VERIFIED (in-run retry, traceability re-ask)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  if (reregate && reregate.reopen && reregate.reopen.length) { if ((await revertAndReopen(f.frd, reregate.reopen)).refused) return 'blocked'; reopenedFrds.push(f.frd); return 'reopened' }
  if (reregate && reregate.traceabilityDeficient) {
   const stillMissing = reregate.missingClasses || missingClasses
   log(`⊘ ${f.frd}: gate traceability contract STILL incomplete after the re-ask (missing: ${stillMissing.join(', ') || 'see failure'}) — BLOCK needs-owner, never 'error' (B2, BL-0157)`)
   await persistGateBlock(f.frd, reviewIds, 'needs-owner', reregate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`)
   blockFrd(f.frd, 'needs-owner', reregate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`, reregate.traceability)
   return 'blocked'
  }
 }
 log(`↻ ${f.frd}: in-run retry did not converge — deferred to the next pass`)
 reopenedFrds.push(f.frd); return 'reopened'
}
async function gateAndConverge(f, reviewIds) {
 const gate = await frdGate(f.frd, reviewIds)
 return await gateConverge(f, reviewIds, gate)
}
function deferUnstamped(f) { reopenedFrds.push(f.frd); return 'reopened' }
const driftUnprovenDefer = (gate) => Boolean(gate && gate.__driftUnproven && !(gate.reopen && gate.reopen.length))
function deferDriftUnproven(f) { log(`↩ ${f.frd}: deferred to the next pass — an unproven drift claim keeps it from certification, and nothing warrants a code change (BL-0206)`); reopenedFrds.push(f.frd); return 'reopened' }
async function gateConverge(f, reviewIds, gate, traceabilityReasked = false) {
 phase('Review')
 if (gate && gate.green === true && isPartialReport(gate)) {
  refusePartial(f.frd, 'the FRD gate')
  reopenedFrds.push(f.frd); return 'reopened'
 }
 if (driftUnprovenDefer(gate)) return deferDriftUnproven(f)
 if (gate && gate.green === true) {
  const ev = gate.reviewerEvidence
  const applied = ev
   ? await applyGate(f.frd, reviewIds, ev.tests.map((x) => x.path), ev.dir)
   : await applyGate(f.frd, reviewIds, gate.testFiles, null)
  if (!applied) { log(`↻ ${f.frd}: the serialized apply step did not confirm the stamp — NOT marking it verified; it re-gates next pass`); reopenedFrds.push(f.frd); return 'reopened' }
  log(`✓ ${f.frd} VERIFIED`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built'
 }
 if (gate && gate.reopen && gate.reopen.length) {
  let patchFailNote = ''
  let patchesThisCycle = 0
  const mech = SCOPED_REPAIR ? classifyGateFailure(gate) : null
  const patched = await attemptPatch(f.frd, gate.findings || [], reviewIds, null, mech)
  patchesThisCycle = 1
  if (patched && patched.green === true) {
   const iv = await verifyPatched(f.frd, reviewIds)
   if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (patched in place, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
   if (iv && iv.unstamped) return deferUnstamped(f)
   patchFailNote = `patch claimed green but the independent verification FAILED (${iv?.failure || 'red'})`
  } else if (patched && patched.cause === 'gate-test-defective' && (patched.defectiveTests || []).length) {
   log(`⚖ ${f.frd}: patch flagged defective gate test(s) (${patched.defectiveTests.map((t) => t.path).join(', ')}) — repairing the TEST, not rebuilding (BL-0001)`)
   const tr = await repairGateTest(f.frd, patched.defectiveTests, reviewIds)
   if (tr && tr.green === true) {
    const iv2 = await verifyPatched(f.frd, reviewIds)
    if (iv2 && iv2.green === true) { log(`✓ ${f.frd} VERIFIED (defective gate test repaired, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
    if (iv2 && iv2.unstamped) return deferUnstamped(f)
    patchFailNote = `gate-test repair greened but the independent verification failed (${iv2?.failure || 'red'})`
   } else patchFailNote = `gate-test claim not upheld (${tr?.failure || 'test was right — the build is wrong'})`
  } else if (patched && patched.cause === 'code' && !capHit() && !canAffordRepair(f.frd, P.judge)) {
   log(`⊘ ${f.frd}: presupuesto de reparación agotado (${repairCostByFrd.get(f.frd) || 0} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted, honest needs-owner exit with the work preserved (WP-08)`)
   await blockRepairBudgetExhausted(f.frd, gate.reopen, gate)
   blockFrd(f.frd, 'needs-owner', 'repair budget exhausted after patch-1 (WP-08)')
   return 'blocked'
  } else if (patched && patched.cause === 'code' && !capHit()) {
   const diag = await diagnoseFailure(f.frd, gate, reviewIds)
   const cls = (diag && diag.classification) || 'point'
   const conf = (diag && diag.confidence) || 'low'
   const repeats = Boolean(diag && diag.repeatsPrior)
   const seam = (diag && diag.seam) || null
   const cleanlySeparable = Boolean(seam && seam.cleanlySeparable && seam.files && seam.files.length)
   if (cls === 'gate-test-defective') {
    const defectiveTests = (seam && seam.files && seam.files.length)
     ? seam.files.map((p) => ({ path: p, why: seam.why || 'diagnosed gate-test-defective (A2)' }))
     : [{ path: '(see the diagnosis)', why: (seam && seam.why) || 'diagnosed gate-test-defective (A2)' }]
    log(`⚖ ${f.frd}: diagnosis = gate-test-defective — repairing the TEST, not rebuilding (A2→BL-0001)`)
    const tr = await repairGateTest(f.frd, defectiveTests, reviewIds)
    if (tr && tr.green === true) {
     const iv = await verifyPatched(f.frd, reviewIds)
     if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (diagnosed defective gate test repaired)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
     if (iv && iv.unstamped) return deferUnstamped(f)
    }
    log(`↻ ${f.frd}: gate-test repair from diagnosis did not green — full revert + retry`)
    return await revertThenRetry(f, gate.reopen, reviewIds, diag)
   }
   if (cls === 'deadlocked-contract' && (conf === 'medium' || conf === 'high')) {
    const blessedTests = (seam && seam.files && seam.files.length)
     ? seam.files.map((path) => ({ path, why: (seam && seam.why) || 'asserts a contract a sibling work order of this FRD intentionally derogates (deadlocked-contract)' }))
     : [{ path: '(see the diagnosis)', why: (seam && seam.why) || 'asserts a contract a sibling work order of this FRD intentionally derogates (deadlocked-contract)' }]
    log(`⚖ ${f.frd}: diagnosis = deadlocked-contract (confidence ${conf}) — breaking the deadlock via the INDEPENDENT gate-test RE-BLESS instead of stopping for a manual unblock (BL-0051)`)
    const tr = await repairGateTest(f.frd, blessedTests, reviewIds, diag)
    if (tr && tr.green === true) {
     const iv = await verifyPatched(f.frd, reviewIds)
     if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (deadlocked contract re-blessed by the independent reviewer, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
     if (iv && iv.unstamped) return deferUnstamped(f)
     log(`⊘ ${f.frd}: the re-bless greened but the independent verification failed (${iv?.failure || 'red'}) — BLOCK needs-owner (BL-0051 fail-closed)`)
    } else log(`⊘ ${f.frd}: the blessed test was UPHELD (${tr?.failure || 'no declared derogation'}) — BLOCK needs-owner (BL-0051 fail-closed)`)
    await blockEarlyNeedsOwner(f.frd, gate.reopen, diag)
    blockFrd(f.frd, 'needs-owner', (diag && diag.decisionRecord) || `diagnosed deadlocked-contract (confidence ${conf})`)
    return 'blocked'
   }
   if (cls === 'architectural' && (conf === 'medium' || conf === 'high')) {
    log(`⊘ ${f.frd}: diagnosis = ${cls} (confidence ${conf}) — early BLOCK needs-owner, NOT burning the remaining reopens on a doomed spec (A3)`)
    await blockEarlyNeedsOwner(f.frd, gate.reopen, diag)
    blockFrd(f.frd, 'needs-owner', (diag && diag.decisionRecord) || `diagnosed ${cls} (confidence ${conf})`)
    return 'blocked'
   }
   if (!repeats && patchesThisCycle < PATCH_ATTEMPT_CAP && !canAffordRepair(f.frd, 'opus')) {
    log(`⊘ ${f.frd}: presupuesto de reparación agotado antes del patch-2 (${repairCostByFrd.get(f.frd) || 0} + ${COST('opus')} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted (WP-08)`)
    await blockRepairBudgetExhausted(f.frd, gate.reopen, gate)
    blockFrd(f.frd, 'needs-owner', 'repair budget exhausted before patch-2 (WP-08)')
    return 'blocked'
   }
   if (!repeats && patchesThisCycle < PATCH_ATTEMPT_CAP) {
    patchesThisCycle++
    log(`↺ ${f.frd}: diagnosis = point (fresh) — patch-2 (${patchesThisCycle}/${PATCH_ATTEMPT_CAP}), diagnosis-guided (A3)`)
    const patched2 = await attemptPatch(f.frd, gate.findings || [], reviewIds, diag)
    if (patched2 && patched2.green === true) {
     const iv = await verifyPatched(f.frd, reviewIds)
     if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (patch-2 diagnosis-guided, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
     if (iv && iv.unstamped) return deferUnstamped(f)
     log(`↻ ${f.frd}: patch-2 greened but the independent verification failed (${iv?.failure || 'red'}) — full revert + retry`)
    } else {
     log(`↻ ${f.frd}: patch-2 did not green (${patched2?.failure || 'no verdict'}) — full revert + retry`)
    }
    return await revertThenRetry(f, gate.reopen, reviewIds, diag)
   }
   if (repeats && cleanlySeparable) {
    log(`↩ ${f.frd}: diagnosis = point, repeats a prior fault, cleanly separable — PARTIAL revert restricted to the seam (${seam.files.join(', ')}) + retry (A3)`)
    return await revertThenRetry(f, gate.reopen, reviewIds, diag, { seamFiles: seam.files })
   }
   log(`↻ ${f.frd}: diagnosis = point${repeats ? ', repeats a prior fault, not cleanly separable' : ''} — full revert + retry with the diagnosis threaded (A3)`)
   return await revertThenRetry(f, gate.reopen, reviewIds, diag)
  } else {
   patchFailNote = `in-place patch did not green (${patched?.failure || 'no verdict'}${patched && patched.cause === 'code' && capHit() ? '; agent ceiling reached — skipping the A3 diagnosis, legacy revert (honest degrade)' : ''})`
  }
  log(`↻ ${f.frd}: ${patchFailNote} — reverting + reopening`)
  return await revertThenRetry(f, gate.reopen, reviewIds)
 }
 if (gate && gate.traceabilityDeficient && (!gate.reopen || !gate.reopen.length) && !traceabilityReasked) {
  const missingClasses = gate.missingClasses || []
  log(`⚠ ${f.frd}: gate traceability contract incomplete (missing: ${missingClasses.join(', ') || 'see failure'}) — re-asking the SAME gate once before any repair (B2, BL-0157)`)
  const st = frdState.get(f.frd)
  const attemptNo = ((st && st.gateAttempts) || 0) + 1
  if (st) st.gateAttempts = attemptNo
  const directive = traceabilityReaskDirective(gate, '(green/reopen/findings unchanged unless your judgment of the code itself has changed) with a COMPLETE traceability inventory this time.')
  const regate = await finalizeGate(f.frd, reviewIds, await frdGateSerial(f.frd, reviewIds, attemptNo, null, null, directive))
  if (regate && regate.traceabilityDeficient && (!regate.reopen || !regate.reopen.length)) {
   const stillMissing = regate.missingClasses || missingClasses
   log(`⊘ ${f.frd}: gate traceability contract STILL incomplete after the re-ask (missing: ${stillMissing.join(', ') || 'see failure'}) — BLOCK needs-owner, never 'error' (B2, BL-0157)`)
   await persistGateBlock(f.frd, reviewIds, 'needs-owner', regate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`)
   blockFrd(f.frd, 'needs-owner', regate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`, regate.traceability)
   return 'blocked'
  }
  return await gateConverge(f, reviewIds, regate, true)
 }
 if (gate && gate.missingFoundation && gate.missingFoundation.length && foundationRepairs < FOUNDATION_REPAIR_CAP) {
  log(`! ${f.frd}: gate found primitives missing from the foundation (${gate.missingFoundation.join(', ')}) — auto-repairing (DR-065)`)
  const fr = await repairFoundation(gate.missingFoundation.map((n) => ({ name: n, referencedBy: [f.frd] })), `the FRD gate for ${f.frd} found a surface needs a primitive missing from the foundation`)
  if (fr && fr.green === true) {
   foundationVerified = false
   log(`✓ ${f.frd}: foundation repaired — its surfaces rebuild against real primitives next pass`)
   reopenedFrds.push(f.frd); return 'reopened'
  }
  log(`⊘ ${f.frd}: foundation auto-repair failed — falling through to block`)
 }
 if (gate && (gate.blocked_reason === 'needs-owner' || gate.blocked_reason === 'external')) {
  log(`⊘ ${f.frd}: gate classified ${gate.blocked_reason}${gate.failure ? ' — ' + gate.failure : ''} — blocking (no repair)`)
  if (gate.blocked_reason === 'needs-owner') await persistGateBlock(f.frd, reviewIds, 'needs-owner', gate.failure, !gate.__outcomeDeferred)
  blockFrd(f.frd, gate.blocked_reason, gate.failure, gate.traceability)
  return 'blocked'
 }
 log(`! ${f.frd} gate failed${gate?.failure ? ': ' + gate.failure : ''} — attempting repair`)
 await recordRepairDiscardIntent(f.frd, reviewIds || [])
 const fix = await attemptRepair(f.frd, 'the FRD review/integration gate failed: ' + (gate?.failure || 'unknown'), true)
 const discardRefused = !(fix && fix.green === true) && !(await discardBlockedCode(f.frd, reviewIds || []))
 if (fix && fix.green === true) {
  gate = await frdGate(f.frd, reviewIds)
  if (gate && gate.green === true && isPartialReport(gate)) { refusePartial(f.frd, 'the post-repair re-gate'); reopenedFrds.push(f.frd); return 'reopened' }
  if (gate && gate.green === true) { await applyGate(f.frd, reviewIds, gate.testFiles, null); log(`✓ ${f.frd} VERIFIED (after repair)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  if (driftUnprovenDefer(gate)) return deferDriftUnproven(f)
 }
 if (gate && gate.traceabilityDeficient) {
  const missing = (gate.missingClasses || []).join(', ') || 'see failure'
  log(`⊘ ${f.frd}: post-repair re-gate traceability contract incomplete (missing: ${missing}) — BLOCK needs-owner, never 'error' (B2/BL-0159)`)
  await persistGateBlock(f.frd, reviewIds, 'needs-owner', gate.failure || `gate traceability contract: missing ${missing}`)
  blockFrd(f.frd, 'needs-owner', gate.failure || `gate traceability contract: missing ${missing}`, gate.traceability)
  return 'blocked'
 }
 const reason = discardRefused ? 'needs-owner' : ((fix && fix.blocked_reason) || (gate && gate.blocked_reason) || 'error')
 const failureText = (fix && fix.failure) || (gate && gate.failure) || ''
 if (gate && gate.__outcomeDeferred && reason === 'needs-owner') await persistGateBlock(f.frd, reviewIds, 'needs-owner', failureText)
 log(`⊘ ${f.frd}: BLOCKED (${reason})`)
 blockFrd(f.frd, reason, failureText, gate && gate.traceability)
 return 'blocked'
}
const frdState = new Map()
const globalQueue = new Map()
const doneIds = new Set()
const blockedIds = new Set()
const gateQueue = []
const mkGateSlot = (id, path, port) => ({ id, path, port, state: 'unknown', lastSha: null, clean: false, inFlight: null, inFlightSha: null, busy: null })
const LEGACY_SLOT = mkGateSlot(0, GATE_WORKTREE, null)
let concurrentGates = null
let gateWorktreeChain = Promise.resolve()
const gatesInFlight = new Map()
const gateResults = []
const convergeQueue = []
function enqueueGateIfComplete(frd) {
 const st = frdState.get(frd)
 if (!st || st.enqueued || st.failed) return false
 if (PARALLEL_GATES && st.gateUnlanded) return false
 if (st.toBuildIds.size === 0 && st.reviewIds.length > 0) { st.enqueued = true; gateQueue.push(frd); return true }
 return false
}
function enrollFrd(f) {
 if (frdState.has(f.frd)) return
 const dupes = (f.workOrders || []).filter((w) => globalQueue.has(w.id) || doneIds.has(w.id) || blockedIds.has(w.id))
 if (dupes.length) {
  log(`⊘ ${f.frd}: WO id(s) ${dupes.map((w) => w.id).join(', ')} already belong to another FRD — duplicate ids across FRDs, refusing to enroll (would silently overwrite the schedule). Blocking ${f.frd} (error) — the owner must give these work orders unique ids.`)
  blockFrdInSchedule(f.frd, 'error')
  return
 }
 const draftWos = f.workOrders.filter((w) => w.docStatus === 'DRAFT' && w.status !== 'VERIFIED')
 if (draftWos.length) log(`⊘ ${f.frd}: WO(s) ${draftWos.map((w) => w.id).join(', ')} are still \`status: DRAFT\` (never gated by /pandacorp:architecture's DR-100 readiness/grounding/consistency check) — refusing to build or gate them this run (needs-owner); route back to /pandacorp:architecture.`)
 const draftIds = new Set(draftWos.map((w) => w.id))
 const pending = f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED' && !draftIds.has(w.id))
 const toBuild = pending.filter((w) => w.status !== 'IN_REVIEW')
 for (const w of f.workOrders) if ((w.status === 'VERIFIED' || w.status === 'IN_REVIEW') && !draftIds.has(w.id)) doneIds.add(w.id)
 for (const w of f.workOrders) if (w.status === 'BLOCKED' || draftIds.has(w.id)) blockedIds.add(w.id)
 for (const w of toBuild) globalQueue.set(w.id, { wo: w, frd: f.frd })
 frdState.set(f.frd, { f, reviewIds: pending.map((w) => w.id), toBuildIds: new Set(toBuild.map((w) => w.id)), failed: false, enqueued: false, gateAttempts: 0 })
 log(`▶ ${f.frd}: ${toBuild.length} to build${pending.length - toBuild.length ? ` · ${pending.length - toBuild.length} already in review` : ''}`)
 if (FAST && toBuild.length === 0 && pending.length > 0 && !priorUsable.some((u) => u.frd === f.frd) && !fastFloor.has(f.frd)) {
  fastFloor.add(f.frd)
  log(`◦ ${f.frd}: built in an earlier run but never USABLE (no committed build_usable line holds) — its dependents wait for its VERIFIED (proposal 39 C6)`)
 }
 enqueueGateIfComplete(f.frd)
 if (draftIds.size && pending.length === 0 && f.workOrders.some((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED')) {
  blockFrdInSchedule(f.frd, 'needs-owner')
 }
}
for (const f of plan.frds) enrollFrd(f)
sizeAgentBudget()
detectCycles()
if ((await preLoopGuarded(() => recoverPendingReverts())) === PAUSED) return await pausedExit({ builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })
function blockFrdInSchedule(frd, reason) {
 const st = frdState.get(frd)
 if (st) { st.failed = true; for (const id of st.toBuildIds) { globalQueue.delete(id); blockedIds.add(id) } }
 blockFrd(frd, reason)
}
function frdDepsBlocked(frd) {
 const st = frdState.get(frd)
 return Boolean(st && st.f.deps && st.f.deps.some((d) => blockedFrds.includes(d)))
}
function findCycle(graph) {
 const WHITE = 0, GRAY = 1, BLACK = 2
 const color = new Map()
 const stack = []
 for (const k of graph.keys()) color.set(k, WHITE)
 let cyclePath = null
 const visit = (node) => {
  color.set(node, GRAY); stack.push(node)
  for (const dep of (graph.get(node) || [])) {
   if (!graph.has(dep)) continue
   if (color.get(dep) === GRAY) { cyclePath = stack.slice(stack.indexOf(dep)).concat(dep); return true }
   if (color.get(dep) === WHITE && visit(dep)) return true
  }
  stack.pop(); color.set(node, BLACK); return false
 }
 for (const k of graph.keys()) { if (color.get(k) === WHITE && visit(k)) break }
 return cyclePath
}
function detectCycles() {
 const frdDeps = new Map()
 for (const [frd, st] of frdState) if (!st.failed) frdDeps.set(frd, (st.f.deps || []).filter((d) => frdState.has(d)))
 const frdCycle = findCycle(frdDeps)
 if (frdCycle) {
  log(`⊘ FRD dependency CYCLE detected: ${frdCycle.join(' → ')} — blocking (needs-owner); the owner must break the cycle`)
  for (const frd of new Set(frdCycle)) if (!blockedFrds.includes(frd)) blockFrdInSchedule(frd, 'needs-owner')
  return
 }
 const woDeps = new Map(); const woFrd = new Map()
 for (const [frd, st] of frdState) if (!st.failed) for (const w of st.f.workOrders) { woDeps.set(w.id, w.deps || []); woFrd.set(w.id, frd) }
 const woCycle = findCycle(woDeps)
 if (woCycle) {
  const frds = [...new Set(woCycle.map((id) => woFrd.get(id)).filter(Boolean))]
  log(`⊘ Work-order dependency CYCLE detected: ${woCycle.join(' → ')} (FRD(s): ${frds.join(', ')}) — blocking (needs-owner)`)
  for (const frd of frds) if (!blockedFrds.includes(frd)) blockFrdInSchedule(frd, 'needs-owner')
 }
}
let gateSettledSinceSafePoint = false
function launchGate(frd) {
 const st = frdState.get(frd)
 const pinSha = st.pinSha
 const reviewIds = st.reviewIds
 const work = gateWorktreeChain.then(async () => {
  const ok = await ensureGateWorktree(pinSha)
  if (!ok) return { __worktreeFailed: true }
  startDriftFinder(frd, reviewIds, pinSha, worktreeWorkFrom(pinSha))
  const evidencePack = await resolveGateEvidence(frd, reviewIds, pinSha)
  LEGACY_SLOT.clean = false
  let gate
  let released = null
  try { gate = await frdGate(frd, reviewIds, worktreeWorkFrom(pinSha), evidencePack) }
  finally { released = await releaseGateWorktree(frd, gate) }
  return (gate && typeof gate === 'object') ? { ...gate, reviewerEvidence: released } : gate
 })
 gateWorktreeChain = work.then(() => {}, () => {})
 const tracked = work.then(
  (gate) => { gatesInFlight.delete(frd); gateResults.push({ f: st.f, reviewIds, gate }) },
  (e) => { gatesInFlight.delete(frd); gateResults.push({ f: st.f, reviewIds, gate: { green: false, blocked_reason: 'error', failure: `gate crashed: ${(e && e.message) || e}` } }) },
 )
 gatesInFlight.set(frd, tracked)
}
async function harvestGateResults() {
 let progressed = false
 while (gateResults.length) {
  const { f, reviewIds, gate } = gateResults.shift()
  gateSettledSinceSafePoint = true
  if (gate && gate.__worktreeFailed) { convergeQueue.push({ f, reviewIds, gate: null, __needsLegacy: true }); continue }
  if (gate && gate.green === true && isPartialReport(gate)) {
   refusePartial(f.frd, 'the concurrent FRD gate')
   reopenedFrds.push(f.frd)
   continue
  }
  if (gate && gate.green === true) {
   const ev = gate.reviewerEvidence
   const ok = ev
    ? await applyGate(f.frd, reviewIds, ev.tests.map((x) => x.path), ev.dir)
    : await applyGate(f.frd, reviewIds, gate.testFiles, GATE_WORKTREE)
   if (ok) { log(`✓ ${f.frd} VERIFIED (concurrent gate, applied on main)`); builtFrds.push(f.frd); consecutiveBlocks = 0; progressed = true }
   else convergeQueue.push({ f, reviewIds, gate })
   continue
  }
  convergeQueue.push({ f, reviewIds, gate })
 }
 return progressed
}
async function settleGates(all) {
 if (gatesInFlight.size) {
  if (all) await Promise.all([...gatesInFlight.values()])
  else await Promise.race([...gatesInFlight.values()])
 }
 return await harvestGateResults()
}
async function drainConverge() {
 while (convergeQueue.length) await convergeOne(convergeQueue.shift())
}
async function convergeOne(item) {
 if (item.__needsLegacy) { await gateAndConverge(item.f, item.reviewIds); return }
 const ported = await portReviewerTests(item.f.frd, item.gate)
 if (ported === false) { await gateAndConverge(item.f, item.reviewIds); return }
 try { await gateConverge(item.f, item.reviewIds, item.gate) }
 finally { reviewerTestsByFrd.delete(item.f.frd) }
}
const gatePool = PARALLEL_GATES ? Array.from({ length: GATE_SLOTS }, (_, i) => mkGateSlot(i + 1, gateSlotPath(i + 1), gateSlotPort(i + 1))) : []
let gateReserved = 0
const GATE_LANDING_COST = 2
const GATE_LADDER_COST = 4 + COST('opus')
const liveSlots = () => gatePool.filter((x) => x.state !== 'failed')
const freeSlot = () => liveSlots().find((x) => !x.busy) || null
const deferredGateLog = new Map()
function frdDirectUpstream(frd, woOwner) {
 const st = frdState.get(frd)
 const up = new Set((st && st.f.deps) || [])
 for (const w of (st ? st.f.workOrders : [])) for (const d of (w.deps || [])) { const o = woOwner.get(d); if (o) up.add(o) }
 up.delete(frd)
 return up
}
function frdUpstream(frd) {
 const woOwner = new Map()
 for (const [k, x] of frdState) for (const w of x.f.workOrders) woOwner.set(w.id, k)
 const seen = new Set()
 const stack = [frd]
 while (stack.length) for (const y of frdDirectUpstream(stack.pop(), woOwner)) if (y !== frd && !seen.has(y)) { seen.add(y); stack.push(y) }
 return seen
}
function frdGateArtifacts(frd) {
 const st = frdState.get(frd)
 const wos = st ? st.f.workOrders.filter((w) => st.reviewIds.includes(w.id)) : []
 if (!wos.length || wos.some((w) => !(w.artifacts && w.artifacts.length))) return []
 return [...new Set(wos.flatMap((w) => w.artifacts))]
}
function gateConflict(frd, force = false) {
 const up = frdUpstream(frd)
 for (const [other, x] of frdState) {
  if (other === frd || !x.gateUnlanded) continue
  if (artifactsOverlap({ artifacts: frdGateArtifacts(frd) }, { artifacts: frdGateArtifacts(other) })) return `artifacts overlap ${other} (DR-060)`
 }
 if (!force) {
  for (const u of up) {
   const x = frdState.get(u)
   if (x && !x.failed && (x.toBuildIds.size > 0 || gateQueue.includes(u))) return `depends on ${u}, which has not gated yet (it lands first)`
  }
 }
 return null
}
function gateCostEstimate(frd) {
 const st = frdState.get(frd)
 const reviewed = st ? st.f.workOrders.filter((w) => st.reviewIds.includes(w.id)) : []
 const split = P.reviewSplit && (((st && st.gateAttempts) || 0) >= 1 || reviewed.some((w) => (w.reopen_count || 0) >= 1))
 return 1 + (GATE_EVIDENCE === 'digested' ? 1 : 0) + (DRIFT_FINDER ? COST('sonnet') + 1 : 0) + (split ? splitGateEstimatedCost() : COST(P.judge)) + 1
}
function landingHeldBy(frd) {
 for (const u of frdUpstream(frd)) {
  const x = frdState.get(u)
  if (x && x.gateUnlanded && !frdUpstream(u).has(frd)) return u
 }
 return null
}
function nextLandingIndex() {
 if (!gateResults.length) return -1
 const i = gateResults.findIndex((r) => !landingHeldBy(r.f.frd))
 if (i >= 0) return i
 return gatesInFlight.size ? -1 : 0
}
const landingHoldLog = new Map()
function logLandingHolds() {
 for (const r of gateResults) {
  const u = landingHeldBy(r.f.frd)
  if (!u || landingHoldLog.get(r.f.frd) === u) continue
  landingHoldLog.set(r.f.frd, u)
  log(`⏸ D1: ${r.f.frd}'s verdict waits to land: it depends on ${u}, whose verdict has not landed yet (a dependency orders the landing, not the gate — E2 finding 1)`)
 }
}
function logGateDeferral(frd, why) {
 if (deferredGateLog.get(frd) === why) return
 deferredGateLog.set(frd, why)
 log(`⏸ D1: gate for ${frd} deferred: ${why}`)
}
function launchGateInSlot(frd, slot, est) {
 const st = frdState.get(frd)
 const pinSha = st.pinSha
 const reviewIds = [...st.reviewIds]
 slot.busy = frd
 st.gateSlotPath = slot.path
 st.gateUnlanded = true
 gateReserved += est
 deferredGateLog.delete(frd)
 log(`▶ D1: gate ${frd} → slot ${slot.id} (${slot.path}, e2e port ${slot.port}) · ${gatesInFlight.size + 1}/${GATE_SLOTS} in flight`)
 const work = (async () => {
  const ok = await ensureGateWorktree(pinSha, slot)
  if (!ok) return { __worktreeFailed: true, __slotDirty: Boolean(slot.failedOnDirt) }
  startDriftFinder(frd, reviewIds, pinSha, worktreeWorkFrom(pinSha, slot.path), slot.path)
  const evidencePack = await resolveGateEvidence(frd, reviewIds, pinSha)
  slot.clean = false
  let gate
  let released = null
  try { gate = await frdGate(frd, reviewIds, worktreeWorkFrom(pinSha, slot.path), evidencePack) }
  finally { released = await releaseGateWorktree(frd, gate, slot) }
  return (gate && typeof gate === 'object') ? { ...gate, reviewerEvidence: released } : gate
 })()
 const settle = (gate) => { gatesInFlight.delete(frd); slot.busy = null; gateReserved -= est; gateResults.push({ f: st.f, reviewIds, pin: pinSha, gate, slot: slot.id }); laneTopUp() }
 const tracked = work.then(settle, (e) => settle({ green: false, blocked_reason: 'error', failure: `gate crashed: ${(e && e.message) || e}` }))
 gatesInFlight.set(frd, tracked)
}
function launchParallelGates(force = false, pinnedOnly = false) {
 if (!liveSlots().length) {
  if (concurrentGates !== false) log(`⚠ D1: every gate slot failed — falling back to the LEGACY synchronous gate path for the rest of the run`)
  concurrentGates = false
  return false
 }
 if (concurrentGates === null) { concurrentGates = true; log(`▹ D1: PARALLEL FRD gates — up to ${GATE_SLOTS} gate(s) review at once in ${gatePool.map((x) => x.path).join(', ')}; verdicts land on main one at a time (args.parallelGates)`) }
 for (let i = 0; i < gateQueue.length;) {
  const slot = freeSlot()
  if (!slot) break
  const frd = gateQueue[i]
  if (frdState.get(frd) && frdState.get(frd).gateUnlanded) { logGateDeferral(frd, 'its previous gate has not landed yet'); i++; continue }
  const why = gateConflict(frd, force)
  if (why) { logGateDeferral(frd, why); i++; continue }
  if (pinnedOnly && !(frdState.get(frd) || {}).pinSha) { logGateDeferral(frd, 'no pin yet — a landing is in flight; it is pinned at the next pre-landing HEAD'); i++; continue }
  const est = gateCostEstimate(frd)
  const pipelineBusy = gatesInFlight.size > 0 || gateResults.length > 0 || Boolean(landingInFlight)
  if (MAX_AGENTS && pipelineBusy) {
   const laneReserve = laneReserveLeft()
   const remaining = MAX_AGENTS - agentSpawned - gateReserved - laneReserve
   if (remaining < est + GATE_LANDING_COST) {
    logGateDeferral(frd, `agent budget — ~${est} units for the gate + ${GATE_LANDING_COST} for its landing, only ${remaining} left after reserving ${gateReserved} for ${gatesInFlight.size} gate(s) in flight${laneReserve ? ` and ${laneReserve} for the landing in progress` : ''} (maxAgents ${MAX_AGENTS})`)
    i++
    continue
   }
  }
  gateQueue.splice(i, 1)
  launchGateInSlot(frd, slot, est)
 }
 return true
}
const REVERIFY_SCHEMA = { type: 'object', required: ['green'], properties: { green: { type: 'boolean' }, failure: { type: 'string' }, report_scope: REPORT_SCOPE, gateReport: FRD_GATE_SCHEMA.properties.gateReport } }
async function reverifyAtLanding(frd, gate, pin, count) {
 const ev = gate && gate.reviewerEvidence
 const files = ev ? ev.tests.map((x) => x.path) : ((gate && gate.testFiles) || []).filter(Boolean)
 const since = pin ? `--since ${pin}` : ''
 agentSpawned++
 try {
  return await agent(`MECHANICAL GATE RE-RUN — D1 stale-pin guard for ${frd} (BL-0186; BL-0179 stamps the report's scope). The review-only gate for ${frd} PASSED at pin ${pin || '(unknown)'}, but the MAIN tree gained ${count >= 0 ? count : 'an unknown number of'} code commit(s) since then, so the verdict may not describe the tree it would certify. Re-run the objective gate on the MAIN tree at HEAD before anything is stamped. You judge nothing, fix nothing, stage nothing, commit nothing. Do EXACTLY, in order:
  1) PORT FIRST (the reviewer's adversarial tests must run against the landing tree):${files.length && ev ? ` each \`${ev.dir}/<path>\` goes to \`<repo root>/<path>\` (${files.join(', ')}) — run this port command VERBATIM, as ONE Bash call: \`${repoRootPortCommand(ev.dir, files)}\`. ${REPO_ROOT_PATHS_NOTE}` : files.length ? ` the reviewer's test files (${files.join(', ')}) must be present on this tree; if one is missing, say so in \`failure\` and return green:false.` : ' (the gate left no test files — skip this step).'}
  2) Run \`bash .pandacorp/verify.sh ${since}\` — NEVER with \`--only\`/\`--files\` (a scoped run stamps scope:"partial" and certifies nothing). It may exit non-zero; that is data.
  3) ${files.length ? `Run EACH of the reviewer's test files explicitly by path — \`pnpm vitest run "$(git rev-parse --show-toplevel)/<path>"\` (a Playwright spec: \`pnpm playwright test "$(git rev-parse --show-toplevel)/<path>"\`): ${files.join(', ')}.` : 'No reviewer test files to run.'}
  4) Read \`.pandacorp/run/gate-report.json\` and return { green: <true ONLY if that report is green AND every step-3 run passed>, report_scope: <its \`scope\` VERBATIM>, failure: <one sentence naming the first red sub-gate or test>, gateReport: <the report verbatim when it is red> }.`,
   { label: `reverify:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REVERIFY_SCHEMA })
 } catch (e) { log(`⚠ D1: the landing re-verify for ${frd} threw (${(e && e.message) || e}) — treated as RED (fail-closed)`); return null }
}
const STALE_PIN_SCHEMA = { type: 'object', required: ['count'], properties: { count: { type: 'number', description: 'the integer the command printed; -1 if it failed' }, failure: { type: 'string' } } }
async function stalePinGuard(frd, reviewIds, gate, launchPin) {
 const pin = launchPin || null
 let count = -1
 if (pin) {
  agentSpawned++
  let r = null
  try {
   r = await agent(`MECHANICAL COMMAND RUNNER — D1 stale-pin guard for ${frd} (BL-0186). Execute exactly this command once, from anywhere, and return the integer it prints as \`count\`: \`git -C ${PROJECT_DIR} rev-list --count ${pin}..HEAD -- . ':(exclude).pandacorp' ':(exclude)docs'\` — the MAIN-tree commits since the pin ${pin} that touched CODE (anything outside .pandacorp/ and docs/). Change nothing. If the command fails, return { count: -1, failure: "<its error>" }.`,
    { label: `stale-pin:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STALE_PIN_SCHEMA })
  } catch (e) { log(`⚠ D1: the stale-pin check for ${frd} threw (${(e && e.message) || e}) — re-verifying (fail-closed)`) }
  count = (r && Number.isInteger(r.count) && r.count >= 0) ? r.count : -1
 }
 if (count === 0) { log(`◦ D1: no code commit on main since ${frd}'s pin ${pin} — its verdict lands as reviewed`); return null }
 log(`↻ D1: main ${count > 0 ? `gained ${count} code commit(s)` : 'may have advanced (the count is unknown)'} since ${frd}'s pin ${pin || '(none)'} — porting its reviewer tests and re-verifying with verify.sh ${pin ? `--since ${pin}` : '(full)'} on main before landing (stale-pin guard)`)
 const rv = await reverifyAtLanding(frd, gate, pin, count)
 if (rv && rv.green === true && !isPartialReport(rv)) { log(`✓ D1: ${frd} re-verified green on the landing tree — landing its PASS`); gate.__reverified = true; return null }
 if (rv && rv.green === true) refusePartial(frd, 'the landing re-verify')
 const failure = `D1 stale-pin guard: main advanced since the gate's pin ${pin || '(none)'} and \`verify.sh ${pin ? `--since ${pin}` : ''}\` on the landing tree is RED${rv && rv.failure ? `: ${rv.failure}` : rv ? '' : ' (no verdict)'}`
 log(`⊘ ${frd}: ${failure} — the PASS is converted into a REOPEN (patch-first on main); it is never stamped VERIFIED over an unverified combination`)
 const tests = gate && gate.reviewerEvidence ? gate.reviewerEvidence.tests.map((x) => x.path) : []
 return {
  ...gate, green: false, reopen: [...reviewIds], failure,
  findings: [{ wo: reviewIds[0], finding: `${failure}. The gate passed at its pin; the combination with what landed on main since is red — find the interaction in \`git diff ${pin || '<pin>'}..HEAD\`.`, failingTest: tests.length ? tests.join(', ') : '(see the gate report)', files: [] }],
  gateReport: (rv && rv.gateReport) || (gate && gate.gateReport), report_scope: rv && rv.report_scope,
 }
}
const landingCostOf = (gate) => (gate && gate.green !== true && Array.isArray(gate.reopen) && gate.reopen.length ? GATE_LADDER_COST : GATE_LANDING_COST)
const laneReserveLeft = () => (landingInFlight ? Math.max(0, landingInFlight.reserve - (agentSpawned - landingInFlight.spawnedAt)) : 0)
function laneTopUp() {
 if (!landingInFlight || concurrentGates !== true || !gateQueue.length || !freeSlot()) return
 try { launchParallelGates(false, true) } catch (e) { log(`⚠ D1: mid-landing slot refill failed (${(e && e.message) || e}) — the loop refills after the landing`) }
}
async function topUpBeforeLanding(idx = 0) {
 if (concurrentGates !== true || !gateQueue.length || !freeSlot()) return
 const unpinned = gateQueue.filter((x) => { const st = frdState.get(x); return st && !st.pinSha })
 if (unpinned.length) await capturePin(unpinned)
 landingInFlight = { frd: gateResults[idx].f.frd, spawnedAt: agentSpawned, reserve: landingCostOf(gateResults[idx].gate) }
 try { launchParallelGates() } finally { landingInFlight = null }
}
async function landParallelVerdict(final = false, idx = 0) {
 const [{ f, reviewIds, pin, gate }] = gateResults.splice(idx, 1)
 const st = frdState.get(f.frd)
 const heldBy = landingHeldBy(f.frd)
 if (heldBy) log(`⚠ D1: ${f.frd} lands before ${heldBy}'s verdict — nothing else can land and no gate is in flight (a dependency cycle through WO deps; the hold is waived)`)
 landingHoldLog.delete(f.frd)
 gateSettledSinceSafePoint = true
 if (!final) landingInFlight = { frd: f.frd, spawnedAt: agentSpawned, reserve: landingCostOf(gate) }
 const builtBefore = builtFrds.length
 let ported = false
 try {
  if (gate && gate.__worktreeFailed) {
   if (!final && gate.__slotDirty && st && !st.slotRequeued && liveSlots().length) {
    st.slotRequeued = true
    log(`↻ D1: ${f.frd}'s gate slot was dirty — re-queued ONCE for another slot (${liveSlots().length} live)`)
    gateQueue.unshift(f.frd)
    return
   }
   await convergeOne({ f, reviewIds, gate: null, __needsLegacy: true })
   return
  }
  if (gate && gate.green === true && isPartialReport(gate)) { refusePartial(f.frd, 'the parallel FRD gate'); reopenedFrds.push(f.frd); return }
  if (gate && gate.green === true) {
   const ev = gate.reviewerEvidence
   if (!ev) {
    log(`⊘ D1: ${f.frd}'s PASS carries no salvaged evidence (its release returned nothing) — NOT applying from a slot another gate may now occupy; re-gating it on main`)
    await convergeOne({ f, reviewIds, gate: null, __needsLegacy: true })
    return
   }
   const reopened = await stalePinGuard(f.frd, reviewIds, gate, pin)
   if (reopened || gate.__reverified) ported = ev.tests.length > 0
   if (reopened) { await convergeOne({ f, reviewIds, gate: reopened }); return }
   const ok = await applyGate(f.frd, reviewIds, ev.tests.map((x) => x.path), ev.dir)
   if (ok) { log(`✓ ${f.frd} VERIFIED (parallel gate, landed on main)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return }
   ported = ported || ev.tests.length > 0
   await convergeOne({ f, reviewIds, gate })
   return
  }
  ported = Boolean(gate && Array.isArray(gate.reopen) && gate.reopen.length && gate.reviewerEvidence && gate.reviewerEvidence.tests.length)
  await convergeOne({ f, reviewIds, gate })
 } finally {
  landingInFlight = null
  if (st) st.gateUnlanded = false
  if (ported && builtFrds.length === builtBefore) await unportReviewerTests(f.frd, gate.reviewerEvidence)
  if (st && !gateQueue.includes(f.frd) && enqueueGateIfComplete(f.frd)) { st.pinSha = null; log(`↻ D1: ${f.frd} gained work while its gate was in flight — queued for a fresh gate at HEAD`) }
 }
}
const UNPORT_SCHEMA = { type: 'object', properties: { removed: { type: 'array', items: { type: 'string' } }, kept: { type: 'array', items: { type: 'string' } } } }
async function unportReviewerTests(frd, ev) {
 if (!ev || !ev.tests.length) return
 agentSpawned++
 let r = null
 try {
  r = await agent(`MECHANICAL COMMAND RUNNER — D1 lane cleanup for ${frd} (BL-0186). This landing did NOT certify ${frd}, so the reviewer's test copies ported onto the MAIN tree must not stay behind as untracked files (the next landing's \`verify.sh --since\` would run them). The originals stay in ${ev.dir}. First run \`${REPO_TOP_ASSIGN}\` (the repository root) in the same Bash call as the checks below. ${REPO_ROOT_PATHS_NOTE} For EACH entry of EXPECTED: if \`"$TOP"/'<path>'\` exists AND \`git -C "$TOP" --literal-pathspecs ls-files --error-unmatch -- '<path>'\` FAILS (it is untracked) AND \`shasum -a 256 "$TOP"/'<path>'\` equals its sha256, run \`git -C "$TOP" --literal-pathspecs clean -f -- '<path>'\` and add the path to \`removed\`; otherwise touch nothing and add it to \`kept\` (tracked, edited, or already gone). Never a blanket clean, stage nothing, commit nothing. EXPECTED (JSON): ${JSON.stringify(ev.tests)}. Return { removed, kept }.`,
   { label: `unport-reviewer-tests:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: UNPORT_SCHEMA })
 } catch (e) { log(`⚠ D1: the lane cleanup for ${frd} threw (${(e && e.message) || e}) — untracked reviewer test copies may remain on main`) }
 const removed = (r && Array.isArray(r.removed)) ? r.removed : []
 const kept = (r && Array.isArray(r.kept)) ? r.kept : []
 log(`◦ D1: ${frd} did not land VERIFIED — removed ${removed.length} untracked reviewer test cop${removed.length === 1 ? 'y' : 'ies'} from main${kept.length ? `; left in place (tracked/edited/gone): ${kept.join(', ')}` : ''} (originals kept in ${ev.dir})`)
}
async function drainParallelGates() {
 while (gatesInFlight.size || gateResults.length) {
  const idx = nextLandingIndex()
  if (idx < 0) { logLandingHolds(); await Promise.race([...gatesInFlight.values()]) }
  else await landParallelVerdict(true, idx)
 }
}
const usableOf = (frd) => fastUsable.find((u) => u.frd === frd) || priorUsable.find((u) => u.frd === frd) || null
const isUsable = (frd) => Boolean(usableOf(frd))
const fastIsFloor = (frd) => fastFloor.has(frd) || !fastClassified.has(frd)
const FAST_BUILD_SCHEMA = { type: 'object', required: ['wos'], properties: { wos: { type: 'array', items: { type: 'object', required: ['id', 'line'], properties: { id: { type: 'string' }, line: { type: 'string', description: "the LAST line this work order's final commit or park command printed, copied character for character" } } } } } }
const SEC_AUDIT_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, findings: { type: 'array', items: { type: 'object' } } } }
async function fastClassify(frds) {
 agentSpawned++
 const c = await runMechOp('classify-frd', frds.map((f) => `--frd ${shellQuote(f)}`).join(' '), { label: `floor:${frds.join('+')}`, phase: 'Plan' })
 const rows = c.body && c.body.ok === true && Array.isArray(c.body.frds) ? c.body.frds : []
 for (const frd of frds) { const row = rows.find((x) => x && x.frd === frd); if (!row || row.floor !== false) fastFloor.add(frd); fastClassified.add(frd) }
 if (!rows.length) log(`⚠ floor classification unreadable (${c.error || 'no rows'}) — ${frds.join(', ')} treated as floor (fail-closed, C3)`)
}
const fastWaitLog = new Map()
function fastUpstreamWait(frd) {
 const woOwner = new Map()
 for (const [k, x] of frdState) for (const w of x.f.workOrders) woOwner.set(w.id, k)
 for (const u of frdDirectUpstream(frd, woOwner)) {
  if (blockedFrds.includes(u)) return { blocked: u }
  const x = frdState.get(u)
  if (!x) continue
  if (x.failed) return { wait: u, why: 'it did not land this run' }
  if (x.toBuildIds.size > 0) return { wait: u, why: 'not built yet' }
  if (fastIsFloor(u) && !builtFrds.includes(u)) return { wait: u, why: 'floor: a dependent waits for its VERIFIED (C3)' }
 }
 return null
}
function pickFastFrd() {
 for (const [frd, st] of frdState) {
  if (st.failed || st.toBuildIds.size === 0) continue
  const w = fastUpstreamWait(frd)
  if (!w) return frd
  if (w.blocked) { log(`⊘ ${frd} skipped (depends on the blocked ${w.blocked})`); blockFrdInSchedule(frd, 'needs-owner'); continue }
  if (fastWaitLog.get(frd) !== w.wait) { fastWaitLog.set(frd, w.wait); log(`⏸ ${frd} waits for ${w.wait} (${w.why})`) }
 }
 return null
}
async function fastLaneStep() {
 const frd = pickFastFrd()
 if (frd) return await fastBuildFrd(frd)
 if (gatesInFlight.size || gateResults.length || convergeQueue.length) {
  if (!PARALLEL_GATES) await settleGates(false)
  else if (gatesInFlight.size && nextLandingIndex() < 0) await Promise.race([...gatesInFlight.values()])
  return null
 }
 if (gateQueue.length) {
  if (PARALLEL_GATES && concurrentGates !== false && launchParallelGates(true) && gatesInFlight.size) return null
  const g = gateQueue.shift()
  const st = frdState.get(g)
  await gateAndConverge(st.f, st.reviewIds)
  return null
 }
 for (const [f, st] of frdState) {
  if (st.failed || st.toBuildIds.size === 0) continue
  log(`↩ ${f}: deferred to the next run — it waits for ${fastWaitLog.get(f) || 'an upstream'}, which will not be VERIFIED this run`)
  for (const id of st.toBuildIds) globalQueue.delete(id)
  st.failed = true
  reopenedFrds.push(f)
 }
 return null
}
const fastMarkLanded = (frd, ids) => { const st = frdState.get(frd); for (const id of ids) { globalQueue.delete(id); doneIds.add(id); if (st) st.toBuildIds.delete(id) } }
function fastSegments(wos) {
 const segs = []
 for (const w of wos) {
  const model = (w.reopen_count || 0) >= 1 ? pickWorkerModel(w) : P.worker
  const last = segs[segs.length - 1]
  if (last && model === P.worker && last.model === P.worker) last.wos.push(w)
  else segs.push({ model, wos: [w] })
 }
 return segs
}
const fastWoBrief = (w, frd) => `### WORK ORDER ${w.id}${w.summary ? ` — ${w.summary}` : ''}
  owns: ${w.artifacts && w.artifacts.length ? w.artifacts.join(', ') : '(nothing declared: add one --file <path> per file you changed, only files this work order needs)'}; depends on: ${(w.deps || []).join(', ') || 'none'}.${woCtx(w, frd)}
  commit: \`${mechOpCommand('commit-wo', commitWoFlags(w))}\`
  park: \`${mechOpCommand('park-wo', parkWoFlags(w))}\``
const fastBuilderPrompt = (frd, wos, retry) => `${EMIT('implementer', frd, { frd, activity: retry ? 'retry' : 'implement' })}FAST-LANE BUILDER (proposal 39 C4) for FRD ${frd}.${retry ? ' RETRY: these work orders did not land on the first attempt; find out why before you rebuild them.' : ''} Build its work orders below IN THIS ORDER, one at a time, each with TDD (RED → GREEN → refactor) against its EARS criteria. A work order's boundary is the files it owns: another work order's files and the .pandacorp state are not yours.
${wos.map((w) => fastWoBrief(w, frd)).join('\n')}
HOW TO RUN each work order, in order:
 1) Append its start line: printf '{"kind":"wo_start","frd":"${frd}","wo":"<id>","at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${TRACK_PATH}. If .pandacorp/run/preserved-tests/<id>/ exists, restore those tests first (your RED baseline, DR-107). Read the ## Status Note of the work orders it depends on and build against those interfaces.
 2) Implement it until its own tests pass. Fill its ## Status Note: what it built, the interfaces with signatures, the seams, the decisions and assumptions a consumer inherits, its test files. Never edit implementation_status and never call git yourself: the commit command stamps IN_REVIEW and commits.
 3) Run its commit command exactly as given and read the LAST line it prints (one JSON object). "ok":true → the next work order. A refusal says why: "undeclared" → the tree held no owner edit at dispatch (the engine never builds over one), so an undeclared path is a stray edit of this build: undo it, or re-run adding --extra '<path>' --reason '<why this work order needs it>'; "parked-leftover" → that path is a parked work order's leftover, never this one's, whether it came in through --files or --extra: run the park command of the work order it names (it salvages the leftover), then re-run; "tests-red" or an uncited AC → fix it (cite each AC id in a test) and re-run.
 4) If it still does not commit after honest attempts, run its park command and go on; a work order that depends on a parked one is parked too (run its park command, do not build it).
 5) SELF-VERIFY, once every work order committed (none parked): run \`bash .pandacorp/verify.sh\` (the whole-program checks: lint, types, dead code, tests). If it is red, fix the PRODUCTION code it names here, in this same context (never weaken, skip or delete a test, never edit a blessed baseline), and commit each fix with \`${mechOpCommand('commit-wo', '--fixup <the-wo-id> --file <each path you changed>')}\`, naming the work order whose code you fixed; re-run until green or after two honest attempts. Leave the tree clean: the engine's own verify runs next.${designRef(frd)}${reuseRef(frd)}
Return { wos: [{ id, line }] }: one entry per work order above, line = the LAST line its final commit or park command printed, copied character for character.`
function fastLanded(wos, wrappedAnswer) {
 const answer = unwrapAnswer(wrappedAnswer, 'wos')
 const rows = answer && Array.isArray(answer.wos) ? answer.wos : []
 const out = { committed: [], parked: [], unproven: [] }
 for (const w of wos) {
  const row = rows.find((x) => x && String(x.id).toLowerCase() === w.id.toLowerCase())
  const c = row ? parseMechLine(row, 'commit-wo') : { body: null, error: 'no receipt' }
  if (c.body && c.body.ok === true && ['committed', 'nothing'].includes(c.body.status) && String(c.body.wo || '').toLowerCase() === w.id.toLowerCase()) { out.committed.push(w); continue }
  const p = row ? parseMechLine(row, 'park-wo') : { body: null }
  if (p.body && p.body.ok === true) { out.parked.push(w); continue }
  log(`⚠ ${w.id}: no valid sealed commit-wo/park-wo receipt from its builder (${c.error || (c.body && `${c.body.status}: ${c.body.reason || ''}`)}) — unverified, treated as not landed`)
  out.unproven.push(w)
 }
 return out
}
async function fastBuilder(frd, wos, model, retry = false) {
 agentSpawned += COST(model)
 const label = retry ? `fast-retry:${frd}` : model !== P.worker ? `fast-build:${frd}:${wos[0].id}` : `fast-build:${frd}`
 const out = fastLanded(wos, await agent(fastBuilderPrompt(frd, wos, retry), { label, phase: 'Build', model, effort: model === 'opus' ? 'high' : undefined, agentType: 'pandacorp:implementer', schema: FAST_BUILD_SCHEMA }))
 fastMarkLanded(frd, out.committed.map((w) => w.id))
 if (out.unproven.length) await parkWorkOrders(out.unproven)
 return [...out.parked, ...out.unproven]
}
async function fastRepairOrBlock(frd, context) {
 const st = frdState.get(frd)
 const liveIds = st.f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED').map((w) => w.id)
 await recordRepairDiscardIntent(frd, liveIds)
 const fix = await attemptRepair(frd, `fast lane: ${context}`)
 if (fix && fix.green === true) { log(`✓ ${frd}: repaired`); return true }
 const reason = (await discardBlockedCode(frd, liveIds)) ? ((fix && fix.blocked_reason) || 'error') : 'needs-owner'
 log(`⊘ ${frd}: could not repair (${reason}) — BLOCKED, continuing with independent FRDs`)
 blockFrdInSchedule(frd, reason)
 return false
}
async function fastVerify(frd, since, ids) {
 agentSpawned++
 const r = await runMechOp('verify', `--frd ${shellQuote(frd)}${since ? ` --since ${shellQuote(since)}` : ''}${ids.map((id) => ` --wo ${shellQuote(id)}`).join('')}${fastIsFloor(frd) ? ' --floor' : ''}`, { label: `verify:${frd}` })
 const b = r.body
 if (!b || b.ok !== true) return { refused: true, green: false, usable: false, failure: r.error || (b && `${b.status}: ${b.reason || b.error || ''}`) || 'no verify receipt' }
 if (b.floor === true) fastFloor.add(frd)
 const green = b.green === true && b.scope !== 'partial'
 return { refused: false, green, usable: green && b.usable === true, sha: b.sha || null, failure: b.failure || b.usableFailure || '' }
}
async function fastVerifyOrRetry(frd, since, ids) {
 const v = await fastVerify(frd, since, ids)
 if (!v.refused) return v
 log(`⚠ ${frd}: verify was refused (${v.failure}) — it certified nothing either way; retrying once`)
 return await fastVerify(frd, since, ids)
}
const fastFixPrompt = (frd, ids, failure) => `${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}FAST-LANE FIX-FORWARD (proposal 39 C6, rung 1) for ${frd}: its work orders (${ids.join(', ')}) are committed, but \`bash .pandacorp/verify.sh\` is RED on the clean landed tree: ${failure || '(see .pandacorp/run/gate-report.json)'}. Fix the PRODUCTION code (never weaken, skip or delete a test) until \`bash .pandacorp/verify.sh\` is green. Commit every fix with exactly \`${mechOpCommand('commit-wo', '--fixup <the-wo-id> --file <each path you changed>')}\`, naming the work order whose code you fixed; never call git yourself and never edit implementation_status. Return { done: true } once verify.sh is green and the project tree is clean, else { done: false, failure }.`
async function fastBuildFrd(frd) {
 const st = frdState.get(frd)
 phase('Build')
 if (!fastClassified.has(frd)) await fastClassify([frd])
 const wos = st.f.workOrders.filter((w) => st.toBuildIds.has(w.id))
 const ids = wos.map((w) => w.id)
 log(`⚒ fast lane: ${frd} — ${wos.length} work order(s), one builder per worker-tier run (C4): ${ids.join(', ')}`)
 const pre = fusedDispatch && fusedDispatch.frd === frd && JSON.stringify([...fusedDispatch.wos].sort()) === JSON.stringify([...ids].sort()) ? fusedDispatch : null
 fusedDispatch = null
 if (!pre) agentSpawned++
 const prefix = pendingSyncRollups || ''
 pendingSyncRollups = null
 const d = pre ? { body: pre } : await runMechOp('dispatch', `${ids.map((id) => `--wo ${shellQuote(id)}`).join(' ')} --commit`, { label: `dispatch:${frd}`, prefix })
 if (!d.body || d.body.ok !== true) log(`⚠ ${frd}: dispatch stamp not confirmed (${d.error || (d.body && (d.body.reason || d.body.error))}) — building anyway; the landed floor is then fail-closed`)
 const since = (d.body && d.body.ok === true && d.body.base) || null
 try {
  let missed = []
  for (const seg of fastSegments(wos)) {
   const waiting = seg.wos.filter((w) => (w.deps || []).some((dep) => missed.some((m) => m.id === dep)))
   missed.push(...waiting)
   const todo = seg.wos.filter((w) => !waiting.includes(w))
   if (!todo.length) continue
   buildCostByFrd.set(frd, (buildCostByFrd.get(frd) || 0) + COST(seg.model))
   missed.push(...(await fastBuilder(frd, todo, seg.model)))
  }
  if (missed.length && !capHit() && canAffordRepair(frd, 'opus')) {
   const again = wos.filter((w) => missed.includes(w))
   log(`↻ ${frd}: ${again.map((w) => w.id).join(', ')} did not land — one opus rebuild (DR-073 escalation)`)
   missed = await chargedRepair(frd, 'opus', () => fastBuilder(frd, again, 'opus', true))
  }
  if (missed.length) {
   if (!(await fastRepairOrBlock(frd, `work order(s) ${missed.map((w) => w.id).join(', ')} could not be built and committed`))) return null
   fastMarkLanded(frd, ids)
  }
  let v = await fastVerifyOrRetry(frd, since, ids)
  if (!v.refused && !v.green && !capHit() && canAffordRepair(frd, 'sonnet')) {
   log(`! ${frd}: verify.sh red on the clean landed tree (${v.failure}) — fix-forward (sonnet)`)
   agentSpawned += COST('sonnet')
   await chargedRepair(frd, 'sonnet', () => agent(fastFixPrompt(frd, ids, v.failure), { label: `fix:${frd}`, phase: 'Build', model: 'sonnet', effort: 'medium', agentType: 'pandacorp:implementer', schema: STOP_SCHEMA }))
   v = await fastVerifyOrRetry(frd, since, ids)
  }
  if (!v.refused && !v.green) {
   if (!(await fastRepairOrBlock(frd, `verify.sh is red on the clean landed tree after the fix-forward: ${v.failure}`))) return null
   v = await fastVerifyOrRetry(frd, since, ids)
  }
  if (v.usable && !fastIsFloor(frd)) {
   fastUsable.push({ frd, sha: v.sha })
   log(`✅ USABLE: ${frd} @ ${v.sha} — committed, verify.sh green on the clean landed SHA (proposal 39 C6); its gate runs now, fix-forward only from here`)
  } else if (v.refused) log(`⚠ ${frd}: verify refused again (${v.failure}) — not USABLE; nothing is repaired or discarded, its gate decides`)
  else if (v.green && fastIsFloor(frd)) log(`◦ ${frd}: floor (C3) — green on ${v.sha}, USABLE only when VERIFIED; its gate runs now`)
  else if (v.green) log(`⚠ ${frd}: green on ${v.sha} but not USABLE (${v.failure || 'no committed build_usable line'}) — its gate decides`)
  else log(`⚠ ${frd}: built but verify.sh is not green on the clean tree (${v.failure}) — not USABLE; its gate decides`)
  if (!fastIsFloor(frd) && !v.usable) fastFloor.add(frd)
  if (enqueueGateIfComplete(frd)) {
   if (v.sha) st.pinSha = v.sha
   else await capturePin([frd])
   launchEvidence(frd)
   startEarlySecurity(st.pinSha)
  }
  return null
 } catch (e) {
  if (!isInfraError(e)) throw e
  await parkWorkOrders(wos.filter((w) => !doneIds.has(w.id)))
  return 'paused'
 }
}
function startEarlySecurity(pin) {
 if (!FAST || REVIEW_DEFERRED || earlySecurity || !pin) return
 agentSpawned += COST(P.judge)
 log(`▹ security audit started alongside the first gate, at ${pin} (proposal 39 C6); the close-out audits only the delta since`)
 earlySecurity = { pin, promise: agent(`DR-085 HARDENING 1a — the EARLY security audit (proposal 39 C6), alongside the first FRD gate. You are READ-ONLY. A build is still writing the working tree, so audit the COMMIT ${pin}, never the working tree: list it with \`git -C ${PROJECT_DIR} ls-tree -r --name-only ${pin} -- .\`, read a file with \`git -C ${PROJECT_DIR} show ${pin}:<repo-relative path>\`, search with \`git -C ${PROJECT_DIR} grep -n <pattern> ${pin} -- .\`. Checklist: OWASP Top-10 for this stack, secrets in code/config/history, security headers + CSP, auth/authz on every mutating route, dependency risk (ASI01–ASI10 too if there is an agentic/LLM component). Write the report (each finding: severity, file:line, remediation) to ${PROJECT_DIR}/.pandacorp/run/security-early/${pin}.md (gitignored; commit nothing). Return { done: true, findings }: the Critical/High items as { severity, summary }, [] when none.`,
  { label: 'hardening:security-audit-early', phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: SEC_AUDIT_SCHEMA }).catch(() => null) }
}
async function securityDeltaAudit(fullAudit) {
 const early = await earlySecurity.promise
 if (!(early && early.done === true && Array.isArray(early.findings))) { log('⚠ the early security audit gave no usable verdict — running the full audit (fail-closed, C6)'); return await fullAudit() }
 const pin = earlySecurity.pin
 return await agent(`DR-085 HARDENING 1a/3 — the security DELTA audit (proposal 39 C6, fail-closed). A read-only audit of commit ${pin} ran alongside the first gate: its report is ${PROJECT_DIR}/.pandacorp/run/security-early/${pin}.md, its open Critical/High items: ${JSON.stringify(early.findings).slice(0, 1500)}. You are READ-ONLY on code. Audit EVERY source change since that commit (\`git -C ${PROJECT_DIR} diff ${pin}..HEAD -- . ':(exclude).pandacorp' ':(exclude)docs'\`) with the same checklist (OWASP Top-10, secrets, headers + CSP, authz on every mutating route, dependency risk), and re-check that each early item still holds at HEAD. Write docs/reviews/security-<YYYY-MM-DD>.md merging both (each finding: severity, file:line, remediation, early or delta) and commit it (Conventional Commits, e.g. \`docs(security): audit report\`). Return { done: true, findings } ALWAYS once the report exists: findings = the Critical/High items still open at HEAD ([] when none).${HARDENING_EVENT_IF_NO_FINDINGS('security')}`,
  { label: 'hardening:security-delta', phase: 'Hardening', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: SEC_AUDIT_SCHEMA })
}
function usableHoldRecord(frd, sha, ids, what) {
 const set = [frd, ...[...frdState.keys()].filter((x) => x !== frd && frdUpstream(x).has(frd))]
 return `${frd} ya era USABLE (en main, verify.sh verde en ${sha}) y su gate lo rechaza; la escalera quiere descartar ${ids.join(', ')} (${what}). El motor no revierte codigo USABLE solo. Decide: corregirlo encima (fix-forward) o descartarlo; si apruebas el descarte se revierte de una vez todo el conjunto dependiente: ${set.join(', ')}.`
}
async function holdUsableDiscard(frd, ids, what) {
 const sha = (usableOf(frd) || {}).sha
 log(`⛔ ${frd}: USABLE since ${sha} — ${what} would discard landed code; fix-forward only: BLOCKED needs-owner, nothing reverted (proposal 39 C6)`)
 const record = usableHoldRecord(frd, sha, ids, what)
 agentSpawned++
 await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}USABLE CODE IS NEVER AUTO-DISCARDED (proposal 39 C6) for ${frd}: the recovery ladder wants ${what} of ${ids.join(', ')}, but ${frd} was USABLE (committed, verify.sh green on ${sha}) and other work may build on it. Do NOT \`git checkout\`/\`restore\`/\`rm\`/\`revert\` any code file.
  1) For EACH of ${ids.join(', ')}: set \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  2) Append this owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH): ${record}
  3) COMMIT (Conventional Commits, scope, the subject naming ${frd}) staging ONLY those frontmatter/rollup files, decisions.md and status.yaml.${emitGateOutcome(frd, 'blocked', ',"blocked_reason":"needs-owner"')}${NOTIFY('FRD ' + frd + ' USABLE rechazado por su gate: descartarlo necesita tu decision')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
  { label: `block-usable:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}
function deferQueuedGates() {
 for (const frd of gateQueue.splice(0)) log(`⏸ ${frd}: gate deferred (reviewBudget defer) — review debt until a later window`)
}
const fastReviewDebt = () => [...frdState].filter(([frd, st]) => !st.failed && st.toBuildIds.size === 0 && !builtFrds.includes(frd) && !blockedFrds.includes(frd)).map(([frd]) => frd)
function fastResult() {
 if (!FAST) return {}
 const usable = fastUsable.map((u) => ({ ...u }))
 const debt = fastReviewDebt()
 const pushHint = usable.length ? `PushNotification: USABLE on main — ${usable.map((u) => `${u.frd} @ ${u.sha}`).join(', ')}${debt.length ? `; review pending for ${debt.join(', ')}` : ''}` : ''
 return { usable, reviewDebt: debt, pushHint }
}
if (gateQueue.length && !REVIEW_DEFERRED) {
 if ((await infraPausable(() => capturePin([...gateQueue]))) === PAUSED) return await pausedExit({ builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })
 for (const frd of gateQueue) launchEvidence(frd)
}
let safePointChecks = 0
const AGENT_BUDGET_WARN_RATIO = 0.8
let agentBudget80Warned = false
let agentBudgetLadderWarned = false
function warnAgentBudgetNearExhaustion(workRemains) {
 if (!MAX_AGENTS || !workRemains || agentSpawned >= MAX_AGENTS) return
 const remaining = MAX_AGENTS - agentSpawned
 if (!agentBudget80Warned && agentSpawned >= AGENT_BUDGET_WARN_RATIO * MAX_AGENTS) {
  agentBudget80Warned = true
  log(`⚠ AgentBudgetAdvisory: ${agentSpawned}/${MAX_AGENTS} cost-weighted agent units spent (${Math.round((100 * agentSpawned) / MAX_AGENTS)} %, threshold ${Math.round(AGENT_BUDGET_WARN_RATIO * 100)} %) with work still pending (${globalQueue.size} WO(s) to build, ${gateQueue.length + gatesInFlight.size + gateResults.length} gate(s) queued/in flight) — ${remaining} unit(s) left; the run stops at the agent ceiling if it is reached before the work finishes (BL-0207)`)
 }
 if (!agentBudgetLadderWarned && remaining < GATE_LADDER_COST) {
  agentBudgetLadderWarned = true
  log(`⚠ AgentBudgetAdvisory: only ${remaining} cost-weighted unit(s) left of maxAgents ${MAX_AGENTS} — less than one reopen ladder (~${GATE_LADDER_COST}) with work still pending: a gate that reopens now cannot be patched inside this budget (BL-0207)`)
 }
}
while (true) {
 try {
 if (infraHalt) { stopReason = 'paused-infra'; break }
 if (budget.total && budget.remaining() < LOW_BUDGET) { stopReason = 'budget'; log('Circuit breaker: budget ceiling reached — stopping at a safe point'); break }
 const workRemains = globalQueue.size > 0 || gateQueue.length > 0 || gatesInFlight.size > 0 || gateResults.length > 0 || convergeQueue.length > 0
 warnAgentBudgetNearExhaustion(workRemains)
 if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) {
  if (workRemains) { stopReason = 'agents'; log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) — stopping at a safe point`); break }
  log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) but no work remains (F5/BL-0177) — closing normally, not an agent-cap stop`)
 }
 if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason = 'budget'; log(`Spend ceiling reached (${Math.round(budget.spent() / 1000)}k ≥ maxSpend ${Math.round(MAX_SPEND / 1000)}k) — stopping at a safe point`); break }
 if ((builtFrds.length + blockedFrds.length + reopenedFrds.length) >= MAX_FRDS) { stopReason = 'maxFrds'; log(`Reached the test cap maxFrds=${MAX_FRDS} (built+blocked+reopened) — stopping at a safe point`); break }
 if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }
 if (REVIEW_DEFERRED && gateQueue.length) deferQueuedGates()
 if (PARALLEL_GATES) {
  if (gateResults.length) {
   const idx = nextLandingIndex()
   if (idx >= 0) { await topUpBeforeLanding(idx); await landParallelVerdict(false, idx); continue }
   logLandingHolds()
  }
 } else {
 await harvestGateResults()
 if (convergeQueue.length) {
  await settleGates(true)
  await drainConverge()
  continue
 }
 }
 const nothingInFlight = gatesInFlight.size === 0 && gateResults.length === 0 && convergeQueue.length === 0
 const wantSafePoint = globalQueue.size > 0
  || (nothingInFlight && gateQueue.length === 0)
  || (!nothingInFlight && globalQueue.size === 0 && gateSettledSinceSafePoint)
 if (wantSafePoint) {
  const throttled = TARGETED && !SAFE_POINT_EVERY_WAVE
  safePointChecks++
  const runSafePoint = !throttled || safePointChecks === 1 || safePointChecks % SAFE_POINT_WAVE_THROTTLE === 1
  if (runSafePoint) {
   gateSettledSinceSafePoint = false
   if ((await safePoint()) === 'stop') { stopReason = 'rethink'; break }
  } else {
   agentSpawned++
   const renewal = await agent(RENEW_LEASE,
    { label: 'renew-lease', phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: RENEW_LEASE_SCHEMA })
   if (renewal && renewal.stop === true) { stopReason = 'rethink'; log('⏸ renovación de lease falló en un safe point saltado — el motor para (fail closed, DR-069)'); break }
   log(`⊘ safe point #${safePointChecks} saltado (build dirigido, no drena nada — WP-11: 1×/corrida + 1×/${SAFE_POINT_WAVE_THROTTLE} boundaries; args.safePointEveryWave:true restaura la cadencia por ola; lease renovada igual)`)
  }
 }
 if (PARALLEL_GATES && concurrentGates !== false) {
  const unpinned = gateQueue.filter((x) => { const st = frdState.get(x); return st && !st.pinSha })
  if (unpinned.length) await capturePin(unpinned)
 }
 if (gateQueue.length && !(PARALLEL_GATES && concurrentGates !== false && launchParallelGates())) {
  if (concurrentGates === null) {
   concurrentGates = await ensureGateWorktree(frdState.get(gateQueue[0]).pinSha)
   log(concurrentGates ? '▹ C2: gates run CONCURRENTLY with builds in a pinned worktree' : '↩ C2: legacy synchronous gate path (worktree unavailable) for the whole run')
  }
  if (concurrentGates && LEGACY_SLOT.state !== 'failed') {
   while (gateQueue.length && gatesInFlight.size < MAX_CONCURRENT_GATES) launchGate(gateQueue.shift())
  } else {
   const gateFrd = gateQueue.shift()
   const st = frdState.get(gateFrd)
   await gateAndConverge(st.f, st.reviewIds)
   continue
  }
 }
 for (const [frd, st] of frdState) {
  if (!st.failed && !st.enqueued && frdDepsBlocked(frd) && [...st.toBuildIds].some((id) => globalQueue.has(id))) {
   log(`⊘ ${frd} skipped (depends on a blocked FRD)`)
   blockFrdInSchedule(frd, 'needs-owner')
  }
 }
 if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }
 if (globalQueue.size === 0) {
  if (PARALLEL_GATES && (gatesInFlight.size || gateResults.length)) {
   if (nextLandingIndex() < 0) await Promise.race([...gatesInFlight.values()])
   continue
  }
  if (gatesInFlight.size || gateResults.length || convergeQueue.length) { await settleGates(false); continue }
  if (PARALLEL_GATES && gateQueue.length && concurrentGates !== false) {
   log(`⚠ D1: ${gateQueue.length} gate(s) still wait on each other's landing with nothing left to build or in flight — waiving the landing-order rule for the head of the queue so the run progresses`)
   if (launchParallelGates(true) && gatesInFlight.size) continue
  }
  if (PARALLEL_GATES && gateQueue.length) {
   const frd = gateQueue.shift()
   log(`⚠ D1: ${frd} is gate-ready but no parallel gate could start with nothing in flight — gating it on main (legacy) rather than dropping it`)
   const st = frdState.get(frd)
   await gateAndConverge(st.f, st.reviewIds)
   continue
  }
  break
 }
 if (FAST) { if ((await fastLaneStep()) === 'paused') { stopReason = 'paused-infra'; break } continue }
 const ready = [...globalQueue.values()]
  .filter(({ wo }) => (wo.deps || []).every((d) => doneIds.has(d) || (!globalQueue.has(d) && !blockedIds.has(d))))
  .map(({ wo, frd }) => ({ ...wo, _frd: frd }))
 if (ready.length === 0) {
  const stuck = [...new Set([...globalQueue.values()].map((x) => x.frd))]
  const onBlockedDep = [...globalQueue.values()].some(({ wo }) => (wo.deps || []).some((d) => blockedIds.has(d)))
  const reason = onBlockedDep ? 'needs-owner' : 'error'
  log(`⚠ ${globalQueue.size} work order(s) can't proceed — ${onBlockedDep ? 'a dependency is BLOCKED' : 'unresolved/circular deps'} (${stuck.join(', ')}) — blocking those FRDs (${reason})`)
  for (const frd of stuck) blockFrdInSchedule(frd, reason)
  continue
 }
 const foundationReady = ready.filter((w) => w.foundation)
 let candidates = ready
 let uiPassSkipEvent = ''
 if (foundationReady.length) {
  candidates = [...foundationReady, ...ready.filter((w) => !w.foundation && joinsFoundationWave(w))]
 } else if (plan.hasFrontend && !foundationVerified && ready.some((w) => !w.foundation)) {
  const nonFoundationReady = ready.filter((w) => !w.foundation)
  if (FORCE_UI_PASSES || artifactsTouchUi(nonFoundationReady)) {
   const ok = await ensureFoundationComplete()
   if (!ok) {
    const surfaceFrds = [...new Set(nonFoundationReady.map((w) => w._frd))]
    log(`⊘ foundation incomplete and it needs the owner — holding surface work (${surfaceFrds.join(', ')})`)
    for (const frd of surfaceFrds) blockFrdInSchedule(frd, 'needs-owner')
    continue
   }
  } else {
   const surfaceFrds = [...new Set(nonFoundationReady.map((w) => w._frd))].join(', ')
   log(`⊘ foundation-gate omitido: ninguna WO no-fundación lista declara artefactos de UI (fail-closed si no declaran); el diff visual determinista sigue en el verify.sh completo del cierre — ${surfaceFrds}`)
   uiPassSkipEvent += UI_PASS_SKIPPED_EVENT('foundation-gate', surfaceFrds, 'no-ui-artifacts')
  }
 }
 phase('Build')
 const undeclared = candidates.filter((w) => !(w.artifacts && w.artifacts.length))
 if (undeclared.length) log(`⚠ ${undeclared.length} ready WO(s) declare no artifacts — serializing them (can't prove disjoint, DR-060 fail-safe): ${undeclared.map((w) => w.id).join(', ')}`)
 const remainingAgents = MAX_AGENTS ? Math.max(1, MAX_AGENTS - agentSpawned - (PARALLEL_GATES ? gateReserved : 0)) : Infinity
 const { picked: wave, cutBy: waveCutBy } = pickDisjointWave(candidates, P.wave, remainingAgents, woWaveCost)
 const waveFrds = [...new Set(wave.map((w) => w._frd))]
 log(`⚒ wave: ${wave.length} WO(s) across ${waveFrds.length} FRD(s) — ${wave.map((w) => w.id).join(', ')}`)
 if (waveCutBy === 'agent-budget' && wave.length === 1 && candidates.length > 1) {
  log(`⚠ oleada reducida a 1 WO por presupuesto de agentes agotado (agentSpawned=${agentSpawned} ≥ maxAgents=${MAX_AGENTS}, remainingAgents=${remainingAgents}) — ${candidates.length - 1} WO(s) más estaban listos y disjuntos pero no caben en el presupuesto restante. Esto NO es un recorte por dependencias/artefactos/tope de conteo (P.wave=${P.wave}).`)
 }
 const wavePicked = new Set(wave.map((w) => w.id))
 const deferred = [...globalQueue.values()].map(({ wo }) => wo).filter((wo) => !wavePicked.has(wo.id)).map((wo) => {
  const unmetDeps = (wo.deps || []).filter((d) => !(doneIds.has(d) || (!globalQueue.has(d) && !blockedIds.has(d))))
  if (unmetDeps.length) return `${wo.id}(deps:${unmetDeps.join('+')})`
  if (!candidates.some((c) => c.id === wo.id)) return `${wo.id}(blocked:foundation-pending)`
  const overlapsWith = wave.find((p) => artifactsOverlap(p, wo))
  return overlapsWith ? `${wo.id}(artifacts:${overlapsWith.id})` : `${wo.id}(blocked:${waveCutBy === 'agent-budget' ? 'agent-budget' : 'wave-cap'})`
 })
 if (deferred.length) log(`↻ deferred: ${deferred.join(', ')}`)
 const dispatchSyncRollups = pendingSyncRollups || ''
 pendingSyncRollups = null
 lastCommitSha = null
 let waveRepairRan = false
 agentSpawned++
 if (MECH_SCRIPT) {
  const d = await runMechOp('dispatch', `${wave.map((w) => `--wo ${shellQuote(w.id)}`).join(' ')} --commit`, { label: `dispatch:${waveFrds.join('+')}`, prefix: dispatchSyncRollups, suffix: uiPassSkipEvent })
  if (!d.body || d.body.ok !== true) log(`⚠ dispatch stamp not confirmed (${d.error || (d.body && (d.body.reason || d.body.error))}) — the builders run anyway; an unstamped WO is rebuilt on resume`)
 } else
 await agent(`${dispatchSyncRollups}Stamp \`implementation_status: IN_PROGRESS\` in the frontmatter of EACH of these work-order files (change nothing else beyond the sync-rollups step above if present, do NOT commit this part) by running EXACTLY this command once per file, substituting its path: \`perl -0pi -e 's/\\A(---\\n(?:(?!---\\n).*\\n)*?)implementation_status:[^\\n]*/$1implementation_status: IN_PROGRESS/' <file>\`. Files: ${wave.map((w) => w.path || `docs/frds/${w._frd}/work-orders/${w.id}`).join(', ')}. Return when all are stamped.${uiPassSkipEvent}`,
  { label: `dispatch:${waveFrds.join('+')}`, phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT })
 const waveBuildTokensBefore = budget.spent()
 const gatesAlongsideWave = PARALLEL_GATES ? gatesInFlight.size : 0
 const results = await parallel(wave.map((w) => () => buildWO(w, w._frd, wave.length === 1)))
 if (gatesAlongsideWave) for (const frd of waveFrds) markTokensUnreliable(frd, `${gatesAlongsideWave} parallel gate(s) were reviewing during its build wave`)
 else recordWaveBuildTokens(waveFrds, budget.spent() - waveBuildTokensBefore)
 for (let i = 0; i < wave.length; i++) {
  const w = wave[i]
  globalQueue.delete(w.id)
  const st = frdState.get(w._frd)
  if (st) st.toBuildIds.delete(w.id)
  if (results[i] && results[i].green === true && results[i].committed === true) doneIds.add(w.id)
  else if (st) st.failed = true
 }
 if (infraHalt || results.some((r) => r && r.infra)) {
  await parkWorkOrders(wave.filter((w) => !doneIds.has(w.id)))
  stopReason = 'paused-infra'
  break
 }
 for (const frd of waveFrds) {
  const st = frdState.get(frd)
  if (!st || !st.failed) continue
  log(`! ${frd}: a work order failed — attempting repair before giving up`)
  waveRepairRan = true
  const liveIds = ((st.f && st.f.workOrders) || []).filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED').map((w) => w.id)
  await recordRepairDiscardIntent(frd, liveIds)
  const fix = await attemptRepair(frd, 'a work order failed its self-test during the build wave')
  if (fix && fix.green === true) {
   log(`✓ ${frd}: repaired — proceeding to the gate`)
   st.failed = false
   for (const id of [...st.toBuildIds]) if (!globalQueue.has(id)) { st.toBuildIds.delete(id); doneIds.add(id) }
  } else {
   const reason = (await discardBlockedCode(frd, liveIds)) ? ((fix && fix.blocked_reason) || 'error') : 'needs-owner'
   log(`⊘ ${frd}: could not repair (${reason}) — BLOCKED, continuing with independent FRDs`)
   blockFrdInSchedule(frd, reason)
  }
 }
 const newlyGateReady = []
 for (const frd of waveFrds) if (enqueueGateIfComplete(frd)) newlyGateReady.push(frd)
 if (newlyGateReady.length) {
  await capturePin(newlyGateReady, waveRepairRan ? null : lastCommitSha)
  for (const frd of newlyGateReady) launchEvidence(frd)
 }
 } catch (loopErr) {
  if (isInfraError(loopErr) || infraHalt) { stopReason = 'paused-infra'; log(`⏸ scheduler stopped on the infra halt (${(loopErr && loopErr.message) || loopErr})`); break }
  log(`☠☠ FATAL: the build scheduler loop threw — ${(loopErr && loopErr.message) || loopErr} — ensuring running:false before rethrow (WS-D/D2)`)
  agentSpawned++
  await agent(`Crash fail-safe (WS-D/D2): the scheduler loop threw. Ensure running:false through the lease owner. Do NOT touch \`phase\`; NEVER set phase: release here. ${RELEASE_LEASE} Confirm done:true.`,
   { label: 'ensure-stopped-crash', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
  throw loopErr
 }
}
if (REVIEW_DEFERRED && !stopReason && fastReviewDebt().length) stopReason = 'review-deferred'
if (stopReason === 'paused-infra') return await pausedExit({ inFlight: gatesInFlight, builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })
try {
if (PARALLEL_GATES) await drainParallelGates()
else {
 await settleGates(true)
 await drainConverge()
}
const VISUAL_QA_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, reason: { type: 'string', description: 'REQUIRED when done is false: the step that could not complete and why, starting with the step number (e.g. "step 1: the dev server does not start: <error>")' }, toolCalls: { type: 'number', description: 'REQUIRED when done is false: how many tool calls you made before answering' } } }
const VISUAL_QA_SCOPE = 'THIS STEP\'S SCOPE: your task is the engine-computed END-OF-BUILD VISUAL QA below. The harness may ALSO relay a message the owner sent to the ORCHESTRATING session (for example a question about how the run delegates its work); when that relayed message does not mention this visual QA pass or these FRDs, it is not addressed to this step: do not answer it, do not stop because of it, do the steps below. Only a relayed message that explicitly asks to skip or change THIS visual QA pass changes it — then return done:false with a reason that quotes it. Return done:false ONLY after attempting the steps, always with `reason` starting with the number of the step that could not complete ("step <n>: …") and `toolCalls`.\n'
const VISUAL_QA_STEP_RE = /\bstep\s*[1-4]\b/i
const visualQaDidNoWork = (r) => Boolean(r) && typeof r === 'object' && r.done === false && !(Number(r.toolCalls) > 0) && !VISUAL_QA_STEP_RE.test(String(r.reason || ''))
const visualQaRetryNote = (prior) => `RETRY (BL-0198) — your previous attempt at this task returned done:false without attempting any step${prior && prior.reason ? ` (its reason: "${String(prior.reason).slice(0, 200)}")` : ''}. That is not an acceptable result: a message relayed from the orchestrating session does not cancel this pass, and "nothing to do" is never the answer, because this pass has a concrete task below. START AT STEP 1 NOW and make the tool calls. Return done:false only after attempting the steps, with a reason that begins "step <n>:" and your toolCalls.\n`
async function spawnVisualQa(frds) {
 const spawn = (note) => agent(note + visualQaPromptBody(frds), { label: 'visual-qa', phase: 'Review', model: VISUAL_QA_MODEL, effort: 'high', agentType: 'pandacorp:reviewer', schema: VISUAL_QA_SCHEMA }).catch(() => null)
 let result = await spawn('')
 if (!visualQaDidNoWork(result)) return { result, retried: false, noop: false }
 log(`↻ visual-qa answered done:false with no work (no tool calls reported, no step named; reason: ${result.reason ? String(result.reason).slice(0, 200) : 'none given'}) — retrying once (BL-0198)`)
 agentSpawned += COST(VISUAL_QA_MODEL)
 result = await spawn(visualQaRetryNote(result))
 return { result, retried: true, noop: visualQaDidNoWork(result) }
}
const visualQaPromptBody = (frds) =>
 `${EMIT('reviewer', 'visual-qa', { phase: 'review', activity: 'visual-qa' })}${VISUAL_QA_SCOPE}END-OF-BUILD VISUAL QA (DR-072) — the dedicated fidelity pass, scoped to the FRDs VERIFIED this run: ${frds.join(', ')}. This is a PUNCH-LIST + bounded DIRECT fixes, NOT a re-gate: NEVER reopen a work order or send anything back to the build loop (that restarts the churn). Compare, list, fix the cheap ones, leave the rest for the owner.
    For EACH of those FRDs, for each key route:
    1) Render the route (start the dev server if needed) and screenshot it; open the BINDING mock (docs/frds/<frd>/mocks/ — screenshot AND source), fdd.md, docs/design/design-tokens.json, DESIGN.md.
    2) Compare SEMANTICALLY (does the build look like the design?): layout, structure, spacing, sizing, colors/tokens, component reuse, density. Write every divergence to \`.pandacorp/comms/visual-punch-list.md\` (merge + dedupe with what the per-FRD gates already appended), one line each: \`- [ ] <frd> · <route> · <gap> · <file:line if known>\`.
    3) FIX the cheap, unambiguous ones DIRECTLY (a token/size/spacing/color/class correction against the EXISTING design docs — the doc already specified it, the build implemented it wrong; NO doc change). Check them off. Leave ambiguous/large gaps UNCHECKED for the owner. Bound your fixes (don't grind to perfection — the owner does the final polish).
    4) After fixing, run the FOCUSED \`bash .pandacorp/verify.sh --since <last_green_sha from .pandacorp/status.yaml>\` to confirm your fixes regressed nothing (DR-106 — the close-out/notify-end step right after runs the FULL suite once; don't pay it twice here); if a fix broke a test, revert THAT one fix (keep the rest) and re-run. Commit (e.g. \`style(visual-qa): sweep punch-list for ${frds.slice(0, 3).join(', ')}\`). Advance status.yaml last_event_at + updated_at + kill any dev server with TaskStop.
    Return { done: true } once the punch-list is written, safe fixes committed, and verify is green.${NOTIFY('QA Visual: punch-list generado + arreglos seguros aplicados', 'Glass')}`
const archiveChangesBody =
 ` 1) List .pandacorp/inbox/changes/*.md (IGNORE the done/ subfolder). For EACH whose frontmatter \`status\` is "building": read its \`affected_frds\` and check each of those FRD folders' rolled-up frd.md \`implementation_status\`. The change has LANDED iff ALL its affected_frds are VERIFIED (read the rollups from disk — this is what makes it work even when the verifying run is a LATER one).
  2) For EACH landed change: verify its durable record exists (the canonical docs/FRDs it names were touched); stamp \`status: done\` + \`shipped_sha\` (current \`git rev-parse --short HEAD\`) + \`shipped_at\` (ISO now); MOVE the file to .pandacorp/inbox/changes/done/ (a move, NEVER a delete — the folder is gitignored, a delete is irreversible); update its row in the queue index README.md.
  3) Leave every still-building change whose affected_frds are merely un-VERIFIED in place (they will verify on a later run). Commit the archive moves + status edits (Conventional Commits, scope) as their OWN commit. If NO building change has fully landed, change nothing.
  4) WS-D/D16 — ORPHANED building change: for EACH change still \`status: building\` whose \`affected_frds\` include a BLOCKED FRD (read that FRD's rolled-up frd.md \`implementation_status\` — it is \`BLOCKED\`, NOT merely un-VERIFIED), its build cannot complete on its own. Set it back to \`status: ready\` and add a one-line \`note:\` saying why (e.g. "re-opened: FRD <folder> quedó BLOCKED needs-owner"), so it re-surfaces at the next run's drain instead of stranding as a phantom building change. Commit that edit.`
const runHardeningChain = async () => {
 phase('Hardening')
 agentSpawned += COST(P.judge)
 const fullAudit = () => agent(`DR-085 HARDENING 1a/3 — the security AUDIT, construction's last step (BL-0012). You are READ-ONLY: audit and report, do NOT edit code (that is the next spawn's job). Audit the WHOLE project: OWASP Top-10 for this stack, secrets in code/config/history, security headers + CSP (e.g. next.config), auth/authz on every mutating route, dependency risk; if the product has an agentic/LLM component, also ASI01–ASI10 (e.g. path traversal via model-chosen paths). Write the durable evidence report to docs/reviews/security-<YYYY-MM-DD>.md: for EACH finding record severity (critical/high/medium/low), file:line evidence, and concrete remediation. Commit the report (Conventional Commits, e.g. \`docs(security): audit report\`). Return { done: true, findings } ALWAYS once the report file exists — do NOT condition done on fixing anything (fixing is the next spawn). \`findings\` is a short array of { severity, summary } for the Critical/High items the fix spawn must clear (empty if none).${HARDENING_EVENT_IF_NO_FINDINGS('security')}`,
  { label: 'hardening:security-audit', phase: 'Hardening', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, findings: { type: 'array', items: { type: 'object' } } } } })
 const audit = earlySecurity ? await securityDeltaAudit(fullAudit) : await fullAudit()
 const securityFixSkippable = Boolean(audit && audit.done === true && Array.isArray(audit.findings) && audit.findings.length === 0)
 if (securityFixSkippable) log('✓ security audit returned an explicit empty findings array — security-fix not applicable, skipped (DR-123)')
 if (!securityFixSkippable) agentSpawned++
 const fix = securityFixSkippable ? { done: true } : await agent(`DR-085 HARDENING 1b/3 — apply the security FIXES (BL-0012). The read-only auditor just wrote docs/reviews/security-<YYYY-MM-DD>.md with each finding + severity + remediation${audit && Array.isArray(audit.findings) ? ` (it flagged ${audit.findings.length} Critical/High item(s))` : ''}. Read that report. FIX every Critical AND High finding directly in production code (TDD — write the failing test first, then the fix; never weaken a test), then re-run the FOCUSED \`bash .pandacorp/verify.sh --since <last_green_sha from .pandacorp/status.yaml>\` until green (DR-106 — the close-out right after runs the FULL suite once; don't pay it twice here). Append to the SAME report, per finding: fixed | accepted-with-reason, and the final verify result. Commit (Conventional Commits).${HARDENING_EVENT('security')} (This one Hardening event folds the audit + fix into the single SECURITY stage result — status ok iff no Critical/High remains open, else fail; the read-only auditor does NOT emit its own.) Return { done: true } ONLY when no Critical/High remains open AND the report reflects it; otherwise { done: false, failure }. If the report lists NO Critical/High findings, there is nothing to fix — return { done: true } immediately.`,
  { label: 'hardening:security-fix', phase: 'Hardening', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
 const sec = { done: Boolean(audit && audit.done === true && fix && fix.done === true), failure: (fix && fix.failure) || (audit && audit.failure) }
 agentSpawned++
 const telem = await agent(`DR-085 HARDENING 3/3 — telemetry verification (BL-0012). Read docs/analytics/events.md (the event plan). VERIFY each planned event actually FIRES (exercise the flows via the tests/dev server; check the PostHog/analytics wiring is present and env-keyed). Fix trivial instrumentation gaps (a missing capture call) with TDD. Append a "## Verification <YYYY-MM-DD>" section to docs/analytics/events.md recording event-by-event: fires|gap-fixed|not-applicable. If the project has NO event plan and needs none (internal/personal return_type — check the PRD), record exactly that in the section instead. Commit.${HARDENING_EVENT('telemetry')} Return { done: true } (the verification section exists) or { done: false, failure }.`,
  { label: 'hardening:telemetry', phase: 'Hardening', model: P.worker, agentType: 'pandacorp:analytics', schema: STOP_SCHEMA })
 return { sec, telem, hardened: Boolean(sec && sec.done === true && telem && telem.done === true) }
}
const REUSE_MAX_AGE_SECONDS = 900
const REUSE_CHECK_SCHEMA = { type: 'object', required: ['canReuse', 'reason'], properties: {
 canReuse: { type: 'boolean' },
 reason: { type: 'string' },
 reportScope: { type: 'string' },
 reportGreen: { type: 'boolean' },
 reportSha: { type: 'string' },
 reportSince: { type: 'string' },
 lastGreenSha: { type: 'string' },
 headSha: { type: 'string' },
 dirty: { type: 'boolean' },
 ageSeconds: { type: 'number' }
} }
const CLOSE_OUT_VERIFY_REUSED_EVENT = (sha, ageSeconds) =>
 ` Also append the CloseOutVerifyReused event (fire-and-forget — BL-0147: this step reused a recent full green gate-report instead of re-running the whole-project suite): printf '{"event":"CloseOutVerifyReused","at":"%s","project":"%s","sha":"${sha}","ageSeconds":${Math.max(0, Math.round(ageSeconds || 0))}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
const REUSE_REPORT_CLAUSE = (reuse) => `a FULL, GREEN run of this EXACT commit (sha ${reuse.headSha}, ~${Math.max(0, Math.round(reuse.ageSeconds || 0))}s ago, clean tree)`
async function checkFullVerifyReuse() {
 agentSpawned++
 const r = MECH_SCRIPT
  ? (await runMechOp('reuse-check', `--max-age ${REUSE_MAX_AGE_SECONDS}`, { label: 'close-out-verify-reuse-check', phase: 'Review' })).body
  : await agent(
  `BL-0147 READ-ONLY CHECK — before the next step runs the WHOLE-PROJECT \`bash .pandacorp/verify.sh\`, decide whether it actually needs to: a recent \`scope:"full"\` green gate-report for this EXACT commit may already certify it. A \`scope:"since"\` or \`scope:"partial"\` report NEVER does — the full suite is the backstop for what a since-scoped run cannot see. Change NOTHING; this is a pure read, not a gate. Do these steps IN ORDER:
  1) \`git -C ${PROJECT_DIR} rev-parse HEAD\` → headSha (the full sha).
  2) \`git -C ${PROJECT_DIR} status --porcelain\` → dirty = true if it prints ANY line, else false.
  3) Read \`last_green_sha\` from \`${PROJECT_DIR}/.pandacorp/status.yaml\` → lastGreenSha.
  4) If \`${PROJECT_DIR}/.pandacorp/run/gate-report.json\` does not exist or fails to parse as JSON, stop and return { canReuse: false, reason: "no-report", headSha, dirty, lastGreenSha }.
  5) Read it. Copy its \`scope\`, \`green\`, \`sha\` fields VERBATIM as reportScope/reportGreen/reportSha, and its \`since\` field (empty string "" if the report has none) VERBATIM as reportSince — never guess or normalize any of them — and read its \`at\` timestamp.
  6) ageSeconds = (now, UTC) minus the report's \`at\`, in whole seconds (e.g. \`date -u +%s\` minus the parsed \`at\`'s epoch).
  \`canReuse\` is true ONLY IF: reportScope === "full"; reportGreen === true; reportSha is non-empty AND reportSha === headSha; dirty === false; AND ageSeconds <= ${REUSE_MAX_AGE_SECONDS}. A "since" or "partial" scope NEVER counts, whatever else matches. green:false, a missing/mismatched sha, a dirty tree, or ageSeconds over the ceiling ALL make canReuse false — on ANY doubt return false, the full rerun is the safe default and this check never relaxes the WP-08 partial-report cage. Return { canReuse, reason: one of "reused"|"no-report"|"scope-not-eligible"|"not-green"|"sha-missing"|"sha-mismatch"|"dirty-tree"|"stale-report", reportScope, reportGreen, reportSha, reportSince, lastGreenSha, headSha, dirty, ageSeconds }.`,
  { label: 'close-out-verify-reuse-check', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REUSE_CHECK_SCHEMA })
 if (!r || typeof r !== 'object' || r.canReuse !== true) return { ...(r || {}), canReuse: false, reason: (r && r.reason) || 'agent-no-result' }
 const why = r.reportScope !== 'full' ? `scope ${JSON.stringify(r.reportScope)} is not "full"`
  : r.reportGreen !== true ? 'the report is not green'
   : (typeof r.reportSha !== 'string' || !r.reportSha || r.reportSha !== r.headSha) ? `report sha ${r.reportSha || '(none)'} ≠ HEAD ${r.headSha || '(none)'}`
    : r.dirty !== false ? 'the tree is not proven clean'
     : !(typeof r.ageSeconds === 'number' && r.ageSeconds >= 0 && r.ageSeconds <= REUSE_MAX_AGE_SECONDS) ? `age ${r.ageSeconds} is outside 0..${REUSE_MAX_AGE_SECONDS}s`
      : null
 if (why) { log(`⊘ close-out verify reuse refused by the engine (${why}) — the full verify.sh runs (E2 finding 7)`); return { ...r, canReuse: false, reason: 'engine-refused' } }
 return r
}
let closed
if (LEAN_CLOSE_OUT) {
 let visualQaPromise = null
 let visualQaNote = ''
 if (plan.hasFrontend && builtFrds.length) {
  const builtWos = builtFrds.flatMap((frd) => (frdState.get(frd) || {}).f?.workOrders || [])
  if (uiPassesRequired(builtWos)) {
   phase('Review')
   agentSpawned += COST(VISUAL_QA_MODEL)
   visualQaPromise = spawnVisualQa(builtFrds).catch(() => null)
  } else {
   log(`⊘ visual-qa omitido: ninguna WO de los FRDs verificados esta corrida (${builtFrds.join(', ')}) declara artefactos de UI (fail-closed si no declaran); el diff visual determinista sigue en el verify.sh completo del cierre`)
   visualQaNote = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'no-ui-artifacts')
  }
 }
 let archiveStep = ''
 if (builtFrds.length) {
  archiveStep = `STEP 0 — archive landed changes FIRST, the DR-069 §7 verify-then-archive protocol (durable, cross-run):\n${archiveChangesBody}\n  THEN, in this SAME agent call: `
  log(`↷ archive sweep folded into the close-out agent (${builtFrds.length} FRD(s) verified this run)`)
 } else if (integratedChanges.length) {
  log(`↷ ${integratedChanges.length} change(s) integradas pero este run no verificó FRDs — siguen 'building' y se archivan en la corrida que verifique sus FRDs (DR-069 §7, durable cross-run)`)
 }
 if (visualQaPromise) {
  const out = await visualQaPromise
  const vq = out && out.result
  if (vq && vq.done === true) {
   log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
  } else {
   log(`⚠ visual-qa agent returned no confirmed result${vq && vq.done === false ? ` (done:false — reason: ${vq.reason ? String(vq.reason).slice(0, 300) : 'none given'})` : ''}${out && out.retried ? ' after one no-work retry (BL-0198)' : ''} — degrading honestly (punch-list may be incomplete this run)`)
   visualQaNote = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), out && out.noop ? 'agent-noop-after-retry' : 'agent-no-result') + ' VISUAL QA DEGRADED: the end-of-build visual QA pass did NOT return a confirmed result (agent failure/no-response) — its punch-list may be incomplete or missing this run. Note this explicitly in the progress/decisions write-up below so the owner knows to double-check fidelity by hand; the deterministic visual regression check inside the full verify.sh below is the remaining safety net.'
  }
 }
 phase('Review')
 const needsOwner = blockedFrds.filter((x) => blockedReasons[x] === 'needs-owner')
 const allDone = !TARGETED && !stopReason && !deferredWork && blockedFrds.length === 0 && reopenedFrds.length === 0 && builtFrds.length === plan.frds.length
 if (allDone) {
  const { sec, telem, hardened } = await runHardeningChain()
  phase('Review')
  if (hardened) {
   agentSpawned += COST(P.judge)
   const reuseLeanCloseOut = await checkFullVerifyReuse()
   closed = await agent(`${archiveStep}All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`).${GATE_SKIP}${reuseLeanCloseOut.canReuse ? ` THEN — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLeanCloseOut)} — treat that as this step's whole-project result (it already covers the smoke + visual gates).${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLeanCloseOut.headSha, reuseLeanCloseOut.ageSeconds)}` : ` THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates)`} and kill any test dev servers with TaskStop. FINALLY, before you may declare release, assert ALL of these ON DISK (BL-0012 + WS-D/D4 fail-closed) — if ANY fails, do NOT set phase: release and return done:false naming exactly what failed:
    (i) **every** docs/frds/*/frd.md rollup \`implementation_status\` is VERIFIED (WS-D/D4b — do a FRESH read of each frd.md on disk right now; if any is NOT VERIFIED, return { done: false } listing the offending FRD folders — the in-memory built-count is NOT enough, the disk is the oracle);
    (ii) assert the hardening evidence EXISTS **and is FRESH**: the security report docs/reviews/security-<TODAY>.md exists (TODAY = \`date -u +%F\`) AND its mtime is NEWER than status.yaml's \`run_started_at\` (WS-D/D4c — compare epochs, e.g. \`date -r docs/reviews/security-<TODAY>.md +%s\` vs the epoch of run_started_at; a STALE same-day report left by a PREVIOUS run FAILS this assert), AND the "## Verification" section is present in docs/analytics/events.md.
  If a cross-feature seam is wrong, reopen the offending work order (set it \`implementation_status: PLANNED\`) and return done:false with the finding. If everything integrates AND the full suite is green AND all of (i)+(ii) hold: set .pandacorp/status.yaml phase: release (commit it as part of this step's own commit — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here).${JOURNAL_GOLD}${HARDENING_EVENT('integration')} (status ok iff you declared release, else fail.) If (and ONLY if) you set phase: release above, ALSO record the run's terminal verdict:${BUILD_COMPLETE('released', `${builtFrds.length}/${plan.frds.length}`)}${visualQaNote}${RELEASE_LEASE} Return done:true ONLY once every step above succeeded — phase:release committed, the terminal verdict recorded, AND this terminal lease release.${NOTIFY('Build COMPLETO: FRDs verificados + hardening + integracion cross-feature OK', 'Glass')}`,
    { label: 'close-out', phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
   log(closed && closed.done === true
    ? 'Run ended: all FRDs verified + hardened.'
    : 'Run ended: all FRDs verified + hardened, but the close-out agent did not confirm release — the fail-safe will ensure running:false (phase stays implementation).')
  } else {
   agentSpawned++
   closed = await agent(`${archiveStep}Every FRD is VERIFIED but the DR-085 hardening did NOT complete (security: ${sec && sec.done === true ? 'ok' : 'INCOMPLETE — ' + ((sec && sec.failure) || 'failed')}; telemetry: ${telem && telem.done === true ? 'ok' : 'INCOMPLETE — ' + ((telem && telem.failure) || 'failed')}). The project must NOT be declared released (BL-0012 fail-closed — release requires the hardening evidence). 1) Append the hardening failure + your recommendation to .pandacorp/inbox/decisions.md (needs-owner). 2) Write a short Spanish summary to .pandacorp/comms/progress.md (todo verificado, hardening incompleto, qué falta). 3) Do NOT touch \`phase\` (KEEP it implementation) — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here.${visualQaNote}${RELEASE_LEASE} Return done:true ONLY once status.yaml/decisions.md reflect the above AND this terminal lease release succeeded.${NOTIFY('Build verificado pero hardening INCOMPLETO — NO se declara release; necesita tu decision')}`,
    { label: 'close-needs-hardening', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
   log('Run ended: all FRDs verified but hardening incomplete — NOT released (needs-owner).')
  }
 } else {
  const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]}${blockedFailures[x] ? `: ${blockedFailures[x]}` : ''})`).slice(0, 8).join(', ') || 'ninguno'
  const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
   : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
   : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
   : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
   : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).'
   : stopReason === 'review-deferred' ? ` Revision diferida (reviewBudget defer): ${fastUsable.length} FRD(s) USABLE en main; los gates quedan pendientes para otra ventana.` : ''
  const ownerMsg = needsOwner.length
   ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
   : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
  agentSpawned++
  const reuseLeanNotifyEnd = await checkFullVerifyReuse()
  closed = await agent(`${archiveStep}The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}.${GATE_SKIP}${reuseLeanNotifyEnd.canReuse ? ` FIRST — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLeanNotifyEnd)} — treat that as this step's whole-project result.${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLeanNotifyEnd.headSha, reuseLeanNotifyEnd.ageSeconds)}` : ` FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since)`} to confirm this pass left no global regression — note the result (a needs-owner-quarantined route is held aside, so its blocked state must NOT red this full-suite check; that is the whole point — the independent features still reach a green baseline while the blocked route waits on the owner, BL-0011). Then ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} (BL-0159 — the WO count you are about to report MUST be this freshly-recomputed one, never a figure remembered from earlier in the run: a gate/repair/block resolved AFTER the last sync would otherwise under- or over-count against the real \`wo-*.md\` files on disk). Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). **BL-0159 — narrate the LATEST state only:** the \`Blocked: … (${blk})\` reason/detail above for each FRD is already this run's FINAL verdict (a later gate/repair attempt supersedes an earlier one automatically — blockedReasons/blockedFailures are never stale). Never narrate an earlier reject/findings you might recall from this run's own transcript as if it were still the open issue once a later attempt changed the outcome — if a fix commit landed and a later gate re-blocked for a DIFFERENT reason (or none), report THAT reason, not the first one you saw. Do NOT touch \`phase\` (leave it as-is) — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here.${visualQaNote}${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${RELEASE_LEASE} Return done:true ONLY once status.yaml/progress.md reflect the above AND this terminal lease release succeeded.${NOTIFY(ownerMsg)}`,
   { label: 'notify-end', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
  log(`Run ended: ${builtFrds.length} verified, ${reopenedFrds.length} reopened, ${blockedFrds.length} blocked${stopReason ? ' · stop=' + stopReason : ''}.`)
 }
} else {
 let visualQaSkipEvent = ''
 if (plan.hasFrontend && builtFrds.length) {
  const builtWos = builtFrds.flatMap((frd) => (frdState.get(frd) || {}).f?.workOrders || [])
  if (uiPassesRequired(builtWos)) {
   phase('Review')
   agentSpawned += COST(VISUAL_QA_MODEL)
   const out = await spawnVisualQa(builtFrds)
   const vq = out.result
   if (vq && vq.done === false) log(`⚠ visual-qa returned done:false — reason: ${vq.reason ? String(vq.reason).slice(0, 300) : 'none given'}${out.retried ? ' (after one no-work retry, BL-0198)' : ''} (E2 finding 5)`)
   else if (!vq || vq.done !== true) log('⚠ visual-qa agent returned no confirmed result — the punch-list may be incomplete this run')
   else log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
   if (out.noop) visualQaSkipEvent = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'agent-noop-after-retry')
  } else {
   log(`⊘ visual-qa omitido: ninguna WO de los FRDs verificados esta corrida (${builtFrds.join(', ')}) declara artefactos de UI (fail-closed si no declaran); el diff visual determinista sigue en el verify.sh completo del cierre`)
   visualQaSkipEvent = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'no-ui-artifacts')
  }
 }
 if (builtFrds.length) {
  phase('Review')
  agentSpawned++
  await agent(`Archive landed changes — the DR-069 §7 verify-then-archive protocol (durable, cross-run).\n${archiveChangesBody}\n  Return { done: true }.${visualQaSkipEvent}`,
   { label: 'archive-changes', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
  log('✓ DR-069 §7 verify-then-archive sweep (building changes whose affected_frds all VERIFIED → done/)')
 } else if (integratedChanges.length) {
  log(`↷ ${integratedChanges.length} change(s) integradas pero este run no verificó FRDs — siguen 'building' y se archivan en la corrida que verifique sus FRDs (DR-069 §7, durable cross-run)`)
 }
 phase('Review')
 const needsOwner = blockedFrds.filter((x) => blockedReasons[x] === 'needs-owner')
 const allDone = !TARGETED && !stopReason && !deferredWork && blockedFrds.length === 0 && reopenedFrds.length === 0 && builtFrds.length === plan.frds.length
 if (allDone) {
  const { sec, telem, hardened } = await runHardeningChain()
  phase('Review')
  if (hardened) {
   agentSpawned += COST(P.judge)
   const reuseLegacyCloseOut = await checkFullVerifyReuse()
   closed = await agent(`All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`).${GATE_SKIP}${reuseLegacyCloseOut.canReuse ? ` THEN — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLegacyCloseOut)} — treat that as this step's whole-project result (it already covers the smoke + visual gates).${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLegacyCloseOut.headSha, reuseLegacyCloseOut.ageSeconds)}` : ` THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates)`} and kill any test dev servers with TaskStop. FINALLY, before you may declare release, assert ALL of these ON DISK (BL-0012 + WS-D/D4 fail-closed) — if ANY fails, do NOT set phase: release and return done:false naming exactly what failed:
    (i) **every** docs/frds/*/frd.md rollup \`implementation_status\` is VERIFIED (WS-D/D4b — do a FRESH read of each frd.md on disk right now; if any is NOT VERIFIED, return { done: false } listing the offending FRD folders — the in-memory built-count is NOT enough, the disk is the oracle);
    (ii) assert the hardening evidence EXISTS **and is FRESH**: the security report docs/reviews/security-<TODAY>.md exists (TODAY = \`date -u +%F\`) AND its mtime is NEWER than status.yaml's \`run_started_at\` (WS-D/D4c — compare epochs, e.g. \`date -r docs/reviews/security-<TODAY>.md +%s\` vs the epoch of run_started_at; a STALE same-day report left by a PREVIOUS run FAILS this assert), AND the "## Verification" section is present in docs/analytics/events.md.
  If a cross-feature seam is wrong, reopen the offending work order (set it \`implementation_status: PLANNED\`) and return done:false with the finding. If everything integrates AND the full suite is green AND all of (i)+(ii) hold: set .pandacorp/status.yaml phase: release and running: false. Return done:true once status.yaml is written.${JOURNAL_GOLD}${HARDENING_EVENT('integration')} (status ok iff you declared release, else fail.) If (and ONLY if) you set phase: release above, ALSO record the run's terminal verdict:${BUILD_COMPLETE('released', `${builtFrds.length}/${plan.frds.length}`)}${NOTIFY('Build COMPLETO: FRDs verificados + hardening + integracion cross-feature OK', 'Glass')}`,
    { label: 'close-out', phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
   log(closed && closed.done === true
    ? 'Run ended: all FRDs verified + hardened.'
    : 'Run ended: all FRDs verified + hardened, but the close-out agent did not confirm release — the fail-safe will ensure running:false (phase stays implementation).')
  } else {
   agentSpawned++
   closed = await agent(`Every FRD is VERIFIED but the DR-085 hardening did NOT complete (security: ${sec && sec.done === true ? 'ok' : 'INCOMPLETE — ' + ((sec && sec.failure) || 'failed')}; telemetry: ${telem && telem.done === true ? 'ok' : 'INCOMPLETE — ' + ((telem && telem.failure) || 'failed')}). The project must NOT be declared released (BL-0012 fail-closed — release requires the hardening evidence). 1) Append the hardening failure + your recommendation to .pandacorp/inbox/decisions.md (needs-owner). 2) Write a short Spanish summary to .pandacorp/comms/progress.md (todo verificado, hardening incompleto, qué falta). 3) Set .pandacorp/status.yaml running: false and KEEP phase: implementation. Return done:true once status.yaml is written.${NOTIFY('Build verificado pero hardening INCOMPLETO — NO se declara release; necesita tu decision')}`,
    { label: 'close-needs-hardening', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
   log('Run ended: all FRDs verified but hardening incomplete — NOT released (needs-owner).')
  }
 } else {
  const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]}${blockedFailures[x] ? `: ${blockedFailures[x]}` : ''})`).slice(0, 8).join(', ') || 'ninguno'
  const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
   : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
   : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
   : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
   : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).'
   : stopReason === 'review-deferred' ? ` Revision diferida (reviewBudget defer): ${fastUsable.length} FRD(s) USABLE en main; los gates quedan pendientes para otra ventana.` : ''
  const ownerMsg = needsOwner.length
   ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
   : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
  agentSpawned++
  const reuseLegacyNotifyEnd = await checkFullVerifyReuse()
  closed = await agent(`The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}.${GATE_SKIP}${reuseLegacyNotifyEnd.canReuse ? ` FIRST — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLegacyNotifyEnd)} — treat that as this step's whole-project result.${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLegacyNotifyEnd.headSha, reuseLegacyNotifyEnd.ageSeconds)}` : ` FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since)`} to confirm this pass left no global regression — note the result (a needs-owner-quarantined route is held aside, so its blocked state must NOT red this full-suite check; that is the whole point — the independent features still reach a green baseline while the blocked route waits on the owner, BL-0011). Then ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} (BL-0159 — report THIS freshly-recomputed WO count, never a figure remembered from earlier in the run). Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). **BL-0159 — narrate the LATEST state only:** the \`Blocked: … (${blk})\` reason/detail above for each FRD is already this run's FINAL verdict; never narrate an earlier reject/findings from this run's own transcript once a later attempt superseded it. Set .pandacorp/status.yaml running: false. Return done:true once status.yaml is written.${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${NOTIFY(ownerMsg)}`,
   { label: 'notify-end', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
  log(`Run ended: ${builtFrds.length} verified, ${reopenedFrds.length} reopened, ${blockedFrds.length} blocked${stopReason ? ' · stop=' + stopReason : ''}.`)
 }
}
if (!closed || closed.done !== true) {
 agentSpawned++
 await agent(`Fail-safe close: ensure running:false through the lease owner. Do NOT touch \`phase\`; NEVER set phase: release here. ${RELEASE_LEASE} Confirm done:true.`,
  { label: 'ensure-stopped', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
}
if (!LEAN_CLOSE_OUT && closed && closed.done === true) {
 agentSpawned++
 await agent(`Terminal lease close. ${RELEASE_LEASE} Confirm done:true.`,
  { label: 'release-lease', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
}
} catch (e) {
 if (!isInfraError(e) && !infraHalt) throw e
 log(`⏸ infra halt during the drain/close-out (${(e && e.message) || e}) — the run pauses instead of closing`)
 return await pausedExit({ inFlight: gatesInFlight, builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })
}
return { mode: MODE, builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures, stopReason, ...fastResult() }
