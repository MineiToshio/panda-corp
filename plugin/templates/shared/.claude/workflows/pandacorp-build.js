export const meta = {
  name: 'pandacorp-build',
  description: 'Pandacorp build engine v2 (DR-050 + BL-0021): builds in GLOBAL WAVES — every wave takes the ready work orders of ALL FRDs (dependsOn satisfied, artifacts disjoint per DR-060, capped at the mode\'s wave) so independent features build in parallel; the per-FRD review/test gates run SERIALIZED at wave boundaries (quiet tree). State lives in the work-order frontmatter (implementation_status). Runs to COMPLETION by default; stops ONLY by health or budget — nothing left to build, a budget ceiling, too many blocks in a row, or work that needs the owner. It TRIES TO REPAIR before giving up; an unrecoverable stop BLOCKS with a reason (needs-owner | external | error) instead of dying. Resumable: it reads the frontmatter and NEVER rebuilds a VERIFIED work order.',
  phases: [
    { title: 'Baseline' },
    { title: 'Process Change' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Hardening' },
    { title: 'Review' },
  ],
}

// ── Input (all optional) ─────────────────────────────────────────────────────
//   args.mode:    'pro' | 'balanced' | 'powerful' | 'deep'  (default: powerful)
//   args.frds:    specific FRD folders to limit to           (default: all pending)
//   args.change:  a change slug/filename from .pandacorp/inbox/changes/ to process
//     and build in one targeted run. The engine reads the change, creates/updates
//     its FRDs+WOs via the iterate/bug engine, then builds only those FRDs (with
//     dep checking). Mutually exclusive with args.frds — if both are set, args.change
//     wins (frds is derived from the change's affected FRDs). null = off.
//   args.maxFrds:  OPT-IN cap on FRDs PROCESSED per run (built + blocked + REOPENED) — for
//     SUPERVISED TEST runs. A reopen COUNTS toward the cap, so chained reopens can't slip
//     past it (the 2026-06-16 overnight test caught that exact bug). For overnight runs
//     prefer args.maxAgents (a reliable spend brake) over a feature count.
//   args.maxAgents: hard cap on subagents spawned this run — THE reliable overnight guardrail
//     (each implementer/reviewer ≈ work ≈ tokens), counted INSIDE the engine; survives a dead
//     supervisor and does NOT depend on budget.spent. null = off.
//   args.maxSpend: output-token ceiling via budget.spent() — UNRELIABLE alone (under-counts
//     subagent work; unenforced if the supervisor dies). Secondary ceiling. null = off.
//     (DR-050, owner decision: run to completion, stop by health/budget, not by feature count.)
const MODE = (args && args.mode) || 'powerful'
// Normalize change: accept 'slug', 'slug.md', '.pandacorp/inbox/changes/slug', '.pandacorp/inbox/changes/slug.md' → just the slug
const CHANGE = (args && args.change) ? String(args.change).split('/').pop().replace(/\.md$/, '') : null
// Normalize frds: accept folder name, 'docs/frds/<folder>', 'docs/frds/<folder>/frd.md' → folder name only
const normalizeFolder = (s) => String(s).replace(/\/[^/]+\.md$/, '').replace(/\/$/, '').split('/').pop()
let ONLY = (args && !args.change && args.frds) ? args.frds.map(normalizeFolder) : null  // frds filter (derived from CHANGE when set)
const MAX_FRDS = (args && args.maxFrds) || Infinity   // counts features PROCESSED (built+blocked+reopened); no cap unless set
const LOW_BUDGET = (args && args.lowBudget) || 80000  // margin to leave when budget.total IS set (a +Nk turn directive)
const MAX_SPEND = (args && args.maxSpend) || null      // output-token ceiling via budget.spent() — UNRELIABLE alone (under-counts subagent work; unenforced if the supervisor dies). Secondary.
const MAX_AGENTS = (args && args.maxAgents) || null     // hard cap on subagents spawned this run — the RELIABLE spend brake (each implementer/reviewer ≈ work ≈ tokens), counted INSIDE the engine, independent of budget.spent AND of the supervisor surviving. THE real guardrail.
const MAX_CONSECUTIVE_BLOCKS = (args && args.maxConsecutiveBlocks) || 3   // health breaker: N non-external blocks in a row → stop (something is systemically wrong)
const FOUNDATION_REPAIR_CAP = (args && args.foundationRepairCap) || 2   // DR-065: bounded auto-repair of an incomplete foundation — after N failed auto-repairs of the SAME class, escalate to the owner instead of looping/burning budget
const MAX_REOPENS = (args && args.maxReopens) || 3   // DR-072 NON-PROGRESS STOP: a WO reopened this many times across runs (same gate fault not resolving) → BLOCK needs-owner instead of grinding forever. "Refuse to treat repeated failure as progress" — the gate can't be satisfied autonomously, the owner must look.
let agentSpawned = 0   // running count of subagents spawned (the maxAgents brake)
let foundationRepairs = 0   // DR-065: how many foundation auto-repairs we've spent this run (capped by FOUNDATION_REPAIR_CAP)
// DR-070: the maxAgents brake, checked at EVERY safe point (FRD boundary AND each build-wave boundary)
// — not only at the top of the per-FRD loop. A pass with a few large FRDs used to inflate the count
// INSIDE one FRD and overshoot the ceiling arbitrarily (a 40-cap run reached 68). The supervisor ALSO
// enforces a reliable EXTERNAL agent-file count brake, independent of this in-engine counter.
const capHit = () => Boolean(MAX_AGENTS && agentSpawned >= MAX_AGENTS)

// Concurrency/models per mode (DR-014). `wave` = work orders built in parallel within
// an FRD. `split` runs test→backend→frontend; otherwise one full-stack implementer
// builds the coarse slice end-to-end (faster).
const PROFILES = {
  pro:      { wave: 2, worker: 'sonnet', judge: 'sonnet', split: false },
  balanced: { wave: 4, worker: 'sonnet', judge: 'opus',   split: false },
  powerful: { wave: 8, worker: 'sonnet', judge: 'opus',   split: false },
  deep:     { wave: 6, worker: 'opus',   judge: 'opus',   split: true  },
}
const P = PROFILES[MODE] || PROFILES.balanced
// DR-073: opus costs ~3x sonnet in tokens, but the maxAgents brake counts AGENTS not TOKENS — so an
// opus escalation would silently blow the token budget while agentSpawned reads low (red-team-B). We
// WEIGHT each spawn by model cost (opus ≈ 3 cost-units) so maxAgents brakes on a token-proxy, not a
// raw agent count. Every model-spawn site below adds COST(model) instead of a bare ++.
const COST = (m) => (m === 'opus' ? 3 : 1)
// DR-072 R2 — make a silently-dropped `args` VISIBLE: if the launcher passed args as a STRING (the
// Workflow-tool serialization bug seen 2026-06-19), `args.maxAgents`/`mode`/`frds` all read as undefined
// and a "bounded" overnight run silently goes UNBOUNDED in powerful mode. Surface it loudly at start.
if (args && typeof args !== 'object') log(`⚠⚠ args arrived as a ${typeof args}, NOT an object — mode/maxAgents/maxFrds were DROPPED. This run is UNBOUNDED. Stop and relaunch passing args as a JSON object (DR-072 R2).`)
log(`Mode ${MODE} · wave ≤${P.wave} · maxFrds ${MAX_FRDS === Infinity ? 'sin tope' : MAX_FRDS} · maxAgents ${MAX_AGENTS || 'OFF (sin freno de presupuesto!)'} · workers ${P.worker} · judge ${P.judge}${CHANGE ? ' · change ' + CHANGE : ONLY ? ' · frds ' + ONLY.join(',') : ''}`)

// Party telemetry. `ctx` enriches the event so the Party views can be faithful to the run
// WITHOUT inventing anything: frd (which feature), phase ('build'|'review'), activity (the
// sub-step — for the deep relay: 'test'|'backend'|'frontend'|'selftest'; else 'implement'),
// and the run mode. All fields are OPTIONAL and additive — older consumers reading {role,wo}
// are unaffected (backward-compatible). See prototype/party-redesign-spec.md §7.
// OBSERVABILITY FIDELITY (DR-066): each AgentWorking append is the PRODUCER's positive heartbeat to
// the event stream — so "sin señal" (no events) genuinely means hung, not idle. It fires at each agent
// START; the supervisor's TIME-driven tick (implement skill) emits the between-agents heartbeat and
// advances supervisor_heartbeat. The status-file freshness stamp (last_event_at) is advanced by the
// safe-point agents below (sync-rollups + the FRD gate), never left frozen while the build advances.
const EMIT = (role, wo, ctx = {}) =>
  `Before you start, record your activity for Party (one append, fire-and-forget):\n` +
  `  printf '{"event":"AgentWorking","at":"%s","project":"%s","data":{"role":"${role}","wo":"${wo}","frd":"${ctx.frd || ''}","phase":"${ctx.phase || 'build'}","activity":"${ctx.activity || ''}","mode":"${MODE}"}}\\n' "$(date -u +%FT%TZ)" "$(basename "$PWD")" >> ~/.claude/dashboard-events.ndjson\n`

// DURABLE per-project build timeline (DR-086 → Observabilidad timeline). The global event stream
// (dashboard-events.ndjson) ROTATES, so the engine ALSO appends timing to `.pandacorp/track.jsonl`
// — committed machine-state (like status.yaml), the durable source Mission Control's timeline reads.
// One JSON line per transition: wo_start / wo_end / review_start / review_end. Fire-and-forget; the
// commit writer (commitWOGreen) and the FRD gate STAGE track.jsonl so it travels with the build.
// `fields` is a JSON fragment of extra keys, e.g. `,"frd":"...","wo":"...","state":"..."`.
const TRACK = (kind, fields = '') =>
  ` Also append ONE line to .pandacorp/track.jsonl for the durable build timeline (fire-and-forget): printf '{"kind":"${kind}"${fields},"at":"%s"}\\n' "$(date -u +%FT%TZ)" >> .pandacorp/track.jsonl.`

// Party contract completion (BL-0020): Mission Control's FRD-06 Party tab derives the Bóveda trophy
// shelf + the unlock toast from `achievement` events and the tribunal's open state from `gate` events
// — the engine NEVER emitted either (0 in a 13MB stream), so the shelf stayed empty and the tribunal
// never lit while frontmatter said VERIFIED. The stampers (the FRD gate and the post-patch verifier —
// the only two agents allowed to set VERIFIED) now emit achievement; the gate emits gate at open.
const GATE_EVENT = (frd) =>
  ` Also append the Party gate-open event (fire-and-forget — the tribunal lights up, BL-0020): printf '{"event":"gate","at":"%s","project":"%s","frd":"${frd}"}\\n' "$(date -u +%FT%TZ)" "$(basename "$PWD")" >> ~/.claude/dashboard-events.ndjson.`
const ACHIEVEMENT = (frd) =>
  ` For EACH work order you just set VERIFIED, ALSO append its Party achievement event (one line per WO, fire-and-forget — the Bóveda trophy shelf + unlock toast read exactly this event, BL-0020): printf '{"event":"achievement","at":"%s","project":"%s","workOrder":"%s","wo":"%s","frd":"${frd}"}\\n' "$(date -u +%FT%TZ)" "$(basename "$PWD")" "<the-wo-id>" "<the-wo-id>" >> ~/.claude/dashboard-events.ndjson.`
// Per-WO commit event (2026-07-01): Mission Control's Party refreshes its frontmatter read when a
// FRESHER dashboard event arrives — the IN_REVIEW stamp alone appends nothing, so without this line
// a WO finishing mid-session never walked forge→tribunal until a manual reload. The mech commit
// writer appends it right after the commit (fire-and-forget; also a bitácora line, "wo_commit").
const WO_COMMIT_EVENT = (frd, woId) =>
  ` Then append the Party per-WO commit event (fire-and-forget): printf '{"event":"wo_commit","at":"%s","project":"%s","frd":"${frd}","wo":"${woId}","state":"IN_REVIEW"}\\n' "$(date -u +%FT%TZ)" "$(basename "$PWD")" >> ~/.claude/dashboard-events.ndjson.`

// DR-108: mechanical steps — a serialized git commit, a frontmatter stamp, a rollup sync, an archive
// move, a run-summary write — don't need the worker model; they run on the cheap tier. The trust
// boundary is never these steps (the FRD gate re-verifies everything); they just execute a script.
const MECH = (args && args.mechModel) || 'haiku'

// Owner notification — macOS desktop only (osascript). Fire-and-forget; never blocks the
// build. (Phone push, when Remote Control is on, is sent by the supervising agent via
// PushNotification — see the implement skill. No third-party push app: owner decision 2026-06-16.)
const NOTIFY = (msg, sound) =>
  ` Notify the owner (run via Bash, fire-and-forget): ` +
  `osascript -e 'display notification "${msg}" with title "Pandacorp build" sound name "${sound || 'Basso'}"' 2>/dev/null || true.`

// ── Schemas ───────────────────────────────────────────────────────────────────
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
                path: { type: 'string', description: 'repo-relative path of this work-order markdown file, e.g. docs/frds/frd-03-x/work-orders/wo-03-001-y.md — injected into the builder prompt so the agent opens THE file instead of hunting for it (DR-108)' },
                acText: { type: 'string', description: "DR-108 context pack: the FRD's EARS acceptance-criteria lines that THIS work order must satisfy, copied VERBATIM from frd.md (only the ACs this WO owns per the Build Plan — bounded, not the whole FRD). Injected into the builder + test-writer prompts so the first attempt builds against the REAL AC scope instead of a one-line summary (first-attempt gate failures were the top rework cause)." },
                difficulty: { type: 'string', description: 'low|medium|high from the WO frontmatter (default medium). high → built on opus a-priori (DR-073 HYBRID)' },
                reopen_count: { type: 'number', description: 'from the WO frontmatter (default 0) — empirical escalation signal (a WO that already failed once is built on opus, DR-073)' },
                deps: { type: 'array', items: { type: 'string' }, description: 'intra-FRD WO ids that must be built first' },
                artifacts: { type: 'array', items: { type: 'string' }, description: 'globs of files/dirs this WO writes (from its `artifacts:` frontmatter) — the engine serializes wave-parallel WOs whose artifacts overlap, so they never collide (DR-060)' },
                foundation: { type: 'boolean', description: 'true if this WO builds the shared design-system primitives / component inventory the other WOs reuse — the engine builds it FIRST, alone, before the rest fan out (DR-057)' },
                summary: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
}
// A reason accompanies every block so Mission Control and the owner know what to do.
const BLOCK_REASON = { type: 'string', enum: ['needs-owner', 'external', 'error'] }
// Generic done/failure result (close-out, archive, hardening stages).
const STOP_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' } } }
// DR-069 SAFE-POINT (audit-20 P0-3): the ENGINE checks the owner's signals at every FRD boundary —
// the change queue (ready items), answered decisions (unblock BLOCKED needs-owner WOs), and the
// rethink stop — instead of leaving the drain to supervisor prose (a supervisor may not exist, and
// its safe points are between passes, not between FRDs).
const SAFE_POINT_SCHEMA = {
  type: 'object', required: ['stop'],
  properties: {
    stop: { type: 'boolean', description: 'true iff rethink_pending: true — the engine stops at this safe point' },
    ready: { type: 'array', items: { type: 'string' }, description: 'queue slugs with status: ready — expedite first, then standard FIFO' },
    unblocked: { type: 'array', items: { type: 'string' }, description: 'WO ids flipped BLOCKED→PLANNED because the owner answered their decision' },
  },
}
// DR-065: a `missingFoundation` list flags the HIGH-CONFIDENCE, BOUNDED auto-repair class — "a
// surface failed because a shared primitive it needs isn't in the foundation". When present, the
// engine auto-resolves (add the primitive to the foundation, rebuild, retry) instead of escalating.
const MISSING_FOUNDATION = { type: 'array', items: { type: 'string' }, description: 'names of shared design-system primitives the surface needed but that are NOT in the built foundation (e.g. Room, AgentSprite). Set this when the failure is "a needed primitive is missing from the foundation" — the engine auto-repairs the foundation (DR-065), it does NOT escalate.' }
// DR-073: `findings` carries the specific fixable fault(s) + the RED-proven failing test(s) the
// reviewer wrote for a LOCALIZED reject, so the engine can attempt an in-place patch BEFORE reverting.
const FINDINGS = { type: 'array', description: 'DR-073: the specific fixable fault(s) of the rejected WO(s) + the RED-proven failing test(s) the reviewer wrote — fed to attemptPatch for an in-place repair before any revert', items: {
  type: 'object', required: ['wo', 'finding'],
  properties: { wo: { type: 'string' }, finding: { type: 'string', description: 'the specific bounded fault, with file:line' }, failingTest: { type: 'string', description: 'the RED-proven test (path / describe-it / a snippet) that fails without the fix and passes with it' }, files: { type: 'array', items: { type: 'string' }, description: 'the file(s) the fix should touch' } },
} }
const FRD_GATE_SCHEMA = {
  type: 'object', required: ['green'],
  properties: { green: { type: 'boolean' }, reopen: { type: 'array', items: { type: 'string' } }, findings: FINDINGS, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' } },
}
const REPAIR_SCHEMA = {
  type: 'object', required: ['green'],
  properties: {
    green: { type: 'boolean' }, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' },
    // BL-0001 (DR-107): a green:false patch verdict is DISCRIMINATED — 'code' (the build is wrong;
    // the engine reverts + retries) vs 'gate-test-defective' (the reviewer's adversarial test is
    // internally inconsistent / unsatisfiable; the engine repairs the TEST, it does NOT discard a
    // correct build). One fallback for two causes was rebuilding correct work in unwinnable loops.
    cause: { type: 'string', enum: ['code', 'gate-test-defective'], description: "why the patch could not green: 'code' = the build genuinely fails → revert+retry; 'gate-test-defective' = a reviewer test is internally inconsistent/unsatisfiable by ANY correct implementation → the engine routes to gate-test repair (BL-0001), never a rebuild" },
    defectiveTests: { type: 'array', description: 'BL-0001: the reviewer test(s) judged defective, with evidence — only when cause is gate-test-defective', items: { type: 'object', required: ['path', 'why'], properties: { path: { type: 'string' }, why: { type: 'string', description: 'the internal inconsistency, e.g. "asserts desktop-only nav visibility but the Playwright config runs desktop+mobile and no viewport is forced"' } } } },
  },
}
// Targeted change build: the process-change agent reads a change from the queue, creates/updates
// its FRDs+WOs via iterate/bug logic, and returns the list of affected FRD folders so the normal
// build loop can pick them up (with dep checking). The change is NOT archived here — the FRD gate
// does that when the FRDs verify, same as in the normal change-drain flow.
const PROCESS_CHANGE_SCHEMA = {
  type: 'object', required: ['done', 'affectedFrds'],
  properties: {
    done: { type: 'boolean' },
    affectedFrds: { type: 'array', items: { type: 'string' }, description: 'FRD folder names (docs/frds/<folder>) created or updated by this change' },
    changeFile: { type: 'string', description: 'the matched change filename in .pandacorp/inbox/changes/' },
    failure: { type: 'string' },
  },
}
// DR-057 (extended) foundation-completeness gate: the foundation = the UNION of EVERY shared
// primitive any UI surface's mock/fdd references; it must be COMPLETE + green BEFORE surfaces fan out.
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

// ── Baseline self-heal (deadlock breaker) ─────────────────────────────────────
phase('Baseline')
agentSpawned += COST(P.judge)   // DR-070/DR-073: weight EVERY spawn by model cost so the maxAgents brake is a token-proxy
const baseline = await agent(
  `You are the Pandacorp baseline-repair engineer. FIRST: if .pandacorp/status.yaml has \`rethink_pending: true\`, set it to \`false\` (this run STARTS from the re-planned docs, so the stop signal is consumed — DR-069; commit that one-line change, or fold it into your repair commit). THEN: if \`git rev-parse --short HEAD\` equals \`last_green_sha\` in .pandacorp/status.yaml, the tree is already known-green → return { green: true } immediately and do NOT run verify.sh (skip the cold-start cost). Otherwise run \`bash .pandacorp/verify.sh\`:
  - GREEN → return { green: true }, change nothing.
  - RED → fix the PRODUCTION code (never weaken/skip tests) until it passes end-to-end, commit (Conventional Commits with scope), return { green: true }.
  If you genuinely can't, return { green: false, failure } describing what remains.${NOTIFY('Baseline roto y no se pudo reparar — necesita tu intervencion')}`,
  { label: 'baseline', phase: 'Baseline', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA },
)
if (!baseline || baseline.green !== true) {
  log(`Baseline red and auto-repair failed${baseline?.failure ? ': ' + baseline.failure : ''} — stopping for the owner.`)
  return { mode: MODE, builtFrds: [], blockedFrds: ['baseline'], blockedReasons: { baseline: 'error' }, note: 'baseline red (needs manual fix)' }
}
log('Baseline green — planning by FRD.')

// ── Process Change (targeted change build + the DR-069 safe-point drain) ──────
// Integrate ONE queued change via the iterate/bug engine (creates/updates FRDs + WOs). Used by the
// targeted change build (args.change) AND by the in-loop safe-point drain. The change is NOT archived
// here — the engine archives it at close-out once its affected FRDs actually VERIFIED (DR-069 §7,
// audit-20 P0-3: the old "the FRD gate archives it" was fiction — the gate prompt never did).
const integratedChanges = []   // { file, frds } — every change this run integrated; archived at close-out when its FRDs verify
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
5. Do NOT archive the change file and do NOT change its status — the ENGINE archives it at close-out once its affected FRDs verify (DR-069 §7).
6. Return { done: true, affectedFrds: ['frd-XX-slug', ...], changeFile: '<the matched filename>' }.${NOTIFY('Procesando change ' + slug)}`,
    { label: `process-change:${slug}`, phase: phaseTitle, model: P.judge, agentType: 'pandacorp:implementer', schema: PROCESS_CHANGE_SCHEMA },
  )
  if (proc && proc.done === true && proc.affectedFrds && proc.affectedFrds.length) {
    integratedChanges.push({ file: proc.changeFile || `${slug}.md`, frds: proc.affectedFrds })
  }
  return proc
}
if (CHANGE) {
  phase('Process Change')
  const proc = await processChange(CHANGE, 'Process Change')
  if (!proc || !proc.done || !proc.affectedFrds || !proc.affectedFrds.length) {
    log(`⊘ No se pudo procesar la change '${CHANGE}': ${proc?.failure || 'no se encontró o no tiene FRDs afectados'}.`)
    return { mode: MODE, builtFrds: [], blockedFrds: [], note: `change '${CHANGE}' no procesada: ${proc?.failure || 'sin FRDs'}` }
  }
  ONLY = proc.affectedFrds
  log(`Change '${proc.changeFile || CHANGE}' procesada — FRDs afectados: ${ONLY.join(', ')}`)
}

// ── Plan: read FRDs, their Build Plans and the frontmatter state (no inferred "done") ──
phase('Plan')
agentSpawned += COST(P.judge)   // DR-070/DR-073: weighted — the planner runs on the judge model
const plan = await agent(
  `You are the Pandacorp build planner. Read state WITHOUT modifying anything:
  - WALK every FRD module docs/frds/*/. For each, read frd.md and blueprint.md's **Build Plan** (WO order, intra-FRD deps, parallelism, cross-FRD deps) in full, and the **frontmatter ONLY** of every work-orders/wo-*.md (the \`implementation_status\`, \`id\`, deps, title, **\`difficulty\`** (low|medium|high, default medium) and **\`reopen_count\`** (number, default 0) — NOT the full WO body; the implementer reads the body when it builds its own WO, so planning stays fast and cheap).
  - For each work order, the **frontmatter \`implementation_status\` is the source of truth**: PLANNED/IN_PROGRESS = pending; IN_REVIEW = built, awaiting its FRD gate; VERIFIED = done (NEVER rebuild); BLOCKED = skip.
  - docs/product/architecture.md → the platform stack.
  - **FOUNDATION (DR-057, web only): read docs/design/components.md** (the shared-component inventory) and skim every FRD's \`mocks/\`/\`fdd.md\` to grasp the COMPLETE set of shared primitives the surfaces reference. The foundation work orders must build the UNION of those primitives — not a hand-picked subset (the gap that shipped flat Party surfaces: Room/AgentSprite/etc. were never in the foundation). Mark \`foundation: true\` on EVERY WO that builds a shared primitive the inventory lists, so the engine builds them all before surfaces fan out.
  Return the FRDs that still have non-VERIFIED work orders, **in cross-FRD dependency order** (from the Build Plans). For each FRD: its \`frd\` folder, its \`deps\` (FRD folders that must be VERIFIED first), and its \`workOrders\` (each with id, frontmatter \`status\`, **\`path\` (the WO file's repo-relative path — DR-108, the builder opens THE file instead of hunting)**, **\`acText\` (DR-108 CONTEXT PACK — copy VERBATIM from frd.md the EARS acceptance-criteria lines THIS work order owns per the Build Plan; bounded to its own ACs, never the whole FRD. You are the ONLY agent that reads frd.md in full — this hand-off is what lets each builder construct against the real AC scope on the FIRST attempt instead of a one-line summary)**, intra-FRD \`deps\`, one-line \`summary\`, **\`difficulty\` (low|medium|high — COPY it from the WO's \`difficulty:\` frontmatter; default \`medium\` when absent — DR-073: \`high\` builds on opus a-priori)**, **\`reopen_count\` (number — COPY it from the WO's \`reopen_count:\` frontmatter; default \`0\` when absent — DR-073: \`>=1\` builds on opus empirically)**, **its \`artifacts\` = the file/dir globs it writes, COPIED FROM the WO's \`artifacts:\` frontmatter — REQUIRED so the engine keeps parallel WOs disjoint (DR-060); if a WO has none in frontmatter, infer the files it will write from its title/summary**, and **\`foundation: true\` if this WO builds a shared design-system primitive / the inventory the other WOs reuse — DR-057, it must build before they fan out**) **in the Build Plan's order**.${ONLY ? ' Limit to these FRD folders: ' + ONLY.join(', ') + '.' : ''}
  hasFrontend=true only if the stack is web (A).${ONLY ? ` TARGETED BUILD — also check cross-FRD deps of the requested FRDs: for each dep folder listed in their Build Plans, read the frontmatter \`implementation_status\` of every work-orders/wo-*.md in that dep. If ALL are VERIFIED the dep is satisfied; if ANY is not VERIFIED, include it in unsatisfiedDeps as { frd: '<requested-frd>', dep: '<the-dep-folder>' }. Return unsatisfiedDeps:[] when all deps are satisfied.` : ''}`,
  { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA, model: P.judge, agentType: 'pandacorp:architect' },
)
if (!plan || !plan.frds || plan.frds.length === 0) {
  log('Nothing to build: every FRD is VERIFIED.')
  return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'all verified' }
}

// Dep-satisfaction gate (targeted build only) — refuse to start if the requested FRDs have deps that are not VERIFIED.
if (ONLY && plan.unsatisfiedDeps && plan.unsatisfiedDeps.length > 0) {
  const byFrd = {}
  for (const { frd, dep } of plan.unsatisfiedDeps) {
    if (!byFrd[frd]) byFrd[frd] = []
    byFrd[frd].push(dep)
  }
  const detail = Object.entries(byFrd).map(([f, deps]) => `${f} requiere: ${deps.join(', ')}`).join('; ')
  log(`⊘ Build parcial bloqueado — hay dependencias sin VERIFIED: ${detail}. Implementa primero esos FRDs (o corre /pandacorp:implement sin filtro para el orden automático).`)
  return { mode: MODE, builtFrds: [], blockedFrds: ONLY, blockedReasons: Object.fromEntries(ONLY.map((f) => [f, 'needs-owner'])), note: `deps sin verificar — ${detail}` }
}
log(`${plan.frds.length} FRDs with pending work · stack ${plan.stack}${plan.hasFrontend ? ' (web)' : ''}`)

// Design fidelity (DR-054/056): the engine PASSES the design references into the build prompt.
// It used to pass only a one-line summary, so the implementer NEVER saw the design — the root cause
// of a build diverging from an approved prototype. For a web build, inject the binding visual refs
// + the in-loop fidelity check into every UI work order's prompt (the agent reads the files itself).
const designRef = (frd) => plan.hasFrontend
  ? ` VISUAL FIDELITY (DR-054/056, web — do NOT skip): OPEN this work order's \`## Visual reference\`, then read \`docs/frds/${frd}/fdd.md\` + its \`mocks/\` (the BINDING screen mock — view the screenshot AND the mock's source) and \`docs/design/design-tokens.json\` + root \`DESIGN.md\`. Your job is to TRANSLATE that one screen's mock into the project's components on the frozen tokens — reproduce its layout, structure, spacing, components and density; do NOT approximate, invent, or restyle. THEN run a SINGLE LIGHT in-loop fidelity check BEFORE marking IN_REVIEW (DR-072 — keep it cheap; the thorough pass is at the end): render the route ONCE (preview/Playwright), screenshot it next to the mock, and fix ONLY a GROSS structural divergence (wrong layout, a missing section) — do NOT iterate on nits (exact sizes/spacing/shades): the dedicated end-of-build Visual QA pass owns fine fidelity, so don't pay that loop twice. Aim for a RECOGNIZABLE, faithful match (right layout, structure, components, density), NOT pixel-perfection. The FRD gate blocks only a GROSS structural mismatch (a flat list where the mock is a rich layout, a missing section); small nits (exact sizes/spacing/shades) are swept later by the end-of-build Visual QA pass + the owner (DR-072) — so get it recognizably right and move on, don't burn cycles chasing the last pixel.`
  : ''

// Reuse & coherence (DR-057): parallel agents reinvent slightly-different versions of the same
// component when they can't see what already exists (the two-near-identical-banners bug). Inject the
// component-inventory "check before you create" directive so each agent reuses the shared primitives.
const reuseRef = (frd) => plan.hasFrontend
  ? ` REUSE & COHERENCE (DR-057): before creating ANY UI component, READ the component inventory \`docs/design/components.md\` (if it doesn't exist yet you're early in the build — create it and list your component as the first row) and scan \`src/components/core\` + \`src/components/modules\`. REUSE an existing component if one fits; ADAPT/extend it (add a prop/variant) if it is close — do NOT fork a near-duplicate for a small difference; CREATE a new shared component only if none fits, and when you do, APPEND it to \`docs/design/components.md\` so the next agent reuses it. A component that re-implements an existing pattern (a second banner/card/modal) is a defect the gate rejects.`
  : ''

// Sync DERIVED rollups (DR-050): an FRD/blueprint implementation_status is DERIVED from its work
// orders (THE source of truth). Correct any drift from a crash mid-build, an interrupted run or a
// manual edit BEFORE building, so the document never lies about progress. One cheap pass, frontmatter only.
agentSpawned++
await agent(`Sync DERIVED rollup state, frontmatter ONLY — NEVER change a work order's state (work orders are the source of truth; you only recompute the FRD/blueprint that rolls up from them). For EVERY docs/frds/*/ folder: read \`implementation_status\` of all its work-orders/wo-*.md and compute the FRD rollup — **VERIFIED** iff ALL are VERIFIED; else **BLOCKED** if any is BLOCKED; else **PLANNED** if any is PLANNED; else **IN_PROGRESS** if any is IN_PROGRESS; else **IN_REVIEW**. Write it into that FRD's frd.md AND blueprint.md \`implementation_status\` ONLY if it differs from the computed value. Refresh .pandacorp/status.yaml per-status work-order counts AND advance \`last_event_at\` + \`updated_at\` to now (ISO 8601, the DR-066 producer freshness stamp — a monitor reads liveness as running AND fresh, so this timestamp must never be left frozen while the build advances). Commit only if something changed (Conventional Commits, scope). Return { corrected: <count> }.`,
  { label: 'sync-rollups', phase: 'Plan', model: MECH, agentType: 'pandacorp:implementer' })

// ── Adaptive model selection (DR-073) — escalate to opus within the mode, never below the floor ──
// The mode's P.worker is the FLOOR. Escalate to opus when the WO is genuinely hard (HYBRID a-priori,
// owner decision: difficulty=high) OR has already failed once (empirical: reopen_count>=1 — a sonnet
// build that didn't pass is unlikely to pass again, so raise the model for the retry). Never downgrade.
function pickWorkerModel(wo) {
  if (P.worker === 'opus') return 'opus'                       // already at the ceiling (deep mode)
  if (wo.difficulty === 'high') return 'opus'                  // HYBRID a-priori (DR-073, owner decision)
  if ((wo.reopen_count || 0) >= 1) return 'opus'              // empirical — it already failed once
  return P.worker
}

// ── Finer save points (DR-086, owner): commit each WO the INSTANT its self-test greens ──
// Not batched at wave end. So an interruption keeps every already-green WO and only the
// still-building ones rebuild (a mid-wave cut used to lose the WHOLE wave — up to P.wave WOs).
// ONE git writer at a time, serialized through this promise chain, so committing a WO while sibling
// WOs of the SAME wave are still building causes NO index.lock race (the invariant Option B/DR-060
// protects); the selective `git add` of the WO's DISJOINT `artifacts` (+ its own work-order .md) can
// never capture a sibling's in-flight files. The resume path is unchanged: a committed WO is IN_REVIEW
// → skipped on relaunch (never rebuilt); only PLANNED/IN_PROGRESS (uncommitted) work is redone.
let commitChain = Promise.resolve()
async function commitWOGreen(wo, frd) {
  agentSpawned++
  const link = commitChain.then(() =>
    agent(
      `You are the SOLE git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race), committing work order ${wo.id} now that its self-test is green and its frontmatter is IN_REVIEW.${TRACK('wo_end', `,"frd":"${frd}","wo":"${wo.id}","state":"in_review"`)} Then make exactly ONE commit (Conventional Commits, with scope) staging ONLY this work order's own files: its declared artifacts ${wo.artifacts && wo.artifacts.length ? '(' + wo.artifacts.join(' ') + ')' : "(use `git status` to identify THIS wo's files)"} AND its own work-order markdown under \`docs/frds/${frd}/work-orders/\` (the IN_REVIEW frontmatter + ## Status Note) AND \`.pandacorp/track.jsonl\` (the durable timeline lines for THIS wo — the wo_start the builder appended + the wo_end you just appended). Sibling work orders of the same wave may be MID-BUILD — do NOT stage or touch their files; if \`git status\` shows changes outside this WO's files (other than track.jsonl, which is append-only and shared), leave them untouched. Do NOT advance last_green_sha (that is the FRD gate's job — this WO is self-test-green, not yet review-verified).${WO_COMMIT_EVENT(frd, wo.id)} Return { committed: 1 }.`,
      { label: `commit:${wo.id}`, phase: 'Build', model: MECH, agentType: 'pandacorp:implementer' },
    ),
  )
  commitChain = link.catch(() => {}) // keep the chain alive even if one commit errors
  return link
}

// ── Build ONE work order: implement → fast self-test → IN_REVIEW + hand-off → commit-when-green ──
// DR-108 context pack: the planner (the ONE agent that reads frd.md in full) hands each builder its
// WO file path + the verbatim AC lines it owns, injected into the prompt — instead of N builders each
// re-hunting the docs and still constructing against a one-line summary (first-attempt gate failures
// were the top rework cost of the personal-page-v2 run). The builder still reads its own WO body.
const woCtx = (wo, frd) =>
  `${wo.path ? ` Your work-order file: \`${wo.path}\` — open it and follow it in full.` : ''}${wo.acText ? ` The EARS acceptance criteria THIS work order must satisfy (verbatim from FRD ${frd} — the gate will assert exactly these):\n  ${wo.acText}\n ` : ''}`

// The SELF-TEST + hand-off contract, shared by both branches (solo: folded into the builder — DR-108;
// split: a separate closer agent, since three hands built the slice and one must close it coherently).
const SELFTEST = (woId) => ` THEN run your fast SELECTIVE self-test (NOT the whole suite): \`pnpm biome check .\`, \`pnpm tsc --noEmit\`, and \`pnpm vitest run\` limited to THIS work order's own test files. If green: set the WO's frontmatter **\`implementation_status: IN_REVIEW\`** and fill its **\`## Status Note\`** hand-off (what it built; the interfaces/contracts exposed with signatures; the integration seams; **the implicit DECISIONS & ASSUMPTIONS you made — naming, data shapes, formats, units, error/empty conventions — so the consumer inherits them instead of re-deciding incompatibly**; which test files cover it). **Do NOT call git — the engine commits THIS work order the INSTANT your self-test passes, via a serialized single writer (Option B, DR-060), so there is no index.lock race.** Return green=true. If red after honest attempts, return green=false with the reason.`

async function buildWO(wo, frd) {
  const woModel = pickWorkerModel(wo)   // DR-073: opus floor-escalation, a-priori (difficulty=high) or empirical (reopen_count>=1)
  if (woModel !== P.worker) log(`⤴ opus: ${wo.id} (${wo.difficulty === 'high' ? 'difficulty=high' : 'reopen=' + (wo.reopen_count || 0)})`)
  let v
  if (P.split && plan.hasFrontend) {
    // DR-073 cost-weighting: 3 build agents at woModel + 1 worker-model closer (self-test).
    agentSpawned += 3 * COST(woModel) + 1
    await agent(`${EMIT('test-writer', wo.id, { frd, activity: 'test' })}${TRACK('wo_start', `,"frd":"${frd}","wo":"${wo.id}"`)} Write the acceptance tests (RED) for work order ${wo.id} from the EARS criteria of FRD ${frd}: ${wo.summary || ''}.${woCtx(wo, frd)} No production code.`,
      { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
    await agent(`${EMIT('backend-dev', wo.id, { frd, activity: 'backend' })}First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces). Then implement the backend of ${wo.id} (TDD until green): ${wo.summary || ''}.${woCtx(wo, frd)} Publish YOUR API contract at docs/api/${wo.id}.md (your own per-WO file — DR-060: never a shared docs/api.md, which races across parallel WOs). Do NOT call git — you never commit; the engine commits this work order (serialized single writer) when it greens (Option B).`,
      { label: `be:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:backend-dev' })
    await agent(`${EMIT('frontend-dev', wo.id, { frd, activity: 'frontend' })}Implement the UI of ${wo.id} using ONLY design tokens and the provider WO's contract at docs/api/<the-backend-WO-in-your-Dependencies>.md (DR-060: read that specific per-WO file, never a shared docs/api.md): ${wo.summary || ''}.${woCtx(wo, frd)}${designRef(frd)}${reuseRef(frd)} Do NOT call git — you never commit; the engine commits this work order when it greens (Option B).`,
      { label: `fe:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:frontend-dev' })
    v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'selftest' })}Close work order ${wo.id} (built by the split team this wave).${SELFTEST(wo.id)} These are file edits to THIS WO's own files only.`,
      { label: `selftest:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
  } else {
    // DR-108: the solo builder runs its OWN self-test + hand-off — the separate selftest agent was a
    // second same-model spawn per WO that re-read everything; the trust boundary was never the
    // self-test, it is the independent FRD gate (reviewer, different model), which re-verifies all of
    // it. One spawn per WO instead of two. (IN_PROGRESS is stamped by the engine at dispatch — BL-0002.)
    agentSpawned += COST(woModel)
    v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'implement' })}${TRACK('wo_start', `,"frd":"${frd}","wo":"${wo.id}"`)} Fully implement work order ${wo.id} with TDD (RED→GREEN→refactor), anchored in the EARS criteria of FRD ${frd} and in bugs from .pandacorp/comms/progress.md: ${wo.summary || ''}.${woCtx(wo, frd)} This is a COARSE slice (a whole view/capability) — build it end-to-end. First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces) and integrate against those, not a guess. If \`.pandacorp/run/preserved-tests/${wo.id}/\` exists, RESTORE those test files into the tree first — they are proven coverage a previous revert preserved (DR-107): they are your RED baseline, make them pass.${designRef(frd)}${reuseRef(frd)}${SELFTEST(wo.id)}`,
      { label: `build:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
  }
  const green = Boolean(v && v.green === true)
  // Finer save points (DR-086): commit THIS WO the instant it is green — serialized single writer —
  // so a mid-wave interruption keeps it (committed → IN_REVIEW → skipped on resume) instead of losing
  // the whole wave. Only still-building (uncommitted) WOs are rebuilt.
  if (green) await commitWOGreen(wo, frd)
  return green
}

// ── FRD gate: ONE review + integration test over the whole feature ──
async function frdGate(frd, reviewIds) {
  agentSpawned += COST(P.judge)   // DR-073: the gate runs on the judge model — weight it honestly
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd)} FRD review + integration gate for ${frd}. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.

  **THE GATE IS SPLIT (DR-072) — this is what makes the build converge instead of churning. Two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd} — the required behavior/sections/elements EXIST and work), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch** (the surface is not RECOGNIZABLY the designed thing — e.g. a flat text list where the mock shows a multi-panel/pixel-art layout; a section missing entirely). These BLOCK.
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing (15px vs 16px), spacing, exact color/shade, minor density/polish, "doesn't match the mock 100%". A pixel-judge is noisy; rejecting on nits is the #1 cause of the build never finishing. **NEVER reopen a WO for a nit.** Instead APPEND each nit to the punch-list \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap, e.g. "heading is 15px, design tokens say 16px"> · <file:approx-line if known>\`). The dedicated end-of-build Visual QA pass + the owner sweep these directly — they do not gate VERIFIED. Scope yourself to CORRECTION + GROSS only; **flag, don't fix, don't reject** the rest (an over-broad reviewer reporting every gap HARMS convergence — research-backed).

  1) Review the changed work orders for CORRECTION (the blocking lenses above) and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising them TOGETHER with the rest of the feature (real integration, not isolated).
  2) Run the FOCUSED gate \`bash .pandacorp/verify.sh --since <last_green_sha>\` (read last_green_sha from .pandacorp/status.yaml) — biome + tsc run globally, but only the TESTS affected since the last green (fast and scales; the full suite runs once at close-out). It must pass clean.

  **If CORRECTION passes (visual nits, if any, go to the punch-list — they do NOT block):** set the reviewed work orders (${reviewIds.join(', ')}) to **\`implementation_status: VERIFIED\`** and **reset their \`reopen_count: 0\`** (the non-progress counter measures CONSECUTIVE unresolved reopens — clearing it on success so a future unrelated change/iterate starts fresh, not pre-capped, DR-072 C2), then **recompute the FRD's frd.md + blueprint.md \`implementation_status\` rollup from ALL its work orders** and persist it (VERIFIED iff all are; else BLOCKED if any blocked; else PLANNED if any planned; else IN_PROGRESS if any in progress; else IN_REVIEW) — the FRD status is DERIVED, never left stale; update .pandacorp/status.yaml (per-status counts + last_green_sha + safe_to_test:true + **advance \`last_event_at\` and \`updated_at\` to now, ISO 8601 — the DR-066 producer freshness stamp**).${TRACK('review_end', `,"frd":"${frd}","verdict":"pass"`)}${TRACK('frd_end', `,"frd":"${frd}"`)}${ACHIEVEMENT(frd)} Stage \`.pandacorp/track.jsonl\` too (its review_start/review_end/frd_end lines for this FRD), and commit. Return { green: true }.

  **If a SPECIFIC reviewed work order fails CORRECTION (a real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again** (the same fault is not resolving autonomously): set it \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`, append to .pandacorp/inbox/decisions.md (what the gate keeps rejecting, your diagnosis, your recommendation),${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)} and return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' }. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH on the existing build BEFORE any revert. **FIX-FORWARD MANDATE (DR-073, calibrated 2026-07-01): a BOUNDED fault you can name at file:line with an estimated fix of ≤ ~30 lines (a hardcoded string, a missing null-guard, a clipped breakpoint, a missing escape) MUST take this findings exit — never a bare failure, never blocked_reason 'error' (80% of real first-gate fails had ≤6-min fixes; routing them to revert cost ~1.5h of a run's 2.2h rework).** Your job here is to REPORT the fixable fault(s) precisely: for EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (a test you wrote that fails WITHOUT the fix and will pass WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }. The engine patches those findings in place; only if the patch can't green it whole-project does it then revert + reopen for a clean rebuild (DR-070, the fallback).
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built (it isn't in src/components nor docs/design/components.md — e.g. the mock shows a Room/AgentSprite/StoneBridge the foundation never built), do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  If it's broken and you can't pinpoint specific WOs,${TRACK('review_end', `,"frd":"${frd}","verdict":"fail"`)} return { green: false, failure, blocked_reason } (classify: 'needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error').${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`,
    { label: `gate:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA })
}

// ── Repair pass: TRY TO FIX before giving up (owner's rule, DR-050) ────────────
// The build resolves problems itself and only stops when it genuinely can't — then it
// BLOCKS with a reason instead of dying. Run by a strong model (it's hard diagnosis).
async function attemptRepair(frd, context) {
  agentSpawned += COST(P.judge)   // DR-073: repair runs on the judge model — weight it honestly
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}The build of FRD ${frd} hit a problem: ${context}. You are the repair engineer — TRY TO FIX it before we give up.
  1) Diagnose the root cause: read the failing output, the work orders, and .pandacorp/comms/progress.md.
  2) If it is within your reach (code / test / local config): fix the PRODUCTION code (never weaken or skip tests) until \`bash .pandacorp/verify.sh\` is green for this feature; set the affected work orders' frontmatter back to \`implementation_status: IN_REVIEW\`; commit (Conventional Commits with scope); return { green: true }.
  3) If you CANNOT fix it, classify WHY, set the affected work orders' frontmatter to \`implementation_status: BLOCKED\` + \`blocked_reason: <reason>\`, mirror it in .pandacorp/status.yaml. **DR-070 — discard the blocked WO's committed-but-broken code so it doesn't pollute sibling FRDs' global gate: revert its files to the last green (\`git checkout <last_green_sha> -- <its existing files>\`; \`git rm\` newly-created ones; NEVER a hard reset of the whole tree).** Commit only the status change + the revert, and return { green: false, blocked_reason, failure }:
     - 'needs-owner' → it needs a HUMAN action/decision the agent can't take: a missing env var or secret, an external account/service to set up, a product decision. ALSO append it to .pandacorp/inbox/decisions.md (what's blocked, the options, your recommendation).
     - 'external' → a transient OUTSIDE failure (no internet, an upstream 5xx) — worth a retry on a later run, not our bug.
     - 'error' → a technical failure you could not resolve.`,
    { label: `repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── DR-073 in-place PATCH: fix the specific finding(s) on the EXISTING build, don't rebuild ──────
// On a localized gate reject the build is ~correct except a bounded fault. Discarding a ~99%-correct
// build and rebuilding from scratch wastes a full multi-agent pass AND re-introduces a new micro-bug
// (the WO-07-005 4-cycle non-convergence). So FIRST attempt one in-place patch (a sub-step of
// this reject cycle — NOT a second counter axis; reopen_count is the single budget). The patch agent
// re-gates with the FULL FRD adversarial+integration pass AND a WHOLE-PROJECT knip+biome+tsc (red-team-A:
// a dead export must NOT slip to a sibling FRD; `--since` would have let it).
// DR-107 (personal-page-v2 incident): the old "one shot, then change NOTHING" contract threw away a
// 1-line i18n fix — and with it the whole WO — because the patch's OWN new test file had a trivial
// TS2345. So the patch now carries a SELF-REPAIR budget (fix failures its own edits introduced, up
// to 2 internal cycles) and a DISCRIMINATED give-up verdict (BL-0001): 'code' → the engine reverts;
// 'gate-test-defective' → the engine repairs the reviewer's TEST instead of discarding a correct build.
// Commit + hand to the independent verifier only on whole-project-clean; on give-up it UNDOES its own
// edits so the engine can still revert cleanly.
async function attemptPatch(frd, findings, reviewIds) {
  agentSpawned += COST('opus')
  const list = (findings || []).map((x) => `• ${x.wo}: ${x.finding}${x.failingTest ? ` — failing test: ${x.failingTest}` : ''}${x.files && x.files.length ? ` — file(s): ${x.files.join(', ')}` : ''}`).join('\n  ') || '(see the gate output)'
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'patch' })}Patch-in-place repair (DR-073). The build of ${frd} is ~CORRECT EXCEPT these specific findings:
  ${list}
  Patch ONLY these on the EXISTING build — do NOT revert, do NOT rebuild from scratch, do NOT touch unrelated files. For each finding, make the RED-proven failing test PASS (production code, never weaken/skip a test). Reviewed work orders this cycle: ${(reviewIds || []).join(', ')}.
  THEN RE-GATE (this is the safety invariant — a focused gate is NOT enough, red-team-A): run the FULL FRD adversarial + integration tests for ${frd} AND a WHOLE-PROJECT \`pnpm knip\` + \`pnpm biome check .\` + \`pnpm tsc --noEmit\` (NOT \`verify.sh --since\` — a dead export left by the patch must not slip to a sibling FRD's global gate). Everything must be whole-project-clean.
  **SELF-REPAIR BUDGET (DR-107) — a red introduced by YOUR OWN edits does not end the patch:** if the re-gate fails on something YOUR patch just added or touched (a type/lint error in a file you created or edited — e.g. a TS2345 in your own new test file), FIX that and re-gate. You may spend up to 2 such internal fix-and-re-gate cycles. (The real incident this exists for: a 1-line i18n patch was discarded — and its whole work order rebuilt from scratch — because its own new a11y spec had a trivial type error the old contract forbade fixing.)
  **If whole-project-clean:** COMMIT the patch (Conventional Commits, scope) — but do NOT set any WO \`VERIFIED\`, do NOT touch \`reopen_count\`, do NOT advance \`last_green_sha\`/status.yaml: you patched it, so you may not certify it (constitution rule 4, generator ≠ verifier — audit-20). An INDEPENDENT verifier re-runs the gate and stamps. Return { green: true }.
  **If the blocker is a DEFECTIVE reviewer test (BL-0001):** you conclude a blocking adversarial test is INTERNALLY INCONSISTENT or unsatisfiable by ANY correct implementation (e.g. it asserts desktop-only nav visibility without forcing a viewport while the Playwright config runs desktop+mobile) — do NOT edit that test (the patcher never rewrites the reviewer's tests) and do NOT keep bending production code to satisfy it: UNDO all your own edits (restore files you modified, delete files you created — \`git status\` must read as you found it) and return { green: false, cause: 'gate-test-defective', defectiveTests: [{ path, why }], failure }. The engine routes it to an independent gate-test repair — not to a revert of the build.
  **If you CANNOT green it in place** (the ORIGINAL build genuinely fails beyond the findings, or your self-repair budget is spent): UNDO all your own edits the same way — leave the tree exactly as you found it (do NOT commit, do NOT revert the WO; the engine reverts cleanly) — and return { green: false, cause: 'code', failure: <why> }.`,
    { label: `patch:${frd}`, phase: 'Review', model: 'opus', effort: 'xhigh', agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── BL-0001 gate-test repair: when the GATE's own test is the defect, fix the TEST, not the build ──
// The patcher flagged reviewer adversarial test(s) as internally inconsistent. An independent
// reviewer-role agent judges each claim: a genuinely defective test is REPAIRED (the assertion/setup
// corrected to test the FRD's REAL acceptance criterion — coverage is never deleted); an upheld test
// sends the flow back to the normal revert fallback. This is the second exit DR-073 lacked — one
// fallback for two causes meant a defective test could grind a correct build through rebuild loops
// that could never converge (LESSON-0002).
async function repairGateTest(frd, defectiveTests, reviewIds) {
  agentSpawned += COST(P.judge)
  const list = (defectiveTests || []).map((t) => `• ${t.path}: ${t.why}`).join('\n  ') || '(see the patch output)'
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate-test-repair' })}GATE-TEST REPAIR (BL-0001) for ${frd}. The patch agent flagged these reviewer adversarial test(s) as DEFECTIVE — internally inconsistent or unsatisfiable by ANY correct implementation:
  ${list}
  You are an INDEPENDENT reviewer (you own the gate's tests; the patcher may not touch them). For EACH flagged test, judge the claim on the evidence — do not take the patcher's word:
  - **Genuinely defective** (the assertion contradicts its own setup/config, or no correct implementation of the FRD's acceptance criteria could satisfy it): REPAIR the test so it correctly asserts the FRD's REAL acceptance criterion (fix the assertion/setup — e.g. force the viewport it assumed; NEVER delete the coverage or weaken what the AC requires).
  - **Actually right** (the build really violates it): change NOTHING and return { green: false, cause: 'code', failure: 'test upheld: <why the build is wrong>' } — the engine falls back to the normal revert.
  After repairing: re-run the repaired test file(s) + the FULL FRD test files for ${frd} AND whole-project \`pnpm biome check .\` + \`pnpm tsc --noEmit\` against the EXISTING build (work orders this cycle: ${(reviewIds || []).join(', ')}). If everything is clean, COMMIT only the test repair(s) (Conventional Commits, scope; note WHY each test was defective in the commit body) and return { green: true } — an independent verifier still re-runs the objective gate and stamps. If red remains, change nothing further and return { green: false, cause: 'code', failure }.`,
    { label: `gate-test-repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA })
}

// ── Independent post-patch verification (constitution rule 4 — the patcher never certifies itself) ──
// A DIFFERENT agent re-runs the objective gate over the patched build and only IT may stamp VERIFIED +
// advance last_green_sha. Mechanical re-run (the scripts are the oracle), so a worker-model agent suffices.
async function verifyPatched(frd, reviewIds) {
  agentSpawned++
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'verify-patch' })}INDEPENDENT post-patch verification for ${frd} (constitution rule 4: the patch agent may not certify its own fix). Re-run the objective gate yourself — trust nothing the patcher reported: the FULL FRD test files for ${frd} (\`pnpm vitest run\` on them) AND whole-project \`pnpm knip\` + \`pnpm biome check .\` + \`pnpm tsc --noEmit\`.
  **If everything is clean:** set the patched work orders (${(reviewIds || []).join(', ')}) \`implementation_status: VERIFIED\` and **reset their \`reopen_count: 0\`**; recompute + persist the FRD's frd.md + blueprint.md \`implementation_status\` rollup from ALL its work orders (VERIFIED iff all are; else BLOCKED if any blocked; else PLANNED if any planned; else IN_PROGRESS if any in progress; else IN_REVIEW); advance .pandacorp/status.yaml exactly as the gate does (per-status counts + last_green_sha + safe_to_test:true + last_event_at + updated_at to now, ISO 8601).${TRACK('review_end', `,"frd":"${frd}","verdict":"pass"`)}${TRACK('frd_end', `,"frd":"${frd}"`)}${ACHIEVEMENT(frd)} Stage .pandacorp/track.jsonl too and commit (Conventional Commits, scope). Return { green: true }.
  **If anything is red:** change NOTHING (no status edits, no commit) and return { green: false, failure: <what failed> } — the engine reverts + reopens.`,
    { label: `verify-patch:${frd}`, phase: 'Review', model: P.worker, agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA })
}

// ── DR-073 fallback: revert + reopen for a clean rebuild (the old DR-070 revert logic) ──
// Runs ONLY when the in-place patch could not green the build. For each reopened WO: set it PLANNED,
// INCREMENT reopen_count (so the non-progress cap can fire), and discard its committed-but-rejected
// code so it does NOT pollute sibling FRDs' WHOLE-PROJECT gate (DR-070) — surgical `git checkout
// <last_green_sha> -- <its files that existed at last green>` + `git rm` newly-created files, NEVER a
// whole-tree hard reset (it would discard verified siblings). Commit the status change + the revert
// together. Reviewer-authored / Status-Note-referenced TEST files are PRESERVED, not deleted (the
// personal-page-v2 revert deleted a green a11y spec the hand-off cited; the reviewer had to re-author
// it blind a pass later). The rebuild happens on opus (reopen_count>=1) — first via the DR-107 in-run
// retry in this same run, else on the next pass.
async function revertAndReopen(frd, reopenIds) {
  agentSpawned += COST(P.judge)
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'revert' })}DR-073 fallback — the in-place patch could NOT green ${frd}, so revert + reopen for a clean rebuild. Read last_green_sha from .pandacorp/status.yaml. For EACH of these reopened work orders: ${(reopenIds || []).join(', ')}
  1) Set its frontmatter \`implementation_status: PLANNED\` and **INCREMENT its \`reopen_count\`** (the non-progress cap, DR-072 — so a WO that keeps failing eventually BLOCKS needs-owner instead of grinding). ALSO append one durable reopen line PER reopened work order to .pandacorp/track.jsonl (fire-and-forget — reopen_count resets to 0 when the WO finally passes, so WITHOUT this line the durable timeline under-reports rework): printf '{"kind":"wo_reopen","frd":"${frd}","wo":"%s","at":"%s"}\\n' "<the-wo-id>" "$(date -u +%FT%TZ)" >> .pandacorp/track.jsonl.
  2) DR-070 — discard its committed-but-rejected code so it does not pollute sibling FRDs' WHOLE-PROJECT gate: \`git checkout <last_green_sha> -- <its files that existed at last green>\` and \`git rm\` any files it newly created. **NEVER a hard reset of the whole tree** (that would discard verified siblings). Leave every other WO (IN_REVIEW or VERIFIED) untouched.
     **EXCEPTION — preserve test evidence (DR-107):** a newly-created TEST file that the reviewer authored or that a \`## Status Note\` references (an adversarial spec, an e2e spec like \`a11y.spec.ts\`) is COVERAGE, not rejected code — do not destroy it. MOVE it to \`.pandacorp/run/preserved-tests/<wo-id>/\` (mkdir -p; gitignored runtime state) instead of \`git rm\`, so the rebuild restores it as its RED baseline instead of losing it (the personal-page-v2 incident: a green 6/6 a11y spec was deleted by a revert and had to be re-authored blind a pass later).
  3) Recompute + persist the FRD's frd.md + blueprint.md \`implementation_status\` rollup from ALL its work orders; advance .pandacorp/status.yaml (per-status counts + last_event_at + updated_at to now, ISO 8601). Commit the status change + the revert together (Conventional Commits, scope). Return { green: false } (the engine retries the reopened WOs — in-run first (DR-107), else next pass — from a clean green base).`,
    { label: `revert:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── Foundation-completeness gate (DR-057 extended) ────────────────────────────
// PREVENT: the foundation = the UNION of EVERY shared primitive any UI surface's mock/fdd
// references. It must be COMPLETE + green BEFORE any surface fans out — otherwise surfaces build
// flat against missing primitives and fail fidelity (the Party regression: Room/AgentSprite/
// StoneBridge/FlowStrip were never in the foundation). Read-only analysis; returns the gaps.
async function foundationCompletenessGate() {
  agentSpawned += COST(P.judge)   // DR-073: judge-model spawn — weighted
  return await agent(
    `You are the FOUNDATION-COMPLETENESS auditor (DR-057). The foundation = the UNION of EVERY shared design-system primitive that ANY UI surface's mock/fdd references — not a hand-picked subset. READ-ONLY, build nothing.
    1) Enumerate the COMPLETE set: read docs/design/components.md (the living inventory) AND scan every docs/frds/*/mocks/ + fdd.md to list every shared primitive the surfaces depend on (layout shells, Banner/Card/Chip/Modal/Button, and any app-specific shared primitive the mocks show — e.g. Room/AgentSprite/StoneBridge/FlowStrip).
    2) For each, check it EXISTS as a BUILT shared component (scan src/components/core + src/components/modules) AND its foundation work order is VERIFIED/IN_REVIEW (read the WO frontmatter).
    Return { complete: true } if every referenced shared primitive is built; otherwise { complete: false, missing: [{ name, referencedBy: [frd folders], suggestedPath, note }] }. Be precise: only list primitives that surfaces genuinely reference and that are NOT yet built.`,
    { label: 'foundation-gate', phase: 'Plan', model: P.judge, agentType: 'pandacorp:reviewer', schema: FOUNDATION_SCHEMA })
}

// ── Bounded foundation auto-repair (DR-065) ───────────────────────────────────
// CURE: the high-confidence, recoverable, BOUNDED class — "a surface needs a shared primitive that
// isn't in the foundation". The engine auto-resolves (it already knows the fix) instead of stopping
// to ask: reset to the last green, ADD the missing primitive(s) to the foundation on the frozen
// tokens per their mock spec, rebuild + re-verify, commit. Capped by FOUNDATION_REPAIR_CAP; on
// exhaustion it escalates needs-owner. This is the autonomy gap the Party build exposed.
async function repairFoundation(missing, context) {
  foundationRepairs++
  agentSpawned += COST(P.judge)   // DR-073: judge-model spawn — weighted
  const list = (missing || []).map((m) => `${m.name}${m.referencedBy && m.referencedBy.length ? ' (needed by ' + m.referencedBy.join(', ') + ')' : ''}${m.suggestedPath ? ' → ' + m.suggestedPath : ''}`).join('; ')
  return await agent(
    `${EMIT('implementer', 'foundation', { phase: 'build', activity: 'repair' })}FOUNDATION AUTO-REPAIR (DR-065), attempt ${foundationRepairs}/${FOUNDATION_REPAIR_CAP}. ${context}. The foundation is INCOMPLETE — these shared primitives that surfaces need are NOT built: ${list || '(see the gate output)'}.
    1) Reset to the last green — SAFELY (DR-072 R3, this prevents wiping verified work): read last_green_sha from .pandacorp/status.yaml, then FIRST verify it is an ANCESTOR of HEAD: \`git merge-base --is-ancestor <last_green_sha> HEAD && echo ANCESTOR || echo ORPHAN\`. **If ANCESTOR:** \`git reset --hard <last_green_sha>\` to discard the flat half-built surfaces (NOT the verified foundation). **If ORPHAN** (the SHA drifted off-branch via reverts / factory commits / an overlay upgrade — a real footgun seen 2026-06-20): do NOT hard-reset (it would discard verified work). Instead surgically discard ONLY the failed surfaces' files — \`git checkout HEAD -- <those surface files>\` and \`git clean -fd <their new dirs>\` — keeping HEAD and every verified commit. If you cannot safely identify exactly which files to discard, STOP: return { green: false, blocked_reason: 'needs-owner', failure: 'last_green_sha orphaned — a hard reset would wipe verified work; the owner must confirm the recovery point' }.
    2) For EACH missing primitive: build it as a SHARED foundation component on the frozen design tokens, faithful to its mock/fdd spec (read docs/frds/*/mocks + docs/design/design-tokens.json + DESIGN.md); place it under src/components/core or src/components/modules; APPEND a row to docs/design/components.md so surfaces reuse it. TDD; never weaken tests.
    3) Run \`bash .pandacorp/verify.sh\` until green and commit (Conventional Commits, scope). The surfaces that depended on these primitives stay PLANNED so the normal loop rebuilds them next — now against REAL primitives.
    Return { green: true } if the foundation is now complete + green. If you genuinely cannot (low confidence, the gap is really a design/product decision, or it's beyond a primitive add), return { green: false, blocked_reason: 'needs-owner', failure } describing what a human must decide.${NOTIFY('Auto-reparé la fundación (faltaban primitivos) y reconstruyo las superficies')}`,
    { label: `foundation-repair:${foundationRepairs}`, phase: 'Build', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// Run the completeness gate once before surfaces fan out; auto-repair (bounded) until complete or
// escalate. Returns true if the foundation is complete (safe to fan out), false if it needs the owner.
let foundationVerified = false
let foundationEscalated = false   // once the foundation needs the owner, don't re-run the gate for every later surface FRD
async function ensureFoundationComplete() {
  if (foundationVerified || !plan.hasFrontend) return true
  if (foundationEscalated) return false
  while (true) {
    const fc = await foundationCompletenessGate()
    // FAIL-CLOSED (audit P1): only an EXPLICIT `complete === true` verdict lets surfaces fan out. A
    // null/missing/garbled gate result (the agent died or returned nothing) is NOT proof of completeness
    // — reading it as "complete" would ship surfaces against an unverified foundation. So a no-verdict
    // is a BOUNDED retry, then escalate; it is never silently treated as green.
    if (fc && fc.complete === true) { foundationVerified = true; return true }
    if (!fc) {
      foundationRepairs++   // count the failed attempt against the cap so a dead gate can't loop forever
      if (foundationRepairs >= FOUNDATION_REPAIR_CAP) {
        log('⊘ Foundation-completeness gate produced no verdict (agent died/invalid) after retries — escalating to the owner (fail-closed)')
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

// ── Per-FRD loop ──────────────────────────────────────────────────────────────
const builtFrds = []
const blockedFrds = []
const reopenedFrds = []
const blockedReasons = {}
let consecutiveBlocks = 0   // health breaker: non-external blocks in a row
let stopReason = null       // 'budget' | 'blocks' | 'maxFrds' (null = ran to completion)

function blockFrd(frd, reason) {
  reason = reason || 'error'
  blockedFrds.push(frd)
  blockedReasons[frd] = reason
  if (reason !== 'external') consecutiveBlocks++   // external = not our bug; don't trip the breaker
}

// DR-060: keep wave-parallel work orders DISJOINT. Each WO declares `artifacts` (globs it writes); the
// engine serializes any whose artifacts overlap into different waves, so two agents never race on one
// file (the generalized banner-collision fix). Undeclared artifacts → fall back to prior behavior
// (trust the Build Plan) for back-compat with WOs authored before the field existed.
// Real glob overlap (not a crude prefix match): two globs overlap if one's pattern can match the
// other's concrete representative path (handles `**`, `*`, and extension globs like `Banner.*`).
const globToRe = (g) => new RegExp('^' + String(g)
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')   // escape regex metachars (keep * )
  .replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$')
const globLiteral = (g) => String(g).replace(/\*\*\/?/g, '').replace(/\*/g, '') || '/'  // representative concrete-ish path
const globsOverlap = (x, y) => {
  if (x === y) return true
  return globToRe(x).test(globLiteral(y)) || globToRe(y).test(globLiteral(x))
}
const artifactsOverlap = (a, b) => {
  const A = a.artifacts || [], B = b.artifacts || []
  // FAIL-SAFE (audit P1): a WO with UNDECLARED artifacts can't be proven disjoint, so assume it MAY
  // collide and force serialization (correctness over parallelism) instead of reading "no globs" as
  // "no overlap" (the old back-compat path that let un-migrated WOs race on a shared file). The planner
  // is instructed to infer artifacts (DR-060), so this only bites old/un-migrated WOs — they serialize.
  if (!A.length || !B.length) return true
  return A.some((x) => B.some((y) => globsOverlap(x, y)))
}
const pickDisjointWave = (ready, max) => {
  const picked = []
  for (const w of ready) {
    if (picked.length >= max) break
    if (picked.some((p) => artifactsOverlap(p, w))) continue   // overlaps a picked WO → defer to a later wave
    picked.push(w)
  }
  return picked
}

// ── DR-069 SAFE-POINT (in-engine, audit-20 P0-3): every WAVE/GATE boundary IS a safe point (BL-0021:
// was every FRD boundary — same cadence, the scheduler unit changed). The ENGINE itself checks the
// owner's signals here — the change queue, answered decisions, the rethink stop — instead of leaving
// the drain to supervisor prose (a supervisor may not exist, and its own safe points are only between
// passes; an expedite change used to wait a whole multi-hour pass).
// Returns 'stop' when the owner re-planned (rethink_pending), else null.
async function safePoint() {
  agentSpawned++
  const sp = await agent(
    `Safe-point check (DR-069) — read the owner's signals; change ONLY what is specified:
    1) Read .pandacorp/status.yaml → if \`rethink_pending: true\`, return { stop: true } immediately (the owner re-planned mid-run; the engine stops at this safe point and the next run resumes on the new plan).
    2) List .pandacorp/inbox/changes/*.md (IGNORE the done/ subfolder): collect the slugs whose frontmatter \`status\` is "ready" — \`class: expedite\` FIRST, then standard FIFO by date. Skip draft/done.
    3) Read .pandacorp/inbox/decisions.md: for each decision the owner ANSWERED (via /pandacorp:decide) that resolves blocked work, find the work orders with \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\` that the answer unblocks, set each back to \`implementation_status: PLANNED\` (the DR-050 frontmatter signal), and update \`pending_decisions\` in status.yaml to the count still unanswered. Commit those frontmatter edits if you made any.
    Return { stop: false, ready: [...slugs, expedite first], unblocked: [...wo ids] } (empty arrays when there is nothing).`,
    { label: 'safe-point', phase: 'Build', model: MECH, agentType: 'pandacorp:implementer', schema: SAFE_POINT_SCHEMA },
  )
  if (sp && sp.stop === true) { log('⏸ rethink_pending — el owner re-planificó; el motor para en este safe point (la próxima corrida retoma con el plan nuevo)'); return 'stop' }
  if (sp && sp.unblocked && sp.unblocked.length) log(`✓ Decisiones respondidas → WOs desbloqueados a PLANNED: ${sp.unblocked.join(', ')} (su FRD los construye en la próxima pasada)`)
  if (sp && sp.ready && sp.ready.length) {
    log(`⇩ Drenando ${sp.ready.length} change(s) ready de la cola (DR-069): ${sp.ready.join(', ')}`)
    for (const slug of sp.ready) {
      if (capHit()) { log('⛔ Techo de agentes — el resto de la cola espera a la próxima corrida'); break }
      const proc = await processChange(slug, 'Build')
      if (!proc || proc.done !== true || !proc.affectedFrds || !proc.affectedFrds.length) { log(`⊘ Change '${slug}' no drenada: ${proc?.failure || 'sin FRDs afectados'}`); continue }
      // NEW FRD folders join THIS run's schedule (the global scheduler picks their WOs up next wave).
      // An affected FRD already in the plan builds its new WOs on the NEXT run (its plan entry
      // predates the drain) — honest and bounded, logged so nothing lands silently.
      const newFolders = proc.affectedFrds.filter((x) => !plan.frds.some((pf) => pf.frd === x))
      const existing = proc.affectedFrds.filter((x) => plan.frds.some((pf) => pf.frd === x))
      if (existing.length) log(`↷ Change '${slug}' tocó FRDs ya planificados (${existing.join(', ')}) — sus WOs nuevos se construyen en la PRÓXIMA corrida/pasada`)
      if (newFolders.length) {
        agentSpawned += COST(P.judge)
        const extra = await agent(
          `Re-plan ONLY these FRD folders (they were just created/updated by a drained change): ${newFolders.join(', ')}. Same contract as the main build planner: read each folder's frd.md + blueprint.md Build Plan + the frontmatter ONLY of every work-orders/wo-*.md, and return { frds: [{ frd, deps, workOrders: [{ id, status, path, acText (the EARS AC lines this WO owns, verbatim from frd.md — DR-108), difficulty, reopen_count, deps, artifacts, foundation, summary }] }] } in Build Plan order. Read-only.`,
          { label: `plan-drained:${slug}`, phase: 'Build', model: P.judge, agentType: 'pandacorp:architect', schema: PLAN_SCHEMA },
        )
        if (extra && extra.frds && extra.frds.length) { for (const nf of extra.frds) { plan.frds.push(nf); enrollFrd(nf) } log(`＋ FRDs de la change añadidos a esta corrida: ${extra.frds.map((x) => x.frd).join(', ')}`) }
      }
    }
  }
  return null
}

// ── FRD gate + convergence (DR-072/073/107, BL-0001) — one FRD, run on a QUIET tree ──────────────
// Extracted verbatim from the old per-FRD loop (BL-0021): the global scheduler calls this serially at
// wave boundaries, so the gate's whole-project checks never see another FRD's in-flight work.
// Returns 'built' | 'reopened' | 'blocked'; updates builtFrds/blockedFrds/reopenedFrds/consecutiveBlocks.
async function gateAndConverge(f, reviewIds) {
  phase('Review')
  let gate = await frdGate(f.frd, reviewIds)
  if (gate && gate.green === true) { log(`✓ ${f.frd} VERIFIED`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  // DR-073 PATCH-FIRST: a localized reject defaults to an in-place patch on the EXISTING build (inject
  // the finding + the RED-proven failing test), re-gated WHOLE-PROJECT — NOT a revert-and-rebuild. The
  // patch runs SYNCHRONOUSLY inside this FRD's gate step (before the loop moves to sibling FRDs), and it
  // VERIFIES only on whole-project-clean, so a sibling never sees broken committed code. Three exits:
  // (1) patch greens → independent verify stamps; (2) the patch flags the GATE's own test as defective →
  // gate-test repair (BL-0001), never a rebuild of correct work; (3) genuine code fault → revert+reopen
  // (DR-070) and then the DR-107 IN-RUN RETRY: rebuild the reopened WOs NOW from the clean base (opus —
  // reopen_count>=1) instead of deferring to the next pass, which re-pays the whole fixed overhead
  // (baseline + full re-plan + sync + safe-points). reopen_count stays the single budget: the patch
  // doesn't touch it; each revert increments it; the reopen cap still ends the grind.
  if (gate && gate.reopen && gate.reopen.length) {
    let patchFailNote = ''
    const patched = await attemptPatch(f.frd, gate.findings || [], reviewIds)
    if (patched && patched.green === true) {
      // Constitution rule 4 (audit-20): the patcher claimed green — an INDEPENDENT agent re-runs the
      // gate and is the only one allowed to stamp VERIFIED + advance last_green_sha.
      const iv = await verifyPatched(f.frd, reviewIds)
      if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (patched in place, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
      patchFailNote = `patch claimed green but the independent verification FAILED (${iv?.failure || 'red'})`
    } else if (patched && patched.cause === 'gate-test-defective' && (patched.defectiveTests || []).length) {
      // BL-0001 second fallback: the gate's own adversarial test is the defect — repair the TEST,
      // never discard a correct build over an unsatisfiable assertion (LESSON-0002).
      log(`⚖ ${f.frd}: patch flagged defective gate test(s) (${patched.defectiveTests.map((t) => t.path).join(', ')}) — repairing the TEST, not rebuilding (BL-0001)`)
      const tr = await repairGateTest(f.frd, patched.defectiveTests, reviewIds)
      if (tr && tr.green === true) {
        const iv2 = await verifyPatched(f.frd, reviewIds)
        if (iv2 && iv2.green === true) { log(`✓ ${f.frd} VERIFIED (defective gate test repaired, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
        patchFailNote = `gate-test repair greened but the independent verification failed (${iv2?.failure || 'red'})`
      } else patchFailNote = `gate-test claim not upheld (${tr?.failure || 'test was right — the build is wrong'})`
    } else {
      patchFailNote = `in-place patch did not green (${patched?.failure || 'no verdict'})`
    }
    log(`↻ ${f.frd}: ${patchFailNote} — reverting + reopening`)
    await revertAndReopen(f.frd, gate.reopen)
    // DR-107 IN-RUN RETRY (bounded): one rebuild attempt NOW, from the clean green base, on opus.
    // Skipped at the agent ceiling or when any reopened WO already hit the reopen cap (the gate
    // would BLOCK it needs-owner anyway). If the retry's gate rejects again, no second patch cycle:
    // revert + defer to the next pass exactly as before. Reopen is still deferred work, not progress
    // — the health breaker is untouched either way.
    const retryWos = f.workOrders.filter((w) => gate.reopen.includes(w.id)).map((w) => ({ ...w, reopen_count: (w.reopen_count || 0) + 1 }))
    const canRetry = !capHit() && retryWos.length > 0 && retryWos.every((w) => w.reopen_count < MAX_REOPENS)
    if (!canRetry) { reopenedFrds.push(f.frd); return 'reopened' }
    log(`↻ ${f.frd}: in-run retry (DR-107) — rebuilding ${retryWos.map((w) => w.id).join(', ')} from the clean base now (opus) instead of paying a whole extra pass`)
    for (const w of retryWos) await buildWO(w, f.frd)
    const regate = await frdGate(f.frd, reviewIds)
    if (regate && regate.green === true) { log(`✓ ${f.frd} VERIFIED (in-run retry)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
    if (regate && regate.reopen && regate.reopen.length) await revertAndReopen(f.frd, regate.reopen)
    log(`↻ ${f.frd}: in-run retry did not converge — deferred to the next pass`)
    reopenedFrds.push(f.frd); return 'reopened'
  }

  // DR-065 CURE: the surface failed because a shared primitive it needs isn't in the foundation —
  // a HIGH-CONFIDENCE, BOUNDED class. The engine ALREADY knows the fix, so it auto-resolves instead
  // of stopping to ask (the autonomy gap the Party build exposed): add the primitive(s) to the
  // foundation, then let this FRD's surfaces rebuild against the real primitives next pass.
  if (gate && gate.missingFoundation && gate.missingFoundation.length && foundationRepairs < FOUNDATION_REPAIR_CAP) {
    log(`! ${f.frd}: gate found primitives missing from the foundation (${gate.missingFoundation.join(', ')}) — auto-repairing (DR-065)`)
    const fr = await repairFoundation(gate.missingFoundation.map((n) => ({ name: n, referencedBy: [f.frd] })), `the FRD gate for ${f.frd} found a surface needs a primitive missing from the foundation`)
    if (fr && fr.green === true) {
      foundationVerified = false   // re-confirm completeness before the next surface fans out
      log(`✓ ${f.frd}: foundation repaired — its surfaces rebuild against real primitives next pass`)
      reopenedFrds.push(f.frd); return 'reopened'   // the repair reset surfaces to the last green (→ PLANNED); next pass rebuilds them
    }
    log(`⊘ ${f.frd}: foundation auto-repair failed — falling through to block`)
  }

  // DR-072 C1 — the gate already CLASSIFIED a block (needs-owner from the reopen-cap / a human decision,
  // or external/transient): do NOT waste a repair pass + a second xhigh re-gate on it (a human or an
  // outside fix is required — a repair can't help). This is what makes the non-progress stop actually
  // STOP instead of grinding another full cycle per capped FRD every run. 'error' still falls through to repair.
  if (gate && (gate.blocked_reason === 'needs-owner' || gate.blocked_reason === 'external')) {
    log(`⊘ ${f.frd}: gate classified ${gate.blocked_reason}${gate.failure ? ' — ' + gate.failure : ''} — blocking (no repair)`)
    blockFrd(f.frd, gate.blocked_reason)
    return 'blocked'
  }

  // Gate failed with no specific reopen → TRY TO REPAIR, then re-gate ONCE (fail-closed).
  log(`! ${f.frd} gate failed${gate?.failure ? ': ' + gate.failure : ''} — attempting repair`)
  const fix = await attemptRepair(f.frd, 'the FRD review/integration gate failed: ' + (gate?.failure || 'unknown'))
  if (fix && fix.green === true) {
    gate = await frdGate(f.frd, reviewIds)
    if (gate && gate.green === true) { log(`✓ ${f.frd} VERIFIED (after repair)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  }
  const reason = (fix && fix.blocked_reason) || (gate && gate.blocked_reason) || 'error'
  log(`⊘ ${f.frd}: BLOCKED (${reason})`)
  blockFrd(f.frd, reason)
  return 'blocked'
}

// ── BL-0021 GLOBAL WAVE SCHEDULER ─────────────────────────────────────────────
// The engine used to build strictly FRD by FRD (a sequential for-loop): the wave parallelism only
// existed INSIDE one feature, so six independent 1-WO FRDs built single-file for ~4.5h in `powerful`
// mode (personal-page-v2, 2026-06-30 — the mode's wave of 8 was theoretical). Now each wave is picked
// from the READY WOs of ALL FRDs (dependsOn satisfied + artifacts disjoint across the whole wave,
// DR-060) and the per-FRD gates run SERIALIZED at wave boundaries — waves are synchronous barriers,
// so a gate's whole-project checks always see a QUIET tree (the trust boundary is unchanged).
// Every prior invariant holds: foundation-first (DR-057), Option B single commit writer, maxAgents/
// budget brakes at every boundary, DR-069 safe-points, the blocks health breaker, DR-107 in-run retry.

// Per-FRD tracking, seeded from the plan; drained changes enroll later via enrollFrd().
const frdState = new Map()   // frd -> { f, reviewIds, toBuildIds:Set, failed:false, enqueued:false }
const globalQueue = new Map() // woId -> { wo, frd }
const doneIds = new Set()     // committed (IN_REVIEW) or VERIFIED wo ids — satisfies dependsOn
const gateQueue = []          // FRD folders whose build WOs are all committed — gates run FIFO, serialized
function enqueueGateIfComplete(frd) {
  const st = frdState.get(frd)
  if (!st || st.enqueued || st.failed) return
  if (st.toBuildIds.size === 0 && st.reviewIds.length > 0) { st.enqueued = true; gateQueue.push(frd) }
}
function enrollFrd(f) {
  if (frdState.has(f.frd)) return
  const pending = f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED')
  const toBuild = pending.filter((w) => w.status !== 'IN_REVIEW')   // IN_REVIEW = built by a prior interrupted run → straight to the gate, don't rebuild
  for (const w of f.workOrders) if (w.status === 'VERIFIED' || w.status === 'IN_REVIEW') doneIds.add(w.id)
  for (const w of toBuild) globalQueue.set(w.id, { wo: w, frd: f.frd })
  frdState.set(f.frd, { f, reviewIds: pending.map((w) => w.id), toBuildIds: new Set(toBuild.map((w) => w.id)), failed: false, enqueued: false })
  log(`▶ ${f.frd}: ${toBuild.length} to build${pending.length - toBuild.length ? ` · ${pending.length - toBuild.length} already in review` : ''}`)
  enqueueGateIfComplete(f.frd)   // resume / drained bug-fix: an all-IN_REVIEW FRD goes straight to the gate
}
for (const f of plan.frds) enrollFrd(f)

// Block an FRD before its gate: drop its unbuilt WOs from the schedule (built/IN_REVIEW ones stay
// committed — the next run resumes them) and record the reason.
function blockFrdInSchedule(frd, reason) {
  const st = frdState.get(frd)
  if (st) { st.failed = true; for (const id of st.toBuildIds) globalQueue.delete(id) }
  blockFrd(frd, reason)
}

// FRD-level deps (a WO is schedulable only if its FRD doesn't depend on a blocked FRD).
function frdDepsBlocked(frd) {
  const st = frdState.get(frd)
  return Boolean(st && st.f.deps && st.f.deps.some((d) => blockedFrds.includes(d)))
}

while (true) {
  // ── Brakes at every wave/gate boundary (same checks the per-FRD loop ran) ──
  if (budget.total && budget.remaining() < LOW_BUDGET) { stopReason = 'budget'; log('Circuit breaker: budget ceiling reached — stopping at a safe point'); break }
  if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) { stopReason = 'agents'; log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) — stopping at a safe point`); break }
  if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason = 'budget'; log(`Spend ceiling reached (${Math.round(budget.spent() / 1000)}k ≥ maxSpend ${Math.round(MAX_SPEND / 1000)}k) — stopping at a safe point`); break }
  if ((builtFrds.length + blockedFrds.length + reopenedFrds.length) >= MAX_FRDS) { stopReason = 'maxFrds'; log(`Reached the test cap maxFrds=${MAX_FRDS} (built+blocked+reopened) — stopping at a safe point`); break }
  if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }

  // ── DR-069 safe point (owner signals; may enroll drained-change FRDs into this run) ──
  if ((await safePoint()) === 'stop') { stopReason = 'rethink'; break }

  // ── Gates first (tree is quiet right after a wave barrier): one per iteration ──
  const gateFrd = gateQueue.shift()
  if (gateFrd) {
    const st = frdState.get(gateFrd)
    await gateAndConverge(st.f, st.reviewIds)
    continue
  }

  // Skip FRDs whose FRD-level deps blocked (the old loop's skip, evaluated lazily).
  for (const [frd, st] of frdState) {
    if (!st.failed && !st.enqueued && frdDepsBlocked(frd) && [...st.toBuildIds].some((id) => globalQueue.has(id))) {
      log(`⊘ ${frd} skipped (depends on a blocked FRD)`)
      blockFrdInSchedule(frd, 'needs-owner')
    }
  }
  if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }

  if (globalQueue.size === 0) break   // nothing left to build and no gate queued → done

  // ── Ready set across ALL FRDs: dependsOn satisfied (a dep outside the schedule counts as
  // satisfied — it belongs to a fully-VERIFIED FRD the planner omitted, mirroring the old
  // `!queue.has(d)` rule extended globally). ──
  const ready = [...globalQueue.values()]
    .filter(({ wo }) => (wo.deps || []).every((d) => doneIds.has(d) || !globalQueue.has(d)))
    .map(({ wo, frd }) => ({ ...wo, _frd: frd }))

  if (ready.length === 0) {
    const stuck = [...new Set([...globalQueue.values()].map((x) => x.frd))]
    log(`⚠ ${globalQueue.size} work orders with unresolved/circular deps (${stuck.join(', ')}) — blocking those FRDs`)
    for (const frd of stuck) blockFrdInSchedule(frd, 'error')
    continue
  }

  // ── DR-057 foundation-first, ENGINE-ENFORCED: while any foundation WO is pending, the wave is
  // foundation-only; before any SURFACE fans out the foundation must be COMPLETE (bounded auto-repair).
  const foundationReady = ready.filter((w) => w.foundation)
  let candidates = ready
  if (foundationReady.length) {
    candidates = foundationReady
  } else if (plan.hasFrontend && !foundationVerified && ready.some((w) => !w.foundation)) {
    const ok = await ensureFoundationComplete()
    if (!ok) {
      const surfaceFrds = [...new Set(ready.filter((w) => !w.foundation).map((w) => w._frd))]
      log(`⊘ foundation incomplete and it needs the owner — holding surface work (${surfaceFrds.join(', ')})`)
      for (const frd of surfaceFrds) blockFrdInSchedule(frd, 'needs-owner')
      continue
    }
  }

  phase('Build')
  const undeclared = candidates.filter((w) => !(w.artifacts && w.artifacts.length))
  if (undeclared.length) log(`⚠ ${undeclared.length} ready WO(s) declare no artifacts — serializing them (can't prove disjoint, DR-060 fail-safe): ${undeclared.map((w) => w.id).join(', ')}`)
  // DR-070 (audit P1): never START more WOs in a wave than the agent budget allows. capHit() guards the
  // wave boundary, but a full P.wave fan-out could overshoot maxAgents mid-wave by (wave-1); cap the
  // wave width to the remaining agent budget so the in-engine brake holds even if the supervisor is dead.
  const waveMax = MAX_AGENTS ? Math.min(P.wave, Math.max(1, MAX_AGENTS - agentSpawned)) : P.wave
  const wave = pickDisjointWave(candidates, waveMax)   // DR-060: never co-schedule WOs whose artifacts overlap — now across FRDs
  const waveFrds = [...new Set(wave.map((w) => w._frd))]
  log(`⚒ wave: ${wave.length} WO(s) across ${waveFrds.length} FRD(s) — ${wave.map((w) => w.id).join(', ')}`)

  // BL-0002: the ENGINE owns the PLANNED→IN_PROGRESS transition, stamped at dispatch — atomic and
  // independent of when each builder actually starts. Parallel waves used to leave five actively-
  // building WOs reading PLANNED (the builder's "first action" never ran first), so Mission Control
  // showed "En progreso: 0" over a busy build (LESSON-0003). Cheap tier; frontmatter only; no commit.
  agentSpawned++
  await agent(`Stamp \`implementation_status: IN_PROGRESS\` in the frontmatter of EACH of these work-order files (a frontmatter-only edit — change nothing else, do NOT commit; skip any already IN_PROGRESS): ${wave.map((w) => w.path || `docs/frds/${w._frd}/work-orders/${w.id}`).join(', ')}. Return when all are stamped.`,
    { label: `dispatch:${waveFrds.join('+')}`, phase: 'Build', model: MECH, agentType: 'pandacorp:implementer' })
  const results = await parallel(wave.map((w) => () => buildWO(w, w._frd)))
  // Option B (DR-060) + finer save points (DR-086): each GREEN work order was ALREADY committed the
  // instant its self-test passed (commitWOGreen — one serialized git writer, selective `git add` of
  // its disjoint artifacts), so there is no batched after-wave commit. A mid-wave interruption keeps
  // every WO that already greened (committed → IN_REVIEW → skipped on resume) and only the
  // still-building (uncommitted) WOs rebuild. No index.lock race: the writer is serialized.
  for (let i = 0; i < wave.length; i++) {
    const w = wave[i]
    globalQueue.delete(w.id)
    const st = frdState.get(w._frd)
    if (st) st.toBuildIds.delete(w.id)
    if (results[i]) doneIds.add(w.id)
    else if (st) st.failed = true
  }

  // A work order failed its self-test → TRY TO REPAIR that FRD before blocking (owner's rule).
  // Runs after the wave barrier (quiet tree), one FRD at a time.
  for (const frd of waveFrds) {
    const st = frdState.get(frd)
    if (!st || !st.failed) continue
    log(`! ${frd}: a work order failed — attempting repair before giving up`)
    const fix = await attemptRepair(frd, 'a work order failed its self-test during the build wave')
    if (fix && fix.green === true) {
      log(`✓ ${frd}: repaired — proceeding to the gate`)
      st.failed = false
      for (const id of [...st.toBuildIds]) if (!globalQueue.has(id)) { st.toBuildIds.delete(id); doneIds.add(id) }
    } else {
      const reason = (fix && fix.blocked_reason) || 'error'
      log(`⊘ ${frd}: could not repair (${reason}) — BLOCKED, continuing with independent FRDs`)
      blockFrdInSchedule(frd, reason)
    }
  }

  // FRDs whose build WOs all committed → queue their gate (runs next iteration, tree quiet).
  for (const frd of waveFrds) enqueueGateIfComplete(frd)
}

// ── End-of-build VISUAL QA pass (DR-072) ──────────────────────────────────────
// The fidelity work consolidated into ONE dedicated phase, OUTSIDE the convergence loop, so being
// thorough here can't cause the churn a per-FRD fidelity BLOCK would. Scoped to the FRDs touched THIS
// run. PUNCH-LIST + bounded DIRECT fixes — NEVER a reject-to-rebuild. The owner sweeps the residual.
if (plan.hasFrontend && builtFrds.length) {
  phase('Review')
  agentSpawned += COST(P.judge)   // DR-073: judge-model spawn — weighted
  await agent(`${EMIT('reviewer', 'visual-qa', { phase: 'review', activity: 'visual-qa' })}END-OF-BUILD VISUAL QA (DR-072) — the dedicated fidelity pass, scoped to the FRDs VERIFIED this run: ${builtFrds.join(', ')}. This is a PUNCH-LIST + bounded DIRECT fixes, NOT a re-gate: NEVER reopen a work order or send anything back to the build loop (that restarts the churn). Compare, list, fix the cheap ones, leave the rest for the owner.
  For EACH of those FRDs, for each key route:
  1) Render the route (start the dev server if needed) and screenshot it; open the BINDING mock (docs/frds/<frd>/mocks/ — screenshot AND source), fdd.md, docs/design/design-tokens.json, DESIGN.md.
  2) Compare SEMANTICALLY (does the build look like the design?): layout, structure, spacing, sizing, colors/tokens, component reuse, density. Write every divergence to \`.pandacorp/comms/visual-punch-list.md\` (merge + dedupe with what the per-FRD gates already appended), one line each: \`- [ ] <frd> · <route> · <gap> · <file:line if known>\`.
  3) FIX the cheap, unambiguous ones DIRECTLY (a token/size/spacing/color/class correction against the EXISTING design docs — the doc already specified it, the build implemented it wrong; NO doc change). Check them off. Leave ambiguous/large gaps UNCHECKED for the owner. Bound your fixes (don't grind to perfection — the owner does the final polish).
  4) After fixing, run the FOCUSED \`bash .pandacorp/verify.sh --since <last_green_sha from .pandacorp/status.yaml>\` to confirm your fixes regressed nothing (DR-106 — the close-out/notify-end step right after runs the FULL suite once; don't pay it twice here); if a fix broke a test, revert THAT one fix (keep the rest) and re-run. Commit (e.g. \`style(visual-qa): sweep punch-list for ${builtFrds.slice(0, 3).join(', ')}\`). Advance status.yaml last_event_at + updated_at + kill any dev server with TaskStop.
  Return { done: true } once the punch-list is written, safe fixes committed, and verify is green.${NOTIFY('QA Visual: punch-list generado + arreglos seguros aplicados', 'Glass')}`,
    { label: 'visual-qa', phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:reviewer', schema: { type: 'object', required: ['done'], properties: { done: { type: 'boolean' } } } })
  log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
}

// ── DR-069 §7 verify-then-archive: changes whose affected FRDs ALL verified this run ─────────────
// (audit-20 P0-3.3: the old flow deferred archiving to "the FRD gate", whose prompt never did it —
// a built change stayed `ready` forever, got re-processed every run, and pending_changes never fell.)
const landedChanges = integratedChanges.filter((c) => c.frds.every((x) => builtFrds.includes(x)))
if (landedChanges.length) {
  phase('Review')
  agentSpawned++
  await agent(`Archive ${landedChanges.length} landed change(s) — the DR-069 §7 verify-then-archive protocol. For EACH of: ${landedChanges.map((c) => c.file).join(', ')} in .pandacorp/inbox/changes/:
  1) Verify its durable record exists (the run's commits touched the canonical docs/FRDs it names).
  2) Stamp its frontmatter \`status: done\` + \`shipped_sha\` (current \`git rev-parse --short HEAD\`) + \`shipped_at\` (ISO now).
  3) MOVE the file to .pandacorp/inbox/changes/done/ (a move, never a delete — the folder is gitignored, a delete is irreversible). Update its row in the queue index README.md.
  4) Decrement \`pending_changes\` in .pandacorp/status.yaml by the number archived.
  Return { done: true }.`,
    { label: 'archive-changes', phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
  log(`✓ ${landedChanges.length} change(s) archivadas a done/ (DR-069 §7)`)
} else if (integratedChanges.length) {
  log(`↷ ${integratedChanges.length} change(s) integradas pero sus FRDs no verificaron todos este run — siguen ready y se archivan cuando verifiquen`)
}

// ── Close-out + ALWAYS notify the owner how this run ended ────────────────────
phase('Review')
const needsOwner = blockedFrds.filter((x) => blockedReasons[x] === 'needs-owner')
const allDone = !stopReason && blockedFrds.length === 0 && reopenedFrds.length === 0 && builtFrds.length === plan.frds.length
let closed
if (allDone) {
  // ── DR-085 HARDENING (BL-0012, fail-closed): security + telemetry are construction's LAST STEP.
  // `phase: release` is gated on their EVIDENCE — never on the FRD loop alone. Two real findings
  // shipped as "green" before this gate existed (a missing CSP + an ASI01 path traversal +
  // never-firing events, run wf_978129ab-eca / LESSON-0022).
  phase('Hardening')
  agentSpawned += COST(P.judge)
  const sec = await agent(`DR-085 HARDENING 1/2 — the security audit, construction's last step (BL-0012). Audit the WHOLE project: OWASP Top-10 for this stack, secrets in code/config/history, security headers + CSP (e.g. next.config), auth/authz on every mutating route, dependency risk; if the product has an agentic/LLM component, also ASI01–ASI10 (e.g. path traversal via model-chosen paths). FIX every Critical/High finding directly (production code, TDD — never weaken a test) and re-run the FOCUSED \`bash .pandacorp/verify.sh --since <last_green_sha from .pandacorp/status.yaml>\` until green (DR-106 — the close-out right after runs the FULL suite once; don't pay it twice here). Write the durable evidence report to docs/reviews/security-<YYYY-MM-DD>.md: each finding, severity, fixed|accepted-with-reason, and the final verify result. Commit (Conventional Commits). Return { done: true } ONLY when no Critical/High remains open AND the report file exists; otherwise { done: false, failure }.`,
    { label: 'hardening:security', phase: 'Hardening', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: STOP_SCHEMA })
  agentSpawned++
  const telem = await agent(`DR-085 HARDENING 2/2 — telemetry verification (BL-0012). Read docs/analytics/events.md (the event plan). VERIFY each planned event actually FIRES (exercise the flows via the tests/dev server; check the PostHog/analytics wiring is present and env-keyed). Fix trivial instrumentation gaps (a missing capture call) with TDD. Append a "## Verification <YYYY-MM-DD>" section to docs/analytics/events.md recording event-by-event: fires|gap-fixed|not-applicable. If the project has NO event plan and needs none (internal/personal return_type — check the PRD), record exactly that in the section instead. Commit. Return { done: true } (the verification section exists) or { done: false, failure }.`,
    { label: 'hardening:telemetry', phase: 'Hardening', model: P.worker, agentType: 'pandacorp:analytics', schema: STOP_SCHEMA })
  const hardened = Boolean(sec && sec.done === true && telem && telem.done === true)
  phase('Review')
  if (hardened) {
    agentSpawned += COST(P.judge)
    closed = await agent(`All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`). THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates) and kill any test dev servers with TaskStop. FINALLY assert the hardening evidence EXISTS before you may declare release (BL-0012 fail-closed): a docs/reviews/security-*.md dated this run AND the "## Verification" section in docs/analytics/events.md — if either is missing, do NOT set phase: release; return done:false with what is missing. If a cross-feature seam is wrong, reopen the offending work order (set it \`implementation_status: PLANNED\`) and return done:false with the finding. If everything integrates AND the full suite is green AND both hardening artifacts exist: set .pandacorp/status.yaml phase: release and running: false. Return done:true once status.yaml is written.${NOTIFY('Build COMPLETO: FRDs verificados + hardening + integracion cross-feature OK', 'Glass')}`,
      { label: 'close-out', phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
    log('Run ended: all FRDs verified + hardened.')
  } else {
    agentSpawned++
    closed = await agent(`Every FRD is VERIFIED but the DR-085 hardening did NOT complete (security: ${sec && sec.done === true ? 'ok' : 'INCOMPLETE — ' + ((sec && sec.failure) || 'failed')}; telemetry: ${telem && telem.done === true ? 'ok' : 'INCOMPLETE — ' + ((telem && telem.failure) || 'failed')}). The project must NOT be declared released (BL-0012 fail-closed — release requires the hardening evidence). 1) Append the hardening failure + your recommendation to .pandacorp/inbox/decisions.md (needs-owner). 2) Write a short Spanish summary to .pandacorp/comms/progress.md (todo verificado, hardening incompleto, qué falta). 3) Set .pandacorp/status.yaml running: false and KEEP phase: implementation. Return done:true once status.yaml is written.${NOTIFY('Build verificado pero hardening INCOMPLETO — NO se declara release; necesita tu decision')}`,
      { label: 'close-needs-hardening', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
    log('Run ended: all FRDs verified but hardening incomplete — NOT released (needs-owner).')
  }
} else {
  const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]})`).slice(0, 8).join(', ') || 'ninguno'
  const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
    : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
    : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
    : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
    : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).' : ''
  const ownerMsg = needsOwner.length
    ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
    : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
  closed = await agent(`The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}. FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since) to confirm this pass left no global regression — note the result. Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). Set .pandacorp/status.yaml running: false. Return done:true once status.yaml is written.${NOTIFY(ownerMsg)}`,
    { label: 'notify-end', phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
  log(`Run ended: ${builtFrds.length} verified, ${reopenedFrds.length} reopened, ${blockedFrds.length} blocked${stopReason ? ' · stop=' + stopReason : ''}.`)
}
// Fail-safe: never leave Mission Control showing a phantom running build.
if (!closed || closed.done !== true) {
  agentSpawned++
  await agent(`Fail-safe close: ensure .pandacorp/status.yaml has running:false written. Do NOT touch \`phase\` — NEVER set phase: release here (BL-0012 fail-closed: the release transition happens ONLY in the hardening-gated close-out; this branch fires precisely when a close-out agent died, so nothing here is verified). Confirm done:true.`,
    { label: 'ensure-stopped', phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
}

return { mode: MODE, builtFrds, blockedFrds, reopenedFrds, blockedReasons, stopReason }
