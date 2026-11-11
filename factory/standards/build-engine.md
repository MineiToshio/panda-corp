# Build engine standard (`pandacorp-build` CLI, engine v2)

> Domain: Quality/Process · Severity: **MUST** · Enforcement: the `pandacorp-build` CLI itself (deterministic, epoch-fenced, fail-closed) + its suites `plugin/scripts/test-build-v2-*.mjs` + the independent reviewer at each FRD/landing; **factory-internal (process) — not injected**: projects meet it through the CLI, `.pandacorp/merge-queue.sh` and the untracked git `pre-push` hook. See DR-150..DR-153.

How `/pandacorp:implement` builds once it runs on the v2 engine: a thin session protocol over a
runtime-neutral Node CLI (`plugin/scripts/pandacorp-build.mjs`) that owns every deterministic
decision (scope, plan, admission, routing, quota, gates, integration, landing, state). Rules
BUILD-7..BUILD-15 live here and only here; every other document links to them instead of restating
them.

**Applicability.** These rules govern every run started by the v2 CLI. From plugin 9.155.0 the v2
engine is opt-in: the owner says `implement v2` (the only opt-in; there is no `--engine` flag). From
10.0.0 (DR-150) v2 is the only build engine. The default (Dynamic Workflows) engine is **frozen from
9.155.0**: usable as it is, never fixed; only its own suites, the Check 5 fragment regeneration and
Check 8 leave CI. At 10.0.0 it is archived under `plugin/archive/engine-v1/` with the git tag
`archive/engine-dynamic-workflows-v9.153.0` and a BREAKPOINTS list; it is restored only on the
owner's "vuelve al viejo" and deleted only on the owner's "bórralo"; nobody sends reminders. Until
10.0.0 the default engine's runs keep following `build-orchestration.md`. Human gates (production,
spending money, deleting data, external communication) are identical under both engines and are
never weakened by anything below.

**Fact ownership (one home each, DR-115).** Policy, thresholds, matrices and the probe budget: this
file. Command, file, coordinator-mapping and schema interfaces: `plugin/docs/build-engine-cli.md` +
`plugin/runtime/build/schemas/*.json`. Machine encoding of the routing tables and thresholds:
`plugin/runtime/model-tiers.json` v2 (the table test asserts it equals the tables here, cell by
cell; a change edits both in one commit). Session behaviour:
`plugin/skills/implement/references/engine-v2.md` (R2: `implement/SKILL.md`). Agent behaviour:
`plugin/agents/*.md`. Runtime boundary: `agent-portability.md` PORT-5. Project test obligations
(TDD, coverage, mutation): `quality.md` + `rules/quality-and-testing.md`, which reference this file
for what the engine runs.

## Vocabulary

| Term | Meaning |
|---|---|
| Unit | One dispatch. Kinds: `docs`, `tests`, `build`, `patch`, `review`, `audit`, `doubt-consult`, `deferred-review`. A `build` unit is a chain of ≤3 WOs of one FRD with one routing cell. "Plan" = `docs` at size feature/giant; "escalation" = `build` or `patch` at attempt 3. Ids `u-<kind>-<first wo, frd or doubt id>` (no attempt suffix; consults `u-doubt-consult-<doubt id>-c<n>`); chain id `c-<first wo>`; `attempt` is a field |
| Safe point | A state the run can stop at and resume from with nothing lost: after a unit commit, a chain integration, a `review-record`, a batch landing |
| Label | Which company builds: `claude` or `codex` (BUILD-7). Reviews follow BUILD-10, not the label |
| Coordinator | Who drives the loop: `claude-session`, `codex-session` or `drive`. The full mapping to lease fields and admission shapes is an interface (`build-engine-cli.md`); the policy consequences are stated in the rules |
| Company / layer | Anthropic: haiku < sonnet < opus < fable. OpenAI (Codex): luna < terra < sol < astra. Model names everywhere (state, journal, reports, matrix) are these catalog keys; only CLI-launched Codex units carry the catalog slug (`gpt-6-luna`, `gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-astra`) |
| Author | The unit's dispatch cell (runtime, model, effort) as journaled at dispatch; a report's `authored_by` is informational only |
| Risk zone | `none`, `floor` or `r1`, computed by `risk` (BUILD-10 §Risk zone) |
| Out of quota / unreachable | Out of quota = a reading ≥90 % or a `usage_limit` response. Unreachable = login, CLI or network failure. The two are never conflated |
| Degraded review | A review not done by the primary cell: `quota_90`, `unreachable`, `at_capacity` or `same_model` |
| G0..G4 | The gate tiers (§Gates) |

**Never automatic:** Fable and effort `max` are never emitted by any table in this file (CONV-12);
only the owner's explicit request selects them. Terra stays `disabled` until calibrated (phase D).

## Rule — single entry, detection and one writer (BUILD-7)

> Severity: **MUST** · Enforcement: `start --detect` (deterministic, no LLM except the session card), the lease of `plugin/runtime/build-state.mjs`, two-phase epoch fencing in every mutating command. See DR-150, DR-050.

**One entry.** Building anything (a feature, a change, a bug fix, the pending plan, a resumed run)
goes through `/pandacorp:implement`. The change queue (`.pandacorp/inbox/changes/`) is a file
format with readers (Mission Control, the DR-147 reconciler, doc-lint, the engine's target card),
not a door: **the engine never drains the queue** at a safe point or anywhere else. "Write it down
for later" is a `draft` card validated by `card check` (BUILD-8). `iterate`, `bug` and `new-version`
are internal engines that `implement` calls; from 10.0.0 `/pandacorp:change` does not exist.

**Label precedence (step 0).** explicit `claude|codex` in the arguments > the orchestrate flag
`~/.claude/state/orchestrator-mode/$CLAUDE_CODE_SESSION_ID.on` (read-only, never written; absent =
no flag; not applicable in the Codex app) > the runtime of the session the owner typed in. The
choice and its source are always announced (`label_source: explicit|orchestrate|default`). The legacy
mode words `pro|balanced|powerful|deep` are accepted and ignored with a warning. A card is referenced
as `change:<id>`, `change=<id>` or its bare slug.

**Detection: first matching row wins.** `start --detect` only lists `building` cards without a live
run (as half-built); it never rewrites a card (card lifecycle: BUILD-8).

| # | Condition | Scope | Action |
|---|---|---|---|
| 1 | The lease is live (another run or runtime holds it) and no `--resume` | none | Do not build (one writer per project). A session card is saved `ready`; first-minute question "¿lo construyo después?", default: queued |
| 2 | `--resume`; or the lease is stale or absent with a non-terminal v2 state; or a v2 `building` card of this project | that run's scope | Resume (BUILD-14 §Resume): deferred reviews first. Paused run **and** a session card: first-minute question, default: the conversed scope first, then the paused run. Never resume another scope instead of the conversed one |
| 3 | Target = a card | that card | `ready` → build. `draft` → complete Dentro/Fuera from the card; first-minute question, default: build it as completed |
| 4 | Target = FRDs | their pending WOs | A cross-FRD dependency not `VERIFIED` → hand-back listing it; never pulled in |
| 5 | A session card (written in this conversation) | the conversed scope only | BUILD-8 |
| 6 | Pending WOs > 0, **excluding** WOs whose `source_change` names an open card | the pending plan | Build. Launched project: build on the branch; landing waits for the owner (BUILD-13) |
| 7 | Nothing | none | List `ready`/`draft`/half-built cards and stop |

- A fresh session without conversation context can only land on rows 2, 6 or 7 (row 3 with
  `implement <card>`). It never infers scope from another conversation.
- **Version scale** (a new PRD, several epics) is product scope: not built; said in the first
  message; with the owner's yes, `implement` invokes `new-version`.
- The scope fixed by `start --detect` is passed verbatim to `start --preflight` and `start --run`;
    the run builds exactly those WOs plus the WOs its card's docs unit creates.
- A session card while `build/` holds a non-terminal run: detection returns the card's scope (row 5) and the first minute asks `conflict.paused_plus_card` (default: the conversed scope first); `start --run` then suspends the paused run under `.pandacorp/run/build-suspended/<run_id>/` and `start --resume --run <id>` resumes it later.

**One path to `main`, one writer (D1).** In every project, launched or not, the v2 engine **never
writes a git-tracked file in the main checkout**. There it writes only gitignored paths
(`.pandacorp/run/**`, `.pandacorp/inbox/**`, `.pandacorp/comms/**`) plus its own git refs and
worktrees; before writing any of those paths the CLI checks `git ls-files --error-unmatch <path>`,
and a path that is tracked anyway (e.g. Mission Control's force-tracked `.pandacorp/inbox/decisions.md`)
is written in the integration worktree and committed there. Every tracked write is a CLI commit on
the integration branch `lane/<run_id>` (worktree `.pandacorp/run/build/integration`): docs before
code, WO frontmatter transitions and FRD/blueprint/status rollups, `track.jsonl` lines, project
`docs/decision-log.md` entries and the landing metadata commit (BUILD-13). The only path to `main` is
`land` running `merge-queue.sh` from the integration worktree. Lease operations of a v2 run never
project `status.yaml`. Consequence, accepted: during a run Mission Control sees the build through the
lease and events; WO columns, `phase` and `last_green_sha` change on `main` only at landing.

**Lease, token and fencing.**
- The lease (`.pandacorp/run/build.lease/lease.json` + `lease-epoch`) is the one shared with any other
  engine: no run starts while another holds it. v2 runs use `ttl_seconds` 1800.
- One token file `.pandacorp/run/build/lease-token.json {epoch, token}` (0600), written by `acquire`
  and `transfer`, never printed, never in events, commits or briefs. Every mutating command takes
  `--epoch`; a mismatch with the file or the lease, a foreign token or a quiesced lease exits 3 and
  the caller becomes an observer.
- **Two-phase mutation (D5).** Phase 1 under the lease mutex (seconds): verify the fence, renew the
  lease, record intent. Long work runs outside the mutex, only in unit or integration worktrees or in
  detached jobs. Phase 2 under the mutex: re-verify the same epoch, then write state, journal and
  branch commits. A phase-2 fence failure discards the results (worktree changes are left for the new
  holder to re-run) and exits 3. Work that outlives a command (merge-queue landing, G2, Codex workers)
  runs as a detached job recorded in the state; the current epoch holder harvests it in `next`. A
  transfer never waits: the loser gets exit 3 at its next phase 2; the winner adopts running jobs.
- **Liveness without a heartbeat process (D3).** Every fenced command of the coordinator renews the
  lease in its phase 1. While any unit, job or worker runs, the session loops `next --wait 300` and
  never ends its turn waiting; `next --wait` returns early when a report or review file, a job or
  worker exit, an answer or `handoff.json` appears. `drive` renews in its own loop. A lease not renewed
  for 1800 s means the coordinator is silent (`drive` trigger c, BUILD-14).
- **State.** Truth = WO frontmatter (DR-050) + the queue + `decisions.md`. `build/state.json` is an
  honest cache (DR-115), versioned (`schema`), regenerable by `rebuild-state` from the journal and the
  integration worktree's WO frontmatter; frontmatter wins on conflict. `build/journal.jsonl` is
  append-only, sha256 hash-chained, per run (a terminal run's directory moves to
  `.pandacorp/run/build-archive/<run_id>/` at the next `start --run`), written only by the epoch
  holder. Nobody edits run state by hand.
- Branches: integration `lane/<run_id>`; units `lane/<run_id>/<unit>` (attempt 1) and `lane/<run_id>/<unit>-a<n>` (attempt n ≥ 2); unit worktrees `.pandacorp/run/build/wt/<unit>[-a<n>]`; assumption
  `lane/<run_id>/assume-<doubt>`.

## Rule — the card and docs before code (BUILD-8)

> Severity: **MUST** · Enforcement: `card check` (shape), `start` (scope from the card), `next` (never dispatches outside scope), `report` (artifacts allowlist, own pathspec-limited commit), the reviewer's scope lens, `land` (trailer placement). See DR-150, DR-147.

**Card of scope** (written by the session, the only actor that saw the conversation), only when in
THIS conversation the owner described or accepted a behaviour **and** gave the order:

- File: `.pandacorp/inbox/changes/<slug>.md`. Fields the v2 session writes: `type`
  (`bug|feature|change`, required by Mission Control), `class`, `status`, `date`, `frd`,
  `origin: conversation`, `affected_frds`, `engine: v2`; body sections **Dentro** (each item cites the
  owner's message, ≤1 line), **Fuera** (discussed and dropped, other cards, pending plan WOs),
  **Dudas**. The CLI later adds `run_id`, `docs_sha`, `shipped_sha`. v2 never writes
  `integration_paths` or `integration_transaction` (their meaning belongs to the default engine).
  Status values stay inside Mission Control's enum (`ready|draft|building|closing|done|discarded`);
  `obsolete` is read as `discarded` and never written.
- Born `ready`; `start --run` sets `status: building` and `run_id` once it holds the lease. Validated
  by `card check` when written. No citation → no card → the no-context path.
- **Conservative defaults:** exclude before include. An item whose only citation is a post-compaction
  summary moves to Fuera as "por confirmar" and becomes a first-minute question.
- The card is shown in the first-minute message (BUILD-12) and the run proceeds without waiting for
  a "sí" unless a first-minute question applies.

**Card lifecycle (`card.mjs` owns every card read and write).** At `start --run`/`--resume`
(fenced): a v2 card (`engine: v2`) of this run is resumed; a v2 card of another, terminal run returns
to `status: ready` with a note; a default-engine card (it carries `integration_transaction`) goes
through `build-state.mjs` `reconcileBuildingChange`. After the batch landing that completes it, the
card moves to `done/` with `status: done` and `shipped_sha`. A failed or discarded build returns the
card to `ready` with a note; on discard, the next `implement` offers in one line to revert `docs_sha`.

**Docs before code (D17).** A card with no WOs starts with one `docs` unit (routed per BUILD-10) on
`lane/<run_id>`: FRD delta (only the REQ/AC that change) or a new FRD; one `docs/decision-log.md`
entry (what, why, the citation, "pendiente de construir"); for feature/giant also WOs with
`artifacts`, `dependsOn` and `source_change: [<slug>]`, plus the blueprint delta; `data-model.json`
when the schema changes (DATA-7); README when commands or env vars change (DR-112). Its commit carries
the trailer `Change-Docs: <slug>` and **never** `Change:`; the CLI writes `docs_sha` into the
(gitignored) card. On that unit's committed report the planner re-runs on the integration worktree
and queues the new units (the size may rise, never fall). Docs reach `main` only with the landing.

**Commit trailers (D28).** Unit commits carry `Unit: <unit>` and one `WO: <wo id>` per WO, never
`Change:`. The trailer `Change: <slug>` goes **only** on the landing metadata commit, and only when
that landing completes the card (BUILD-13). A decision-log entry for the build itself is added only
when the build deviated from the docs.

**Scope guarantee, by construction:** the run's scope is the WOs with that card's `source_change`
(or the FRDs/plan of rows 2, 4, 6); `next` never returns a unit outside it; `report` commits with
its own pathspec-limited `git commit` only after checking that the reported files equal the
worktree's changes, every file is inside the unit's allowlist (build/patch: its WOs' `artifacts`; docs: `docs/**`, `README.md`, `.env.example` and new WO files born `PLANNED`; tests: test surfaces only), no `**/*-snapshots/**` path, no edit of an existing WO's frontmatter (the body of the unit's own WO only if that file is in `artifacts`), and no change to any hashed test or probe file; schema and migration paths are allowed (G3
gates them). The single reviewer opens a `scope` finding when the diff touches anything in Fuera. A
dependency outside scope and not `VERIFIED` is a hand-back ("depende de WO-x, ¿la incluyo?"), never
silently included.

## Rule — sizes, tranches, planner and admission (BUILD-9)

> Severity: **MUST** · Enforcement: `start` (size), `plan`/`lint-plan` (`planner.mjs`, self-contained), `next` (admission tokens), `report`/`review-record` (token check), the host heavy-tool semaphore shared with `merge-queue.sh`. See DR-150, DR-132.

**Sizes** (computed on the fixed scope; the provisional size comes from the card before docs and can
rise, never fall):

| Size | Condition | Shape |
|---|---|---|
| touch | 0-1 WO, no new FRD | one unit, light review (≤10 reviewer calls) |
| feature | 2-15 WOs or 1-4 FRDs | planned units, FRD review |
| giant | first implementation, >4 FRDs or >15 WOs | a feature in **tranches of 2 FRDs**: each tranche is landed with G3 before the next starts; in a launched project the tranche stays on the integration branch, `main` waits for the owner's order and the next tranche continues |

**Planner (D30).** `planner.mjs` is a pure, self-contained function; it imports nothing from the
default engine's `build-mech-*` files.
- A WO is ready when its status is `PLANNED|IN_PROGRESS`, every `dependsOn` is **integrated on
  `lane/<run_id>`** (not merely reported), its floor wait or `floorWaived` dispensation (DR-132)
  holds, it is not parked and it is not pending the answer to an irreversible question.
- Rounds are chosen greedily (barrier first, then longest downstream path) up to the admission
  ceiling, adding a unit only if its `artifacts` do not overlap anything live. Overlap is decided by
  the literal-prefix rule: the prefix before the first wildcard of each glob; two globs overlap when
  one prefix is a prefix of the other (conservative).
- Barrier paths are constant (`prisma/**`, `**/migrations/**`, `package.json`, lockfiles); a barrier
  WO dispatches as soon as ready and pauses integration of other chains until it is integrated.
- A chain is ≤3 WOs of one FRD on a linear stretch with one builder, **cut when the routing cell
  changes**, so every chain has exactly one (model, effort).
- No progress possible → `deadlock` (a terminal action, BUILD-15).
- `lint-plan` is RED when: a live WO has no `artifacts` (legacy WOs: warning, and they run serially);
  a `dependsOn` is dangling or cyclic; two WOs with no dependency path between them overlap
  `artifacts`.

**Admission (D31; RAM/CPU, deterministic, evaluated on every `next`).**
- Signals: `L` = `sysctl -n kern.memorystatus_vm_pressure_level` (1/2/4); swapouts delta from
  `vm_stat`; `A` = (free + inactive + speculative + purgeable) × page size, in GiB; swap used and the
  conservative available are telemetry only. `os.freemem()` and `kern.memorystatus_level` are
  forbidden as inputs. An unexpected parse fails loud (DR-078) and switches to **safe mode** (B = 1,
  H = 1, `senal_fallida`).
- Two semaphores: **B** (LLM units: builders, patches, reviewers; reviewers keep a sub-cap of 2) and
  **H** (heavy jobs: G2 jobs, and merge-queue's `verify.sh` inside the `land` job, which takes the slot itself; the `land` job wrapper takes none). H is **host-wide**: slots under
  `~/.pandacorp/host/h-slots/slot-<i>/owner.json` (mkdir + pid + dead-owner reclaim), also taken by
  `merge-queue.sh` around `verify.sh`; `H_max = max(1, min(2, floor(ncpu/4)))`.
- Reservations: `A_ef = A − Σ pending(u)`. A subagent unit reserves `c_b` for its first 60 s, then
  `c_tool` while alive; a CLI-launched process reserves `max(0, class peak − rss of its tree)`, class peak = `c_b + 0.35` for a Codex worker and `c_h` for a heavy job.
- Rule: `L == 4` → launch nothing (`pausa_L4`; >10 min → `paused-infra`). `veto` = `L ≥ 2` or a
  swapout delta > 0 in ≥2 of the last 3 readings → series (at most 1 builder + 1 heavy job, only if
  none of that class is alive). Otherwise `P = A_ef − COLCHON`; a queued heavy job starts if
  `P ≥ c_h` or none is alive, else its `c_h` is set aside; LLM ceiling
  `techo = min(ready non-overlapping width + live B, K_TECHO, --k, K_reactivo)`; floor `suelo = 2`
  when no veto and `P ≥ 0`, else 1; grant one token if `live B < techo` and (`live B < suelo` or (no
  veto and `P ≥ c_b + 0.5`)). Rising above the floor needs the 0.5 GiB band, `L = 1` and zero
  swapouts in 3 readings; dropping is immediate.
- `K_reactivo`: −1 on a flaky-contention rerun, a heavy job waiting >5 min for CPU, or a Codex
  `rate_limit` (BUILD-11); +1 after 3 clean units; never below 1; never raised by quota. For Codex
  workers it starts at 2.
- A Codex app session (`codex-session` coordinator) runs B = 1, H = 1 always. Each `codex exec`
  worker adds 0.35 GiB to its reservation.
- Priority: landing > heavy job > new builder; at least one builder stays alive while ready work exists.
- Briefs require one tool at a time per unit (the builder's own checks live inside its `c_b`).
- Every decision carries `motivo_limite` ∈ {`ancho`, `ram`, `ram_reservada_H`, `veto_presion`,
  `veto_swap`, `cpu_H`, `techo`, `owner_k`, `reactivo_contencion`, `reactivo_codex`, `cupo_limite`,
  `senal_fallida`, `pausa_L4`, `sin_token`}. Admission events carry the unit, never the token.
- **Nothing is ever killed** to relieve pressure (BL-0223): live work finishes, launches pause.
- **Tokens:** the unit token is the admission token. Only `next` issues it, returns it once, and
  stores its sha256; `report`, `review-record` and `doubt answer` verify and then release it, so a
  unit launched outside the CLI never lands. `admit` is read-only: it shows the signals and the
  decision a `next` would take.

## Rule — routing and the single cross-company reviewer (BUILD-10)

> Severity: **MUST** · Enforcement: `routing.mjs` derives every cell from `model-tiers.json` v2; `next` emits the cell; `review-record` records it; the routing table test pins this section. See DR-152, DR-015 (amended), DR-073 (amended).

### Builder routing (first matching row)

| Unit | label `claude` | label `codex` |
|---|---|---|
| `docs`, touch | sonnet medium | sol low |
| `docs`, feature or giant (plan) | opus high | sol high |
| `tests` (tests-first, any zone: floor/r1 units whose WOs add AC ids, and every `type: bug` card; a different agent and dispatch from the builder) | sonnet high (test-writer) | sol medium |
| `build`, `reopen_count ≥ 1` (max over the chain's WOs) | opus high | sol high |
| `build`, static zone floor or r1 | sonnet high | sol medium |
| `build`, default | sonnet medium | sol low |
| `patch` bounded (≤30 lines, off-floor, with a test) | sonnet high | sol medium |
| `patch` unbounded | opus high | sol high |
| `build` or `patch` at attempt 3 (escalation, BUILD-15) | opus xhigh | astra high |
| `audit` (once per build when `risk.audit`) | opus high | opus high |

- The `audit` is not run under `drive` or while Claude is out of quota or unreachable (Codex app): it is queued as a deferred review for claude opus high (never Astra).
- `difficulty` never routes (DR-073 amended); it is recorded only. Mechanical steps run inside the
  CLI with no LLM.
- **No repeat:** when a row would repeat the previous execution's exact (model, effort) for the same
  unit, the effort rises one step (cap `xhigh`). A repeat never switches company.
- **Quota switch** (the only company switch, BUILD-11): when the label's company is out of quota, new
  units take the other company's column of the same row. Running units finish where they are.
- Workers write only inside their unit worktree, never `git commit`/`push`/`reset`, and never set
  `PANDACORP_OWNER_RELEASE_OK`; the CLI commits. Codex slugs are checked against `codex debug models`
  at `start` (fail loud if retired).
- **Session units:** a `touch` `build` unit at attempt 1 in static zone `none`, whose label company equals the coordinator's company, is written by the coordinating session itself (`via: session`); its author cell is the session model with effort unknown (treated as `high` for review routing, so an Opus session's N7 review is `xhigh`). Every other unit is dispatched as an agent or a CLI-launched Codex worker.

### Review: one reviewer, the other company, one layer above

Exactly one reviewer per review unit (no double review, also in the risk zone). The cell is chosen by
the author (the dispatch cell, also when the session wrote the unit) and the zone; a zone other than
`none` takes precedence over the touch/FRD kind. The reviewer never authored any line of the diff it
judges, except under the N7 exception below. A mixed-author diff takes the strictest applicable row.
Effort cells are extrapolated from calibration and fixed until phase D.

| # | Author | Kind / zone | Primary reviewer | Fallback when the other company is out of quota (≥90 % or `usage_limit`) | `degraded` | Deferred re-review |
|---|---|---|---|---|---|---|
| 1 | claude sonnet (any effort) | FRD, none | codex sol high | claude opus high | quota_90 | codex sol high |
| 2 | claude sonnet | touch | codex sol medium | claude opus high | quota_90 | codex sol medium |
| 3 | claude sonnet | floor | codex sol high + risk lens | claude opus xhigh | quota_90 | codex sol high |
| 4 | claude sonnet | r1 | codex astra high | claude opus xhigh | quota_90 | codex astra high |
| 5 | claude opus high | FRD / floor | codex sol high | claude opus xhigh, fresh context, adversarial same-model brief (N7) | same_model | codex sol high |
| 6 | claude opus high | r1 | codex astra high | as #5 (N7, also in the risk zone) | same_model | codex astra high |
| 7 | claude opus xhigh | any | codex sol high (r1: astra high) | claude opus xhigh (cap, same effort), fresh context (N7) | same_model | codex (sol high; r1 astra high) |
| 8 | claude session (touch) | touch | codex sol medium | the row of the session's real model: sonnet or haiku → #2; opus at effort e → opus next(e), cap xhigh (N7); fable → primary codex astra high, fallback **park** (never Fable, never a lower Claude model) | per row | codex |
| 9 | codex sol or luna | FRD | claude opus high | codex astra high | quota_90 / unreachable | claude opus high |
| 10 | codex sol or luna | touch | claude opus medium | codex astra high | idem | claude opus medium |
| 11 | codex sol or luna | floor or r1 | claude opus xhigh | codex astra high | idem | claude opus xhigh |
| 12 | codex astra high | FRD / touch | claude opus high | codex astra xhigh (N7 analog) | same_model | claude opus high |
| 13 | codex astra high | floor or r1 | claude opus xhigh | **park** (`parked: no_reviewer`) | — | — |
| 14 | codex terra (disabled until calibrated) | FRD / touch / risk | claude opus high / medium / xhigh | codex sol high | idem | claude |
| 15 | codex session (touch) | touch | claude opus medium | the row of the session's real model (luna or sol → astra high; terra → sol high; astra → astra xhigh, N7 analog) | per row | claude |
| 16 | claude fable (only ever an owner-chosen session model) | any | codex astra high | **park** (never Fable, never a lower Claude model) | — | codex astra high |

**Availability rules (D11).**
- **Out of quota** triggers the fallback column of every row.
- **Codex unreachable** (login, CLI, network) is not quota. Rows whose fallback is a different model
  (Claude sonnet or haiku authors) take that fallback with `degraded: unreachable`. Rows whose
  fallback is N7 (Claude opus authors, an Opus session) do **not** get a same-model review: the review
  waits as `parked: no_reviewer`, is retried at every safe point and is listed in the report
  (`access.codex_login` already asks the owner in the first minute).
- **Claude out of quota or unreachable** (the Codex app, `drive`) triggers the Codex-author fallback
  column, including the Astra analog of rows 12 and 15.
- Degradations made under `drive` are labelled `quota_90`.
- Sol answering "at capacity": resume the same Codex session id once (LESSON-0612); if it repeats,
  astra high with `degraded: at_capacity`.
- Under `drive` Claude-authored units written before the handoff keep their normal Codex primary.

**N7, the only same-model exception (DR-015 amended).** Only when the other company is out of quota
(a reading ≥90 % or a `usage_limit` response) and no stronger model of the author's own company exists
in the matrix: the same model reviews in a **fresh context** (diff, ACs and tests only), at the effort
**after** the author's (cap `xhigh`; an `xhigh` author gets `xhigh` again), with a brief that states
the author is the same model and asks for adversarial review; the review is recorded
`degraded: same_model` and queued for a deferred re-review by the other company. It applies inside and
outside the risk zone. An unreachable (not out-of-quota) other company never triggers a Claude
same-model review. The Astra analog (rows 12 and 15) also applies when Claude is unreachable. It is
never applied at a lower effort.

**Deferred re-review.** Every degraded review is appended to `.pandacorp/run/deferred-reviews.json`
(outlives runs; written only inside a run). `next` serves pending entries **first** as soon as the
needed company is below 90 %; if the run has finished, the next `implement` preflight runs them before
new work; Mission Control shows the count; the launched-project landing question lists them (landing
with any pending is the owner's informed choice). A grave finding opens a `type: bug` card.

**Recording.** Every review emits `review_recorded` with `reviewer{runtime,model,effort}`,
`authors[]`, `cross`, `degraded` and findings by severity; unit commits keep `Unit:` trailers. That data
is what the deferred escape attribution (F2) and shadow sampling (F1) will use; neither runs now. The
final report states the totals, e.g. "Revisiones: 3 cruzadas (Codex Sol high), 1 degradada (Opus xhigh,
mismo modelo)".

**Probes (D23; the budget lives only here).** One probe per finding plus at most 3 more per FRD,
permanent only when they failed first. `review-record` commits them onto `lane/<run_id>` (trailer
`Unit: <review unit>`) and stores their hashes; the patch unit's brief lists them as read-only RED
tests; `land` re-hashes them. `verdict: blocked` hands back the reviewed units with the finding as the
reason.

**Tests-first (D16).** For units in zone `floor` or `r1` that add ACs, and for every `type: bug` card,
a `tests` unit (the test-writer, a different agent and dispatch from the builder) runs before the build
unit. Its G1 must be RED on the new test files by assertion (not import or syntax) and green on
everything else; its outcome is `committed`. The CLI hashes those files; the tests unit is integrated
before the dependent build unit branches; that build unit's `report` rejects any change to a hashed
file; `land` re-hashes. This replaces the `drift-proof.mjs` differential for bug cards in v2.

**Other safeguards that replace the owner's confirmation in the risk zone** (DR-151): the single strong
reviewer with the scope lens; one security audit per build when `risk.audit`; G3 before `main`; floor
mutation at G4; nothing irreversible past its gate.

### Risk zone (`risk`, input to BUILD-10 and BUILD-12)

`pandacorp-build risk --files … | --range base..head` builds the classifier context itself
(`git diff --name-only` and `git diff -U0` added lines for `--range`; a path list without line
knowledge for `--files`) and returns
`{zone, rules[], signals{product_floor[], classify[], security[], risk_paths[]}, irreversible, audit, failclosed, unclassified[]}`.

| Rule | Signal | Effect |
|---|---|---|
| R1 | `productFloor(ctx).floor`, imported from `plugin/scripts/product-floor.mjs`: P1 auth/session, P2 payments, P3 persistence of personal data, P4 secrets/env, P5 destructive data operations | zone `r1` (the only Astra zone) |
| R2 | `classify-change.mjs` returns a `floor_hits` entry with `level: "critical"` whose signal is in {S5, S6, S7, S8, S9, S17} (run via `execFile(process.execPath, [classify-change.mjs, "--repo", root, "--range"\|"--files", …], {timeout: 60000})`, one JSON line parsed) | zone `floor` when not r1: persistence without personal data, CI, tests and oracles, package files, plugin/factory machinery |
| R3 | `securityDeltaTriggers(ctx).hits.length > 0` (product-floor) | `audit: true` (one security audit per build); does not change the zone |
| R11 | a `risk` glob of `.pandacorp/risk-paths` matches | zone `floor` when not r1 |

- `audit` = R3 ∨ zone `r1`. `irreversible` = zone `r1` ∨ S5 ∨ S8 (login, stored data, deletions);
  consumed by BUILD-12.
- Classifier exit 3, a `FAILCLOSED` signal or a product-floor throw → `zone: r1, failclosed: true`
  (exit 9 on read commands).
- **Static zone** (decides the builder row and tests-first) = `--files` over the units' `artifacts`
  before dispatch. **Review zone** = max(static zone, diff zone); it only hardens the reviewer.
- Missing `risk-paths`: unmatched files are listed as `unclassified`; the zone is unchanged. R1 still
  catches auth, money, personal data, secrets and destructive changes. `upgrade` seeds only a commented
    example; the owner confirms the globs.
- A `normal`-level classifier hit (e.g. S17 "madge is not installed") never raises the zone; its files go to `unclassified`.
- Rules R4-R10 of the design drafts are retired (F9): size and reopen act through routing, and
  filesystem-destructive changes and sensitive identifiers are covered by S8 and the product floor.

## Rule — quota thresholds (BUILD-11)

> Severity: **MUST** · Enforcement: `quota.mjs` (readers, single limit detector, `policy()`), `next` (handoff and terminal pauses decided in the CLI, never in prose). See DR-152.

**Sources.**
- Codex: the last `token_count.rate_limits` of the newest rollout under
  `~/.codex/sessions/YYYY/MM/DD` (newest dirs first, ≤3 days), tail read ≤256 KiB, never a full scan;
  `used_percent = max(primary, secondary when present)`, with that window's `window_minutes` and its
  `resets_at` converted from epoch seconds to ISO-8601. A reading stays valid at least until its
  `resets_at` (usage only rises within a window). When it is older than 1 h and ≥70 %, the preflight
  runs one minimal `codex exec` probe (≈20k input tokens) and re-reads.
- Claude: the session calls Desktop `get_usage` (5 h and weekly) at start and at every safe point and
  stores it with `quota record`. Older than 10 min, or `unavailable` (terminal Claude Code, `drive`),
  = unknown.
- Unknown → reactive only: the single limit detector (`classifyLimitText`, the union of every existing
  limit pattern, copied, not imported) on worker and report output.

**Thresholds** (either window of a provider; fixed until phase D):

| Condition | Action |
|---|---|
| Claude out of quota | No new Claude units; new units take the codex column of the same row; reviews of Codex-authored work take the fallback column (astra, degraded) |
| Claude ≥95 % or `usage_limit`, with `coordinator = claude-session` | `next` returns `handoff` (BUILD-14, trigger a/b) when the `drive` standby is alive, else the terminal `paused-quota`. Enforced in the CLI. A handoff never releases the lease |
| Codex out of quota | No new Codex units; new units take the claude column of the same row; reviews of Claude-authored work take the fallback column |
| Both ≥90 % | Terminal `paused-quota` at the last safe point; report with each company's `resets_at` |

**Limits (D9).** A `usage_limit` consumes no attempt and is recorded as a 100 % reading for that
provider (`source: "limit"`), after which the table applies. A `rate_limit` (429) consumes no attempt:
retry once after 60 s, then `K_reactivo −1`.

- Running units always finish. A provider returns only after its `resets_at`.
- The CLI stores the % at each unit's start and end so phase D can tune the thresholds; until then 90
  and 95 are constants.
- **The lease is released only by** `finish`, `stop`, an engine failure and `next`'s terminal actions
  (`paused-quota`, `paused-infra`, `waiting-owner`, `deadlock`, `stop`); never by a single-provider
  limit or a handoff.

## Rule — autonomy: the first minute, doubts and parking (BUILD-12)

> Severity: **MUST** · Enforcement: `start --preflight` (one question batch with defaults), `answer`, `doubt open|answer` (ladder, caps, deterministic veto), `next` (`pending_answer` units last). See DR-151, DR-148 (CONV-20).

**Principle:** the build never stops whole for a question. What needs the owner is asked once, at the
start; what appears later is consulted, parked or waits at its gate, and everything independent
continues. No unit waits for an owner "sí" outside the first minute, except parked units and human
gates (BUILD-13).

**First minute.** `start --preflight` (no LLM; CLI target ≤60 s on a Mission-Control-sized project;
the card turn before it is not included) runs these check groups, each with a stable id: `scope.*`
(non-empty Dudas, summary-only citations, giant, version scale), `conflict.*` (live lease, paused run
plus card, half-built cards with the same `affected_frds`), `phase.*` (launched, pre-push missing),
`access.*` (`codex login status` always, both quotas, test database, `.env.local` and pending entries of
`.pandacorp/comms/entrega-entornos.md` for the named FRDs, disk, RAM), `mac.*` (power via
`pmset -g batt`, keep-awake, `drive` armed), `gates.foreseen` (classify-change reasons on the card text:
deploy, money, deletion, external communication, production migration), `deferred.pending`. A check
asks only when the owner can fix it (an expired login); otherwise it warns. The result is written to
`.pandacorp/run/build/preflight.json` (0600); `start --run` reuses it when it is ≤15 min old and for
the same row and scope, otherwise it exits 5 ("re-run preflight").

**One message, in this order** (owner strings in Spanish):
1. If any: **"Necesito de ti"**, numbered, each question with "si no respondes: …".
2. **"Arrancó"**: scope in 4-6 lines, size, who builds, who reviews, provisional risk zone (the final
   one comes from the plan's paths and only changes the reviewer and tests-first, never asks), foreseen
   gates, each company's quota, pending deferred reviews; in a launched project the line "En proyecto
   lanzado no toco `main`: el código, los documentos y el estado esperan tu orden."; when Codex is ≥90 %
   at start, "Relevo a Codex: armado (Codex al N %, solo actuará si se renueva antes)".
3. Last line: **"Puedes irte. Te aviso si algo necesita tu firma; el informe estará en Mission Control
   y aquí."**, or "No necesito nada de ti." when there are no questions.

The session also requests keep-awake (Desktop `request_keep_awake`; `drive` runs `caffeinate`) and
warns to keep the Mac plugged in with the lid open.

**Questions and answers (D19).**
- Ids: `q-<check id>` (first-minute asks), `<doubt id>` (parks), `g-<unit>` (gates). A question is
  `{id, text_es, default_es, default_action, affects: all | frds[] | wos[], reversible}`.
- Units in `affects` of an open question carry `pending_answer` and are dispatched last: on the default
  when `reversible`, parked `owner_question` when not. An answer arriving later (chat or
  `/pandacorp:decide`) is recorded with `answer` and applied.
- Gate questions `money|delete|external` are answered with `answer`; `production` is answered only by
  the owner's chat order (BUILD-13).
- Defaults: exclude before include; park before guessing when irreversible; paused run vs conversed
  scope → conversed first; giant → tranches of 2 FRDs; `draft` card → built as completed; version scale
  → not built. Anything that only appears after the plan (an env var a WO needs) is not asked: it
  follows the ladder, parks or waits at its gate.

**Doubt ladder (D20)** (a builder, reviewer or planner returns `status: "doubt"` with question, options
and its preferred one; the unit stays `reported` with its `doubt_id`):
0. **Sources, no consult:** card citations, FRD and ACs, blueprint, `docs/decision-log.md`, DRs in
   `factory/decisions/registry.yaml`, `factory/memory/INDEX.md`. If one answers, apply it with the
   citation. Under `drive` or a Codex app session this step is skipped and the consult brief tells the
   consultant to check the sources first.
1. **Consult 1, the other company at judgment level:** Claude-origin doubt → codex sol high;
   Codex-origin → claude opus high; under `drive` or in the Codex app → codex astra high. Context pack ≤1
   page: question, options, Dentro/Fuera with citations, ACs and affected files, the owner's priorities
   (precision > speed > quota), the never-decide list. Answer: option, confidence (high/medium/low),
   reason, reversible?
2. **Decide** when consult 1 matches the preferred option with confidence ≥ medium. Otherwise
   **consult 2** (tie-break) with the strongest model not yet consulted (opus xhigh or astra high); the
   option with 2 of 3 votes and confidence ≥ medium wins.
3. **Caps:** ≤3 consult calls per doubt; ≤8 consulted doubts per build; beyond that the doubt parks. A
   consult that returns no JSON counts as a low-confidence, irreversible non-answer: it counts toward the
   cap and the ladder advances.

**Never decided this way:** anything `irreversible` (BUILD-10 §Risk zone: r1, S5 or S8; decided by the
CLI, never by an LLM); widening scope beyond Dentro; **reducing or reinterpreting** a Dentro item;
product scope (PRD, epics); DRs with `requiere_humano: true`; human gates; spending money.

**Recording a decision:** a `docs/decision-log.md` entry marked "Decidido sin el owner" (question,
options, chosen, who advised with model/company/confidence, card, commit, how to revert), committed on
`lane/<run_id>`; a journal `autonomous_decision` event; one line under "Decidí sin ti (N)" in the final
report. "Revierte la decisión X" from the owner becomes a card.

**Park.** When nobody is sure: the unit and its `dependsOn` dependents park (`parked: owner_question`
in state and journal; no new WO frontmatter status); everything independent continues; the question goes
to `.pandacorp/inbox/decisions.md` as a CONV-20 card (on the integration branch if that file is
tracked), to the report header, and as a notification.
- **Root block:** when the parked unit drags more than 50 % of pending units through `dependsOn` and its
  preferred option is reversible, everything is built on that option on `lane/<run_id>/assume-<doubt>`
  with G3, **never landed** on its own (`parked: built_on_assumption`). The owner's answer through
  `answer`: equal to the option → the branch is merged into `lane/<run_id>` by the next integration and
  lands through the normal `land` (a launched project still waits for "aterriza"); otherwise the branch
  is discarded and the units are re-queued with the answer in their brief, consuming no attempt.
- Only when **all** remaining work depends on the answer does the run stop at a safe point
  (`waiting-owner`, the one case where nothing advances), saying so and notifying.

**Final report** opens with "Necesito de ti", "Decidí sin ti (N)", "Aparcado", the review totals (cross
vs degraded) and pending deferred reviews.

## Rule — human gates in the owner's absence (BUILD-13)

> Severity: **MUST** · Enforcement: `land` (merge-queue exit map, never sets the release variable), the git `pre-push` hook (`install-pre-push.mjs`), `merge-queue.sh` (DR-138), `block-dangerous.sh` (Claude side, unchanged). See DR-153, DR-138.

- A unit that reaches a human gate stops at it with `waiting_gate: production|money|delete|external`
  (a report with a non-null `gate`, or S8 or deploy reasons on the unit's diff); question `g-<unit>`;
  event `WaitingGate`; everything else continues. Everything before the gate is prepared (branch,
  reviewed script, message text) so the owner's OK is one word.
- Notification at that moment: in a session, Claude Code `PushNotification`; under `drive`, a macOS
  notification (`osascript`, off with `PANDACORP_NOTIFY=off`); always the Mission Control banner and the
  report header.
- **Landing (D2), integration → `main` only.** `land` runs only when the batch is complete (all
  non-parked units of the run, or of the tranche for giant). Inside its fenced phase 2, before spawning
  the merge-queue job, it rebases `lane/<run_id>` onto the current `main` and commits on it the
  **landing metadata commit**: WO `VERIFIED` for every review-verified unit (+ rollups), `status.yaml`
  `last_green_sha` (the code tip just below this commit), `safe_to_test: true`, `phase: implementation`
  if it was `architecture`, and the trailer `Change: <slug>` only when this landing completes the card.
  merge-queue's G3 judges that tree; red → nothing reaches `main`. After exit 0: archive the card idempotently (merge-queue's DR-147 reconciler may already have moved it to `done/`; then only `shipped_sha` is added), journal
  `batch_landed`; if `last_green_sha` is no longer an ancestor of the new `main` (merge-queue re-rebased
  because `main` moved), journal `pin_stale` and the next landing rewrites it (F12).
- **merge-queue exit map (D24):** 0 → landed; 10 → hand-back (rebase conflict); 11 → G3 red: a `patch`
  unit for the run (attempt +1); 12 → nothing to land, `busy_main`; 14 → nothing to land, `port_busy`
  (12 and 14 retried at the next safe point, never hand-backs); 13 → landed with a "push falló" note
  (only possible with the owner's order); 20 → nothing to land, `mq_precondition` (retried at the next safe point; a second consecutive 20 is an engine failure, BUILD-15); 21 → `waiting_gate: production`.
- **Launched project** = `status.yaml` `phase: release` and `deploy_target` not `internal` (the same test
  as `merge-queue.sh`). There, building on the branch needs no question and nothing is written on `main`
  (BUILD-7); landing is the production gate: exit 21 → `waiting_gate: production`, and the CLI **never
  sets `PANDACORP_OWNER_RELEASE_OK`**. Only the owner's chat order lands it, by re-running `land` with
  that variable. The "¿aterrizo?" question lists degraded reviews and pending deferred re-reviews.
- **pre-push hook (D29).** Untracked by design: `install-pre-push.mjs` writes a full copy of
  `plugin/templates/shared/.pandacorp/hooks/pre-push`, marked `# pandacorp-pre-push v1`, into
  `git rev-parse --git-path hooks`, chaining an existing foreign hook as `pre-push.pandacorp-chained`. If
  `core.hooksPath` points inside the work tree (a tracked hooks dir such as husky) it refuses and the
  preflight asks the owner. In a launched project the hook rejects any push or delete of the default
  branch without `PANDACORP_OWNER_RELEASE_OK=1`; an unreadable `status.yaml` with the default branch as
  target is rejected (fail-closed). It is installed by `start --run` in a launched project before its
  first v2 run, and by `/pandacorp:upgrade` in every project from 10.0.0. The variable is not a secret: it
  stops an unprompted push, not a deliberate bypass; briefs forbid setting it; only the owner's chat order
  sets it. `drive` is never armed in a launched project without a verified hook.
- No rule in this file, no default and no autonomous decision may cross a human gate.

## Rule — the `drive` relay (BUILD-14)

> Severity: **MUST** · Enforcement: `drive.mjs` + `build-state.mjs` `transfer` (epoch fencing), `next` (handoff decided in the CLI). See DR-153, DR-133.

`pandacorp-build drive` is a Node process of the same CLI, **with no LLM of its own and never calling
Claude** (LESSON-0501). It reuses `next`, `codex-worker.mjs` (workers in their own process group), the
deterministic steps and the Codex quota reader.

- **Arming (D10).** `start --run` (and `start --resume`) arms `drive` in standby whenever
  `codex login status` is OK and, in a launched project, the pre-push hook is verified (spawned detached
  and unref'd; no `setsid` on macOS; `caffeinate -i -w <pid>`). Codex quota is **not** checked at arming.
  When it cannot be armed, the first-minute message says why.
- **Triggers** (polled every 30 s): (a) `build/handoff.json`, written by the session when `next`
  returned `handoff`; (b) `classifyLimitText` matches in the run's report or worker output
  (`units/*/report.json`, `.pandacorp/run/codex-workers/<id>/last.md`) or in an optional coordinator
  transcript (not verified); (c) no lease renewal for `drive_silent_s` (1800 s) AND pending work AND the last
  Claude reading ≥85 % or unknown. Standby exits when the run's state is no longer `active`.
- **Takeover.** At a trigger `drive` re-reads Codex quota. ≥90 %: `transfer`, then stop at
  `paused-quota` with both `resets_at` (lease released). Otherwise: `transfer` with coordinator `drive`
  (same `run_id`, epoch+1, new token file, no quiesce, running Codex workers kept, no owner confirmation:
  it is the same build) and run the loop; journal `drive_takeover`; notification. The old session is
  fenced (exit 3) and stays an observer.
- **Loop:** `next` (all builders codex; reviews per BUILD-10, Claude counted as out) → launch workers and
  jobs → harvest → `report` / `review-record` / `land` → renew the lease each iteration. Doubts: sources
  skipped, consult astra high, then park. Security audit: not run, queued as a deferred review for claude
  opus high. Gates: `waiting_gate` + macOS notification. `drive` never spawns a `land` while a land job is
  alive.
- **Stops:** Codex ≥90 % → `paused-quota` at a safe point; engine failure → BUILD-15; all done → `finish`.
- **Resume and return to Claude (D32).** `start --resume` accepts a `paused`, `waiting_owner`,
  `waiting_gate` or `stopped` run: lease present → `transfer` back to the caller immediately (epoch+1);
  absent → `acquire`; units whose worker or job pid is alive are re-attached, the others re-queued; `drive`
  is re-armed. A running `drive` gets exit 3 at its next phase 2 and exits. Only a stale lease held by a `session` coordinator of the other runtime needs `--owner-confirmed`; a lease held by `drive` (fresh or stale, e.g. after `kill -9`) is transferred back without it. `start --resume` names the new coordinator (`--coordinator claude|codex`). Accepted consequence: if Codex runs out during the relay the build waits for
  the owner even if Claude has renewed (automatic return: phase D).
- Log: `build/drive/drive.log`, rotated at 5 MB. `--handoff-after N` exists for tests only.

## Rule — failure policy (BUILD-15)

> Severity: **MUST** · Enforcement: `failure.mjs` (attempt budget, evidence identity check, env-infra streak, engine-failure stop), `report` (queues attempt 3 automatically), the journal. See DR-150, DR-103.

**Per unit: at most 3 executions (D21).**
1. Build.
2. A **fresh** patch agent (never the resumed builder) with the reviewer's RED tests and probes and ≤2
   internal fix cycles; bounded or unbounded per BUILD-10. Branch `lane/<run_id>/<unit>-a2`.
3. Escalation, **queued automatically by the CLI** (there is no `escalate` command), only with new
   evidence: {failing test ids and command of the CLI's own G1/G2 re-run, implicated files of the diff}
   plus the report's `diagnosis` (cause ∈ `code`, `test-defective`, `spec-ambiguous`, `env-infra`,
   `dependency`). Evidence identical to attempt 2 → hand-back.

No automatic revert-and-rebuild, no split gate, no automatic "next pass". Fable is never chosen.

- `spec-ambiguous` and a missing decision enter the doubt ladder (BUILD-12), not a hand-back.
- **Immediate hand-back** = the unit and its dependents park; independent units continue. Causes:
  `test-defective` still disputed after one reviewer reply; a `dependency` on a missing secret or account;
  a human gate; the 3-execution budget exhausted. The hand-back writes `handback/<unit>.md` (unit, WO
  `BLOCKED` + `blocked_reason` committed on the integration branch, attempt, cause, failing command with
  its last 40 lines, each attempt's evidence, diagnosis, what is preserved, numbered options with the
  recommended one), a `pending` entry in `.pandacorp/inbox/decisions.md` and a chat notice (DR-099).
- **Three consecutive `env-infra` hand-backs** stop the run at a safe point.

**Always preserved:** unit commits (a revert is the owner's call), the `lane/<run_id>/<unit>-a<n>`
branches (no stash), RED tests and probes, the journal, registered worktrees.

**Engine failure** (a fault of the CLI, not of the product): retry the step once after `rebuild-state`;
if it repeats, stop at the last safe point, exit 8, release the lease, write `handback/engine.md`, open the
next free `factory/backlog/BL-NNNN` (DR-103), emit `engine_failure`. It consumes no unit attempt and never
offers another engine. Owner message: "El motor nuevo se ha parado por un fallo suyo, no de tu app. Tu
trabajo está a salvo en la rama `lane/<run_id>` (N WOs hechas). Para seguir: en la fábrica di 'arregla
BL-NNNN'; luego aquí, `/pandacorp:implement --resume`."
- **Fix and continue:** fixed in the factory on its `main` (never in the build's worktree), PATCH or
  MINOR, plugin update, new session; `--resume` continues the **same** `run_id`.
- **State compatibility:** `state.json` and every journal line carry a schema version; a PATCH or MINOR
  always reads the previous version's journal (previous-version fixtures in the suite); an incompatible
  state makes `--resume` run `rebuild-state`, losing at most the unit in flight.
- After 3 engine failures in one build the message adds one informative line ("si lo consideras un
  desastre, dilo y se aplica el regreso").
- **Run status and terminal actions (D32).** `next` returns a terminal action only when nothing of the run is running. First match: both ≥90 % → `paused-quota`; `L == 4` >10 min → `paused-infra`; 3 consecutive `env-infra` hand-backs → `stop`; everything landed or handed back → `done` (then `finish`); everything left waits on an owner answer or a gate → `waiting-owner` (status `waiting_gate` if only gates); queued work with no planner progress → `deadlock`; other no-progress → `stop`. A non-`done` terminal action arrives applied (status, journal, lease released); the session only reports. `finish` accepts any non-active status; `finish` with only `waiting_gate` units left releases the lease and leaves the run `waiting_gate`.

## Gates G0..G4 (D7)

| Gate | When | Content | Certifies |
|---|---|---|---|
| G0 | every session turn (Stop hook, DR-146) | `verify.sh --light` + the session's own tests | nothing |
| G1 | per unit, synchronous inside `report` (outside the mutex) | `bash .pandacorp/verify.sh --light --tests=<test files among the reported files>` in the unit worktree; no e2e | nothing (the CLI re-runs it: "un hecho es un reporte") |
| G2 | per FRD, once all its units are integrated | detached job `bash .pandacorp/verify.sh --since <integration base sha>` in the integration worktree, holding an H slot; red → a `patch` unit for that FRD (attempt +1); green → the FRD's review unit is scheduled | nothing |
| G3 | per landing batch on `main` | merge-queue's full `verify.sh` once per tree (green-stamp) | the tree |
| G4 | per version, before `/pandacorp:release` | G3 + responsive + visual + production smoke + **mutation on floor modules only** + approved telemetry | the release |

- **`main` only receives trees with G3 green** (true by construction: BUILD-7 one path to `main`).
  merge-queue refreshes its lock while the gate runs.
- WO status, all on the integration branch: `IN_PROGRESS` at dispatch; `IN_REVIEW` when the chain is
  integrated; a patch after a review moves `IN_REVIEW → PLANNED → IN_PROGRESS` and bumps `reopen_count`;
  `BLOCKED` with `blocked_reason` on hand-back; **`VERIFIED` only in the landing metadata commit**, judged
  by G3 (DR-097 amended). No new status values. `last_green_sha` and `safe_to_test` reach `main` only with
  that commit.
- Engine test obligations: existing tests reached by the change always; ≤1 new behaviour spec per new or
  changed main flow; ≤5 cases per module for branching logic; tests-first units in the risk zone and for
  bug cards (BUILD-10); the e2e budget per project is ≤10 min of Playwright, beyond it the CLI opens an
  "e2e debt" card and never deletes tests itself.

## Mission Control telemetry contract

The CLI is Mission Control's only build producer; it never changes a reader's input type.

| Surface | What the CLI writes | Reader constraint |
|---|---|---|
| `status.yaml` | nothing on `main` during a run; `last_green_sha`, `safe_to_test` and `phase` arrive with the landing metadata commit. v2 never writes `running` nor a per-tick `supervisor_heartbeat` | key types unchanged |
| `build.lease/lease.json` | valid `renewed_at` (ISO) and `ttl_seconds` 1800, renewed by every coordinator command | Mission Control's `isLive` treats a lease renewed within its own ttl as live without `running: true` (task D06, effective at 9.155.0); any other lease shape blanks its status |
| Events (`event-transport.mjs`, emitter runtime = the coordinator's company) | always `project = basename(project root)`; existing `BuildLaunch`, `AgentWorking`/`AgentDone` (`role, model, unit, result green\|red`), `wo_commit` (legacy name, emitted by `report`), `GateVerdict{frd, verdict}`, `BuildComplete`, `BuildStopped`, `worker_started/stopped`; new vocabulary entries `review.recorded`, `quota.reading`, `engine.failure`, `autonomous.decision`, `build.handoff`, `build.waiting-gate`, `unit.parked`, `admit.decision`. No `build_usable` | unknown names display as `legacy.*`, so every new name is in `event-vocabulary.json` before it is emitted |
| `track.jsonl` (written only on the integration branch, reaches `main` with the landing) | `{kind:"wo_start",frd,wo,at}`, `{kind:"wo_end",frd,wo,at,state:in_review\|verified\|failed}`, `{kind:"review_start",frd,at}`, `{kind:"review_end",frd,at,verdict:pass\|reject}`, `{kind:"frd_end",frd,at}` | unknown kinds skipped |
| Branches | `lane/<run_id>`, `lane/<run_id>/<unit>-a<n>`, `lane/<run_id>/assume-<doubt>` | `lane/` is classified as engine-origin |
| WO frontmatter, cards | statuses stay in their existing enums; new card fields (`engine`, `run_id`, `docs_sha`, `origin`) are optional | a new status token is a reader error |

Admission decisions are journal + event only, never `track.jsonl`. Other Mission Control `running`
readers (portfolio columns, the Resumen badge) and board progress during a run are deferred (F11).

## Constants (single list; change only through a DR)

| Constant | Value | Rule |
|---|---|---|
| Quota stop / handoff | 90 % / 95 % (or `usage_limit` = 100 %) | BUILD-11 |
| Codex reading probe | age >1 h and ≥70 % | BUILD-11 |
| Claude reading freshness | 10 min | BUILD-11 |
| `rate_limit` retry | once after 60 s, then `K_reactivo −1` | BUILD-11 |
| `lease_ttl_s` | 1800 | BUILD-7 |
| `drive_silent_s` (trigger c) | 1800 | BUILD-14 |
| `drive_trigger_c_min_pct` | 85 | BUILD-14 |
| `drive_poll_s` | 30 | BUILD-14 |
| `next --wait` maximum | 300 s | BUILD-7 |
| Preflight reuse | ≤15 min, same row and scope | BUILD-12 |
| Doubt caps | 3 calls per doubt, 8 doubts per build | BUILD-12 |
| Root block | >50 % of pending units | BUILD-12 |
| Sizes | touch 0-1 WO; feature 2-15 WOs or 1-4 FRDs; giant >4 FRDs or >15 WOs; tranche 2 FRDs | BUILD-9 |
| Chain length | ≤3 WOs | BUILD-9 |
| Touch review budget | ≤10 calls | BUILD-10 |
| Probe budget | 1 per finding + ≤3 more per FRD | BUILD-10 |
| Bounded patch | ≤30 lines, off-floor, with a test | BUILD-10 |
| Admission | `K_TECHO` 2; floor 2; veto → 1 + 1; `COLCHON` 3 GiB (never <1); `c_b` 1.5 GiB; `c_tool` 1.2 GiB; `c_h` 3.5 GiB; Codex worker +0.35 GiB; hysteresis band 0.5 GiB; reviewer sub-cap 2; `H_max` max(1, min(2, floor(ncpu/4))); `L == 4` pause >10 min → `paused-infra` | BUILD-9 |
| Executions per unit | 3 | BUILD-15 |
| `env-infra` hand-back streak | 3 | BUILD-15 |
| Engine failures before the extra line | 3 | BUILD-15 |
| First minute | CLI ≤60 s | BUILD-12 |
| e2e budget | ≤10 min Playwright per project | §Gates |

## Deferred

Not owner-decided; each is documented here and in the DR-150 nota. The data the deferred
measurements need keeps being recorded.

| # | Feature | Reason | Target |
|---|---|---|---|
| F1 | Shadow review sampling 1 in 10 | needs both companies below 70 % (not true at today's Codex usage); measurement only, non-blocking; `review_recorded` and `Unit:` trailers are kept | phase D |
| F2 | Escape-attribution report (escapes per reviewer model) | data kept; computation and display belong to Mission Control later | phase D / MC |
| F3 | `calibrate`, a host calibration file, Jetsam autocorrection, ceiling 3 | phase D (h1-h3); the ceiling stays 2 with fixed constants | phase D |
| F4 | `--budget <$-eq>` | needs `usage-rollup.mjs` adapted to v2 transcripts; quota thresholds already guard usage | later MINOR |
| F5 | G1 e2e in a heavy queue | e2e runs per FRD in G2 and in G3 | removed |
| F6 | Detached heartbeat process | replaced by renew-per-command + ttl 1800 | removed |
| F7 | Public `escalate` command | attempt 3 is automatic | removed |
| F8 | `drift-proof.mjs` differential for bug cards | replaced by the tests-first unit | replaced |
| F9 | Risk rules R4-R10 (filesystem-destructive, sensitive identifiers, size as zone) | covered by S8 and the product floor; size and reopen act through routing | retired |
| F10 | PreToolUse hook on `Agent` for admission tokens | not verified; detection at `report` is enough | phase D |
| F11 | Mission Control: full Manual rewrite, build-mode picker redesign, `running` readers other than `isLive`, board progress during a run | behaviour changes beyond liveness and buttons are not part of the design; buttons keep working | MC change after 10.0.0 |
| F12 | Fix for the `last_green_sha` pin race | rare (`main` must move during a landing); journaled `pin_stale`, healed by the next landing | later |
| F13 | `yield-request` file | replaced by the immediate transfer of `start --resume` | removed |

## How it is verified

- **BUILD-7 (entry, detection, one writer):** `node plugin/scripts/test-build-v2-detect.mjs` (each row; paused run plus card; `source_change` exclusion; label precedence; legacy words; card reference forms), `test-build-v2-state.mjs` (hash chain, per-run archive, `rebuild-state` idempotent, frontmatter wins), `test-build-v2-cli.mjs` (exit 3 on a stale epoch; one JSON line on stdout), `test-build-v2-next.mjs` (never drains the queue; never returns a unit outside scope; `--wait` early returns), `node plugin/scripts/test-build-state-handoff.mjs` (`transfer`, `forceRelease`, no status projection), `test-build-v2-e2e.mjs` (no tracked file of the main checkout changes until merge-queue lands).
- **BUILD-8 (card, docs before):** `test-build-v2-detect.mjs` (`card check`, Mission Control enum, `obsolete` read alias), `test-build-v2-report.mjs` (own commit, `Unit:`/`WO:` trailers, files outside `artifacts`, snapshots, WO frontmatter edits and hashed-file changes rejected), `test-build-v2-land.mjs` (`Change:` only on the landing metadata commit; card to `done/`); citation fidelity to the conversation is review-only (no machine can check it).
- **BUILD-9 (sizes, planner, admission):** `test-build-v2-planner.mjs` (cyclic-FRD/acyclic-WO graph, barrier + wide DAG, literal-prefix overlap, out-of-scope never planned, chain cut, deadlock), `test-build-v2-admission.mjs` (signal fixtures: clean, warn, critical, swap rising, garbled → safe mode; `motivo_limite`; host slots; never kills; `admit` read-only), `test-build-v2-report.mjs` (tokenless unit rejected), `test-build-v2-jobs.mjs` (detached jobs, H slot, adoption by the epoch holder), `bash plugin/scripts/test-merge-queue-lock-refresh.sh` (lock refresh + host H slot).
- **BUILD-10 (routing, single reviewer, risk zone):** `test-build-v2-routing.mjs` (every builder row, all 16 matrix rows × availability {ok, quota, unreachable, at_capacity}, N7 only on quota, unreachable N7 cells park, row 8 haiku/fable, `drive` labels `quota_90`, no-repeat raises effort only, exhaustive guard that Fable and `max` are never emitted), `test-build-v2-review.mjs` (degraded marking, deferred lifecycle, probe commits and hashes, `blocked` → hand-back), `test-build-v2-risk.mjs` (zone mapping, `irreversible`, `audit`, fail-closed, `unclassified`), `test-build-v2-risk-backtest.mjs` (CI-only, `package.json`-only, `plugin/**`-only and query-only diffs give `floor`; a login diff gives `r1`; 0 false negatives on the known set; the owner-labelled sample is pending owner time).
- **BUILD-11 (quota):** `test-build-v2-quota.mjs` (rollout fixtures 98 %, stale, malformed, primary/secondary max, epoch-to-ISO `resets_at`, `usage_limit` recorded as 100 %, `rate_limit` retry; `policy()` table), `test-build-v2-next.mjs` (95 % → `handoff` with the lease kept; both ≥90 % → `paused-quota` with the lease released).
- **BUILD-12 (autonomy):** `test-build-v2-preflight.mjs` (every question type appears with its default; `preflight.json` reuse; ≤60 s on a Mission-Control-shaped fixture), `test-build-v2-doubts.mjs` (ladder, sources skipped under drive, caps 3/8, no-JSON consult, never-decide list, deterministic veto, decision-log and `decisions.md` writers incl. the tracked-path rule, >50 % root rule), `test-build-v2-answer.mjs` (kinds ask/parked/gate, assumption accepted/discarded, `pending_answer` effects), `test-build-v2-next.mjs` (`pending_answer` last). The owner-perceived first minute (including the card turn) is measured in the first real use; review-only until then.
- **BUILD-13 (human gates, landing):** `bash plugin/scripts/test-pre-push.sh` (launched/internal, default/other branch, delete, env OK, chaining, tracked `core.hooksPath` refused, unreadable status), `test-build-v2-land.mjs` (landing metadata commit contents, every merge-queue exit mapped, exit 21 → `waiting_gate` with the release variable never set, `pin_stale`), `test-build-v2-e2e.mjs` (a fake worker's `git push` to `main` is rejected); existing `test-merge-queue-release-gate.sh` and `test-block-dangerous.sh` stay green.
- **BUILD-14 (drive):** `test-build-v2-drive.mjs` (arming without a quota check, triggers a/b/c with fixture clocks, quota re-check at takeover, takeover fences the session, `kill -9` mid-unit + `--resume`, return by `start --resume`, audit deferred, `paused-quota`), `test-build-v2-workers.mjs` (`codex-worker.mjs run --direct` polling, limit classification), `test-build-state-handoff.mjs`, `test-build-v2-e2e.mjs`. Not verifiable without real runs (stated, not claimed): the real loop with `codex exec`, long-lived Codex auth in a detached process, surviving a Desktop app close, sleep and lid behaviour, notifications reaching the owner.
- **BUILD-15 (failure):** `test-build-v2-failure.mjs` (3-execution budget, automatic attempt 3, identical evidence → hand-back, hand-back parks dependents, 3 consecutive `env-infra` stop, engine failure: safe-point stop, exit 8, `handback/engine.md`, a BL file valid for `validate-backlog.sh`, Spanish message), `test-build-v2-integrate.mjs` (chain integration, WO transitions on the integration branch, patch path `IN_REVIEW → PLANNED → IN_PROGRESS`), `test-build-v2-e2e.mjs`.
- **Gates and telemetry:** `test-build-v2-integrate.mjs` (G2 job spawned per fully integrated FRD), `test-build-v2-land.mjs` (`VERIFIED` and `last_green_sha` only in the landing metadata commit), `test-build-v2-telemetry.mjs` + Mission Control `src/lib/build-track/_tests/engine-v2-contract.test.ts` (CLI-produced lines parsed by the real `build-track.ts`, `events.ts` and the lease reader), Mission Control `src/lib/status/_tests/{liveness,lease-liveness}.test.ts` (lease-only liveness, task D06), `bash plugin/scripts/check-derived-drift.sh` Check 7 (event vocabulary projected into Mission Control).
- **End to end:** `node plugin/scripts/test-build-v2-e2e.mjs` on the 4-WO fixture with fake workers, 0 manual state edits; the whole family runs in `bash plugin/scripts/run-engine-tests.sh` and the CI workflow `factory-engine-tests.yml`.
- **This file's shape:** `bash factory/standards/check-standards.sh`; consistency with its decisions is checked by the independent reviewer at each release point.

## Why

The default engine spent its time and quota in fixed costs (relays, an opus planner, double gates)
and needed the owner at the keyboard. Moving every deterministic decision into a fenced CLI makes a
build resumable from disk, portable across runtimes and observable, and lets the owner say
"impleméntalo" and leave: questions are front-loaded, later doubts are consulted or parked, and the
only stops are human gates. Keeping every tracked write on one integration branch makes merge-queue
the single, G3-gated path to `main` in every project. One cross-company reviewer replaces double review
in exchange for quota and simplicity (an accepted risk, measured later through escapes); human gates,
G3 before `main` and the irreversibility veto are what keep that trade safe.
