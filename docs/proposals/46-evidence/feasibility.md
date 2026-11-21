# 46 · Code feasibility checks

**Date** 2026-11-21 · **Status** read-only source and filesystem observations.

Commands below ran from `/Users/Shared/Proyectos/panda-corp` with `GIT_OPTIONAL_LOCKS=0` and `LC_ALL=C`.
Paths and line numbers identify inputs. Outputs and counts are **MEASURED**. Feasibility inferences and proposed behavior are **ESTIMATED**. No verifier, queue, worktree bootstrap, test, build, install or Git write was executed.

## 1. Routing, single entry and design

The existing guide assigns cross-skill selection to the conversation. Procedure files are compatible with that rule and avoid a second runtime entry. Main paths are versioned, including the delegated lightweight design source and its commit before the run. The actual installed guides are sampled separately from the template.

```bash
git ls-files plugin/skills/implement
rg -n '^(name|user-invocable):|skills never invoke|never an owner command' plugin/skills/{implement,bug,iterate}/SKILL.md AGENTS.md | cut -c1-235
nl -ba plugin/templates/shared/.pandacorp/guide.md.tpl | sed -n '17p;27,43p'
rg -n 'skills never invoke|Parallel sessions|Batch integration' mission-control/.pandacorp/guide.md ../funko-tracker/.pandacorp/guide.md | cut -c1-220
```

```text
plugin/skills/implement/SKILL.md
plugin/skills/implement/references/autonomy.md
plugin/skills/implement/references/drive.md
plugin/skills/implement/references/engine-v2.md
plugin/skills/implement/references/incremental.md
plugin/skills/implement/references/rescue.md
plugin/skills/implement/references/shared-capacity.md
plugin/skills/iterate/SKILL.md:2:name: iterate
plugin/skills/iterate/SKILL.md:3:user-invocable: false
plugin/skills/iterate/SKILL.md:4:description: Internal incremental documentation contract for the selected implement scope. Specialists prepare minimum FRD, design-source, blueprint and work-order deltas on the integration branch; neve
plugin/skills/bug/SKILL.md:2:name: bug
plugin/skills/bug/SKILL.md:3:user-invocable: false
plugin/skills/implement/SKILL.md:2:name: implement
plugin/skills/implement/SKILL.md:31:The conversation selects skills using `.pandacorp/guide.md`; skills never invoke each
    17	By default, changes use the `/pandacorp:*` skills to maintain canonical documentation, decision history, work orders and verification. The conversation agent chooses the route; skills never invoke other skills. If the owner explicitly says "do it directly without Pandacorp", honor that route and keep documentation and verification proportional to the change. Production, money, deletion and external-communication gates still apply.
    27	**The agent routes automatically.** When the owner asks for a change, classify it and **invoke the right skill, telling them which one** — do not ask permission to enter the skill:
    28	
    29	| What the owner asks | Skill |
    30	|---|---|
    31	| UI whose design is already agreed in this conversation or exists in FDD/mocks/prototype | **`/pandacorp:implement`** implements and documents that source without redesigning it. Capture `ui: true`, `design_source: agreed\|existing`, `design_refs: [citations/paths]` and `design_decision_by: owner\|agent` in the scope card. |
    32	| Small UI change with no design, and "take care of everything" | The **conversation agent** invokes **`/pandacorp:design` in lightweight mode**, then **`/pandacorp:implement`**. Reuse DESIGN.md/tokens, produce only the affected FDD/mock delta and record the reversible decision as agent-made. Before starting the run, the conversation records that scoped documentation delta in a source-checkout commit and verifies the referenced files match HEAD; design itself never commits. Continue without owner visual approval. If routed to implement with `design_source: pending`, its run plans WOs with PM/architect first, then schedules design only for UI WOs missing an available source; independent backend work continues. Explicit WO UI classification wins over FRD UI, then artifact inference; card UI never classifies all units. |
    33	| Change without UI / fix / resume build | **`/pandacorp:implement`**, the single build entry. For a new non-UI card record `ui: false`, `design_source: not-applicable`. `iterate` and `bug` describe internal contracts, not additional owner build commands. |
    34	| "design this modal/section/page adjustment" | **`/pandacorp:design` lightweight mode**: scoped FDD/mock delta, no global gate, full freeze or project phase change. |
    35	| First design iteration / large visual redesign | **`/pandacorp:design` full mode**, retaining its visual gate and full handoff. The conversation subsequently chooses the next skill. |
    36	| "write it down" / "save this for later" | Write a **`status: draft`** card in `.pandacorp/inbox/changes/<slug>.md`, then validate it with `node <plugin>/scripts/pandacorp-build.mjs card check <path>`. Capture stops there; no automatic queue drain. |
    37	| "I decide X" (on a pending point) | `/pandacorp:decide` |
    38	| Large milestone beyond the current PRD | The conversation selects the appropriate milestone planning contract before construction. |
    39	| "do it directly without Pandacorp" | Work directly as requested; preserve the owner's existing scope, documentation and verification requirements. |
    40	
    41	The owner gives one request, not a chain of commands. A missing UI design source is explicit in the card, never permission for a builder to improvise visuals. Lightweight design records its source and decision author so the owner can iterate afterward.
    42	
    43	**Build execution.** Resolve `<plugin>` from the factory path above (`{{FACTORY_PATH}}/plugin`). The CLI owns governed transitions and commits tracked changes only on `lane/<run_id>/integration`; `.pandacorp/merge-queue.sh` is the only path to `main`. Workers use their active runtime. A launched project waits for the owner's explicit landing order. Never mix plugin versions in one project: after a plugin update, restart or close every session working on it.
../funko-tracker/.pandacorp/guide.md:17:By default, changes use the `/pandacorp:*` skills to maintain canonical documentation, decision history, work orders and verification. The conversation agent chooses the route; ski
../funko-tracker/.pandacorp/guide.md:49:**Parallel sessions — self-isolate in a worktree (DR-096).** The owner often runs **several conversations at once**, by hand, to advance things in parallel. Because the gate is w
../funko-tracker/.pandacorp/guide.md:82:**Batch integration (DR-141, MUST).** If several finished branches are waiting, each already independently verified, one landing session records their SHAs, owning changes and gree
mission-control/.pandacorp/guide.md:17:By default, changes use the `/pandacorp:*` skills to maintain canonical documentation, decision history, work orders and verification. The conversation agent chooses the route; skil
mission-control/.pandacorp/guide.md:49:**Parallel sessions — self-isolate in a worktree (DR-096).** The owner often runs **several conversations at once**, by hand, to advance things in parallel. Because the gate is wh
mission-control/.pandacorp/guide.md:82:**Batch integration (DR-141, MUST).** If several finished branches are waiting, each already independently verified, one landing session records their SHAs, owning changes and green
(exit 0)
```

## 2. Landing topology today

The queue rejects a call from the default branch. With a topic checked out in the physical primary checkout and no other checkout of the default, MAIN_WT is empty. With the default checked out in a different worktree, the physical primary topic is not explicitly rejected by these predicates, but the setup still uses two checkouts. The script derives the target, log root and project status from MAIN_WT. A same-checkout mode must resolve those correctly, preserve the default ref until after proof and preserve the existing checked-out-default path.

```bash
rg -n 'WORKTREE=|BRANCH=|COMMON_DIR=|MAIN_WT=|default branch is checked out|run this from the WORKTREE|this is the main checkout|could not locate the .*DEFAULT_BRANCH|QUEUE_PROJECT=|git fetch --quiet|git rebase |^main_busy\(|git -C .\$MAIN_WT. merge|QUEU.*SHA.*QUEU.*GATED_SHA' plugin/templates/shared/.pandacorp/merge-queue.sh
rg -n '^(phase|deploy_target):' mission-control/.pandacorp/status.yaml ../{funko-tracker,personal-page-v2}/.pandacorp/status.yaml
for p in mission-control ../funko-tracker ../personal-page-v2; do
  git -C "$p" rev-parse --show-toplevel --show-prefix
  for script in merge-queue green-stamp worktree-bootstrap; do
    cmp -s "plugin/templates/shared/.pandacorp/$script.sh" "$p/.pandacorp/$script.sh"
    printf '%s %s cmp=%s\n' "$p" "$script" "$?"
  done
  git -C "$p" worktree list --porcelain | awk '/^worktree / {n++} /^branch refs\/heads\/main$/ {m++} END {print "worktrees="n, "main_checked_out="m}'
done
```

```text
205:WORKTREE="$(git rev-parse --show-toplevel)"
206:BRANCH="$(git rev-parse --abbrev-ref HEAD)"
207:COMMON_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)"          # shared across ALL worktrees
208:DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || echo main)"
209:# The working tree where the default branch is checked out (where we ff-merge into).
210:MAIN_WT="$(git worktree list --porcelain | awk -v b="refs/heads/$DEFAULT_BRANCH" '
272:QUEUE_PROJECT=""
330:  QUEUE_PROJECT="${MAIN_WT}/${prefix}"; QUEUE_PROJECT="${QUEUE_PROJECT%/}"
448:[ "$BRANCH" = "$DEFAULT_BRANCH" ] && fail "run this from the WORKTREE branch, not $DEFAULT_BRANCH" 20
449:[ "$WORKTREE" = "$MAIN_WT" ] && fail "this is the main checkout, not a worktree" 20
451:[ -n "$MAIN_WT" ] || fail "could not locate the $DEFAULT_BRANCH checkout" 20
638:main_busy() {
677:git fetch --quiet "$MAIN_WT" "$DEFAULT_BRANCH" 2>/dev/null || true
696:if ! git rebase "$DEFAULT_BRANCH"; then
697:  git rebase --abort 2>/dev/null || true
912:if ! git merge-base --is-ancestor "$QUEUE_SHA" "$QUEUE_GATED_SHA"; then
916:if ! git -C "$MAIN_WT" merge --ff-only "$QUEUE_GATED_SHA" 2>/dev/null; then
919:  if ! git merge-base --is-ancestor "$QUEUE_SHA" "$QUEUE_GATED_SHA"; then
926:if [ "$QUEUE_SHA" != "$QUEUE_GATED_SHA" ]; then
957:  QUEUE_PUSH_SHA="$QUEUE_GATED_SHA"
../funko-tracker/.pandacorp/status.yaml:4:phase: release
../personal-page-v2/.pandacorp/status.yaml:4:phase: release
../personal-page-v2/.pandacorp/status.yaml:5:deploy_target: external  # internal | external (DR-085) — live on Vercel at https://toshiominei.com since the 2026-10-07 release
mission-control/.pandacorp/status.yaml:4:phase: implementation
mission-control/.pandacorp/status.yaml:10:deploy_target: internal  # internal tool served on the LAN without auth (owner decision 2026-10-12) — no external host (DR-085)
/Users/Shared/Proyectos/panda-corp
mission-control/
mission-control merge-queue cmp=0
mission-control green-stamp cmp=0
mission-control worktree-bootstrap cmp=0
worktrees=4 main_checked_out=1
/Users/Shared/Proyectos/funko-tracker

../funko-tracker merge-queue cmp=0
../funko-tracker green-stamp cmp=0
../funko-tracker worktree-bootstrap cmp=0
worktrees=36 main_checked_out=1
/Users/Shared/Proyectos/personal-page-v2

../personal-page-v2 merge-queue cmp=0
../personal-page-v2 green-stamp cmp=0
../personal-page-v2 worktree-bootstrap cmp=0
worktrees=2 main_checked_out=1
(exit 0)
```

## 3. Proof, release and publication

The stamp is checkout-input bound and has no default-branch prerequisite. Hidden index state or dirty required control files matter. An exact tree is only one input. Queued pre-push requires a live matching queue attempt or a documented terminal attempt and a checked-out default. Same-checkout queue must attach default before a launched push and keep valid process identity. DR-138 classification and scope order have independent inputs, and exit 13 is a local result plus unresolved publication. The lock wrapper does not certify. Base/diff review enforcement is an added guard, not an existing queue feature.

```bash
rg -n 'tree_is_clean|current_tree|MAX_AGE|^group\(|^    \[ .*now_tree|lock = os.open' plugin/templates/shared/.pandacorp/green-stamp.sh | cut -c1-225
rg -n 'QUEUE_GATED_SHA=|stamp_check|owner_release_ok|order_check|exit 21|already.*local|push result unknown|queue_event (ff|push)|QUEUE_ARCHIVED_REPORT' plugin/templates/shared/.pandacorp/merge-queue.sh | tail -29
rg -n 'MAIN_WT=|end.get|same|lock_acquired|process_identity|transferred|^  pushed_tree|PANDACORP_OWNER_RELEASE_OK|queue_proof .*stamp_proof' plugin/templates/shared/.pandacorp/hooks/pre-push | cut -c1-210
nl -ba plugin/templates/shared/.pandacorp/with-merge-lock.sh | sed -n '2,13p;23,29p'
rg -n 'ancestor|mqExit ===|landing_state|unknown' plugin/runtime/build/land/harvest.mjs | head -16
```

```text
23:MAX_AGE_S=43200
137:group('verify', ['.pandacorp/verify.sh', '.pandacorp/green-stamp.sh', '.pandacorp/vitest-policy.ts', '.pandacorp/test-gate-policy.mjs', '.pandacorp/test-exclusions.json', '.pandacorp/exclusion-owner.pub', '.pandacorp/gate
138:group('dependencies', ['node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml',
140:group('e2e', ['e2e', 'playwright.config.ts', '.pandacorp/run/lane.env', '.pandacorp/run/e2e-port', *Path('.').glob('.env*')])
171:current_tree() { git rev-parse --verify -q 'HEAD^{tree}' 2>/dev/null; }
174:tree_is_clean() {
187:    tree_is_clean || doubt "working tree not clean — this run cannot certify a tree"
188:    tree=$(current_tree) || doubt "not a git checkout"
199:    now_tree=$(current_tree) || doubt "not a git checkout"
200:    [ "$now_tree" = "$tree" ] || doubt "tree changed during the run — nothing certified"
201:    tree_is_clean || doubt "working tree not clean — nothing certified"
220:      [ "$age" -ge 0 ] && [ "$age" -le "$MAX_AGE_S" ] || doubt "original certificate expired"
245:lock = os.open('.pandacorp/run/verify.lock', os.O_RDWR | os.O_CREAT, 0o600)
269:    now_tree=$(current_tree) || doubt "not a git checkout"
270:    [ "$now_tree" = "$s_tree" ] || doubt "tree $now_tree is not the certified tree $s_tree"
271:    tree_is_clean || doubt "working tree not clean"
294:    [ "$age" -ge 0 ] && [ "$age" -le "$MAX_AGE_S" ] || doubt "stamp is ${age}s old (max ${MAX_AGE_S}s)"
25:# order the script stops at exit 21 with the branch ready; with it, it ff-merges AND pushes main.
343:  queue_event start head str "$head" launched json "$QUEUE_START_LAUNCHED" owner_release_ok json "$owner" pid json "$$" worktree str "$WORKTREE"
399:  QUEUE_ARCHIVED_REPORT=""
428:    QUEUE_ARCHIVED_REPORT="$target"
781:QUEUE_GATED_SHA=$(git rev-parse --verify 'HEAD^{commit}') || fail "cannot pin gated commit" 20
803:  stamp_check() {
814:  if [ -f ".pandacorp/green-stamp.sh" ] && stamp_check; then
815:    queue_event stamp_check result str match reason str "${stamp_note:0:1500}"
826:    queue_event stamp_check result str miss reason str "${QUEUE_STAMP_REASON:0:1500}"
851:    QUEUE_ARCHIVED_REPORT=""
853:    queue_event gate_end start_load json "$QUEUE_GATE_START_LOAD" rc json "$GATE_RC" duration_s json "$QUEUE_GATE_DURATION" report str "$QUEUE_ARCHIVED_REPORT"
879:    if ! stamp_check; then fail "green but uncertifiable: $stamp_note" 11; fi
892:queue_event order_check launched json "$LAUNCHED" order_present json "$QUEUE_ORDER_PRESENT"
898:  exit 21
913:  queue_event ff sha str "$QUEUE_SHA" result str failed
918:  queue_event ff sha str "$QUEUE_SHA" result str failed
927:  queue_event ff sha str "$QUEUE_SHA" result str failed
930:queue_event ff sha str "$QUEUE_SHA" result str ok
992:    queue_event push sha str "$QUEUE_PUSH_SHA" result str unknown
995:    [ "$QUEUE_REMOTE_SHA" = "$QUEUE_PUSH_SHA" ] || fail "push result unknown; origin/main could not confirm the gated sha — inspect the remote before retrying" 13
997:    queue_event push sha str "$QUEUE_PUSH_SHA" result str failed
1000:  queue_event push sha str "$QUEUE_PUSH_SHA" result str ok
8:# the same test as .pandacorp/merge-queue.sh) it requires PANDACORP_OWNER_RELEASE_OK=1 AND proof
13:# Honest limits: PANDACORP_OWNER_RELEASE_OK is a FLAG, not a secret. This hook stops an unprompted push
21:# run after the gate passes, with the same arguments and stdin.
41:  echo "pandacorp pre-push: this project is LAUNCHED, so its default branch is production. Do not push or delete it; ask the owner for an explicit order and re-run with PANDACORP_OWNER_RELEASE_OK=1." >&2
42:  echo "pandacorp pre-push: el proyecto esta LANZADO y su rama principal es produccion. Pide la orden explicita del dueno y repite con PANDACORP_OWNER_RELEASE_OK=1." >&2
87:# with its own start and either no end + the same live process identity and owned attempt lock, or end.exit 0/13 (13 permits
89:# The queue writes ff under its merge lock; the hook must not acquire that same lock and deadlock
118:            if end_index > max(matches) and type(end.get('exit')) is int and end['exit'] in (0, 13):
124:            acquired = [(i, r) for i, r in enumerate(rows) if r.get('event') == 'lock_acquired']
134:            token, identity, proof_name = locked.get('lock_token'), start.get('process_identity'), start.get('process_proof')
137:                    or owner.get('pid') != pid or owner.get('process_identity') != identity
173:  pushed_tree=$(git rev-parse --verify "$2^{tree}" 2>/dev/null) || exit 1
207:  MAIN_WT=$(git worktree list --porcelain 2>/dev/null | awk -v b="refs/heads/$DEFAULT" '
237:        [ "${PANDACORP_OWNER_RELEASE_OK:-}" = 1 ] || deny "$ACTION rejected for $project."
242:          queue_proof "$PROOF_ROOT" "$local_sha" || stamp_proof "$PROOF_ROOT" "$local_sha"
     2	# Serialize direct-main writers with the queue (DR-096/DR-165). The queue owns the
     3	# shared protocol; the factory copy resolves it from templates, the overlay locally.
     4	set -euo pipefail
     5	HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
     6	LIB="$HERE/merge-queue.sh"
     7	[ -f "$LIB" ] || LIB="$HERE/../templates/shared/.pandacorp/merge-queue.sh"
     8	source "$LIB" --lock-library
     9	[ "$#" -gt 0 ] || { echo 'usage: with-merge-lock.sh <command...>' >&2; exit 20; }
    10	COMMON_DIR=$(cd "$(git rev-parse --git-common-dir)" && pwd)
    11	WORKTREE=$(git rev-parse --show-toplevel)
    12	BRANCH=$(git rev-parse --abbrev-ref HEAD)
    13	QUEUE_LOG="$PWD/.pandacorp/run/queue-log.jsonl"
    23	trap cleanup_merge_lock EXIT
    24	trap 'exit 143' TERM
    25	trap 'exit 130' INT
    26	trap 'exit 129' HUP
    27	acquire
    28	start_lock_refresh
    29	"$@"
56:  const contained = await git(d, root, ["merge-base", "--is-ancestor", branch, defaultBranch]);
63:  let next = { ...await moveUnits(ctx, state, batch.landable, "landed", { waiting_gate: null }), landing_state: mqExit === 0 ? "landed" : "implemented-uncertified" };
65:  const notes = mqExit === 13 ? "El aterrizaje llegó a main pero el push falló o no pudo confirmarse: revisa origin/main antes de reintentar." : null;
70:    const pinned = await git(d, root, ["merge-base", "--is-ancestor", where.lastGreen, defaultBranch]);
158:  return { state: next, output: { result: "waiting_gate", landing_state: "certified-awaiting-order", reason: null, mq_exit: 21, sha: null,
215:  return { exit: applied.exit, output: { ok:true, cmd:"land", ...applied.output, landing_state:applied.state.landing_state, attended:true } };
276:    const contained = await git(d, root, ["merge-base", "--is-ancestor", branch, await defaultBranchOf(d, root)]);
280:  const environmentRetry = mqExit === 16 && prepared.bootstrap?.code === 0;
281:  const environmentBudget = mqExit === 16 ? { environment_retry_sha: prepared.environmentTip, environment_retry_exhausted: !environmentRetry } : {};
282:  const finished = { ...job, ...environmentBudget, state: polled.state === "dead" && mqExit === null ? "dead" : "done", exit: mqExit };
284:  state = { ...upsertJob(state, finished), landing_state: mqExit === 21 ? "certified-awaiting-order" : "implemented-uncertified" };
286:  if (mqExit === null && polled.state === "dead") {
295:  if (mqExit === 20 && previous?.exit === 20) {
303:    else if (mqExit === 11) applied = await onGateRed(ctx, state, job, prepared.plan, d);
304:    else if (mqExit === 21) applied = await onGate(ctx, state);
306:      if (mqExit === 16) {
(exit 0)
```

## 4. Lease, live sessions and Stop

A build lease is keyed by the project path supplied to build-state, with a mutation mutex and token/epoch. A directory appearing empty or a stale relay is insufficient to grant worktree-free mutation. The queue lock is repo-common but held for integration and direct-main commands, not agent edits. Session cleanup and tool events supply evidence, not authorization to steal. Today Stop uses historical touched/dirty signals and treats busy as blocking. It needs turn-local attribution, queue-proof independence, and a skip/defer on contention. Keep unknown or owned actual reds visible.

```bash
rg -n 'leaseDir:|processStartMs|currentLease =|isFresh =|assertFence =|unreadable/orphan|async function acquire\(' plugin/runtime/build-state.mjs | cut -c1-250
rg -n 'pandacorp-merge.guard|pathname|pandacorp-merge.lock|start_lock_refresh' plugin/templates/shared/.pandacorp/merge-queue.sh | head -15
rg -n 'git-common-dir|ancestry, status' plugin/scripts/session-cleanup.mjs
rg -n 'isolation nudge|\.touched|Isolation reminder|worktree list' plugin/scripts/warn-adhoc-write.sh
rg -n 'stop_hook_active|lease=|green-stamp.sh.*check|touched=|dirty_raw=|verify_rc.*75|foreign=1' plugin/scripts/verify-before-stop.sh
rg -n 'max|slot|flock' plugin/runtime/build/admission/{constants,hostSlots}.mjs | cut -c1-190 | head -17
```

```text
18:  return { run, leaseDir: path.join(run, "build.lease"), lease: path.join(run, "build.lease", "lease.json"), epoch: path.join(run, "lease-epoch"), mutex: path.join(run, "lease-mutation.lock"), buildDir: path.join(run, "build"), tokenFile: path.joi
61:const processStartMs = async (pid) => {
87:  const started = await processStartMs(pid);
212:export const currentLease = async (project) => { try { return await parseJson(paths(project).lease); } catch { return null; } };
213:export const isFresh = (lease, now = leaseNowMs()) => Boolean(lease && Number.isFinite(Date.parse(lease.renewed_at)) && now - Date.parse(lease.renewed_at) < lease.ttl_seconds * 1000);
225:export const assertFence = async (project, token, epoch, { allowQuiesced = false } = {}) => {
241:    // An unreadable/orphan lease directory is still owned, never permission to clean.
272:export async function acquire(project, options) { const p = await assertSafeLayout(project, { allowMissingRun: true }); await mkdir(p.run, { recursive: true }); await assertSafeLayout(project); return withMutex(p.mutex, () => acquireUnlocked(proj
37:lock = os.path.join(common, 'pandacorp-merge.lock')
67:with open(os.path.join(common, 'pandacorp-merge.guard'), 'a') as guard:
152:start_lock_refresh() {
454:LOCK="$COMMON_DIR/pandacorp-merge.lock"
629:start_lock_refresh
35:  const common = real(git(repoRoot, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
104:      // Rescan EACH target immediately before removal, including ancestry, status, owner state, lsof and locks.
3:# isolation nudge (DR-096/099).
8:#   2. Isolation reminder (DR-096) + session attribution (DR-099) — don't leave WIP in the
46:  mkdir -p "$tdir" 2>/dev/null && printf '%s\n' "$file" >> "$tdir/$sid.touched" 2>/dev/null
57:    mkdir -p "$tdir" 2>/dev/null && printf '%s\n' "$pfile" >> "$tdir/$sid.touched" 2>/dev/null
84:# edit does, so they must keep the isolation nudge instead of falling into the prose exemption
114:# Isolation reminder (DR-096/099, producer side): editing code directly in the SHARED main checkout
149:      isolation_msg="Isolation reminder (DR-096): you are editing in the SHARED main checkout (not a worktree), outside a build. For a NON-TRIVIAL change, isolate FIRST — call EnterWorktree, edit there, and $land_hint. Uncommitted WIP left in the shared checkout REDs other parallel sessions' gates (this is exactly the failure that blocked a merge in a sibling session). Micro-edits (typo/comment/local config) may stay in-tree."
27:stop_active=$(echo "$input" | jq -r '.stop_hook_active // false')
38:lease="$cwd/.pandacorp/run/build.lease/lease.json"
107:# to the main checkout by merge-queue when it lands. green-stamp.sh check is the only judge: same
109:if [ -f "$cwd/.pandacorp/green-stamp.sh" ] && stamp_note=$(cd "$cwd" && bash .pandacorp/green-stamp.sh check 2>/dev/null); then
125:touched="$cwd/.pandacorp/run/sessions/$sid.touched"
251:if [ "$verify_rc" -eq 75 ]; then
264:  touched="$cwd/.pandacorp/run/sessions/$sid.touched"
265:  dirty_raw=$(git -C "$cwd" status --porcelain 2>/dev/null)
293:      foreign=1   # none of MY edits are implicated, and there IS foreign evidence to blame → foreign red
plugin/runtime/build/admission/hostSlots.mjs:1:// Host heavy-tool slots (A1), the same protocol as merge-queue.sh (split from admission.mjs).
plugin/runtime/build/admission/hostSlots.mjs:11:/** `<host>/h-slots`. */
plugin/runtime/build/admission/hostSlots.mjs:12:export const hSlotsDir = (host = hostDir()) => path.join(host, 'h-slots')
plugin/runtime/build/admission/hostSlots.mjs:19:function readOwner(fs, slot) {
plugin/runtime/build/admission/hostSlots.mjs:21:    const o = JSON.parse(fs.readFileSync(path.join(slot, 'owner.json'), 'utf8'))
plugin/runtime/build/admission/hostSlots.mjs:26:/** A slot is stale when its owner pid fails `kill -0`, or it has no owner.json and its mtime is older than 60 s. */
plugin/runtime/build/admission/hostSlots.mjs:27:function isStaleSlot(fs, slot, nowMs, isAlive, graceMs) {
plugin/runtime/build/admission/hostSlots.mjs:28:  const owner = readOwner(fs, slot)
plugin/runtime/build/admission/hostSlots.mjs:30:  try { return nowMs - fs.statSync(slot).mtimeMs > graceMs } catch { return false }
plugin/runtime/build/admission/hostSlots.mjs:34: * Removes a slot directory atomically: `rename` to a unique tomb (only one racer wins the rename; a loser sees ENOENT and
plugin/runtime/build/admission/hostSlots.mjs:35: * touches nothing, so a slot a faster waiter just re-took is never deleted), then removes the tomb.
plugin/runtime/build/admission/hostSlots.mjs:37:function removeSlot(fs, slot, expected, allowed) {
plugin/runtime/build/admission/hostSlots.mjs:38:  const tomb = `${slot}.tomb-${randomUUID()}`
plugin/runtime/build/admission/hostSlots.mjs:40:    const stat = fs.statSync(slot)
plugin/runtime/build/admission/hostSlots.mjs:42:    fs.renameSync(slot, tomb)
plugin/runtime/build/admission/hostSlots.mjs:50:    if (!fs.existsSync(slot)) fs.renameSync(tomb, slot)
plugin/runtime/build/admission/hostSlots.mjs:57:function underAdmission(slots, fs, timeoutMs, busyValue, body) {
(exit 0)
```

## 5. Home worktrees, dependency and runtime cost

du reports traversed blocks in KiB, with shared file and APFS clone caveats. The sample is a filesystem snapshot without a before/after allocation baseline or RAM benchmark. The store identified below is on the same device as the Funko checkout. Bootstrap uses local node_modules over pnpm's shared store, caches installs by lock hash and isolates local build outputs, port and fixture setup. A top-level node_modules symlink would share mutable metadata and path-sensitive tooling. Reuse store content, keep each checkout's node_modules view and .next, and benchmark a compatible recipe before changing it. Existing runtime Next artifacts may be cold, absent or cleared. The queue uses a separate stronger install identity, so skipping bootstrap alone does not guarantee no install.

```bash
for t in ../funko-tracker/.pandacorp/run/build/wt/{u-docs-catalog-line-scope-a2,u-tests-wo-06-010,u-tests-wo-06-010-a2} ../panda-corp-wt-ci ../personal-page-v2/.claude/worktrees/gallant-sanderson-f04745; do
  p="$t"; [[ "$t" != *panda-corp-wt-ci ]] || p="$t/mission-control"
  for d in "$p/node_modules" "$p/.next" "$t"; do
    if [[ -d "$d" ]]; then du -sk "$d"; else printf 'missing %s\n' "$d"; fi
  done
done
stat -f '%d %N' ../funko-tracker /Users/sergio/Library/pnpm/store
rg -n 'never symlink|APP_DIR/node_modules|pnpm install|FS_AVAIL|15%|\.env.local|per-project hook|worktrees/|PRIVATE_PORT_FILE|--e2e-port-only' plugin/templates/shared/.pandacorp/worktree-bootstrap.sh | cut -c1-190
rg -n 'dependency_identity|frozen-lockfile|npm ci|next typegen|--e2e-port-only' plugin/templates/shared/.pandacorp/merge-queue.sh
```

```text
1213300	../funko-tracker/.pandacorp/run/build/wt/u-docs-catalog-line-scope-a2/node_modules
52	../funko-tracker/.pandacorp/run/build/wt/u-docs-catalog-line-scope-a2/.next
1907772	../funko-tracker/.pandacorp/run/build/wt/u-docs-catalog-line-scope-a2
1213276	../funko-tracker/.pandacorp/run/build/wt/u-tests-wo-06-010/node_modules
52	../funko-tracker/.pandacorp/run/build/wt/u-tests-wo-06-010/.next
1907748	../funko-tracker/.pandacorp/run/build/wt/u-tests-wo-06-010
1213276	../funko-tracker/.pandacorp/run/build/wt/u-tests-wo-06-010-a2/node_modules
0	../funko-tracker/.pandacorp/run/build/wt/u-tests-wo-06-010-a2/.next
1907692	../funko-tracker/.pandacorp/run/build/wt/u-tests-wo-06-010-a2
883516	../panda-corp-wt-ci/mission-control/node_modules
missing ../panda-corp-wt-ci/mission-control/.next
1306328	../panda-corp-wt-ci
686724	../personal-page-v2/.claude/worktrees/gallant-sanderson-f04745/node_modules
0	../personal-page-v2/.claude/worktrees/gallant-sanderson-f04745/.next
722144	../personal-page-v2/.claude/worktrees/gallant-sanderson-f04745
16777234 ../funko-tracker
16777234 /Users/sergio/Library/pnpm/store
8:# with its own state (a DB) adds the heavy bit in the per-project hook `.pandacorp/worktree-setup.sh`.
13:[ "${1:-}" != "--e2e-port-only" ] || PORT_ONLY=1
28:BOOTSTRAP_MANIFEST="$MAIN_WT/.pandacorp/run/worktrees/bootstrap-$BOOTSTRAP_ID.json"
126:# ── 1. Dependencies — APFS clones from the shared store (never symlink node_modules; .next stays local) ─
139:  LOCK_MARKER="$APP_DIR/node_modules/.pandacorp-lock-sha"
142:  if [ -d "$APP_DIR/node_modules" ] && [ -n "$LOCK_SHA" ] && [ -f "$LOCK_MARKER" ] && [ "$(cat "$LOCK_MARKER" 2>/dev/null)" = "$LOCK_SHA" ]; then
143:    echo "  • pnpm install skipped ($APP_DIR/node_modules present, pnpm-lock.yaml unchanged)"
160:    echo "  • pnpm install ($APP_DIR, clones APFS desde el almacén global)"
163:      if ! pnpm install --offline --frozen-lockfile >/dev/null 2>&1; then
164:        if ! pnpm install --prefer-offline --frozen-lockfile; then
166:            pnpm install
175:    MODULES_KB="$(du -sk "$APP_DIR/node_modules" 2>/dev/null | awk '{print $1}')" || MODULES_KB=0
177:      echo "Aviso: la instalación consumió más del 15% de du node_modules; pnpm podría estar copiando en vez de clonar. Revisa el volumen del almacén." >&2
182:    [ -z "$LOCK_SHA" ] || { mkdir -p "$APP_DIR/node_modules"; echo "$LOCK_SHA" > "$LOCK_MARKER"; }
192:  PRIVATE_PORT_FILE="$APP_DIR/.pandacorp/run/e2e-port"
193:  [ ! -L "$PRIVATE_PORT_FILE" ] || { echo "Invalid symlink e2e port" >&2; exit 3; }
195:  if [ ! -e "$PRIVATE_PORT_FILE" ] || bootstrap_owned_input "$PRIVATE_PORT_FILE"; then
203:  elif [ -f "$PRIVATE_PORT_FILE" ]; then
206:    E2E_PORT="$(cat "$PRIVATE_PORT_FILE")"
229:  if [ ! -f "$PRIVATE_PORT_FILE" ] || [ "$(cat "$PRIVATE_PORT_FILE")" != "$E2E_PORT" ]; then
230:    printf '%s\n' "$E2E_PORT" > "$PRIVATE_PORT_FILE"
233:  [ "$PRIVATE_PORT_PROVEN" != 1 ] || bootstrap_record_output "$PRIVATE_PORT_FILE"
245:#   the onboarding gate. Write a worktree-local .env.local pointing at a factory checkout instead.
263:  { [ ! -e "$APP_DIR/.env.local" ] && [ ! -L "$APP_DIR/.env.local" ]; } || bootstrap_owned_input "$APP_DIR/.env.local";
265:  echo "  • PANDACORP_FACTORY_ROOT → $WORKTREE ($APP_DIR/.env.local, gitignored, BL-0160: this worktree's own nested factory)"
266:  echo "PANDACORP_FACTORY_ROOT=$WORKTREE" > "$APP_DIR/.env.local"
267:  bootstrap_record_output "$APP_DIR/.env.local"
269:    cleanup_env_rel="${APP_DIR#"$WORKTREE"/}/.env.local"
270:    [ "$APP_DIR" != "$WORKTREE" ] || cleanup_env_rel=".env.local"
716:dependency_identity() {
741:  if ! dependency_identity check; then
744:      pnpm install --frozen-lockfile || environment_not_ready "pnpm install failed"
747:      npm ci || environment_not_ready "npm ci failed"
749:    dependency_identity record || environment_not_ready "cannot record dependency installation identity"
771:  node_modules/.bin/next typegen || environment_not_ready "next typegen failed"
776:  bash .pandacorp/worktree-bootstrap.sh --e2e-port-only || environment_not_ready "cannot prepare private e2e port"
(exit 0)
```

## 6. Parallel resources and current dispatch topology

Source paths, index, servers, generated output and mutable fixtures are different conflicts. Bootstrap source shows why existing port discovery is a hint rather than a reservation. Funko deliberately fixes an origin used by its fixture identities, so two worktrees alone do not make its browser proofs parallel. Mission Control's internal production fixture is per slot. Keep shell/database test lane leases and the existing shared host counters for heavy proof when a helper can participate. Current engine creates an integration checkout plus worker/snapshot worktrees, which the new procedures avoid for serial work.

```bash
rg -n 'worktree|bootstrap' plugin/runtime/build/lifecycle/start.mjs | cut -c1-180 | tail -13
rg -n 'worktree|--light' plugin/runtime/build/units/worktrees.mjs | cut -c1-195 | tail -15
rg -n 'collision|nothing answers|E2E_PORT_FILE|e2e-port' plugin/templates/shared/.pandacorp/worktree-bootstrap.sh | cut -c1-190 | tail -13
rg -n 'shared gate DB|:4037|NEX[Tt]|HOST_SLOT|COMMITTED_PORT' plugin/templates/shared/.pandacorp/merge-queue.sh | cut -c1-210 | tail -16
rg -n 'PORT|next|slot' ../funko-tracker/e2e/prod-server.mjs mission-control/e2e/prod-server.mjs | cut -c1-170 | tail -18
```

```text
1:// `start --run`: take the lease, create the run, its integration worktree and its first units.
51:async function rollbackStart({ project, p, runId, lease, branch, worktree, markedCard }, d) {
55:  await soft(() => removeWorktree({ project, runId, worktree }, d));
63: * `start --run`: take the lease, create the run, its integration worktree and its first units, apply the owner's answers,
100:  const ctx = { project, p, runId, lease, branch, worktree: p.integrationWorktree, markedCard: null };
104:    const root = path.resolve(productRoot(created.worktree, prefix));
112:      scope: { ...scope, out_of_scope: [] }, integration: { branch, worktree: root, base_sha: created.base_sha },
140:    return { run_id: runId, epoch: lease.epoch, integration: { branch, worktree: root }, drive, prepush, ...(warning ? { warnings: [warning] } : {}) };
224:    await git(deps, worktree, ["sparse-checkout", "set", "--cone", "--", ...directories]);
226:    const light = await runnerOf(deps)("bash", [".pandacorp/verify.sh", "--light"], { cwd: root, env: deps.env, timeout: BOOTSTRAP_TIMEOUT_MS });
227:    if (light.code !== 0) throw new Error(`verify.sh --light exited ${light.code}`);
231:    await git(deps, worktree, ["sparse-checkout", "disable"]);
237: * Create (or adopt) the unit worktree of one attempt: {@link prepareUnitWorktree} with the unit given as an object.
240: * @returns {Promise<{worktree: string, root: string, branch: string, base_sha: string, created: boolean, bootstrap: object}>}
248: * BL-0323: put a review-type unit's worktree exactly at `sha` (the end of the diff range its brief names) before the
252: * @param {{project: string, runId: string, worktree: string, sha: string}} input
256:export async function pinReviewWorktree({ project, runId, worktree, sha }, deps = {}) {
258:  const head = async () => (await git(deps, worktree, ["rev-parse", "HEAD"])).stdout.trim();
259:  const target = (await git(deps, worktree, ["rev-parse", "--verify", `${sha}^{commit}`])).stdout.trim();
263:  const own = (await git(deps, worktree, ["merge-base", "--is-ancestor", before, integration], { allowFail: true })).code === 0;
264:  if (!own) throw err("INVALID_STATE", `review worktree ${worktree} holds commits outside ${integration}; it cannot be moved to ${target}`);
265:  await git(deps, worktree, ["reset", "--quiet", "--keep", target]);
267:  if (after !== target) throw err("INVALID_STATE", `review worktree ${worktree} is at ${after}, not the review pin ${target}`);
13:[ "${1:-}" != "--e2e-port-only" ] || PORT_ONLY=1
192:  PRIVATE_PORT_FILE="$APP_DIR/.pandacorp/run/e2e-port"
213:    # Free-port probe: a hash collision between two worktrees (or a leftover listener) must not wedge
215:    # at the first port nothing answers on. An exhausted range falls back to the deterministic
234:  echo "  • .pandacorp/run/e2e-port → $E2E_PORT (worktree-private)"
589:      export PANDACORP_HOST_SLOT_TOKEN="$inherited"
595:    [ "$((SECONDS - slot_started))" -lt "${PANDACORP_HOST_SLOT_TIMEOUT_SECS:-600}" ] || environment_not_ready "host slot wait timed out"
596:    sleep "${PANDACORP_HOST_SLOT_POLL_SECS:-5}"
607:  unset PANDACORP_HOST_SLOT_TOKEN
786:# :4037 media identities (localFixture); a per-worktree DB was rejected by the owner. This queue's
787:# shared lock serializes integration gates, so the shared gate DB never sees two gates at once.
793:  export PANDACORP_E2E_COMMITTED_PORT=1
794:  COMMITTED_PORT="$(jq -r '.PORT|tostring' e2e/server-env.json)"
830:    if [ -n "${COMMITTED_PORT:-}" ]; then
833:      if (exec 3<>"/dev/tcp/127.0.0.1/$COMMITTED_PORT") 2>/dev/null; then
834:        fail "committed e2e PORT :$COMMITTED_PORT is busy — stop the dev server / other gate on :$COMMITTED_PORT, then re-run" 14
mission-control/e2e/prod-server.mjs:16:const slot = action === "start" && process.argv.length > 4 ? process.argv[5] : undefined;
mission-control/e2e/prod-server.mjs:20:  (process.argv[4] !== "--slot" ||
mission-control/e2e/prod-server.mjs:22:    !/^\d+$/.test(slot ?? "") ||
mission-control/e2e/prod-server.mjs:23:    !Number.isSafeInteger(Number(slot)))
mission-control/e2e/prod-server.mjs:25:  throw new Error("Invalid slot index");
mission-control/e2e/prod-server.mjs:26:const slotRoot = slot === undefined ? undefined : path.resolve("test-results/e2e-slots", slot);
mission-control/e2e/prod-server.mjs:34:        throw new Error(`Fixture slots cannot contain symbolic links: ${current}`);
mission-control/e2e/prod-server.mjs:43:if (slotRoot) {
mission-control/e2e/prod-server.mjs:53:  rejectSymlinks(slotRoot);
mission-control/e2e/prod-server.mjs:55:  fs.rmSync(slotRoot, { recursive: true, force: true });
mission-control/e2e/prod-server.mjs:59:    const target = path.join(slotRoot, path.relative("e2e", file));
mission-control/e2e/prod-server.mjs:67:  const value = key === "PORT" ? String(raw) : raw;
mission-control/e2e/prod-server.mjs:69:  if (slotRoot && value.startsWith("./e2e/")) {
mission-control/e2e/prod-server.mjs:72:    fixtureEnv[key] = path.join(slotRoot, value.slice("./e2e/".length));
mission-control/e2e/prod-server.mjs:78:    path.resolve("node_modules/next/dist/bin/next"),
../funko-tracker/e2e/prod-server.mjs:4:import { e2eFixtureEnvironment, PORT, ROOT, SERVER_ENV } from "../scripts/fidelity/config.mjs";
../funko-tracker/e2e/prod-server.mjs:20:} else if (command === "start" && Number(port) === PORT) {
../funko-tracker/e2e/prod-server.mjs:23:    ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)],
(exit 0)
```

## 7. Verify contract, independent tests and honest WO state

Initial start sends card type, while the next planner round omits it. Passing the current card design object alone cannot feed the independent-tests predicate. The replacement pins original case type and protects regression authorship across route changes. G1 and G2 are existing behaviors to supersede explicitly in the live procedure. Landing writes VERIFIED and the status projection before executing queue, in the candidate branch. Expose IN_REVIEW/review pass and queue/publication receipts distinctly. Inert prose needs an allowlist and a semantic diff fence. The marker grep is a literal match in the verifier.

```bash
rg -n 'cardType:|card_type:' plugin/runtime/build/lifecycle/{start,plan}.mjs plugin/runtime/build/next/planning.mjs
sed -n '94,99{=;p;}' plugin/runtime/build/next/planning.mjs
rg -n 'cardType|bug_card|new_acs' plugin/runtime/build/planner/{model,units}.mjs
rg -n -- '--light|testFiles.length|classifyRed|const problems|reported.add' plugin/runtime/build/report.mjs | head -21
rg -n -- '--since|snapshot|enqueued' plugin/runtime/build/next/{constants,g2}.mjs | cut -c1-180 | head -24
rg -n 'IN_REVIEW|VERIFIED|last_green_sha|Change:|RELEASE_VAR|MERGE_QUEUE' plugin/runtime/build/land/command.mjs | head -24
rg -n 'NEEDS CLARIFICATION|--affected|production build|run_cheap_gate doc-lint' plugin/templates/stack-a-nextjs/verify.sh | cut -c1-180 | tail -17
rg -n 'page.on|status\(|page.goto|toBeVisible|console' ../funko-tracker/e2e/smoke.spec.ts mission-control/e2e/smoke.spec.ts
```

```text
plugin/runtime/build/lifecycle/start.mjs:119:    const { input: pin } = await planInput({ project, root, state, scope: state.scope, questions, cardType: taken.card?.type, params: { sessionModel: input.sessionModel } }, d);
plugin/runtime/build/lifecycle/plan.mjs:18:      questions, card_type: cardType ?? null, shape: state ? shapeOf(state) : undefined, coordinator: state?.coordinator, session_model: params?.sessionModel ?? null,
94
  const questions = [...(await readQuestions(run)).values()].filter((q) => !(q.id in (state.answers ?? {})));
95
  const params = await readRunParams(run);
96
  const plan = await (await sibling(d, "planner", "plan"))({
97
    design, visual_files: read?.visual_files, wos, frd_acs: read?.frd_acs ?? {}, scope: state.scope, units: state.units, label: state.label, size: state.size,
98
    questions, quota: pol, shape: shapeOf(state), coordinator: state.coordinator, session_model: params.sessionModel,
99
  }, d);
plugin/runtime/build/planner/units.mjs:67:  const reason = m.cardType === "bug" ? "bug_card" : zone !== "none" && newAcs.length > 0 ? "new_acs" : null;
plugin/runtime/build/planner/units.mjs:80:    sim.meta[unit.id] = { artifacts: owned, barrier, downstream, new_acs: newAcs, tests_first: reason, cut: kind === "build" ? cut : null, floor_waived: waived, existing: false };
plugin/runtime/build/planner/units.mjs:101:      reason === "bug_card" ? "tests first: bug card" : `tests first: ${zone} zone adds ${newAcs.join(", ")}`);
plugin/runtime/build/planner/model.mjs:107:    initialVerified: verified, floorFrds, frdAcs, cardType: input.card_type ?? null, ceiling,
75:export function classifyRed(output) {
127:  const problems = [];
167: * G1 (D7): `bash .pandacorp/verify.sh --light [--tests=<files>]` in the unit worktree, no e2e.
174:  const args = [".pandacorp/verify.sh", "--light", ...(testFiles.length ? [`--tests=${testFiles.join(",")}`] : [])];
185:  if (!testFiles.length) return { ok: false, why: "a tests unit must add or change test files", g1: null };
189:  const kind = classifyRed(red.output);
258:    if (rel === null) reasons.push(`${f}: not a repository-relative path`); else reported.add(rel);
270:  const problems = await checkChanges({ unit, artifacts, changes, hashed: intent.hashed, root, base, card: intent.card, claimed: intent.claimed, targets: intent.targets, deps });
294:    if (unit.test_repair && g1.exit !== 0 && !g1.timed_out && classifyRed(g1.output) === "assertion") {
plugin/runtime/build/next/g2.mjs:1:// G2 snapshot worktrees (B5): every G2 job judges its own detached checkout of a pinned integration sha; the
plugin/runtime/build/next/g2.mjs:25:/** The snapshot directory and pinned sha of a G2 job, read back from its `cwd`; null for a job with no snapshot. */
plugin/runtime/build/next/g2.mjs:57: * Create the detached snapshot worktree of one G2 job at the integration tip (work phase, no mutex). A leftover at the same
plugin/runtime/build/next/g2.mjs:59: * @returns {Promise<{dir: string, cwd: string, sha: string}>} `cwd` is the product root inside the snapshot (nested projects)
plugin/runtime/build/next/g2.mjs:76: * Remove one registered G2 snapshot through the shared ownership and safety checks. Unregistered directories stay
plugin/runtime/build/next/g2.mjs:85:      if (strict) throw err("INVALID_STATE", `G2 snapshot is protected: ${result.reason ?? "unregistered-path"}`);
plugin/runtime/build/next/g2.mjs:91:    run.d.log(`next: the G2 snapshot ${dir} could not be removed: ${error?.message ?? error}`);
plugin/runtime/build/next/g2.mjs:96: * Remove every G2 snapshot of the run (`<build>/g2/*`) and its bootstrap manifest entry, except (unless `all`) the snapshot
plugin/runtime/build/next/g2.mjs:98: * actions, `stop`), finishes, and on `start --resume` (leftovers of a crash between a snapshot and its job). Never runs
plugin/runtime/build/next/g2.mjs:107:  if (state.status === "active" && epoch === null) throw err("FENCE", "La limpieza de snapshots activos requiere su epoch.");
plugin/runtime/build/next/g2.mjs:132:    d.log(`next: the G2 snapshots under ${root} could not be cleaned: ${error?.message ?? error}`);
plugin/runtime/build/next/g2.mjs:139:const g2FailuresFile = (paths) => path.join(paths.build, "g2-snapshot-failures.json");
plugin/runtime/build/next/g2.mjs:141:/** `{<frd>: consecutive failed snapshot passes}`, persisted under `<build>/` (untracked) because every `next` call is a new process. */
plugin/runtime/build/next/g2.mjs:152:/** Reset the counter of the FRDs whose snapshot was made and add one to the failed ones; returns the counts of the failed FRDs. */
plugin/runtime/build/next/g2.mjs:164: * G2 snapshot has failed `G2_SNAPSHOT_FAIL_MAX` passes in a row, and reset its counter.
plugin/runtime/build/next/g2.mjs:165: * @returns {Promise<string[]>} the FRDs that are still retrying (their snapshot failed fewer times)
plugin/runtime/build/next/g2.mjs:178:      run.d.log(`next: G2 snapshot of ${frd} failed ${G2_SNAPSHOT_FAIL_MAX} times and the FRD has no integrated unit left to hand back`);
plugin/runtime/build/next/constants.mjs:1:// Constants of the `next` scheduler (CLI doc section 4, BUILD-7 constants): action names, retry delays, G2 snapshot
plugin/runtime/build/next/constants.mjs:16:// G2 snapshot worktrees (B5): `<build>/g2/<frd>-<pinned sha>`, one per job, never the integration worktree itself.
plugin/runtime/build/next/constants.mjs:19:/** Consecutive passes a G2 snapshot may fail to be created before the FRD is handed back as an environment failure (NB2). */
plugin/runtime/build/next/constants.mjs:23:/** Exit code of a G2 job whose snapshot could not be bootstrapped (`worktree-bootstrap.sh` failed): no verdict, env-infra. */
plugin/runtime/build/next/constants.mjs:26:// The G2 job body: bootstrap the fresh snapshot (deps are not tracked), then the gate. argv: $0 label, $1 integration base sha.
plugin/runtime/build/next/constants.mjs:34:exec bash .pandacorp/verify.sh --since "$1"`;
plugin/runtime/build/next/constants.mjs:71:  "jobs.startJob": "({project, epoch, actor, kind: 'g2', cmd, cwd, frd, unit: null}, deps) -> jobs[] item (fenced; records the job; cwd =
9:  MERGE_QUEUE, OUTPUT_TAIL_BYTES, RELEASE_VAR, WO_KINDS, assertCleanWorktree, defaultBranchOf, dropLandingMetadata, emitQueueReady, err, git, gitOk, landingCodeTip,
25:  const script = await d.fs.stat(path.join(root, MERGE_QUEUE)).catch(() => null);
26:  if (!script?.isFile()) throw err("INVALID_STATE", `the project has no ${MERGE_QUEUE} in the integration worktree (run /pandacorp:upgrade)`);
77:/** Write the landing metadata into the integration worktree (WO VERIFIED, status pin) and commit it. Returns the commit sha. */
86:    if (wo.status === "VERIFIED") continue;
87:    if (wo.status !== "IN_REVIEW") throw err("INVALID_STATE", `work order ${id} is ${wo.status}, expected IN_REVIEW before landing`);
88:    await transition(root, { file: wo.file, to: "VERIFIED", reason: "landing" });
93:  const updates = { last_green_sha: tip, safe_to_test: true };
96:  const trailers = [markerLine(runId), ...(slug ? [`Change: ${slug}`] : [])].join("\n");
99:    "-m", `Marks ${verified} work order(s) VERIFIED and pins last_green_sha to the code tip below this commit.`, "-m", trailers], "commit");
105:  delete jobEnv[RELEASE_VAR];
112:  const spec = { project: ctx.project, kind: "land", cmd: ["bash", MERGE_QUEUE], cwd: root, jobId: `land-${ctx.epoch}-${seq}` };
36:#   `--affected`: iteration only; omit browser ONLY for proven data-only diffs (queries/worker).
90:  [ "$_affected_arg" != "--affected" ] || AFFECTED=1
95:# Without --affected, preserve the legacy positional --since behavior and command lines exactly.
227:    --affected) AFFECTED=1 ;;
418:    echo "→ --affected: UI/unknown path or classification unavailable; retaining full browser gate"
1128:run_cheap_gate doc-lint pathlist gate_doc_lint
1130:# --- Residual-ambiguity gate (DR-100) — a [NEEDS CLARIFICATION] marker must never reach an ACTIVE doc ---
1131:# Spec/blueprint authors mark an unresolved, build-changing question inline with `[NEEDS CLARIFICATION: …]`
1141:    done < <(grep -rIl 'NEEDS CLARIFICATION' docs 2>/dev/null || true)
1143:      echo "✗ DR-100 readiness: unresolved [NEEDS CLARIFICATION] in ACTIVE docs (resolve → AC / business rule / [ASSUMPTION], or escalate):"
1276:  # --only/--since/--affected alone never authorize an empty inventory.
1369:  # A project's e2e/prod-server.mjs serves the FULL run from one production build instead of next dev.
../funko-tracker/e2e/smoke.spec.ts:6: * Preview Smoke Gate (DR-055): every blessed surface renders real content with no console
../funko-tracker/e2e/smoke.spec.ts:27:    page.on("console", (m) => {
../funko-tracker/e2e/smoke.spec.ts:30:    page.on("pageerror", (e) => errors.push(String(e)));
../funko-tracker/e2e/smoke.spec.ts:34:    // toBeVisible() wait below is the deterministic readiness signal instead.
../funko-tracker/e2e/smoke.spec.ts:35:    const res = await page.goto(s.path, { waitUntil: "domcontentloaded" });
../funko-tracker/e2e/smoke.spec.ts:36:    expect(res?.status(), `${s.path} HTTP status`).toBeLessThan(400);
../funko-tracker/e2e/smoke.spec.ts:37:    await expect(page.locator("main, h1").first()).toBeVisible();
../funko-tracker/e2e/smoke.spec.ts:38:    expect(errors, `console/page errors on ${s.path}`).toEqual([]);
mission-control/e2e/smoke.spec.ts:6: * Preview Smoke Gate (DR-055): every blessed surface renders real content with no console
mission-control/e2e/smoke.spec.ts:27:    page.on("console", (m) => {
mission-control/e2e/smoke.spec.ts:30:    page.on("pageerror", (e) => errors.push(String(e)));
mission-control/e2e/smoke.spec.ts:34:    // toBeVisible() wait below is the deterministic readiness signal instead.
mission-control/e2e/smoke.spec.ts:35:    const res = await page.goto(s.path, { waitUntil: "domcontentloaded" });
mission-control/e2e/smoke.spec.ts:36:    expect(res?.status(), `${s.path} HTTP status`).toBeLessThan(400);
mission-control/e2e/smoke.spec.ts:37:    await expect(page.locator("main, h1").first()).toBeVisible();
mission-control/e2e/smoke.spec.ts:38:    expect(errors, `console/page errors on ${s.path}`).toEqual([]);
(exit 0)
```

## 8. Worker contracts and previous decision owners

Briefs currently place role and unit before scope, assemble a fixed gate command and ask for report JSON via transport. Working-copy sizes are context for the estimated change budget. DR owners and target material are a propagation map, not prerequisites invented by this research.

```bash
rg -n '## [1-9]|allowed|report' plugin/runtime/build/units/render.mjs | cut -c1-190 | tail -33
rg -n 'verification:|read.*SKILL|never invoke' plugin/runtime/build/units/brief.mjs | cut -c1-215 | tail -7
rg -n 'output-schema|schema' plugin/runtime/build/next/dispatch.mjs | cut -c1-220 | tail -11
wc -l plugin/runtime/build/{report.mjs,units/brief.mjs,units/render.mjs,next/g2.mjs,next/planning.mjs,land/command.mjs,land/harvest.mjs} plugin/runtime/build-state.mjs plugin/scripts/{verify-before-stop.sh,pandacorp-build.mjs} plugin/templates/shared/.pandacorp/{merge-queue.sh,green-stamp.sh,with-merge-lock.sh}
rg -n '^  - id: DR-(026|031|034|044|050|051|054|055|056|060|067|068|070|072|073|080|085|086|093|096|099|100|106|138|140|141|144|145|146|152|153|158|159|162|164|165)$' factory/decisions/registry.yaml
rg -n '^##|^\*\*Queue completion' factory/standards/build-orchestration.md | head -33
nl -ba factory/standards/build-engine.md | sed -n '3,23p'
rg -n 'implementation_status|source_change' mission-control/.pandacorp/change-reconcile.mjs | cut -c1-190 | head -10
rg -n 'source: Pandacorp|During a run|per-turn Stop|independently verified finished' mission-control/docs/rules/{ai-implementation,documentation-and-decisions,quality-and-testing}.md | cut -c1-215
rg -n 'Internal engines|Skill invocation protocol|Tool translation|Worktree isolation' AGENTS.md | cut -c1-230
```

```text
39: * @param {string} input.reportPath
58:  out.push("## 1. Role");
62:  out.push("## 2. Unit");
72:  out.push("## 9. Identity", `unit: ${unit.id}`, `token: ${token}`, "(copy both verbatim into the report)", "");
77:  const lines = ["## 3. Scope"];
83:  if (unit.kind === "tests") lines.push("", "RED-first acceptance tests: each new test must fail by assertion, never by an import or syntax error; touch no production code. The report car
89:  const lines = ["## 4. Context pack", bullets(contextPack, "- (none)")];
90:  if (readOnlyPaths.length) lines.push("", "Read-only, hashed by the engine (a change gets your report rejected):", bullets(readOnlyPaths, ""));
114:function workSections({ root, verification = [], reportPath, schemaPath }) {
117:    "## 5. Working directory and git",
121:    "## 6. Verification",
124:    "Record each command's exit code and the output tail in the report.", "",
125:    "## 7. Doubts",
127:    "## 8. Output",
128:    `Write a JSON object valid against \`${schemaPath}\` to \`${reportPath}\`, and print the same JSON as your final message.`, "",
132:function reviewSections({ root, review, reportPath, schemaPath }) {
134:    "## 5. Review inputs",
139:    "## 6. Verification",
141:    "## 7. Doubts",
143:    "## 8. Output",
144:    `Write a JSON object valid against \`${schemaPath}\` to \`${reportPath}\`, and print the same JSON as your final message.`, "",
148:function consultSections({ doubt, sourcesSkipped, reportPath }) {
150:    "## 3. Doubt",
153:    "## 8. Output",
154:    `Write \`{"decision": string|null, "rationale": string, "confidence": "low|medium|high", "reversible": boolean}\` to \`${reportPath}\` and print the same JSON as your final message. 
167:    verification: extra.verification ?? repairVerification ?? ["bash .pandacorp/verify.sh --light", "bash .pandacorp/verify.sh --light --tests=<the test files you changed>"],
264:      schemaPath: files.schema_path, worktree, reportPath: files.report_path, extra: await briefExtra(run, current, g),
273:      cell: g.cell, task: g.task ?? capacityTaskForUnit(unit, current), schemaFile: files.schema_path || null, dir, briefFile: briefPath, dispatch: dispatchOf(g.token_hash), epoch: ref.epoch, token: g.token,
314:    schema_path: consult ? (via === "cli" ? paths.schemaFile("doubt-answer") : "") : paths.schemaFile(reviewType ? "review-report" : "report"),
324:    worktree: p.worktree, brief_path: p.files.brief_path, report_path: p.files.report_path, schema_path: p.files.schema_path,
     591 plugin/runtime/build/report.mjs
     173 plugin/runtime/build/units/brief.mjs
     156 plugin/runtime/build/units/render.mjs
     189 plugin/runtime/build/next/g2.mjs
     203 plugin/runtime/build/next/planning.mjs
     191 plugin/runtime/build/land/command.mjs
     325 plugin/runtime/build/land/harvest.mjs
     580 plugin/runtime/build-state.mjs
     330 plugin/scripts/verify-before-stop.sh
     421 plugin/scripts/pandacorp-build.mjs
    1021 plugin/templates/shared/.pandacorp/merge-queue.sh
     307 plugin/templates/shared/.pandacorp/green-stamp.sh
      29 plugin/templates/shared/.pandacorp/with-merge-lock.sh
    4516 total
145:  - id: DR-026
173:  - id: DR-031
191:  - id: DR-034
249:  - id: DR-044
285:  - id: DR-050
291:  - id: DR-051
309:  - id: DR-054
315:  - id: DR-055
321:  - id: DR-056
345:  - id: DR-060
387:  - id: DR-067
393:  - id: DR-068
405:  - id: DR-070
417:  - id: DR-072
423:  - id: DR-073
465:  - id: DR-080
494:  - id: DR-085
500:  - id: DR-086
542:  - id: DR-093
560:  - id: DR-096
578:  - id: DR-099
584:  - id: DR-100
620:  - id: DR-106
813:  - id: DR-138
825:  - id: DR-140
832:  - id: DR-141
850:  - id: DR-144
857:  - id: DR-145
863:  - id: DR-146
898:  - id: DR-152
904:  - id: DR-153
934:  - id: DR-158
940:  - id: DR-159
959:  - id: DR-162
972:  - id: DR-164
978:  - id: DR-165
11:## 1. State lives in the frontmatter (two axes)
41:**Queue completion (DR-165 phase 1).** The recipe is commit → `bash .pandacorp/merge-queue.sh`.
59:## 2. Coarse work orders
84:## 3. The Build Plan lives in the blueprint (per FRD)
94:## 3b. The readiness gate — cohesion before the build (DR-100)
123:## 4. Hand-off (`## Status Note`)
129:## 5. Test per FRD, not per work order
135:## 5a. Concurrent gates and pinned snapshots
139:## 5c. Parallel FRD gates
143:## 5d. Deterministic build plumbing
147:## 5b. The phase model & `deploy_target` (DR-085)
153:## 6. How a run stops
159:## 7. Coordination and the `drive` relay
163:## 8. Scoped requests and owner answers
169:## 9. Convergence — the split gate (DR-072/DR-129)
177:## 10. Templates
181:## 10b. Testing the executor
185:## 10c. Invocation mechanics
189:## 11. Concurrent-run guard
193:## Concurrent sessions on one repo (DR-093)
210:## Parallel manual sessions — worktree isolation + merge queue (DR-096)
234:### 1. Self-isolation is a per-session REFLEX (no orchestrator)
250:### 2. Bootstrap on entry — reconstitute what git doesn't carry
265:### 3. Ports — fixed for the canonical/stateful/callback, autoPort for the ephemeral
281:### 4. Per-worktree state isolation (stateful projects)
289:### Queue critical section (DR-165 phase 0.5; amends DR-096/146)
382:### 5. Batch integration through the serialized merge queue (DR-141, BUILD-4)
464:### 6. Attribute every red — "not-mine → report, don't fix"
474:### 7. Visibility — never silently strand a worktree
505:### 8. The propagable contract (every project declares 3 things)
516:### 9. Enforcement — the rule can't stay soft (DR-099)
569:## Session resource teardown (BUILD-5, DR-145)
594:## How it is verified
     3	## BUILD-16 Supervised rescue and completion with gaps (DR-164)
     4	
     5	A technical failure never ends an authorized run as `stopped`. Two observations with the
     6	same error class and unit/worker/file identity enter `rescue`, including scheduler no-progress,
     7	exceptions and a repeated decided doubt. Identity uses `failureIdentity`, excludes PID/error prose,
     8	and counts matching observations across interleaved causes. Different causes do not qualify yet. The journal
     9	owns the failure history and rescue stages; replay preserves them across coordinator changes.
    10	An unreadable state cache is replayed under the owned lease before recovery; it never
    11	authorizes releasing that lease as a technical startup failure.
    12	This rule supersedes historical technical stop/hand-back instructions below. An explicit
    13	owner stop remains authoritative. Only unauthorized production, money, real data deletion
    14	and external communication retain human gates. Capacity keeps its existing automatic wake.
    15	
    16	There is one rescue per unit. The CLI gives the supervising app lead (or a fresh drive
    17	worker) a brief containing the WO objective, necessary files/consumers, protected oracle
    18	hashes and failure history. Work happens directly in that unit's checkout, with exceptions
    19	to the failed ordinary artifact allowlist, report/G1 transport and attempt budget recorded
    20	explicitly. Scope, the lease fence, one writer, protected tests and production guards remain
    21	binding. Never modify the main checkout or set `PANDACORP_OWNER_RELEASE_OK`.
    22	An old CLI writer must stop with positive termination evidence before checkout reuse.
    23	An unproven CLI or native agent writer keeps its original checkout; rescue uses an isolated
13://     T3  ≥1 work order declares `source_change: <slug>` and every such WO is VERIFIED          → done
135:      all.push({ frd, rel: `docs/frds/${frd}/work-orders/${name}`, status: fmGet(split.fm, "implementation_status"), sourceChanges: fmList(split.fm, "source_change") });
167:    return { verdict: "done", sha, evidence: [`its ${linked.length} work order(s) with source_change: ${card.slug} are all VERIFIED (${linked.map((wo) => path.basename(wo.rel, ".md")).jo
mission-control/docs/rules/documentation-and-decisions.md:5:source: Pandacorp standard — documentation
mission-control/docs/rules/documentation-and-decisions.md:43:During a run, product-manager owns FRD/AC deltas, architect owns blueprint/ADR/model and work-order planning, and designer owns pending visual deltas. Use
mission-control/docs/rules/ai-implementation.md:5:source: Pandacorp standard — ai-implementation
mission-control/docs/rules/quality-and-testing.md:5:source: Pandacorp standard — quality
mission-control/docs/rules/quality-and-testing.md:77:- **MUST:** when several independently verified finished branches are waiting, assemble them in one integration worktree/branch from current `main`; record source
mission-control/docs/rules/quality-and-testing.md:86:- The per-turn Stop gate runs `verify.sh --light` plus `--tests=` the tests that belong to the files this session edited: cheap static stages, never Playwright or
53:Internal engines (marked `user-invocable: false`; not offered to the owner directly, but readable/executable by an agent when a flow calls for them): `bug` (the internal bug-case engine behind `implement`), `new-version` (large
110:- **Skill invocation protocol.** When the owner asks for a phase (`/pandacorp:x`, "ejecuta la fase x", `$x`): read `plugin/skills/<x>/SKILL.md` and follow it, applying the tool translation table below. Human gates, language ru
111:- **Tool translation** (Claude tool referenced in a skill → what to do elsewhere): `Agent`/`Task` → an explicit subagent from the **active runtime only** (Codex: the generated `.codex/agents/` incl. `tier-mech`/`tier-stand
143:- Worktree isolation (DR-096) uses the `EnterWorktree`/`ExitWorktree` tools. **Landing differs by repo:** product projects land via their own `.pandacorp/merge-queue.sh`; the factory repo has NO merge queue — factory worktre
(exit 0)
```

## 9. Frozen revision and failure history

This is a spot check against the corrected audit, not a repeat census. Proposal 45 reports the historical schema paths and actual launcher dates. The current checkout or an installed cache can be selected depending on the caller. The version string alone cannot identify what was executed.

```bash
git log -1 --oneline
git show --stat --oneline 3105fd55
rg -n '10.19.5|d5e1c96d' /Users/sergio/.claude/plugins/installed_plugins.json | cut -c1-220
rg -n 'CLAUDE_PLUGIN_ROOT|factory.*plugin|PANDACORP' plugin/skills/implement/references/engine-v2.md | cut -c1-230 | head -12
rg -n '89 min 37|same tree|same SHA' docs/proposals/44-verification-strategy.md | cut -c1-225 | head -10
rg -n '8.*owner scopes|19.*delivery activations|8.*current CLI Funko|71.5%|16.*small oracle' docs/proposals/45-implement-audit.md | cut -c1-225 | head -10
```

```text
3105fd55 fix(build): type const/enum nodes in Codex output schemas
3105fd559 fix(build): type const/enum nodes in Codex output schemas
 plugin/docs/decision-log.md                        |  4 +++
 .../runtime/build/schemas/doubt-answer.schema.json | 12 ++++---
 plugin/runtime/build/schemas/report.schema.json    | 21 ++++++++----
 .../build/schemas/rescue-report.schema.json        | 10 ++++--
 .../build/schemas/review-report.schema.json        | 27 ++++++++++-----
 plugin/scripts/test-codex-output-schemas.mjs       | 40 ++++++++++++++++++++++
 6 files changed, 92 insertions(+), 22 deletions(-)
7:        "installPath": "/Users/sergio/.claude/plugins/cache/panda-corp/pandacorp/10.19.5",
8:        "version": "10.19.5",
11:        "gitCommitSha": "d5e1c96d7bac6ae1c423cdcf75bd27fc473da343"
36:   session never pushes directly. Every detached job removes `PANDACORP_OWNER_RELEASE_OK`.
51:| Claude Code | `node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build.mjs" <cmd> --project <projectDir> …` |
52:| Codex | `node "<factory>/plugin/scripts/pandacorp-build.mjs" <cmd> --project <projectDir> …`, `<factory>` = the `Factory:` path in `.pandacorp/guide.md` |
292:`PANDACORP_OWNER_RELEASE_OK` without that order; kill a process (BL-0223); spawn or stop `drive` (`drive.md`); ask
36:2. **Most measured elapsed time sits outside gate execution, and the incident that prompted the question was not a test-suite problem.** In five completed queue episodes on 21 November, median first enqueue to local landin
160:- **Time:** from approval to the engine stop was 89 min 37 s (measured); neither engine run dispatched the feature implementer. The two rejected docs G1 runs logged 12.868 s across all their timed stages; the failing stag
176:| Queue, Nov 21 | 8 reds | None demonstrated an application repair. One Funko red and two early Mission Control reds later passed a full gate at the same app SHA. In personal-page-v2 the affected test also passed on the s
23:- **Across 8 MEASURED owner scopes, 0 had a documented full-scope delivery through the engine alone.** The **19 MEASURED** delivery activations represent **18 MEASURED** distinct run IDs across two engine generations. Some
58:**MEASURED, 2026-10-10 through 2026-11-21 UTC.** There were **20** observed activations, including a Mission Control launch converted to a relay diagnostic. The delivery-coded count is **19** activations, **18** distinct I
60:**Outcomes, MEASURED.** There are **8** current CLI Funko journals and **59** dispatch records across **939** events, with **zero** `batch_landed` events. **12 of 22** exact integration-event SHAs reached main across **3 o
124:All **16 MEASURED** small oracle runs scored **151/151**, so that oracle did not distinguish the candidates. Proposal 41 reported **4.2–4.8×** as many builder output tokens as direct work (**MEASURED** as archived). It
280:- The historical transcript and proposal clocks for small F-2/F-3 are reported at their respective granularity, and exact direct endpoints differ by start boundary. The evidence supplies no finer reconciliation of the pro
(exit 0)
```

## 10. Installed Codex worker contracts

Archive and installed bytes were compared for every worker output schema. Each parent comparison uses read-only Git. This establishes distribution drift. Runtime/provider acceptance still needs future confirmation. The same source fix should qualify fallback as well as the new route.

```text
Method (executed by this helper): for each schema at plugin/runtime/build/schemas/<name>, read HEAD working bytes and both 10.19.5 caches; compare SHA-256 with subprocess git show 3105fd55^:<path>; recursively count enum/const objects without type using json.loads. Paths and equality results follow.
/Users/sergio/.claude/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/report.schema.json: predecessor=True, working=False
/Users/sergio/.codex/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/report.schema.json: predecessor=True, working=False
plugin/runtime/build/schemas/report.schema.json: predecessor_untyped=7, working_untyped=0, working_sha256=3995610ba46b0cec5d86ffb1e04b0e331ee476cd7666d0488f878290cc2c5020
/Users/sergio/.claude/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/review-report.schema.json: predecessor=True, working=False
/Users/sergio/.codex/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/review-report.schema.json: predecessor=True, working=False
plugin/runtime/build/schemas/review-report.schema.json: predecessor_untyped=9, working_untyped=0, working_sha256=90a4c4bb99d67f07fbcdadf195bc790315d7fbaa12bda9f5afc031dfd4a89552
/Users/sergio/.claude/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/doubt-answer.schema.json: predecessor=True, working=False
/Users/sergio/.codex/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/doubt-answer.schema.json: predecessor=True, working=False
plugin/runtime/build/schemas/doubt-answer.schema.json: predecessor_untyped=4, working_untyped=0, working_sha256=29ed1ca9bdc7deca618f2c959a8ff6020f86484a267e3f2b85ed4bfd2ad6c9a8
/Users/sergio/.claude/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/rescue-report.schema.json: predecessor=True, working=False
/Users/sergio/.codex/plugins/cache/panda-corp/pandacorp/10.19.5/runtime/build/schemas/rescue-report.schema.json: predecessor=True, working=False
plugin/runtime/build/schemas/rescue-report.schema.json: predecessor_untyped=3, working_untyped=0, working_sha256=cac0e8dbdd9dd8be960c7f6d2822e7b92b8e14e02b7aa5e3575e57458dbf63e5
```

## 11. Prior evidence and gaps

Input inventory below is a complete byte read and index of the two memos and the top-level evidence Markdown. The earlier audits already reconcile the transcripts, journals, queue attempts and benchmark records. Their fixed windows and endpoint corrections govern this proposal. The raw oracle projects and comparable direct delivery baseline are unavailable in those archives. Worktree measurements above are traversed sizes, not incremental physical allocation, memory, boot time or projected savings. Static inspection cannot establish provider acceptance, shared-writer enforcement, feature integration or safe landing through a queue mode that is not yet implemented.

```text
docs/proposals/44-verification-strategy.md: 478 lines, sha256=cce98821762b5783fb40c1f4ca8e0670cf0314abdecc211a1f32925b589c34a2
docs/proposals/45-implement-audit.md: 290 lines, sha256=f8f27d260a50663251dacbb777698c86d787c8c2f1df0cada274b62a89e42751
docs/proposals/45-evidence/README.md: 39 lines, sha256=70174a57c12a6c3d45e90377a8ffb863f31db80e5006db17ae6fc0be082ecdd3
docs/proposals/45-evidence/anatomy.md: 2159 lines, sha256=0bf867f454ea5dfa7ef1f1402036d42c3d4f2094feb5f9583ae28891d75e7d16
docs/proposals/45-evidence/failures.md: 243 lines, sha256=a2a20490980e5213e6f1165e57c9ab14d5407d1a5f281718ea21c9c34b6c4a3a
docs/proposals/45-evidence/figures.md: 56 lines, sha256=2b514eec7e275b516162ac7540aeaba7ab7d8de9ec96403dc07526af097512f7
docs/proposals/45-evidence/prompts.md: 250 lines, sha256=20d89a7e8716af77f3acac462bba2bf37b2c83bf8d0202b10c177147e038138d
docs/proposals/45-evidence/redteam.md: 195 lines, sha256=f40e4c515e2e3f9a147f7e515cd1c5ec9a22a8004d9674f9e9fb4c10d90c8364
docs/proposals/45-evidence/synthesis.md: 202 lines, sha256=c2622d11f8fa6b6232eb635e16d4f8f002ac9b53b485f8793e8470f1c0e7f931
docs/proposals/45-evidence/verify-memo.md: 242 lines, sha256=b23bdee9b9cda1db71d02508b64c5de8a21700b31876f34c14f1288b1f127fb9
```

Further locators for interpretation include `docs/proposals/44-verification-strategy.md:33–40,147–166,269–276,307–355,433–440`, `docs/proposals/45-evidence/redteam.md:9–75,76–107,129–139,153–195`, and `docs/proposals/45-evidence/verify-memo.md:11–50,96–118,154–161,211–225`.
Runtime log and transcript restrictions were honored by reusing their existing forensic extracts and observations. The historical launch evidence does not show provider acceptance with the patched installed copy. The bug-card source gap has no published escape count. The deployed and sibling worktrees in the inventory were left untouched.
